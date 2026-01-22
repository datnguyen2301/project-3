import { Router, Request, Response, NextFunction } from 'express';
import { EarnController } from './earn.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { body, param, validationResult } from 'express-validator';

const router = Router();
const earnController = new EarnController();

// Validation middleware for express-validator
const validate = (validations: any[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    for (const validation of validations) {
      await validation.run(req);
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    return next();
  };
};

// Validation schemas
const stakeSchema = [
  body('productId').isString().notEmpty().withMessage('Product ID is required'),
  body('amount').isFloat({ min: 0.00000001 }).withMessage('Amount must be greater than 0'),
];

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/earn/products
 * Get all available earn products
 * Query: ?type=FLEXIBLE|LOCKED
 */
router.get('/products', (req: Request, res: Response, next: NextFunction) =>
  earnController.getProducts(req, res).catch(next)
);

/**
 * POST /api/earn/stake
 * Stake into an earn product
 * Body: { productId, amount }
 */
router.post('/stake', validate(stakeSchema), (req: Request, res: Response, next: NextFunction) =>
  earnController.stake(req, res).catch(next)
);

/**
 * POST /api/earn/unstake/:stakeId
 * Unstake from an earn product
 */
router.post('/unstake/:stakeId', 
  param('stakeId').isUUID().withMessage('Invalid stake ID'),
  (req: Request, res: Response, next: NextFunction) =>
    earnController.unstake(req, res).catch(next)
);

/**
 * GET /api/earn/my-stakes
 * Get user's active and completed stakes
 */
router.get('/my-stakes', (req: Request, res: Response, next: NextFunction) =>
  earnController.getMyStakes(req, res).catch(next)
);

/**
 * GET /api/earn/rewards
 * Get reward history
 */
router.get('/rewards', (req: Request, res: Response, next: NextFunction) =>
  earnController.getRewards(req, res).catch(next)
);

export default router;
