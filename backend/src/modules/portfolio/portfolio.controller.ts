import { Response } from 'express';
import prisma from '../../config/database';
import { successResponse, AppError } from '../../common/utils/response.utils';
import { AuthRequest } from '../../common/middlewares/auth.middleware';
import { decimalToNumber, toNumber } from '../../common/utils/decimal.utils';
import logger from '../../config/logger';
import axios from 'axios';
import config from '../../config';

export class PortfolioController {
  // Get portfolio
  async getPortfolio(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;

      const portfolios = await prisma.portfolio.findMany({
        where: { userId },
      });

      if (portfolios.length === 0) {
        return successResponse(res, {
          totalValue: 0,
          totalChange: 0,
          assets: [],
        });
      }

      // Get current prices from Binance
      const symbols = portfolios.map((p: any) => `${p.symbol}USDT`);
      const prices = await this.getCurrentPrices(symbols);

      let totalValue = 0;
      let totalInvested = 0;

      const assets = portfolios.map((portfolio: any) => {
        const symbol = portfolio.symbol;
        const amount = toNumber(portfolio.amount);
        const avgBuyPrice = toNumber(portfolio.avgBuyPrice);
        const invested = toNumber(portfolio.totalInvested);
        const currentPrice = prices[`${symbol}USDT`] || avgBuyPrice;
        const value = amount * currentPrice;
        const pnl = value - invested;
        const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;

        totalValue += value;
        totalInvested += invested;

        return {
          symbol,
          name: this.getCryptoName(symbol),
          amount,
          avgBuyPrice,
          currentPrice,
          value,
          change: ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100,
          pnl,
          pnlPercent,
        };
      });

      // Add USDT balance
      const usdtBalance = await prisma.walletBalance.findUnique({
        where: {
          userId_symbol: {
            userId: userId!,
            symbol: 'USDT',
          },
        },
      });

      if (usdtBalance) {
        const usdtAmount = toNumber(usdtBalance.available) + toNumber(usdtBalance.locked);
        if (usdtAmount > 0) {
          totalValue += usdtAmount;
          assets.push({
            symbol: 'USDT',
            name: 'Tether',
            amount: usdtAmount,
            avgBuyPrice: 1,
            currentPrice: 1,
            value: usdtAmount,
            change: 0,
            pnl: 0,
            pnlPercent: 0,
          });
        }
      }

      const totalChange = totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0;

      return successResponse(res, {
        totalValue: Number(totalValue.toFixed(2)),
        totalChange: Number(totalChange.toFixed(2)),
        totalPnl: Number((totalValue - totalInvested).toFixed(2)),
        assets,
      });
    } catch (error) {
      logger.error('Get portfolio error:', error);
      throw new AppError('GEN_004', 'Failed to get portfolio', 500);
    }
  }

  // Get portfolio balance (total value)
  async getBalance(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;

      const portfolios = await prisma.portfolio.findMany({
        where: { userId },
      });

      if (portfolios.length === 0) {
        return successResponse(res, { totalValue: 0 });
      }

      const symbols = portfolios.map((p: any) => `${p.symbol}USDT`);
      const prices = await this.getCurrentPrices(symbols);

      let totalValue = 0;

      portfolios.forEach((portfolio: any) => {
        const symbol = portfolio.symbol;
        const amount = toNumber(portfolio.amount);
        const currentPrice = prices[`${symbol}USDT`] || toNumber(portfolio.avgBuyPrice);
        totalValue += amount * currentPrice;
      });

      // Add USDT
      const usdtBalance = await prisma.walletBalance.findUnique({
        where: {
          userId_symbol: {
            userId: userId!,
            symbol: 'USDT',
          },
        },
      });

      if (usdtBalance) {
        totalValue += toNumber(usdtBalance.available) + toNumber(usdtBalance.locked);
      }

      return successResponse(res, {
        totalValue: Number(totalValue.toFixed(2)),
      });
    } catch (error) {
      logger.error('Get balance error:', error);
      throw new AppError('GEN_004', 'Failed to get balance', 500);
    }
  }

  // Get portfolio history
  async getHistory(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { days = 30 } = req.query;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - Number(days));

      const history = await prisma.portfolioHistory.findMany({
        where: {
          userId,
          createdAt: {
            gte: startDate,
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      const formattedHistory = history.map((h: any) => ({
        date: h.createdAt,
        totalValue: decimalToNumber(h.totalValue),
        assets: h.snapshotData,
      }));

      return successResponse(res, { history: formattedHistory });
    } catch (error) {
      logger.error('Get history error:', error);
      throw new AppError('GEN_004', 'Failed to get history', 500);
    }
  }

  // Get P&L
  async getPnL(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;

      const portfolios = await prisma.portfolio.findMany({
        where: { userId },
      });

      if (portfolios.length === 0) {
        return successResponse(res, {
          totalInvested: 0,
          currentValue: 0,
          totalPnL: 0,
          totalPnLPercent: 0,
        });
      }

      const symbols = portfolios.map((p: any) => `${p.symbol}USDT`);
      const prices = await this.getCurrentPrices(symbols);

      let totalInvested = 0;
      let currentValue = 0;

      portfolios.forEach((portfolio: any) => {
        const symbol = portfolio.symbol;
        const amount = toNumber(portfolio.amount);
        const invested = toNumber(portfolio.totalInvested);
        const currentPrice = prices[`${symbol}USDT`] || toNumber(portfolio.avgBuyPrice);

        totalInvested += invested;
        currentValue += amount * currentPrice;
      });

      const totalPnL = currentValue - totalInvested;
      const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

      return successResponse(res, {
        totalInvested: Number(totalInvested.toFixed(2)),
        currentValue: Number(currentValue.toFixed(2)),
        totalPnL: Number(totalPnL.toFixed(2)),
        totalPnLPercent: Number(totalPnLPercent.toFixed(2)),
      });
    } catch (error) {
      logger.error('Get P&L error:', error);
      throw new AppError('GEN_004', 'Failed to get P&L', 500);
    }
  }

  // Helper: Get current prices from Binance
  private async getCurrentPrices(symbols: string[]): Promise<Record<string, number>> {
    try {
      const response = await axios.get(`${config.binance.apiUrl}/api/v3/ticker/price`);
      const prices: Record<string, number> = {};

      response.data.forEach((ticker: any) => {
        if (symbols.includes(ticker.symbol)) {
          prices[ticker.symbol] = parseFloat(ticker.price);
        }
      });

      return prices;
    } catch (error) {
      logger.error('Failed to fetch prices from Binance:', error);
      return {};
    }
  }

  // Helper: Get crypto name
  private getCryptoName(symbol: string): string {
    const names: Record<string, string> = {
      BTC: 'Bitcoin',
      ETH: 'Ethereum',
      BNB: 'Binance Coin',
      XRP: 'Ripple',
      ADA: 'Cardano',
      SOL: 'Solana',
      DOT: 'Polkadot',
      DOGE: 'Dogecoin',
      USDT: 'Tether',
    };
    return names[symbol] || symbol;
  }

  // Get portfolio performance over time
  async getPerformance(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const period = (req.query.period as string) || '7d'; // 24h, 7d, 30d, 90d, 1y

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();

      switch (period) {
        case '24h':
          startDate.setHours(startDate.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(startDate.getDate() - 7);
      }

      const history = await prisma.portfolioHistory.findMany({
        where: {
          userId,
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { timestamp: 'asc' },
      });

      const performance = history.map(h => ({
        timestamp: h.timestamp,
        totalValue: decimalToNumber(h.totalValue),
        totalPnl: decimalToNumber(h.totalPnl),
        totalPnlPercentage: decimalToNumber(h.totalPnlPercentage),
      }));

      return successResponse(res, { performance, period });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get performance error:', error);
      throw new AppError('GEN_004', 'Failed to get performance', 500);
    }
  }

  // Get asset allocation
  async getAssetAllocation(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const portfolios = await prisma.portfolio.findMany({
        where: { userId },
      });

      if (portfolios.length === 0) {
        return successResponse(res, { allocation: [] });
      }

      // Get current prices
      const symbols = portfolios.map((p: any) => `${p.symbol}USDT`);
      const prices = await this.getCurrentPrices(symbols);

      let totalValue = 0;
      const assets = portfolios.map((portfolio: any) => {
        const symbol = portfolio.symbol;
        const amount = toNumber(portfolio.amount);
        const currentPrice = prices[`${symbol}USDT`] || toNumber(portfolio.avgBuyPrice);
        const value = amount * currentPrice;
        totalValue += value;

        return { symbol, value };
      });

      // Calculate percentages
      const allocation = assets.map(asset => ({
        symbol: asset.symbol,
        name: this.getCryptoName(asset.symbol),
        value: asset.value,
        percentage: totalValue > 0 ? (asset.value / totalValue) * 100 : 0,
      }));

      return successResponse(res, { allocation, totalValue });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get asset allocation error:', error);
      throw new AppError('GEN_004', 'Failed to get asset allocation', 500);
    }
  }

  // Export trade history
  async exportTradeHistory(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const format = (req.query.format as string) || 'csv'; // csv or json

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      // Get all filled orders
      const orders = await prisma.order.findMany({
        where: {
          userId,
          status: 'FILLED',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (format === 'csv') {
        // Generate CSV
        const csvHeader = 'Date,Symbol,Side,Type,Amount,Price,Total,Fee,Status\n';
        const csvRows = orders.map(order => {
          const date = order.createdAt.toISOString();
          const price = order.price ? toNumber(order.price) : 0;
          const amount = toNumber(order.amount);
          const total = price * amount;
          return `${date},${order.symbol},${order.side},${order.type},${amount},${price},${total},0,${order.status}`;
        }).join('\n');

        const csv = csvHeader + csvRows;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=trade-history-${Date.now()}.csv`);
        return res.send(csv);
      } else {
        // Return JSON
        const trades = orders.map(order => {
          const price = order.price ? toNumber(order.price) : 0;
          const amount = toNumber(order.amount);
          return {
            date: order.createdAt,
            symbol: order.symbol,
            side: order.side,
            type: order.type,
            amount,
            price,
            total: price * amount,
            fee: 0,
            status: order.status,
          };
        });

        return successResponse(res, { trades });
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Export trade history error:', error);
      throw new AppError('GEN_004', 'Failed to export trade history', 500);
    }
  }
}
