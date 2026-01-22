import { Router, Request, Response, NextFunction } from 'express';
import { adminController } from './admin.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';

const router = Router();

// asyncHandler wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) => 
  (req: Request, res: Response, next: NextFunction) => 
    Promise.resolve(fn(req, res, next)).catch(next);

// All routes require authentication
router.use(authenticate);

// Dashboard
router.get('/dashboard', asyncHandler(adminController.getDashboardStats));

// User Management
router.get('/users', asyncHandler(adminController.getAllUsers));
router.get('/users/:id', asyncHandler(adminController.getUserDetail));
router.patch('/users/:id/block', asyncHandler(adminController.blockUser));
router.patch('/users/:id/role', asyncHandler(adminController.updateUserRole));
router.delete('/users/:id', asyncHandler(adminController.deleteUser));

// KYC Management
router.get('/kyc', asyncHandler(adminController.getPendingKYC));
router.patch('/kyc/:id', asyncHandler(adminController.approveKYC));

// Deposit Management
router.get('/deposits', asyncHandler(adminController.getPendingDeposits));
router.patch('/deposits/:id', asyncHandler(adminController.approveDeposit));

// Withdrawal Management
router.get('/withdrawals', asyncHandler(adminController.getPendingWithdrawals));
router.post('/withdrawals/:id/approve', asyncHandler(adminController.approveWithdrawal));
router.post('/withdrawals/:id/reject', asyncHandler(adminController.rejectWithdrawal));

// System Logs
router.get('/logs', asyncHandler(adminController.getSystemLogs));

// System Settings
router.get('/settings', asyncHandler(adminController.getSettings));
router.patch('/settings', asyncHandler(adminController.updateSettings));

// Bank Accounts Management
router.get('/bank-accounts', asyncHandler(adminController.getBankAccounts));
router.post('/bank-accounts', asyncHandler(adminController.addBankAccount));
router.delete('/bank-accounts/:id', asyncHandler(adminController.deleteBankAccount));

export default router;
