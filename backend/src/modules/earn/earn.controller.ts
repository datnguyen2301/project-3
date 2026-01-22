import { Response } from 'express';
import prisma from '../../config/database';
import { successResponse, AppError } from '../../common/utils/response.utils';
import { AuthRequest } from '../../common/middlewares/auth.middleware';
import { decimalToNumber, toNumber } from '../../common/utils/decimal.utils';
import logger from '../../config/logger';
import { Decimal } from '@prisma/client/runtime/library';

export class EarnController {
  /**
   * Get all available earn products
   */
  async getProducts(req: AuthRequest, res: Response) {
    try {
      const { type } = req.query; // FLEXIBLE or LOCKED

      const where: any = { isActive: true };
      if (type) {
        where.type = type;
      }

      const products = await prisma.earnProduct.findMany({
        where,
        orderBy: [{ type: 'asc' }, { apy: 'desc' }],
      });

      const formattedProducts = products.map((product) => ({
        id: product.id,
        symbol: product.symbol,
        name: product.name,
        type: product.type,
        apy: decimalToNumber(product.apy),
        durationDays: product.durationDays,
        minAmount: decimalToNumber(product.minAmount),
        maxAmount: product.maxAmount ? decimalToNumber(product.maxAmount) : null,
        totalCapacity: product.totalCapacity ? decimalToNumber(product.totalCapacity) : null,
        totalStaked: decimalToNumber(product.totalStaked),
        available: product.totalCapacity 
          ? toNumber(product.totalCapacity) - toNumber(product.totalStaked)
          : null,
        riskLevel: product.riskLevel,
        description: product.description,
        terms: product.terms,
      }));

      return successResponse(res, { products: formattedProducts });
    } catch (error) {
      logger.error('Get earn products error:', error);
      throw new AppError('GEN_004', 'Failed to get earn products', 500);
    }
  }

  /**
   * Stake into an earn product
   */
  async stake(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { productId, amount } = req.body;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      // Get product details
      const product = await prisma.earnProduct.findUnique({
        where: { id: productId },
      });

      if (!product || !product.isActive) {
        throw new AppError('EARN_001', 'Product not found or inactive', 404);
      }

      const stakeAmount = new Decimal(amount);

      // Validate amount
      if (stakeAmount.lessThan(product.minAmount)) {
        throw new AppError(
          'EARN_002',
          `Minimum stake amount is ${product.minAmount} ${product.symbol}`,
          400
        );
      }

      if (product.maxAmount && stakeAmount.greaterThan(product.maxAmount)) {
        throw new AppError(
          'EARN_003',
          `Maximum stake amount is ${product.maxAmount} ${product.symbol}`,
          400
        );
      }

      // Check capacity
      if (product.totalCapacity) {
        const available = product.totalCapacity.minus(product.totalStaked);
        if (stakeAmount.greaterThan(available)) {
          throw new AppError('EARN_004', 'Insufficient capacity available', 400);
        }
      }

      // Check user balance
      const wallet = await prisma.walletBalance.findUnique({
        where: {
          userId_symbol: {
            userId,
            symbol: product.symbol,
          },
        },
      });

      if (!wallet || wallet.available.lessThan(stakeAmount)) {
        throw new AppError('EARN_005', 'Insufficient balance', 400);
      }

      // Calculate end date for locked products
      const startDate = new Date();
      let endDate: Date | null = null;
      if (product.type === 'LOCKED' && product.durationDays) {
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + product.durationDays);
      }

      // Create stake transaction
      const stake = await prisma.$transaction(async (tx) => {
        // Lock funds in wallet
        await tx.walletBalance.update({
          where: {
            userId_symbol: {
              userId,
              symbol: product.symbol,
            },
          },
          data: {
            available: wallet.available.minus(stakeAmount),
            locked: wallet.locked.plus(stakeAmount),
          },
        });

        // Update product total staked
        await tx.earnProduct.update({
          where: { id: productId },
          data: {
            totalStaked: product.totalStaked.plus(stakeAmount),
          },
        });

        // Create stake record
        const newStake = await tx.userStake.create({
          data: {
            userId,
            productId,
            symbol: product.symbol,
            amount: stakeAmount,
            apy: product.apy,
            startDate,
            endDate,
            status: 'ACTIVE',
          },
        });

        return newStake;
      });

      return successResponse(res, {
        stake: {
          id: stake.id,
          symbol: stake.symbol,
          amount: decimalToNumber(stake.amount),
          apy: decimalToNumber(stake.apy),
          startDate: stake.startDate,
          endDate: stake.endDate,
          status: stake.status,
        },
        message: 'Staked successfully',
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Stake error:', error);
      throw new AppError('GEN_004', 'Failed to stake', 500);
    }
  }

  /**
   * Unstake from earn product
   */
  async unstake(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { stakeId } = req.params;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      // Get stake details
      const stake = await prisma.userStake.findFirst({
        where: {
          id: stakeId,
          userId,
        },
        include: { product: true },
      });

      if (!stake) {
        throw new AppError('EARN_006', 'Stake not found', 404);
      }

      if (stake.status !== 'ACTIVE') {
        throw new AppError('EARN_007', 'Stake is not active', 400);
      }

      // Check if locked stake has matured
      if (stake.product.type === 'LOCKED') {
        if (stake.endDate && new Date() < stake.endDate) {
          throw new AppError(
            'EARN_008',
            `Locked stake cannot be withdrawn before ${stake.endDate.toISOString().split('T')[0]}`,
            400
          );
        }
      }

      // Calculate rewards
      const rewards = await this.calculateRewards(stake);

      // Process unstake
      const result = await prisma.$transaction(async (tx) => {
        // Update stake status
        await tx.userStake.update({
          where: { id: stakeId },
          data: {
            status: 'COMPLETED',
            accumulatedRewards: stake.accumulatedRewards.plus(rewards),
          },
        });

        // Get wallet
        const wallet = await tx.walletBalance.findUnique({
          where: {
            userId_symbol: {
              userId,
              symbol: stake.symbol,
            },
          },
        });

        if (!wallet) {
          throw new AppError('WALLET_001', 'Wallet not found', 404);
        }

        // Return principal + rewards to wallet
        const totalReturn = stake.amount.plus(rewards);
        await tx.walletBalance.update({
          where: {
            userId_symbol: {
              userId,
              symbol: stake.symbol,
            },
          },
          data: {
            available: wallet.available.plus(totalReturn),
            locked: wallet.locked.minus(stake.amount),
          },
        });

        // Update product total staked
        await tx.earnProduct.update({
          where: { id: stake.productId },
          data: {
            totalStaked: stake.product.totalStaked.minus(stake.amount),
          },
        });

        // Record reward
        if (rewards.greaterThan(0)) {
          await tx.earnReward.create({
            data: {
              stakeId,
              userId,
              symbol: stake.symbol,
              amount: rewards,
              apy: stake.apy,
              rewardDate: new Date(),
            },
          });
        }

        return { principal: stake.amount, rewards, totalReturn };
      });

      return successResponse(res, {
        message: 'Unstaked successfully',
        principal: decimalToNumber(result.principal),
        rewards: decimalToNumber(result.rewards),
        total: decimalToNumber(result.totalReturn),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Unstake error:', error);
      throw new AppError('GEN_004', 'Failed to unstake', 500);
    }
  }

  /**
   * Get user's active stakes
   */
  async getMyStakes(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const stakes = await prisma.userStake.findMany({
        where: { userId },
        include: { product: true },
        orderBy: { createdAt: 'desc' },
      });

      const formattedStakes = await Promise.all(
        stakes.map(async (stake) => {
          const rewards = stake.status === 'ACTIVE' 
            ? await this.calculateRewards(stake)
            : new Decimal(0);

          return {
            id: stake.id,
            productId: stake.productId,
            productName: stake.product.name,
            symbol: stake.symbol,
            type: stake.product.type,
            amount: decimalToNumber(stake.amount),
            apy: decimalToNumber(stake.apy),
            startDate: stake.startDate,
            endDate: stake.endDate,
            status: stake.status,
            estimatedRewards: decimalToNumber(rewards),
            accumulatedRewards: decimalToNumber(stake.accumulatedRewards),
            daysRemaining: stake.endDate 
              ? Math.max(0, Math.ceil((stake.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
              : null,
          };
        })
      );

      const totalStaked = formattedStakes
        .filter((s) => s.status === 'ACTIVE')
        .reduce((sum, s) => sum + parseFloat(s.amount), 0);

      const totalRewards = formattedStakes
        .filter((s) => s.status === 'ACTIVE')
        .reduce((sum, s) => sum + parseFloat(s.estimatedRewards), 0);

      return successResponse(res, {
        stakes: formattedStakes,
        summary: {
          totalStaked,
          totalRewards,
          activeCount: formattedStakes.filter((s) => s.status === 'ACTIVE').length,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get my stakes error:', error);
      throw new AppError('GEN_004', 'Failed to get stakes', 500);
    }
  }

  /**
   * Get reward history
   */
  async getRewards(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const rewards = await prisma.earnReward.findMany({
        where: { userId },
        include: {
          stake: {
            include: { product: true },
          },
        },
        orderBy: { rewardDate: 'desc' },
      });

      const formattedRewards = rewards.map((reward) => ({
        id: reward.id,
        productName: reward.stake.product.name,
        symbol: reward.symbol,
        amount: decimalToNumber(reward.amount),
        apy: reward.apy ? decimalToNumber(reward.apy) : null,
        date: reward.rewardDate,
      }));

      const totalRewards = formattedRewards.reduce((sum, r) => sum + parseFloat(r.amount), 0);

      return successResponse(res, {
        rewards: formattedRewards,
        totalRewards,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get rewards error:', error);
      throw new AppError('GEN_004', 'Failed to get rewards', 500);
    }
  }

  /**
   * Calculate current rewards for a stake
   */
  private async calculateRewards(stake: any): Promise<Decimal> {
    const now = new Date();
    const startDate = stake.lastRewardDate || stake.startDate;
    const daysStaked = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

    // APY is annual, so rewards = principal * (APY / 100) * (days / 365)
    const rewards = stake.amount
      .mul(stake.apy)
      .div(100)
      .mul(daysStaked)
      .div(365);

    return rewards;
  }
}
