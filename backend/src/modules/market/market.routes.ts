import { Router, Request, Response, NextFunction } from 'express';
import { MarketController } from './market.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';

const router = Router();
const marketController = new MarketController();

// Public routes - no authentication required
router.get('/tickers', (req: Request, res: Response, next: NextFunction) => marketController.getTickers(req, res).catch(next));

router.get('/ticker/:symbol', (req: Request, res: Response, next: NextFunction) => marketController.getTicker(req, res).catch(next));

router.get('/orderbook/:symbol', (req: Request, res: Response, next: NextFunction) =>
  marketController.getOrderBook(req, res).catch(next)
);

router.get('/trades/:symbol', (req: Request, res: Response, next: NextFunction) => marketController.getTrades(req, res).catch(next));

router.get('/klines/:symbol', (req: Request, res: Response, next: NextFunction) => marketController.getKlines(req, res).catch(next));

router.get('/24hr/:symbol', (req: Request, res: Response, next: NextFunction) => marketController.get24hrStats(req, res).catch(next));

// Global market statistics
router.get('/global', (req: Request, res: Response, next: NextFunction) => marketController.getGlobalStats(req, res).catch(next));

// Favorites (authenticated routes)
router.get('/favorites', authenticate, (req: Request, res: Response, next: NextFunction) =>
  marketController.getFavorites(req, res).catch(next)
);

router.post('/favorites/:symbol', authenticate, (req: Request, res: Response, next: NextFunction) =>
  marketController.addFavorite(req, res).catch(next)
);

router.delete('/favorites/:symbol', authenticate, (req: Request, res: Response, next: NextFunction) =>
  marketController.removeFavorite(req, res).catch(next)
);

export default router;
