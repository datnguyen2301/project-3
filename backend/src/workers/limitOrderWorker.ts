import prisma from '../config/database';
import logger from '../config/logger';
import { Decimal } from '@prisma/client/runtime/library';
import config from '../config';
import axios from 'axios';

interface BinancePrice {
  symbol: string;
  price: string;
}

export class LimitOrderWorker {
  private isRunning = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 5000; // Check every 5 seconds

  /**
   * Start the limit order matching worker
   */
  start() {
    if (this.isRunning) {
      logger.warn('Limit order worker already running');
      return;
    }

    this.isRunning = true;
    logger.info('🔄 Limit order matching worker started');

    // Run immediately then schedule
    this.checkAndMatchOrders();
    this.checkInterval = setInterval(() => {
      this.checkAndMatchOrders();
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Stop the worker
   */
  stop() {
    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    logger.info('Limit order matching worker stopped');
  }

  /**
   * Main function to check and match limit orders
   */
  private async checkAndMatchOrders() {
    try {
      // Get all open LIMIT orders
      const openOrders = await prisma.order.findMany({
        where: {
          type: 'LIMIT',
          status: 'OPEN',
        },
        orderBy: { createdAt: 'asc' },
      });

      if (openOrders.length === 0) {
        return;
      }

      logger.info(`📋 Found ${openOrders.length} open LIMIT orders to check`);

      // Get unique symbols
      const symbols = [...new Set(openOrders.map(o => o.symbol))];
      
      // Fetch current prices from Binance
      const prices = await this.getBinancePrices(symbols);

      // Process each order
      for (const order of openOrders) {
        try {
          const currentPrice = prices.get(order.symbol);
          if (!currentPrice) continue;

          const orderPrice = parseFloat(order.price?.toString() || '0');
          const shouldMatch = this.shouldMatchOrder(order.side, orderPrice, currentPrice);

          logger.info(`  Order ${order.id.slice(0,8)}: ${order.side} ${order.symbol} @ ${orderPrice} | Market: ${currentPrice} | Match: ${shouldMatch}`);

          if (shouldMatch) {
            // Execute at order's limit price (guaranteed price for user)
            // For BUY: execute at orderPrice (user pays their specified price or better)
            // For SELL: execute at orderPrice (user receives their specified price or better)
            logger.info(`📈 Matching LIMIT ${order.side} order: ${order.id} | ${order.symbol} @ ${orderPrice} (market: ${currentPrice})`);
            await this.executeOrder(order, orderPrice);
          }
        } catch (error) {
          logger.error(`Error processing order ${order.id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Limit order matching worker error:', error);
    }
  }

  /**
   * Check if order should be matched based on current price
   */
  private shouldMatchOrder(side: string, orderPrice: number, currentPrice: number): boolean {
    if (side === 'BUY') {
      // BUY LIMIT: execute when market price drops to or below order price
      return currentPrice <= orderPrice;
    } else {
      // SELL LIMIT: execute when market price rises to or above order price
      return currentPrice >= orderPrice;
    }
  }

  /**
   * Execute a limit order
   */
  private async executeOrder(order: any, executionPrice: number) {
    const baseAsset = order.symbol.replace('USDT', '');
    const quoteAsset = 'USDT';
    const amount = parseFloat(order.remainingAmount.toString());
    const feeRate = config.fees.taker;

    await prisma.$transaction(async (tx: any) => {
      // Calculate fee based on received asset
      const fee = order.side === 'BUY'
        ? amount * feeRate  // Fee in base asset (BTC)
        : amount * executionPrice * feeRate; // Fee in quote asset (USDT)

      // Create order fill
      await tx.orderFill.create({
        data: {
          orderId: order.id,
          userId: order.userId,
          symbol: order.symbol,
          side: order.side,
          price: new Decimal(executionPrice),
          amount: new Decimal(amount),
          fee: new Decimal(fee),
          feeCurrency: order.side === 'BUY' ? baseAsset : quoteAsset,
        },
      });

      // Update order status with execution details
      const executionTotal = amount * executionPrice;
      await tx.order.update({
        where: { id: order.id },
        data: {
          price: new Decimal(executionPrice),
          filledAmount: order.amount,
          remainingAmount: new Decimal(0),
          total: new Decimal(executionTotal),
          fee: new Decimal(fee),
          feeCurrency: order.side === 'BUY' ? baseAsset : quoteAsset,
          status: 'FILLED',
          filledAt: new Date(),
        },
      });

      // Update wallet balances
      if (order.side === 'BUY') {
        // BUY: Locked USDT -> receive base asset
        const lockedAmount = parseFloat(order.amount.toString()) * parseFloat(order.price.toString());
        
        // Calculate actual cost (should equal lockedAmount when executing at limit price)
        const actualCost = amount * executionPrice;
        // Ensure refund is never negative
        const refund = Math.max(0, lockedAmount - actualCost);

        // Verify we have enough locked funds (should always be true when executing at limit price)
        if (actualCost > lockedAmount) {
          throw new Error(`Insufficient locked funds: need ${actualCost}, have ${lockedAmount}`);
        }

        await tx.walletBalance.update({
          where: {
            userId_symbol: {
              userId: order.userId,
              symbol: quoteAsset,
            },
          },
          data: {
            locked: { decrement: lockedAmount },
            available: { increment: refund }, // Refund if any
          },
        });

        // Add base asset (minus fee)
        const receivedAmount = amount - fee;
        await tx.walletBalance.upsert({
          where: {
            userId_symbol: {
              userId: order.userId,
              symbol: baseAsset,
            },
          },
          update: {
            available: { increment: receivedAmount },
          },
          create: {
            userId: order.userId,
            symbol: baseAsset,
            available: new Decimal(receivedAmount),
            locked: new Decimal(0),
          },
        });

        logger.info(`✅ LIMIT BUY filled: ${amount} ${baseAsset} @ ${executionPrice} | Fee: ${fee} ${baseAsset} | Received: ${receivedAmount} ${baseAsset}`);

        // Update portfolio for BUY
        await this.updatePortfolio(tx, order.userId, baseAsset, 'BUY', amount, executionPrice);
      } else {
        // SELL: Locked base asset -> receive USDT
        // Unlock base asset
        await tx.walletBalance.update({
          where: {
            userId_symbol: {
              userId: order.userId,
              symbol: baseAsset,
            },
          },
          data: {
            locked: { decrement: amount },
          },
        });

        // Add USDT (minus fee)
        const receivedAmount = (amount * executionPrice) - fee;
        await tx.walletBalance.upsert({
          where: {
            userId_symbol: {
              userId: order.userId,
              symbol: quoteAsset,
            },
          },
          update: {
            available: { increment: receivedAmount },
          },
          create: {
            userId: order.userId,
            symbol: quoteAsset,
            available: new Decimal(receivedAmount),
            locked: new Decimal(0),
          },
        });

        logger.info(`✅ LIMIT SELL filled: ${amount} ${baseAsset} @ ${executionPrice} | Fee: ${fee} ${quoteAsset} | Received: ${receivedAmount} ${quoteAsset}`);

        // Update portfolio for SELL
        await this.updatePortfolio(tx, order.userId, baseAsset, 'SELL', amount, executionPrice);
      }
    });
  }

  /**
   * Update portfolio when order is filled
   */
  private async updatePortfolio(
    tx: any,
    userId: string,
    symbol: string,
    side: string,
    amount: number,
    price: number
  ) {
    try {
      if (side === 'BUY') {
        // BUY: Add to portfolio
        const portfolio = await tx.portfolio.findUnique({
          where: {
            userId_symbol: { userId, symbol },
          },
        });

        if (portfolio) {
          const currentAmount = parseFloat(portfolio.amount.toString());
          const currentInvested = parseFloat(portfolio.totalInvested.toString());
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
              symbol,
              amount: new Decimal(amount),
              totalInvested: new Decimal(amount * price),
              avgBuyPrice: new Decimal(price),
            },
          });
        }
      } else {
        // SELL: Decrease portfolio
        const portfolio = await tx.portfolio.findUnique({
          where: {
            userId_symbol: { userId, symbol },
          },
        });

        if (portfolio) {
          const currentAmount = parseFloat(portfolio.amount.toString());
          const newAmount = currentAmount - amount;

          if (newAmount <= 0) {
            await tx.portfolio.delete({ where: { id: portfolio.id } });
          } else {
            const currentInvested = parseFloat(portfolio.totalInvested.toString());
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
    } catch (error) {
      logger.error('Failed to update portfolio:', error);
    }
  }

  /**
   * Fetch current prices from Binance for multiple symbols
   */
  private async getBinancePrices(symbols: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();

    try {
      const response = await axios.get<BinancePrice[]>(`${config.binance.apiUrl}/api/v3/ticker/price`, {
        timeout: 5000,
      });

      for (const item of response.data) {
        if (symbols.includes(item.symbol)) {
          prices.set(item.symbol, parseFloat(item.price));
        }
      }
    } catch (error) {
      logger.error('Failed to fetch Binance prices:', error);
    }

    return prices;
  }
}

export const limitOrderWorker = new LimitOrderWorker();
