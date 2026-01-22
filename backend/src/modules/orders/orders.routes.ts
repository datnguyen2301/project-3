import { Router, Request, Response, NextFunction } from 'express';
import { OrderController } from './orders.controller';
import { AdvancedOrderController } from './advancedOrder.controller';
import { authenticate, requireVerified } from '../../common/middlewares/auth.middleware';
import { validate, validateQuery } from '../../common/middlewares/validation.middleware';
import { tradingLimiter } from '../../common/middlewares/rateLimit.middleware';
import { createOrderSchema, getOrdersSchema } from '../../common/validators/order.validator';
import { createAdvancedOrderSchema, createOCOOrderSchema } from '../../common/validators/advancedOrder.validator';

const router = Router();
const orderController = new OrderController();
const advancedOrderController = new AdvancedOrderController();

// All routes require authentication and verified email
router.use(authenticate, requireVerified);

router.post('/', tradingLimiter, validate(createOrderSchema), (req: Request, res: Response, next: NextFunction) =>
  orderController.createOrder(req, res).catch(next)
);

router.get('/', validateQuery(getOrdersSchema), (req: Request, res: Response, next: NextFunction) =>
  orderController.getOrders(req, res).catch(next)
);

// Get open orders (alias for / with status=OPEN filter)
router.get('/open', (req: Request, res: Response, next: NextFunction) =>
  orderController.getOpenOrders(req, res).catch(next)
);

router.get('/history', validateQuery(getOrdersSchema), (req: Request, res: Response, next: NextFunction) =>
  orderController.getOrderHistory(req, res).catch(next)
);

router.get('/:id', (req: Request, res: Response, next: NextFunction) => orderController.getOrder(req, res).catch(next));

router.delete('/:id', (req: Request, res: Response, next: NextFunction) => orderController.cancelOrder(req, res).catch(next));

// Advanced order types
router.post('/advanced/stop', tradingLimiter, validate(createAdvancedOrderSchema), (req: Request, res: Response, next: NextFunction) =>
  advancedOrderController.createStopOrder(req, res).catch(next)
);

router.post('/advanced/trailing', tradingLimiter, validate(createAdvancedOrderSchema), (req: Request, res: Response, next: NextFunction) =>
  advancedOrderController.createTrailingStopOrder(req, res).catch(next)
);

router.post('/advanced/oco', tradingLimiter, validate(createOCOOrderSchema), (req: Request, res: Response, next: NextFunction) =>
  advancedOrderController.createOCOOrder(req, res).catch(next)
);

export default router;
