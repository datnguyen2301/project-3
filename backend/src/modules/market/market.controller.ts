import { Request, Response } from 'express';
import axios from 'axios';
import { isRedisConnected, getRedisClient } from '../../config/redis';
import { successResponse, AppError } from '../../common/utils/response.utils';
import { AuthRequest } from '../../common/middlewares/auth.middleware';
import logger from '../../config/logger';
import config from '../../config';
import prisma from '../../config/database';

// Helper: Parse và xóa trailing zeros
const cleanPrice = (value: string | number): number => {
  return parseFloat(parseFloat(String(value)).toString());
};

// Valid intervals for klines
const VALID_INTERVALS = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];

// Max limit for queries
const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 100;

// Helper to validate and sanitize limit parameter
const validateLimit = (limit: any, defaultValue: number = DEFAULT_LIMIT): number => {
  const parsed = parseInt(limit as string, 10);
  if (isNaN(parsed) || parsed < 1) return defaultValue;
  return Math.min(parsed, MAX_LIMIT);
};

// Helper to validate interval
const validateInterval = (interval: string): string => {
  if (!VALID_INTERVALS.includes(interval)) {
    return '1h'; // Default interval
  }
  return interval;
};

export class MarketController {
  private binanceApi = config.binance.apiUrl;

  // Helper to safely get from cache
  private async getFromCache(key: string): Promise<any | null> {
    if (!isRedisConnected()) return null;
    try {
      const redisClient = getRedisClient();
      const cached = await redisClient.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.warn(`Redis get failed for ${key}:`, error);
      return null;
    }
  }

  // Helper to safely set cache
  private async setCache(key: string, value: any, ttl: number): Promise<void> {
    if (!isRedisConnected()) return;
    try {
      const redisClient = getRedisClient();
      await redisClient.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.warn(`Redis set failed for ${key}:`, error);
    }
  }

  // Get all tickers
  async getTickers(_req: Request, res: Response) {
    try {
      const cacheKey = 'market:tickers';
      
      // Try to get from cache
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        return successResponse(res, cached);
      }

      const response = await axios.get(`${this.binanceApi}/api/v3/ticker/24hr`);

      // Supported quote currencies for trading pairs
      const supportedQuotes = ['USDT', 'BTC', 'ETH'];
      
      // Filter pairs that end with supported quote currencies
      const tickers = response.data
        .filter((ticker: any) => {
          const symbol = ticker.symbol;
          // Check if symbol ends with any supported quote currency
          return supportedQuotes.some(quote => {
            if (symbol.endsWith(quote)) {
              // Make sure it's not just the quote currency itself (e.g., avoid matching "BTC" as "BTC")
              const base = symbol.slice(0, -quote.length);
              return base.length > 0;
            }
            return false;
          });
        })
        .map((ticker: any) => ({
          symbol: ticker.symbol,
          price: cleanPrice(ticker.lastPrice),
          priceChange: cleanPrice(ticker.priceChange),
          priceChangePercent: cleanPrice(ticker.priceChangePercent),
          high: cleanPrice(ticker.highPrice),
          low: cleanPrice(ticker.lowPrice),
          volume: cleanPrice(ticker.volume),
          quoteVolume: cleanPrice(ticker.quoteVolume),
        }));

      // Cache for 2 seconds
      await this.setCache(cacheKey, tickers, 2);

      return successResponse(res, tickers);
    } catch (error) {
      logger.error('Get tickers error:', error);
      throw new AppError('GEN_004', 'Failed to fetch tickers', 500);
    }
  }

  // Get single ticker
  async getTicker(req: Request, res: Response) {
    try {
      const { symbol } = req.params;
      const uppercaseSymbol = symbol.toUpperCase();

      const cacheKey = `market:ticker:${uppercaseSymbol}`;
      const cached = await this.getFromCache(cacheKey);

      if (cached) {
        return successResponse(res, cached);
      }

      const response = await axios.get(`${this.binanceApi}/api/v3/ticker/24hr`, {
        params: { symbol: uppercaseSymbol },
      });

      const ticker = {
        symbol: response.data.symbol,
        price: cleanPrice(response.data.lastPrice),
        priceChange: cleanPrice(response.data.priceChange),
        priceChangePercent: cleanPrice(response.data.priceChangePercent),
        high: cleanPrice(response.data.highPrice),
        low: cleanPrice(response.data.lowPrice),
        volume: cleanPrice(response.data.volume),
        quoteVolume: cleanPrice(response.data.quoteVolume),
        openTime: response.data.openTime,
        closeTime: response.data.closeTime,
      };

      // Cache for 1 second
      await this.setCache(cacheKey, ticker, 1);

      return successResponse(res, ticker);
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new AppError('GEN_002', 'Invalid symbol', 404);
      }
      logger.error('Get ticker error:', error);
      throw new AppError('GEN_004', 'Failed to fetch ticker', 500);
    }
  }

  // Get order book
  async getOrderBook(req: Request, res: Response) {
    try {
      const { symbol } = req.params;
      const limit = validateLimit(req.query.limit, 20);
      const uppercaseSymbol = symbol.toUpperCase();

      const cacheKey = `market:orderbook:${uppercaseSymbol}:${limit}`;
      const cached = await this.getFromCache(cacheKey);

      if (cached) {
        return successResponse(res, cached);
      }

      const response = await axios.get(`${this.binanceApi}/api/v3/depth`, {
        params: {
          symbol: uppercaseSymbol,
          limit: Number(limit),
        },
      });

      const orderBook = {
        symbol: uppercaseSymbol,
        bids: response.data.bids.map((bid: any) => ({
          price: cleanPrice(bid[0]),
          quantity: cleanPrice(bid[1]),
        })),
        asks: response.data.asks.map((ask: any) => ({
          price: cleanPrice(ask[0]),
          quantity: cleanPrice(ask[1]),
        })),
      };

      // Cache for 1 second
      await this.setCache(cacheKey, orderBook, 1);

      return successResponse(res, orderBook);
    } catch (error) {
      logger.error('Get order book error:', error);
      throw new AppError('GEN_004', 'Failed to fetch order book', 500);
    }
  }

  // Get recent trades
  async getTrades(req: Request, res: Response) {
    try {
      const { symbol } = req.params;
      const limit = validateLimit(req.query.limit, 50);
      const uppercaseSymbol = symbol.toUpperCase();

      const cacheKey = `market:trades:${uppercaseSymbol}:${limit}`;
      const cached = await this.getFromCache(cacheKey);

      if (cached) {
        return successResponse(res, cached);
      }

      const response = await axios.get(`${this.binanceApi}/api/v3/trades`, {
        params: {
          symbol: uppercaseSymbol,
          limit: Number(limit),
        },
      });

      const trades = response.data.map((trade: any) => ({
        id: trade.id,
        price: cleanPrice(trade.price),
        quantity: cleanPrice(trade.qty),
        time: trade.time,
        isBuyerMaker: trade.isBuyerMaker,
      }));

      // Cache for 2 seconds
      await this.setCache(cacheKey, trades, 2);

      return successResponse(res, trades);
    } catch (error) {
      logger.error('Get trades error:', error);
      throw new AppError('GEN_004', 'Failed to fetch trades', 500);
    }
  }

  // Get candlestick data
  async getKlines(req: Request, res: Response) {
    try {
      const { symbol } = req.params;
      const interval = validateInterval(req.query.interval as string || '1h');
      const limit = validateLimit(req.query.limit, 100);
      const uppercaseSymbol = symbol.toUpperCase();

      const cacheKey = `market:klines:${uppercaseSymbol}:${interval}:${limit}`;
      const cached = await this.getFromCache(cacheKey);

      if (cached) {
        return successResponse(res, cached);
      }

      const response = await axios.get(`${this.binanceApi}/api/v3/klines`, {
        params: {
          symbol: uppercaseSymbol,
          interval,
          limit: Number(limit),
        },
      });

      const klines = response.data.map((kline: any) => ({
        openTime: kline[0],
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5]),
        closeTime: kline[6],
        quoteVolume: parseFloat(kline[7]),
        trades: kline[8],
      }));

      // Cache for 5 seconds
      await this.setCache(cacheKey, klines, 5);

      return successResponse(res, klines);
    } catch (error) {
      logger.error('Get klines error:', error);
      throw new AppError('GEN_004', 'Failed to fetch klines', 500);
    }
  }

  // Get 24hr stats
  async get24hrStats(req: Request, res: Response) {
    try {
      const { symbol } = req.params;
      const uppercaseSymbol = symbol.toUpperCase();

      const cacheKey = `market:24hr:${uppercaseSymbol}`;
      const cached = await this.getFromCache(cacheKey);

      if (cached) {
        return successResponse(res, cached);
      }

      const response = await axios.get(`${this.binanceApi}/api/v3/ticker/24hr`, {
        params: { symbol: uppercaseSymbol },
      });

      const stats = {
        symbol: response.data.symbol,
        priceChange: parseFloat(response.data.priceChange),
        priceChangePercent: parseFloat(response.data.priceChangePercent),
        weightedAvgPrice: parseFloat(response.data.weightedAvgPrice),
        prevClosePrice: parseFloat(response.data.prevClosePrice),
        lastPrice: parseFloat(response.data.lastPrice),
        bidPrice: parseFloat(response.data.bidPrice),
        askPrice: parseFloat(response.data.askPrice),
        openPrice: parseFloat(response.data.openPrice),
        highPrice: parseFloat(response.data.highPrice),
        lowPrice: parseFloat(response.data.lowPrice),
        volume: parseFloat(response.data.volume),
        quoteVolume: parseFloat(response.data.quoteVolume),
        openTime: response.data.openTime,
        closeTime: response.data.closeTime,
        count: response.data.count,
      };

      // Cache for 2 seconds
      await this.setCache(cacheKey, stats, 2);

      return successResponse(res, stats);
    } catch (error) {
      logger.error('Get 24hr stats error:', error);
      throw new AppError('GEN_004', 'Failed to fetch 24hr stats', 500);
    }
  }

  // Get user favorites
  async getFavorites(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const favorites = await prisma.favoritePair.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      return successResponse(res, { favorites: favorites.map(f => f.symbol) });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get favorites error:', error);
      throw new AppError('GEN_004', 'Failed to get favorites', 500);
    }
  }

  // Add favorite
  async addFavorite(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { symbol } = req.params;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      // Check if already exists
      const existing = await prisma.favoritePair.findFirst({
        where: { userId, symbol: symbol.toUpperCase() },
      });

      if (existing) {
        throw new AppError('FAV_001', 'Symbol already in favorites', 400);
      }

      // Check limit (max 50 favorites)
      const count = await prisma.favoritePair.count({ where: { userId } });
      if (count >= 50) {
        throw new AppError('FAV_002', 'Maximum 50 favorites allowed', 400);
      }

      await prisma.favoritePair.create({
        data: {
          userId,
          symbol: symbol.toUpperCase(),
        },
      });

      return successResponse(res, { message: 'Added to favorites' });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Add favorite error:', error);
      throw new AppError('GEN_004', 'Failed to add favorite', 500);
    }
  }

  // Remove favorite
  async removeFavorite(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { symbol } = req.params;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const favorite = await prisma.favoritePair.findFirst({
        where: { userId, symbol: symbol.toUpperCase() },
      });

      if (!favorite) {
        throw new AppError('FAV_003', 'Favorite not found', 404);
      }

      await prisma.favoritePair.delete({ where: { id: favorite.id } });

      return successResponse(res, { message: 'Removed from favorites' });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Remove favorite error:', error);
      throw new AppError('GEN_004', 'Failed to remove favorite', 500);
    }
  }

  // Get global market statistics
  async getGlobalStats(_req: Request, res: Response) {
    try {
      const cacheKey = 'market:global';
      
      // Try to get from cache
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        return successResponse(res, cached);
      }

      // Fetch all tickers to calculate global stats
      const response = await axios.get(`${this.binanceApi}/api/v3/ticker/24hr`);
      
      const supportedQuotes = ['USDT', 'BTC', 'ETH'];
      const tickers = response.data.filter((ticker: any) => {
        const symbol = ticker.symbol;
        return supportedQuotes.some(quote => {
          if (symbol.endsWith(quote)) {
            const base = symbol.slice(0, -quote.length);
            return base.length > 0;
          }
          return false;
        });
      });

      // Calculate global statistics
      let totalVolume24h = 0;
      let gainers = 0;
      let losers = 0;
      let unchanged = 0;

      tickers.forEach((ticker: any) => {
        totalVolume24h += parseFloat(ticker.quoteVolume) || 0;
        const change = parseFloat(ticker.priceChangePercent);
        if (change > 0) gainers++;
        else if (change < 0) losers++;
        else unchanged++;
      });

      const globalStats = {
        totalMarkets: tickers.length,
        totalVolume24h,
        gainers,
        losers,
        unchanged,
        btcDominance: 45.2, // Placeholder - would need CoinGecko API for real data
        marketCapChange24h: 2.5, // Placeholder
        lastUpdated: new Date().toISOString(),
      };

      // Cache for 30 seconds
      await this.setCache(cacheKey, globalStats, 30);

      return successResponse(res, globalStats);
    } catch (error) {
      logger.error('Get global stats error:', error);
      throw new AppError('GEN_004', 'Failed to fetch global stats', 500);
    }
  }
}
