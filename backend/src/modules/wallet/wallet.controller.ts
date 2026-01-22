import { Response } from 'express';
import prisma from '../../config/database';
import { successResponse, AppError } from '../../common/utils/response.utils';
import { AuthRequest } from '../../common/middlewares/auth.middleware';
import { formatPrice } from '../../common/utils/decimal.utils';
import logger from '../../config/logger';
import { Decimal } from '@prisma/client/runtime/library';

// Helper to format balance - removes trailing zeros
const formatBalance = (decimal: Decimal | null | undefined): string => {
  if (!decimal) return '0';
  return formatPrice(decimal);
};

export class WalletController {
  // Get all balances
  async getBalances(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;

      const balances = await prisma.walletBalance.findMany({
        where: { userId },
      });

      const formattedBalances = balances.map((balance: any) => ({
        symbol: balance.symbol,
        available: formatBalance(balance.available),
        locked: formatBalance(balance.locked),
        total: formatBalance(
          new Decimal(balance.available).plus(new Decimal(balance.locked))
        ),
      }));

      return successResponse(res, { balances: formattedBalances });
    } catch (error) {
      logger.error('Get balances error:', error);
      throw new AppError('GEN_004', 'Failed to get balances', 500);
    }
  }

  // Get single balance
  async getBalance(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { symbol } = req.params;

      const balance = await prisma.walletBalance.findUnique({
        where: {
          userId_symbol: {
            userId: userId!,
            symbol: symbol.toUpperCase(),
          },
        },
      });

      if (!balance) {
        return successResponse(res, {
          symbol: symbol.toUpperCase(),
          available: '0',
          locked: '0',
          total: '0',
        });
      }

      return successResponse(res, {
        symbol: balance.symbol,
        available: formatBalance(balance.available),
        locked: formatBalance(balance.locked),
        total: formatBalance(
          new Decimal(balance.available).plus(new Decimal(balance.locked))
        ),
      });
    } catch (error) {
      logger.error('Get balance error:', error);
      throw new AppError('GEN_004', 'Failed to get balance', 500);
    }
  }

  // Withdraw
  async withdraw(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { symbol, amount, address, network, memo } = req.body;

      // Check KYC status
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { kycStatus: true },
      });

      if (user?.kycStatus !== 'APPROVED') {
        throw new AppError('KYC_001', 'KYC verification required for withdrawals', 403);
      }

      // Check balance
      const balance = await prisma.walletBalance.findUnique({
        where: {
          userId_symbol: {
            userId: userId!,
            symbol: symbol.toUpperCase(),
          },
        },
      });

      if (!balance || new Decimal(balance.available).lessThan(amount)) {
        throw new AppError(
          'WALLET_001',
          'Insufficient balance for withdrawal',
          400,
          {
            required: amount,
            available: balance ? formatBalance(balance.available) : '0',
          }
        );
      }

      // Calculate fee (simplified - 0.5% or min 0.0001)
      const feePercent = 0.005;
      const fee = Math.max(amount * feePercent, 0.0001);
      const totalAmount = amount + fee;

      if (new Decimal(balance.available).lessThan(totalAmount)) {
        throw new AppError(
          'WALLET_001',
          'Insufficient balance including fees',
          400,
          {
            required: totalAmount,
            available: formatBalance(balance.available),
            fee,
          }
        );
      }

      // Create withdrawal transaction
      const transaction = await prisma.$transaction(async (tx: any) => {
        // Deduct from available balance
        await tx.walletBalance.update({
          where: {
            userId_symbol: {
              userId: userId!,
              symbol: symbol.toUpperCase(),
            },
          },
          data: {
            available: {
              decrement: totalAmount,
            },
          },
        });

        // Create transaction record
        const withdrawal = await tx.walletTransaction.create({
          data: {
            userId: userId!,
            type: 'WITHDRAW',
            symbol: symbol.toUpperCase(),
            amount: new Decimal(amount),
            fee: new Decimal(fee),
            status: 'PENDING',
            address,
            network,
            memo,
          },
        });

        return withdrawal;
      });

      return successResponse(
        res,
        {
          id: transaction.id,
          symbol: transaction.symbol,
          amount: formatBalance(transaction.amount),
          fee: formatBalance(transaction.fee),
          address: transaction.address,
          network: transaction.network,
          status: transaction.status,
          createdAt: transaction.createdAt,
        },
        201
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Withdraw error:', error);
      throw new AppError('GEN_004', 'Withdrawal failed', 500);
    }
  }

  // Get transactions
  async getTransactions(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { type, symbol, status, page = 1, limit = 20 } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const where: any = { userId };
      if (type) where.type = type;
      if (symbol) where.symbol = (symbol as string).toUpperCase();
      if (status) where.status = status;

      const [transactions, total] = await Promise.all([
        prisma.walletTransaction.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: Number(limit),
          skip,
        }),
        prisma.walletTransaction.count({ where }),
      ]);

      const formattedTransactions = transactions.map((tx: any) => ({
        id: tx.id,
        type: tx.type,
        symbol: tx.symbol,
        amount: formatBalance(tx.amount),
        fee: formatBalance(tx.fee),
        status: tx.status,
        txHash: tx.txHash,
        address: tx.address,
        network: tx.network,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
      }));

      return successResponse(res, {
        transactions: formattedTransactions,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error('Get transactions error:', error);
      throw new AppError('GEN_004', 'Failed to get transactions', 500);
    }
  }

  // Get deposit address
  async getDepositAddress(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { symbol } = req.params;
      const { network = 'BTC' } = req.query;

      // Check if address exists
      let depositAddress = await prisma.depositAddress.findUnique({
        where: {
          userId_symbol_network: {
            userId: userId!,
            symbol: symbol.toUpperCase(),
            network: network as string,
          },
        },
      });

      // If not exists, generate one (simplified - in production, use actual blockchain API)
      if (!depositAddress) {
        const address = `${symbol.toLowerCase()}_${userId?.substring(0, 8)}_${Date.now()}`;

        depositAddress = await prisma.depositAddress.create({
          data: {
            userId: userId!,
            symbol: symbol.toUpperCase(),
            network: network as string,
            address,
          },
        });
      }

      return successResponse(res, {
        symbol: depositAddress.symbol,
        address: depositAddress.address,
        network: depositAddress.network,
        memo: depositAddress.memo,
      });
    } catch (error) {
      logger.error('Get deposit address error:', error);
      throw new AppError('GEN_004', 'Failed to get deposit address', 500);
    }
  }

  // Get deposit address from query parameter (for frontend compatibility)
  async getDepositAddressQuery(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { asset, symbol: querySymbol, network = 'BTC' } = req.query;
      const symbol = (asset || querySymbol) as string;

      if (!symbol) {
        throw new AppError('VAL_001', 'Asset or symbol is required', 400);
      }

      // Check if address exists
      let depositAddress = await prisma.depositAddress.findUnique({
        where: {
          userId_symbol_network: {
            userId: userId!,
            symbol: symbol.toUpperCase(),
            network: network as string,
          },
        },
      });

      // If not exists, generate one (simplified - in production, use actual blockchain API)
      if (!depositAddress) {
        const address = `${symbol.toLowerCase()}_${userId?.substring(0, 8)}_${Date.now()}`;

        depositAddress = await prisma.depositAddress.create({
          data: {
            userId: userId!,
            symbol: symbol.toUpperCase(),
            network: network as string,
            address,
          },
        });
      }

      return successResponse(res, {
        symbol: depositAddress.symbol,
        address: depositAddress.address,
        network: depositAddress.network,
        memo: depositAddress.memo,
      });
    } catch (error) {
      logger.error('Get deposit address error:', error);
      throw new AppError('GEN_004', 'Failed to get deposit address', 500);
    }
  }
}
