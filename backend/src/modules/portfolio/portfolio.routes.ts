import { Router, Request, Response, NextFunction } from 'express';
import { PortfolioController } from './portfolio.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';

const router = Router();
const portfolioController = new PortfolioController();

// All routes require authentication
router.use(authenticate);

router.get('/', (req: Request, res: Response, next: NextFunction) => portfolioController.getPortfolio(req, res).catch(next));

router.get('/balance', (req: Request, res: Response, next: NextFunction) => portfolioController.getBalance(req, res).catch(next));

router.get('/history', (req: Request, res: Response, next: NextFunction) => portfolioController.getHistory(req, res).catch(next));

router.get('/pnl', (req: Request, res: Response, next: NextFunction) => portfolioController.getPnL(req, res).catch(next));

// Analytics routes
router.get('/performance', (req: Request, res: Response, next: NextFunction) =>
  portfolioController.getPerformance(req, res).catch(next)
);

router.get('/allocation', (req: Request, res: Response, next: NextFunction) =>
  portfolioController.getAssetAllocation(req, res).catch(next)
);

router.get('/export', (req: Request, res: Response, next: NextFunction) =>
  portfolioController.exportTradeHistory(req, res).catch(next)
);

export default router;
