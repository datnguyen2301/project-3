import { Router, Request, Response, NextFunction } from 'express';
import withdrawalController from './withdrawal.controller';
import { authenticate, requireAdmin } from '../../common/middlewares/auth.middleware';
import { body, validationResult } from 'express-validator';
import { generalLimiter } from '../../common/middlewares/rateLimit.middleware';

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
const createWithdrawalSchema = [
  body('amount').isFloat({ min: 50000 }).withMessage('Số tiền tối thiểu 50,000 VND'),
  body('bankAccountId').isString().notEmpty().withMessage('Vui lòng chọn tài khoản ngân hàng'),
  body('currency').optional().isIn(['VND']).withMessage('Currency không hợp lệ'),
];

const approveSchema = [
  body('note').optional().isString(),
];

const completeSchema = [
  body('transactionRef').optional().isString(),
  body('note').optional().isString(),
];

const rejectSchema = [
  body('reason').isString().notEmpty().withMessage('Vui lòng nhập lý do từ chối'),
];

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/withdrawals/admin/all
 * Admin: Lấy tất cả yêu cầu rút tiền
 */
router.get('/admin/all', requireAdmin, (req: Request, res: Response, next: NextFunction) =>
  withdrawalController.getAdminWithdrawals(req, res).catch(next)
);

/**
 * GET /api/withdrawals
 * Lấy lịch sử rút tiền của user
 */
router.get('/', (req: Request, res: Response, next: NextFunction) =>
  withdrawalController.getWithdrawalHistory(req, res).catch(next)
);

/**
 * GET /api/withdrawals/:id
 * Lấy chi tiết 1 yêu cầu rút tiền
 */
router.get('/:id', (req: Request, res: Response, next: NextFunction) =>
  withdrawalController.getWithdrawalStatus(req, res).catch(next)
);

/**
 * POST /api/withdrawals/create
 * Tạo yêu cầu rút tiền mới
 */
router.post('/create', validate(createWithdrawalSchema), (req: Request, res: Response, next: NextFunction) =>
  withdrawalController.createWithdrawal(req, res).catch(next)
);

/**
 * POST /api/withdrawals
 * Alias cho /create (tương thích frontend)
 */
router.post('/', validate(createWithdrawalSchema), (req: Request, res: Response, next: NextFunction) =>
  withdrawalController.createWithdrawal(req, res).catch(next)
);

/**
 * DELETE /api/withdrawals/:id
 * Hủy yêu cầu rút tiền (chỉ khi PENDING)
 */
router.delete('/:id', (req: Request, res: Response, next: NextFunction) =>
  withdrawalController.cancelWithdrawal(req, res).catch(next)
);

/**
 * PATCH /api/withdrawals/:id/approve
 * Admin: Duyệt yêu cầu rút tiền
 */
router.patch('/:id/approve', requireAdmin, generalLimiter, validate(approveSchema), (req: Request, res: Response, next: NextFunction) =>
  withdrawalController.approveWithdrawal(req, res).catch(next)
);

/**
 * PATCH /api/withdrawals/:id/complete
 * Admin: Hoàn thành rút tiền (đã chuyển tiền)
 */
router.patch('/:id/complete', requireAdmin, generalLimiter, validate(completeSchema), (req: Request, res: Response, next: NextFunction) =>
  withdrawalController.completeWithdrawal(req, res).catch(next)
);

/**
 * PATCH /api/withdrawals/:id/reject
 * Admin: Từ chối rút tiền
 */
router.patch('/:id/reject', requireAdmin, generalLimiter, validate(rejectSchema), (req: Request, res: Response, next: NextFunction) =>
  withdrawalController.rejectWithdrawal(req, res).catch(next)
);

export default router;
