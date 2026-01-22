import { Response } from 'express';
import prisma from '../../config/database';
import { successResponse, AppError } from '../../common/utils/response.utils';
import { AuthRequest } from '../../common/middlewares/auth.middleware';
import { decimalToNumber, toNumber } from '../../common/utils/decimal.utils';
import logger from '../../config/logger';
import { Decimal } from '@prisma/client/runtime/library';
import config from '../../config';
import axios from 'axios';
import { sendNotificationToUser } from '../../websocket/notificationHandler';

// Helper function để lấy giá thực từ Binance
async function getBinancePrice(symbol: string): Promise<number> {
  try {
    const response = await axios.get(`${config.binance.apiUrl}/api/v3/ticker/price`, {
      params: { symbol },
      timeout: 5000,
    });
    return parseFloat(response.data.price);
  } catch (error) {
    logger.error(`Failed to get Binance price for ${symbol}:`, error);
    throw new AppError('TRADE_006', 'Failed to get market price from Binance', 503);
  }
}

export class OrderController {
  // Create order
  async createOrder(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { symbol, side, type, price, amount, stopPrice } = req.body;

      // Verify user is verified
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isVerified: true, kycStatus: true },
      });

      if (!user?.isVerified) {
        throw new AppError('AUTH_003', 'Email verification required for trading', 403);
      }

      // Parse symbol (e.g., BTCUSDT -> BTC/USDT)
      const baseAsset = symbol.replace('USDT', '');
      const quoteAsset = 'USDT';

      // Get real-time price from Binance for market orders
      let marketPrice: number | null = null;
      if (type === 'MARKET') {
        marketPrice = await getBinancePrice(symbol);
        logger.info(`Binance price for ${symbol}: ${marketPrice}`);
      }

      // Calculate total and check balance
      let total = 0;
      let checkSymbol = '';
      let requiredAmount = 0;
      const SLIPPAGE_BUFFER = 1.005; // 0.5% slippage protection for market orders

      if (side === 'BUY') {
        // Need USDT to buy
        checkSymbol = quoteAsset;
        if (type === 'MARKET') {
          // For market orders, add slippage buffer to protect against price movement
          total = amount * marketPrice! * SLIPPAGE_BUFFER;
        } else {
          total = amount * price!;
        }
        requiredAmount = total;
      } else {
        // Need base asset to sell
        checkSymbol = baseAsset;
        requiredAmount = amount;
      }

      // Check balance
      const balance = await prisma.walletBalance.findUnique({
        where: {
          userId_symbol: {
            userId: userId!,
            symbol: checkSymbol,
          },
        },
      });

      if (!balance || new Decimal(balance.available).lessThan(requiredAmount)) {
        throw new AppError(
          'TRADE_001',
          'Insufficient balance to create order',
          400,
          {
            required: requiredAmount,
            available: balance ? decimalToNumber(balance.available) : '0',
          }
        );
      }

      // Minimum order validation (10 USDT)
      const orderValue = side === 'BUY' 
        ? total 
        : amount * (price || marketPrice || 0);
      if (orderValue < 10) {
        throw new AppError('TRADE_005', 'Minimum order size is 10 USDT', 400);
      }

      // Create order with transaction
      const order = await prisma.$transaction(async (tx: any) => {
        // Re-check balance inside transaction with lock
        const currentBalance = await tx.walletBalance.findUnique({
          where: {
            userId_symbol: {
              userId: userId!,
              symbol: checkSymbol,
            },
          },
        });

        if (!currentBalance || new Decimal(currentBalance.available).lessThan(requiredAmount)) {
          throw new AppError(
            'TRADE_001',
            'Insufficient balance to create order',
            400,
            {
              required: requiredAmount,
              available: currentBalance ? currentBalance.available.toString() : '0',
            }
          );
        }

        // Lock balance
        await tx.walletBalance.update({
          where: {
            userId_symbol: {
              userId: userId!,
              symbol: checkSymbol,
            },
          },
          data: {
            available: { decrement: requiredAmount },
            locked: { increment: requiredAmount },
          },
        });

        // Create order
        const newOrder = await tx.order.create({
          data: {
            userId: userId!,
            symbol,
            side,
            type,
            price: price ? new Decimal(price) : null,
            stopPrice: stopPrice ? new Decimal(stopPrice) : null,
            amount: new Decimal(amount),
            filledAmount: new Decimal(0),
            remainingAmount: new Decimal(amount),
            total: total ? new Decimal(total) : null,
            status: type === 'MARKET' ? 'FILLED' : 'OPEN',
          },
        });

        // For MARKET orders, execute immediately with real Binance price
        if (type === 'MARKET') {
          const executionPrice = marketPrice!; // Use real Binance price
          // Fee is calculated on the received asset
          // BUY: receive BTC, fee in BTC
          // SELL: receive USDT, fee in USDT
          const feeRate = config.fees.taker;
          const fee = side === 'BUY' 
            ? amount * feeRate  // Fee in BTC
            : amount * executionPrice * feeRate; // Fee in USDT

          // Create fill
          await tx.orderFill.create({
            data: {
              orderId: newOrder.id,
              userId: userId!,
              symbol,
              side,
              price: new Decimal(executionPrice),
              amount: new Decimal(amount),
              fee: new Decimal(fee),
              feeCurrency: side === 'BUY' ? baseAsset : quoteAsset,
            },
          });

          // Update order with execution price and total
          const executionTotal = amount * executionPrice;
          await tx.order.update({
            where: { id: newOrder.id },
            data: {
              price: new Decimal(executionPrice),
              filledAmount: new Decimal(amount),
              remainingAmount: new Decimal(0),
              total: new Decimal(executionTotal),
              fee: new Decimal(fee),
              feeCurrency: side === 'BUY' ? baseAsset : quoteAsset,
              status: 'FILLED',
              filledAt: new Date(),
            },
          });

          // Unlock locked balance and update balances
          if (side === 'BUY') {
            // Calculate actual cost and refund any slippage buffer
            const actualCost = amount * executionPrice;
            const refund = Math.max(0, requiredAmount - actualCost);
            
            // Unlock USDT and refund excess
            await tx.walletBalance.update({
              where: {
                userId_symbol: {
                  userId: userId!,
                  symbol: quoteAsset,
                },
              },
              data: {
                locked: { decrement: requiredAmount },
                available: { increment: refund },
              },
            });

            // Add base asset
            await tx.walletBalance.upsert({
              where: {
                userId_symbol: {
                  userId: userId!,
                  symbol: baseAsset,
                },
              },
              create: {
                userId: userId!,
                symbol: baseAsset,
                available: new Decimal(amount - fee),
                locked: new Decimal(0),
              },
              update: {
                available: { increment: amount - fee },
              },
            });
          } else {
            // Unlock base asset
            await tx.walletBalance.update({
              where: {
                userId_symbol: {
                  userId: userId!,
                  symbol: baseAsset,
                },
              },
              data: {
                locked: { decrement: requiredAmount },
              },
            });

            // Add USDT
            const receiveAmount = amount * executionPrice - fee;
            await tx.walletBalance.upsert({
              where: {
                userId_symbol: {
                  userId: userId!,
                  symbol: quoteAsset,
                },
              },
              create: {
                userId: userId!,
                symbol: quoteAsset,
                available: new Decimal(receiveAmount),
                locked: new Decimal(0),
              },
              update: {
                available: { increment: receiveAmount },
              },
            });
          }

          // Update portfolio
          await this.updatePortfolio(tx, userId!, symbol, side, amount, executionPrice);

          // Create wallet transaction
          await tx.walletTransaction.create({
            data: {
              userId: userId!,
              type: 'TRADE',
              symbol: side === 'BUY' ? baseAsset : quoteAsset,
              amount: new Decimal(side === 'BUY' ? amount : amount * executionPrice),
              fee: new Decimal(fee),
              status: 'COMPLETED',
              referenceId: newOrder.id,
              referenceType: 'ORDER',
            },
          });
        }

        return newOrder;
      });

      // Lấy giá thực thi (marketPrice cho MARKET order, price cho LIMIT order)
      const executedPrice = type === 'MARKET' ? marketPrice : price;

      const formattedOrder = {
        id: order.id,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        status: order.status,
        price: executedPrice || (order.price ? decimalToNumber(order.price) : null),
        amount: decimalToNumber(order.amount),
        filled: decimalToNumber(order.filledAmount),
        remaining: decimalToNumber(order.remainingAmount),
        total: order.total ? decimalToNumber(order.total) : null,
        createdAt: order.createdAt,
      };

      // Emit notification qua WebSocket
      const orderBaseAsset = symbol.replace('USDT', '');
      const sideText = side === 'BUY' ? 'Mua' : 'Bán';
      const statusText = type === 'MARKET' ? 'thành công' : 'đã được tạo';
      const displayPrice = formattedOrder.price || price || 0;
      const priceText = displayPrice > 0 ? `tại giá $${Number(displayPrice).toLocaleString()}` : '';
      
      sendNotificationToUser(userId!, {
        type: 'orderUpdate',
        data: {
          id: order.id,
          orderId: order.id,
          symbol: order.symbol,
          side: order.side,
          type: order.type,
          status: order.status,
          amount: formattedOrder.amount,
          price: formattedOrder.price,
          title: `${sideText} ${orderBaseAsset} ${statusText}`,
          message: `Lệnh ${sideText.toLowerCase()} ${amount} ${orderBaseAsset} ${priceText} ${statusText}.`,
        },
      });

      return successResponse(res, formattedOrder, 201);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Create order error:', error);
      throw new AppError('GEN_004', 'Failed to create order', 500);
    }
  }

  // Helper to update portfolio
  private async updatePortfolio(
    tx: any,
    userId: string,
    symbol: string,
    side: string,
    amount: number,
    price: number
  ) {
    const baseAsset = symbol.replace('USDT', '');

    if (side === 'BUY') {
      const portfolio = await tx.portfolio.findUnique({
        where: {
          userId_symbol: {
            userId,
            symbol: baseAsset,
          },
        },
      });

      if (portfolio) {
        const currentAmount = toNumber(portfolio.amount);
        const currentInvested = toNumber(portfolio.totalInvested);
        const newAmount = currentAmount + amount;
        const newInvested = currentInvested + amount * price;
        const newAvgPrice = newInvested / newAmount;

        await tx.portfolio.update({
          where: { id: portfolio.id },
          data: {
            amount: new Decimal(newAmount),
            totalInvested: new Decimal(newInvested),
            avgBuyPrice: new Decimal(newAvgPrice),
          },
        });
      } else {
        await tx.portfolio.create({
          data: {
            userId,
            symbol: baseAsset,
            amount: new Decimal(amount),
            totalInvested: new Decimal(amount * price),
            avgBuyPrice: new Decimal(price),
          },
        });
      }
    } else {
      // SELL - decrease portfolio
      const portfolio = await tx.portfolio.findUnique({
        where: {
          userId_symbol: {
            userId,
            symbol: baseAsset,
          },
        },
      });

      if (portfolio) {
        const currentAmount = toNumber(portfolio.amount);
        const newAmount = currentAmount - amount;

        if (newAmount <= 0) {
          await tx.portfolio.delete({ where: { id: portfolio.id } });
        } else {
          const currentInvested = toNumber(portfolio.totalInvested);
          const investedPerUnit = currentInvested / currentAmount;
          const newInvested = investedPerUnit * newAmount;

          await tx.portfolio.update({
            where: { id: portfolio.id },
            data: {
              amount: new Decimal(newAmount),
              totalInvested: new Decimal(newInvested),
            },
          });
        }
      }
    }
  }

  // Get open orders (convenience method)
  async getOpenOrders(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { symbol } = req.query;

      const where: any = { 
        userId,
        status: { in: ['OPEN', 'PARTIALLY_FILLED'] }
      };
      if (symbol) where.symbol = (symbol as string).toUpperCase();

      const orders = await prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      const formattedOrders = orders.map((order: any) => ({
        id: order.id,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        status: order.status,
        price: order.price ? decimalToNumber(order.price) : null,
        amount: decimalToNumber(order.amount),
        filled: decimalToNumber(order.filledAmount),
        remaining: decimalToNumber(order.remainingAmount),
        filledPercent:
          (toNumber(order.filledAmount) / toNumber(order.amount)) * 100,
        createdAt: order.createdAt,
      }));

      // Return array directly for frontend compatibility
      return successResponse(res, formattedOrders);
    } catch (error) {
      logger.error('Get open orders error:', error);
      throw new AppError('GEN_004', 'Failed to get open orders', 500);
    }
  }

  // Get orders
  async getOrders(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { symbol, status, page = 1, limit = 20 } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const where: any = { userId };
      if (symbol) where.symbol = (symbol as string).toUpperCase();
      if (status) where.status = status;
      else where.status = { in: ['OPEN', 'PARTIALLY_FILLED'] }; // Default: open orders

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: Number(limit),
          skip,
        }),
        prisma.order.count({ where }),
      ]);

      const formattedOrders = orders.map((order: any) => ({
        id: order.id,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        status: order.status,
        price: order.price ? decimalToNumber(order.price) : null,
        amount: decimalToNumber(order.amount),
        filled: decimalToNumber(order.filledAmount),
        remaining: decimalToNumber(order.remainingAmount),
        filledPercent:
          (toNumber(order.filledAmount) / toNumber(order.amount)) * 100,
        createdAt: order.createdAt,
      }));

      return successResponse(res, {
        orders: formattedOrders,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error('Get orders error:', error);
      throw new AppError('GEN_004', 'Failed to get orders', 500);
    }
  }

  // Get order history
  async getOrderHistory(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { symbol, page = 1, limit = 20 } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const where: any = {
        userId,
        status: { in: ['FILLED', 'CANCELLED'] },
      };
      if (symbol) where.symbol = (symbol as string).toUpperCase();

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: Number(limit),
          skip,
        }),
        prisma.order.count({ where }),
      ]);

      const formattedOrders = orders.map((order: any) => ({
        id: order.id,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        status: order.status,
        price: order.price ? decimalToNumber(order.price) : null,
        amount: decimalToNumber(order.amount),
        filled: decimalToNumber(order.filledAmount),
        createdAt: order.createdAt,
        filledAt: order.filledAt,
      }));

      return successResponse(res, {
        orders: formattedOrders,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error('Get order history error:', error);
      throw new AppError('GEN_004', 'Failed to get order history', 500);
    }
  }

  // Get order details
  async getOrder(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      const order = await prisma.order.findFirst({
        where: {
          id,
          userId,
        },
        include: {
          fills: true,
        },
      });

      if (!order) {
        throw new AppError('TRADE_003', 'Order not found', 404);
      }

      const formattedOrder = {
        id: order.id,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        status: order.status,
        price: order.price ? decimalToNumber(order.price) : null,
        amount: decimalToNumber(order.amount),
        filled: decimalToNumber(order.filledAmount),
        remaining: decimalToNumber(order.remainingAmount),
        total: order.total ? decimalToNumber(order.total) : null,
        fee: decimalToNumber(order.fee),
        createdAt: order.createdAt,
        filledAt: order.filledAt,
        fills: order.fills.map((fill: any) => ({
          price: decimalToNumber(fill.price),
          amount: decimalToNumber(fill.amount),
          fee: decimalToNumber(fill.fee),
          createdAt: fill.createdAt,
        })),
      };

      return successResponse(res, formattedOrder);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get order error:', error);
      throw new AppError('GEN_004', 'Failed to get order', 500);
    }
  }

  // Cancel order
  async cancelOrder(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      const order = await prisma.order.findFirst({
        where: {
          id,
          userId,
        },
      });

      if (!order) {
        throw new AppError('TRADE_003', 'Order not found', 404);
      }

      if (!['OPEN', 'PARTIALLY_FILLED'].includes(order.status)) {
        throw new AppError('TRADE_004', 'Cannot cancel this order', 400);
      }

      // Cancel order and unlock balance
      await prisma.$transaction(async (tx: any) => {
        // Update order status
        await tx.order.update({
          where: { id },
          data: { status: 'CANCELLED' },
        });

        // Unlock balance
        const baseAsset = order.symbol.replace('USDT', '');
        const quoteAsset = 'USDT';
        const unlockSymbol = order.side === 'BUY' ? quoteAsset : baseAsset;
        const unlockAmount =
          order.side === 'BUY'
            ? toNumber(order.remainingAmount) * (order.price ? toNumber(order.price) : 0)
            : toNumber(order.remainingAmount);

        await tx.walletBalance.update({
          where: {
            userId_symbol: {
              userId: userId!,
              symbol: unlockSymbol,
            },
          },
          data: {
            available: { increment: unlockAmount },
            locked: { decrement: unlockAmount },
          },
        });
      });

      return successResponse(res, { message: 'Order cancelled successfully' });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Cancel order error:', error);
      throw new AppError('GEN_004', 'Failed to cancel order', 500);
    }
  }
}
