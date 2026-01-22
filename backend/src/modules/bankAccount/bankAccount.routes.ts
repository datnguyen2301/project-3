import { Router, Request, Response, NextFunction } from 'express';
import bankAccountController from './bankAccount.controller';
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
const addBankAccountSchema = [
  body('bankName').isString().notEmpty().withMessage('Tên ngân hàng không được để trống'),
  body('accountNumber').isString().notEmpty().withMessage('Số tài khoản không được để trống'),
  body('accountName').isString().notEmpty().withMessage('Tên chủ tài khoản không được để trống'),
  body('bankCode').optional().isString(),
];

const updateBankAccountSchema = [
  body('bankName').optional().isString(),
  body('accountNumber').optional().isString(),
  body('accountName').optional().isString(),
];

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/bank-accounts/banks
 * Lấy danh sách ngân hàng Việt Nam
 */
router.get('/banks', (req: Request, res: Response, next: NextFunction) =>
  bankAccountController.getBankList(req, res).catch(next)
);

/**
 * GET /api/bank-accounts/admin/unverified
 * Admin: Lấy danh sách tài khoản chờ xác minh
 */
router.get('/admin/unverified', requireAdmin, (req: Request, res: Response, next: NextFunction) =>
  bankAccountController.getUnverifiedBankAccounts(req, res).catch(next)
);

/**
 * GET /api/bank-accounts
 * Lấy danh sách tài khoản ngân hàng của user
 */
router.get('/', (req: Request, res: Response, next: NextFunction) =>
  bankAccountController.getBankAccounts(req, res).catch(next)
);

/**
 * GET /api/bank-accounts/:id
 * Lấy chi tiết 1 tài khoản ngân hàng
 */
router.get('/:id', (req: Request, res: Response, next: NextFunction) =>
  bankAccountController.getBankAccountById(req, res).catch(next)
);

/**
 * POST /api/bank-accounts
 * Thêm tài khoản ngân hàng mới
 */
router.post('/', validate(addBankAccountSchema), (req: Request, res: Response, next: NextFunction) =>
  bankAccountController.addBankAccount(req, res).catch(next)
);

/**
 * PUT /api/bank-accounts/:id
 * Cập nhật tài khoản ngân hàng
 */
router.put('/:id', validate(updateBankAccountSchema), (req: Request, res: Response, next: NextFunction) =>
  bankAccountController.updateBankAccount(req, res).catch(next)
);

/**
 * PATCH /api/bank-accounts/:id/default
 * Đặt làm tài khoản mặc định
 */
router.patch('/:id/default', (req: Request, res: Response, next: NextFunction) =>
  bankAccountController.setDefaultBankAccount(req, res).catch(next)
);

/**
 * DELETE /api/bank-accounts/:id
 * Xóa tài khoản ngân hàng
 */
router.delete('/:id', (req: Request, res: Response, next: NextFunction) =>
  bankAccountController.deleteBankAccount(req, res).catch(next)
);

/**
 * PATCH /api/bank-accounts/:id/verify
 * Admin: Xác minh tài khoản ngân hàng
 */
router.patch('/:id/verify', requireAdmin, generalLimiter, (req: Request, res: Response, next: NextFunction) =>
  bankAccountController.verifyBankAccount(req, res).catch(next)
);

export default router;
