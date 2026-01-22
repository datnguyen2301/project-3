import { Router, Request, Response, NextFunction } from 'express';
import { FiatController } from './fiat.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { body, validationResult } from 'express-validator';
import express from 'express';

const router = Router();
const fiatController = new FiatController();

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
const initiateBuySchema = [
  body('method').isIn(['stripe_card', 'bank_transfer']).withMessage('Invalid payment method'),
  body('fiatAmount').isFloat({ min: 10 }).withMessage('Minimum amount is 10'),
  body('fiatCurrency').isIn(['USD', 'EUR', 'GBP']).withMessage('Invalid currency'),
  body('cryptoSymbol').isString().withMessage('Crypto symbol is required'),
];

const createDepositSchema = [
  body('amount').isFloat({ min: 10000 }).withMessage('Số tiền tối thiểu 10,000 VND'),
  body('paymentMethod')
    .optional()
    .isIn(['VNPAY', 'MOMO', 'ZALOPAY', 'BANK_TRANSFER'])
    .withMessage('Phương thức thanh toán không hợp lệ'),
  body('method')
    .optional()
    .isIn(['VNPAY', 'MOMO', 'ZALOPAY', 'BANK_TRANSFER', 'vnpay', 'momo', 'zalopay', 'bank_transfer'])
    .withMessage('Phương thức thanh toán không hợp lệ'),
  body('currency').optional().isIn(['VND']).withMessage('Currency không hợp lệ'),
];

// Public routes - Webhooks (không cần authentication)

/**
 * POST /api/fiat/webhook/stripe
 * Stripe webhook handler (no authentication required)
 */
router.post(
  '/webhook/stripe',
  express.raw({ type: 'application/json' }),
  (req: any, res: any) => fiatController.handleStripeWebhook(req, res)
);

/**
 * GET /api/fiat/vnpay/return
 * VNPay return URL (no authentication required)
 */
router.get('/vnpay/return', (req: Request, res: Response, next: NextFunction) =>
  fiatController.vnpayReturn(req, res).catch(next)
);

/**
 * POST /api/fiat/webhook/momo
 * MoMo IPN callback (no authentication required)
 */
router.post('/webhook/momo', (req: Request, res: Response, next: NextFunction) =>
  fiatController.momoCallback(req, res).catch(next)
);

/**
 * POST /api/fiat/webhook/payment
 * Generic payment webhook handler (no authentication required)
 * Hỗ trợ callback từ nhiều gateway: vnpay, momo, stripe, etc.
 */
router.post('/webhook/payment', (req: Request, res: Response, next: NextFunction) =>
  fiatController.paymentWebhook(req, res).catch(next)
);

/**
 * GET /api/fiat/deposit/methods
 * Lấy danh sách phương thức nạp tiền khả dụng (Public - không cần auth)
 */
router.get('/deposit/methods', (req: Request, res: Response, next: NextFunction) =>
  fiatController.getDepositMethods(req, res).catch(next)
);

/**
 * GET /api/fiat/deposit-methods
 * Alias cho /deposit/methods - Frontend gọi endpoint này
 */
router.get('/deposit-methods', (req: Request, res: Response, next: NextFunction) =>
  fiatController.getDepositMethods(req, res).catch(next)
);

// Protected routes
router.use(authenticate);

/**
 * GET /api/fiat/methods
 * Get available payment methods
 */
router.get('/methods', (req: Request, res: Response, next: NextFunction) =>
  fiatController.getPaymentMethods(req, res).catch(next)
);

/**
 * POST /api/fiat/buy
 * Initiate buy crypto with fiat
 */
router.post('/buy', validate(initiateBuySchema), (req: Request, res: Response, next: NextFunction) =>
  fiatController.initiateBuy(req, res).catch(next)
);

/**
 * GET /api/fiat/transactions
 * Get transaction history
 */
router.get('/transactions', (req: Request, res: Response, next: NextFunction) =>
  fiatController.getTransactions(req, res).catch(next)
);

/**
 * POST /api/fiat/deposit
 * Tạo yêu cầu nạp tiền (VNPay/MoMo/ZaloPay/Bank Transfer)
 */
router.post('/deposit', validate(createDepositSchema), (req: Request, res: Response, next: NextFunction) =>
  fiatController.createDeposit(req, res).catch(next)
);

/**
 * POST /api/fiat/deposit/create
 * Alias for /deposit - Frontend compatibility
 */
router.post('/deposit/create', validate(createDepositSchema), (req: Request, res: Response, next: NextFunction) =>
  fiatController.createDeposit(req, res).catch(next)
);

/**
 * GET /api/fiat/deposit/history
 * Lấy lịch sử nạp tiền
 */
router.get('/deposit/history', (req: Request, res: Response, next: NextFunction) =>
  fiatController.getDepositHistory(req, res).catch(next)
);

/**
 * POST /api/fiat/deposit/demo-confirm
 * Demo: Xác nhận thanh toán giả lập (chỉ dùng cho development)
 */
router.post('/deposit/demo-confirm', (req: Request, res: Response, next: NextFunction) =>
  fiatController.confirmDemoPayment(req, res).catch(next)
);

/**
 * GET /api/fiat/deposit/:id
 * Kiểm tra trạng thái nạp tiền theo ID
 */
router.get('/deposit/:id', (req: Request, res: Response, next: NextFunction) =>
  fiatController.getDepositStatus(req, res).catch(next)
);

/**
 * POST /api/fiat/deposit/:transactionId/confirm
 * Admin: Xác nhận nạp tiền thủ công (Bank Transfer)
 */
router.post('/deposit/:transactionId/confirm', (req: Request, res: Response, next: NextFunction) =>
  fiatController.confirmBankTransfer(req, res).catch(next)
);

export default router;
