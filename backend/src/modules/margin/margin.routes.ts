import { Router, Request, Response, NextFunction } from 'express';
import { MarginController } from './margin.controller';
import { authenticate, requireKYC } from '../../common/middlewares/auth.middleware';
import { validate } from '../../common/middlewares/validation.middleware';
import { borrowSchema, repaySchema, createMarginOrderSchema } from '../../common/validators/margin.validator';
import { tradingLimiter } from '../../common/middlewares/rateLimit.middleware';

const router = Router();
const marginController = new MarginController();

// All routes require authentication and KYC level 2
router.use(authenticate, requireKYC(2));

// Get margin account
router.get('/account', (req: Request, res: Response, next: NextFunction) =>
  marginController.getMarginAccount(req, res).catch(next)
);

// Borrow assets
router.post('/borrow', tradingLimiter, validate(borrowSchema), (req: Request, res: Response, next: NextFunction) =>
  marginController.borrow(req, res).catch(next)
);

// Repay loan
router.post('/repay', tradingLimiter, validate(repaySchema), (req: Request, res: Response, next: NextFunction) =>
  marginController.repay(req, res).catch(next)
);

// Get loan history
router.get('/loans', (req: Request, res: Response, next: NextFunction) =>
  marginController.getLoanHistory(req, res).catch(next)
);

// Create margin order
router.post('/orders', tradingLimiter, validate(createMarginOrderSchema), (req: Request, res: Response, next: NextFunction) =>
  marginController.createMarginOrder(req, res).catch(next)
);

// Get margin level (risk indicator)
router.get('/level', (req: Request, res: Response, next: NextFunction) =>
  marginController.getMarginLevel(req, res).catch(next)
);

export default router;
