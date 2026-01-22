import { Response } from 'express';
import prisma from '../../config/database';
import { successResponse, AppError } from '../../common/utils/response.utils';
import { AuthRequest } from '../../common/middlewares/auth.middleware';
import logger from '../../config/logger';
import { Decimal } from '@prisma/client/runtime/library';

export class AdvancedOrderController {
  /**
   * Create Stop-Loss or Take-Profit order
   */
  async createStopOrder(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { symbol, side, type, amount, price, stopPrice } = req.body;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      // Validate stop price logic
      if (type === 'STOP_LOSS' && side === 'SELL' && price && stopPrice >= price) {
        throw new AppError('ORD_010', 'Stop price must be below limit price for SELL stop-loss', 400);
      }
      if (type === 'TAKE_PROFIT' && side === 'SELL' && price && stopPrice <= price) {
        throw new AppError('ORD_011', 'Stop price must be above limit price for SELL take-profit', 400);
      }

      // Parse symbol
      const baseAsset = symbol.replace('USDT', '');
      const quoteAsset = 'USDT';

      // Calculate required amount and check/lock balance
      const checkSymbol = side === 'BUY' ? quoteAsset : baseAsset;
      const requiredAmount = side === 'BUY' ? amount * (price || stopPrice) : amount;

      // Check balance
      const balance = await prisma.walletBalance.findUnique({
        where: {
          userId_symbol: { userId, symbol: checkSymbol },
        },
      });

      if (!balance || new Decimal(balance.available).lessThan(requiredAmount)) {
        throw new AppError('TRADE_001', 'Insufficient balance to create order', 400);
      }

      // Create order with balance lock in transaction
      const order = await prisma.$transaction(async (tx: any) => {
        // Lock balance
        await tx.walletBalance.update({
          where: {
            userId_symbol: { userId, symbol: checkSymbol },
          },
          data: {
            available: { decrement: requiredAmount },
            locked: { increment: requiredAmount },
          },
        });

        // Create conditional order
        return await tx.order.create({
          data: {
            userId,
            symbol,
            side,
            type,
            price: price ? new Decimal(price) : null,
            amount: new Decimal(amount),
            stopPrice: stopPrice ? new Decimal(stopPrice) : null,
            status: 'PENDING',
            filledAmount: new Decimal(0),
            remainingAmount: new Decimal(amount),
          },
        });
      });

      return successResponse(res, {
        message: 'Advanced order created successfully',
        order,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Create stop order error:', error);
      throw new AppError('GEN_004', 'Failed to create advanced order', 500);
    }
  }

  /**
   * Create Trailing Stop order
   */
  async createTrailingStopOrder(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { symbol, side, amount, stopPrice, trailingDelta } = req.body;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      // Parse symbol
      const baseAsset = symbol.replace('USDT', '');
      const quoteAsset = 'USDT';

      // Calculate required amount and check/lock balance
      const checkSymbol = side === 'BUY' ? quoteAsset : baseAsset;
      const requiredAmount = side === 'BUY' ? amount * stopPrice : amount;

      // Check balance
      const balance = await prisma.walletBalance.findUnique({
        where: {
          userId_symbol: { userId, symbol: checkSymbol },
        },
      });

      if (!balance || new Decimal(balance.available).lessThan(requiredAmount)) {
        throw new AppError('TRADE_001', 'Insufficient balance to create order', 400);
      }

      // Create order with balance lock in transaction
      const order = await prisma.$transaction(async (tx: any) => {
        // Lock balance
        await tx.walletBalance.update({
          where: {
            userId_symbol: { userId, symbol: checkSymbol },
          },
          data: {
            available: { decrement: requiredAmount },
            locked: { increment: requiredAmount },
          },
        });

        // Create trailing stop order
        return await tx.order.create({
          data: {
            userId,
            symbol,
            side,
            type: 'TRAILING_STOP',
            amount: new Decimal(amount),
            stopPrice: new Decimal(stopPrice),
            trailingDelta: trailingDelta ? new Decimal(trailingDelta) : null,
            status: 'PENDING',
            filledAmount: new Decimal(0),
            remainingAmount: new Decimal(amount),
          },
        });
      });

      return successResponse(res, {
        message: 'Trailing stop order created successfully',
        order,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Create trailing stop order error:', error);
      throw new AppError('GEN_004', 'Failed to create trailing stop order', 500);
    }
  }

  /**
   * Create OCO (One-Cancels-Other) order
   * This creates two linked orders: a limit order and a stop-loss order
   */
  async createOCOOrder(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { symbol, side, amount, price, stopPrice, stopLimitPrice } = req.body;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      // Validate OCO logic
      if (side === 'SELL') {
        if (price <= stopPrice) {
          throw new AppError('ORD_012', 'Limit price must be above stop price for SELL OCO', 400);
        }
      } else {
        if (price >= stopPrice) {
          throw new AppError('ORD_013', 'Limit price must be below stop price for BUY OCO', 400);
        }
      }

      // Parse symbol
      const baseAsset = symbol.replace('USDT', '');
      const quoteAsset = 'USDT';

      // Calculate required amount for OCO - only lock once (as only one order can execute)
      const checkSymbol = side === 'BUY' ? quoteAsset : baseAsset;
      // Use higher price for BUY to ensure enough locked
      const maxPrice = side === 'BUY' ? Math.max(price, stopLimitPrice || stopPrice) : price;
      const requiredAmount = side === 'BUY' ? amount * maxPrice : amount;

      // Check balance
      const balance = await prisma.walletBalance.findUnique({
        where: {
          userId_symbol: { userId, symbol: checkSymbol },
        },
      });

      if (!balance || new Decimal(balance.available).lessThan(requiredAmount)) {
        throw new AppError('TRADE_001', 'Insufficient balance to create order', 400);
      }

      // Create both orders in a transaction with balance lock
      const result = await prisma.$transaction(async (tx: any) => {
        // Lock balance (only once, as only one order can execute)
        await tx.walletBalance.update({
          where: {
            userId_symbol: { userId, symbol: checkSymbol },
          },
          data: {
            available: { decrement: requiredAmount },
            locked: { increment: requiredAmount },
          },
        });

        // Create limit order
        const limitOrder = await tx.order.create({
          data: {
            userId,
            symbol,
            side,
            type: 'LIMIT',
            price: new Decimal(price),
            amount: new Decimal(amount),
            status: 'OPEN',
            filledAmount: new Decimal(0),
            remainingAmount: new Decimal(amount),
          },
        });

        // Create stop-loss order
        const stopOrder = await tx.order.create({
          data: {
            userId,
            symbol,
            side,
            type: stopLimitPrice ? 'STOP_LOSS_LIMIT' : 'STOP_LOSS',
            price: stopLimitPrice ? new Decimal(stopLimitPrice) : null,
            amount: new Decimal(amount),
            stopPrice: new Decimal(stopPrice),
            status: 'PENDING',
            filledAmount: new Decimal(0),            remainingAmount: new Decimal(amount),            linkedOrderId: limitOrder.id, // Link to limit order
          },
        });

        // Update limit order with linked stop order
        await tx.order.update({
          where: { id: limitOrder.id },
          data: { linkedOrderId: stopOrder.id },
        });

        return { limitOrder, stopOrder };
      });

      return successResponse(res, {
        message: 'OCO order created successfully',
        orders: result,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Create OCO order error:', error);
      throw new AppError('GEN_004', 'Failed to create OCO order', 500);
    }
  }

  /**
   * Cancel linked order (for OCO)
   */
  async cancelLinkedOrder(orderId: string) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { linkedOrderId: true },
      });

      if (order?.linkedOrderId) {
        // Cancel the linked order
        await prisma.order.update({
          where: { id: order.linkedOrderId },
          data: { status: 'CANCELLED' },
        });
      }
    } catch (error) {
      logger.error('Cancel linked order error:', error);
    }
  }
}
