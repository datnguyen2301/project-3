import { Router, Request, Response, NextFunction } from 'express';
import { PriceAlertController } from './priceAlert.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { validate } from '../../common/middlewares/validation.middleware';
import { createPriceAlertSchema } from '../../common/validators/priceAlert.validator';

const router = Router();
const priceAlertController = new PriceAlertController();

// All routes require authentication
router.use(authenticate);

// Get all alerts
router.get('/', (req: Request, res: Response, next: NextFunction) =>
  priceAlertController.getAlerts(req, res).catch(next)
);

// Create alert
router.post('/', validate(createPriceAlertSchema), (req: Request, res: Response, next: NextFunction) =>
  priceAlertController.createAlert(req, res).catch(next)
);

// Delete alert
router.delete('/:id', (req: Request, res: Response, next: NextFunction) =>
  priceAlertController.deleteAlert(req, res).catch(next)
);

// Toggle alert active status
router.patch('/:id/toggle', (req: Request, res: Response, next: NextFunction) =>
  priceAlertController.toggleAlert(req, res).catch(next)
);

export default router;
