import { Response } from 'express';
import prisma from '../../config/database';
import { successResponse, AppError } from '../../common/utils/response.utils';
import { AuthRequest } from '../../common/middlewares/auth.middleware';
import logger from '../../config/logger';
import { Decimal } from '@prisma/client/runtime/library';

export class MarginController {
  /**
   * Get margin account info
   */
  async getMarginAccount(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      // Get wallet balances (used as collateral)
      const balances = await prisma.walletBalance.findMany({
        where: { userId },
      });

      // Calculate total collateral value in USDT
      let totalCollateral = 0;
      balances.forEach(balance => {
        // Simplified: assume 1:1 for USDT, need price conversion for other assets
        if (balance.symbol === 'USDT') {
          totalCollateral += parseFloat(balance.available.toString());
        }
      });

      // Get active loans (simplified - using wallet transactions as placeholder)
      // In production, you'd have a dedicated MarginLoan table
      const borrowed = 0; // TODO: Calculate from loan records
      const maxBorrow = totalCollateral * 5; // 5x max leverage

      return successResponse(res, {
        totalCollateral,
        borrowed,
        available: maxBorrow - borrowed,
        marginLevel: borrowed > 0 ? (totalCollateral / borrowed) * 100 : 0,
        maxLeverage: 5,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get margin account error:', error);
      throw new AppError('GEN_004', 'Failed to get margin account', 500);
    }
  }

  /**
   * Borrow assets
   */
  async borrow(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { asset, amount } = req.body;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      // Check collateral and margin level
      // This is simplified - production needs comprehensive risk checks

      // Create loan record (simplified using wallet transaction)
      await prisma.walletTransaction.create({
        data: {
          userId,
          type: 'MARGIN_BORROW',
          symbol: asset,
          amount: new Decimal(amount),
          fee: new Decimal(0),
          status: 'COMPLETED',
        },
      });

      // Add borrowed amount to wallet
      await prisma.walletBalance.upsert({
        where: {
          userId_symbol: {
            userId,
            symbol: asset,
          },
        },
        update: {
          available: {
            increment: new Decimal(amount),
          },
        },
        create: {
          userId,
          symbol: asset,
          available: new Decimal(amount),
          locked: new Decimal(0),
        },
      });

      return successResponse(res, {
        message: `Borrowed ${amount} ${asset}`,
        amount,
        asset,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Borrow error:', error);
      throw new AppError('GEN_004', 'Failed to borrow', 500);
    }
  }

  /**
   * Repay loan
   */
  async repay(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { asset, amount } = req.body;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      // Check if user has sufficient balance
      const balance = await prisma.walletBalance.findUnique({
        where: {
          userId_symbol: {
            userId,
            symbol: asset,
          },
        },
      });

      if (!balance || parseFloat(balance.available.toString()) < amount) {
        throw new AppError('MARGIN_001', 'Insufficient balance to repay', 400);
      }

      // Deduct from wallet
      await prisma.walletBalance.update({
        where: {
          userId_symbol: {
            userId,
            symbol: asset,
          },
        },
        data: {
          available: {
            decrement: new Decimal(amount),
          },
        },
      });

      // Record repayment
      await prisma.walletTransaction.create({
        data: {
          userId,
          type: 'MARGIN_REPAY',
          symbol: asset,
          amount: new Decimal(amount),
          fee: new Decimal(0),
          status: 'COMPLETED',
        },
      });

      return successResponse(res, {
        message: `Repaid ${amount} ${asset}`,
        amount,
        asset,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Repay error:', error);
      throw new AppError('GEN_004', 'Failed to repay', 500);
    }
  }

  /**
   * Get loan history
   */
  async getLoanHistory(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const loans = await prisma.walletTransaction.findMany({
        where: {
          userId,
          type: {
            in: ['MARGIN_BORROW', 'MARGIN_REPAY'],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return successResponse(res, { loans });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get loan history error:', error);
      throw new AppError('GEN_004', 'Failed to get loan history', 500);
    }
  }

  /**
   * Create margin order (with leverage)
   */
  async createMarginOrder(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { symbol, side, type, amount, price, leverage } = req.body;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      // This is a simplified implementation
      // Production needs: position tracking, liquidation price calculation, risk management

      const effectiveAmount = amount * (leverage || 1);

      const order = await prisma.order.create({
        data: {
          userId,
          symbol,
          side,
          type,
          price: price ? new Decimal(price) : null,
          amount: new Decimal(effectiveAmount),
          status: 'OPEN',
          filledAmount: new Decimal(0),
          remainingAmount: new Decimal(effectiveAmount),
        },
      });

      return successResponse(res, {
        message: 'Margin order created',
        order,
        leverage: leverage || 1,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Create margin order error:', error);
      throw new AppError('GEN_004', 'Failed to create margin order', 500);
    }
  }

  /**
   * Get margin level (risk indicator)
   */
  async getMarginLevel(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      // Simplified calculation
      // Production needs real-time price updates and accurate position tracking

      const marginLevel = 250; // Example: 250% (healthy is > 130%)
      const liquidationPrice = 0; // Calculate based on positions
      const maintenanceMargin = 0;

      return successResponse(res, {
        marginLevel,
        liquidationPrice,
        maintenanceMargin,
        status: marginLevel > 150 ? 'HEALTHY' : marginLevel > 130 ? 'WARNING' : 'DANGER',
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get margin level error:', error);
      throw new AppError('GEN_004', 'Failed to get margin level', 500);
    }
  }
}
