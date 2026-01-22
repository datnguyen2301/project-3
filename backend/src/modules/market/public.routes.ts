// Public Market Routes - Simplified for frontend
import { Router, Request, Response, NextFunction } from 'express';
import { MarketController } from './market.controller';

const router = Router();
const marketController = new MarketController();

// Simplified public routes matching frontend expectations
// GET /api/tickers - Get all tickers
router.get('/tickers', (req: Request, res: Response, next: NextFunction) => 
  marketController.getTickers(req, res).catch(next)
);

// GET /api/tickers/:symbol - Get specific ticker
router.get('/tickers/:symbol', (req: Request, res: Response, next: NextFunction) => 
  marketController.getTicker(req, res).catch(next)
);

// GET /api/orderbook/:symbol - Get order book
router.get('/orderbook/:symbol', (req: Request, res: Response, next: NextFunction) =>
  marketController.getOrderBook(req, res).catch(next)
);

// GET /api/trades/:symbol - Get recent trades
router.get('/trades/:symbol', (req: Request, res: Response, next: NextFunction) => 
  marketController.getTrades(req, res).catch(next)
);

// GET /api/klines/:symbol - Get candlestick data
router.get('/klines/:symbol', (req: Request, res: Response, next: NextFunction) => 
  marketController.getKlines(req, res).catch(next)
);

export default router;
