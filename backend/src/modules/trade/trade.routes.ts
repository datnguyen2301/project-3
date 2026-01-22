import { Router, Request, Response, NextFunction } from 'express';
import tradeController from './trade.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { body, validationResult } from 'express-validator';

const router = Router();

// Validation middleware
const validate = (validations: any[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    for (const validation of validations) {
      await validation.run(req);
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    return next();
  };
};

// Validation schemas
const buyCryptoSchema = [
  body('cryptoCurrency')
    .isString()
    .notEmpty()
    .withMessage('Vui lòng chọn loại crypto'),
  body('amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Số lượng không hợp lệ'),
  body('quoteAmount')
    .optional()
    .isFloat({ min: 10000 })
    .withMessage('Số tiền tối thiểu 10,000 VND'),
];

const sellCryptoSchema = [
  body('cryptoCurrency')
    .isString()
    .notEmpty()
    .withMessage('Vui lòng chọn loại crypto'),
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Số lượng không hợp lệ'),
];

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/trade/quote
 * Lấy báo giá trước khi mua/bán
 * Query: cryptoCurrency, amount?, quoteAmount?, side?
 */
router.get('/quote', (req: Request, res: Response, next: NextFunction) =>
  tradeController.getQuote(req, res).catch(next)
);

/**
 * POST /api/trade/buy
 * Mua crypto bằng VND
 * Body: { cryptoCurrency, amount?, quoteAmount? }
 */
router.post('/buy', validate(buyCryptoSchema), (req: Request, res: Response, next: NextFunction) =>
  tradeController.buyCrypto(req, res).catch(next)
);

/**
 * POST /api/trade/sell
 * Bán crypto lấy VND
 * Body: { cryptoCurrency, amount }
 */
router.post('/sell', validate(sellCryptoSchema), (req: Request, res: Response, next: NextFunction) =>
  tradeController.sellCrypto(req, res).catch(next)
);

/**
 * GET /api/trade/history
 * Lấy lịch sử giao dịch mua/bán
 * Query: page?, limit?, symbol?
 */
router.get('/history', (req: Request, res: Response, next: NextFunction) =>
  tradeController.getTradeHistory(req, res).catch(next)
);

export default router;
