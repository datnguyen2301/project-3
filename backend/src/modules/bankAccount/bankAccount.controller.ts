import { Response } from 'express';
import prisma from '../../config/database';
import { successResponse, AppError } from '../../common/utils/response.utils';
import { AuthRequest } from '../../common/middlewares/auth.middleware';
import logger from '../../config/logger';
import { sendNotificationToUser } from '../../websocket/notificationHandler';

// Danh sách ngân hàng Việt Nam phổ biến
const VIETNAM_BANKS = [
  { code: 'VCB', name: 'Vietcombank' },
  { code: 'TCB', name: 'Techcombank' },
  { code: 'MB', name: 'MB Bank' },
  { code: 'ACB', name: 'ACB' },
  { code: 'VPB', name: 'VPBank' },
  { code: 'BIDV', name: 'BIDV' },
  { code: 'VTB', name: 'VietinBank' },
  { code: 'TPB', name: 'TPBank' },
  { code: 'SHB', name: 'SHB' },
  { code: 'HDB', name: 'HDBank' },
  { code: 'OCB', name: 'OCB' },
  { code: 'MSB', name: 'MSB' },
  { code: 'SCB', name: 'SCB' },
  { code: 'EIB', name: 'Eximbank' },
  { code: 'STB', name: 'Sacombank' },
  { code: 'VIB', name: 'VIB' },
  { code: 'NAB', name: 'Nam A Bank' },
  { code: 'BAB', name: 'Bac A Bank' },
  { code: 'SEAB', name: 'SeABank' },
  { code: 'ABB', name: 'ABBANK' },
];

export class BankAccountController {
  /**
   * Lấy danh sách ngân hàng Việt Nam
   */
  async getBankList(_req: AuthRequest, res: Response) {
    return successResponse(res, {
      banks: VIETNAM_BANKS,
    });
  }

  /**
   * Thêm tài khoản ngân hàng mới
   * POST /api/bank-accounts
   */
  async addBankAccount(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { bankCode, bankName, accountNumber, accountName } = req.body;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      // Validate
      if (!bankName || !accountNumber || !accountName) {
        throw new AppError('BANK_001', 'Vui lòng điền đầy đủ thông tin', 400);
      }

      // Kiểm tra số tài khoản hợp lệ (chỉ số, 6-20 ký tự)
      const cleanAccountNumber = accountNumber.replace(/\s/g, '');
      if (!/^\d{6,20}$/.test(cleanAccountNumber)) {
        throw new AppError('BANK_002', 'Số tài khoản không hợp lệ', 400);
      }

      // Kiểm tra trùng lặp
      const existing = await prisma.bankAccount.findFirst({
        where: {
          userId,
          accountNumber: cleanAccountNumber,
          bankName,
        },
      });

      if (existing) {
        throw new AppError('BANK_003', 'Tài khoản ngân hàng này đã tồn tại', 400);
      }

      // Đếm số lượng tài khoản hiện có
      const count = await prisma.bankAccount.count({ where: { userId } });
      const isFirstAccount = count === 0;

      // Tạo tài khoản ngân hàng
      const bankAccount = await prisma.bankAccount.create({
        data: {
          userId,
          bankCode: bankCode || undefined,
          bankName,
          accountNumber: cleanAccountNumber,
          accountName: accountName.toUpperCase().trim(),
          isDefault: isFirstAccount,
          isVerified: false,
        },
      });

      logger.info(`Bank account added: ${bankAccount.id} for user ${userId}`);

      return successResponse(res, {
        bankAccount: {
          id: bankAccount.id,
          bankCode: bankAccount.bankCode,
          bankName: bankAccount.bankName,
          accountNumber: bankAccount.accountNumber,
          accountName: bankAccount.accountName,
          isDefault: bankAccount.isDefault,
          isVerified: bankAccount.isVerified,
          createdAt: bankAccount.createdAt,
        },
        message: isFirstAccount
          ? 'Đã thêm tài khoản ngân hàng mặc định'
          : 'Đã thêm tài khoản ngân hàng. Vui lòng chờ xác minh.',
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Add bank account error:', error);
      throw new AppError('GEN_004', 'Không thể thêm tài khoản ngân hàng', 500);
    }
  }

  /**
   * Lấy danh sách tài khoản ngân hàng của user
   * GET /api/bank-accounts
   */
  async getBankAccounts(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const bankAccounts = await prisma.bankAccount.findMany({
        where: { userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });

      return successResponse(res, {
        bankAccounts: bankAccounts.map((acc) => ({
          id: acc.id,
          bankCode: acc.bankCode,
          bankName: acc.bankName,
          accountNumber: acc.accountNumber,
          accountName: acc.accountName,
          isDefault: acc.isDefault,
          isVerified: acc.isVerified,
          createdAt: acc.createdAt,
        })),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get bank accounts error:', error);
      throw new AppError('GEN_004', 'Không thể lấy danh sách tài khoản ngân hàng', 500);
    }
  }

  /**
   * Lấy chi tiết 1 tài khoản ngân hàng
   * GET /api/bank-accounts/:id
   */
  async getBankAccountById(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const bankAccount = await prisma.bankAccount.findFirst({
        where: { id, userId },
      });

      if (!bankAccount) {
        throw new AppError('BANK_004', 'Tài khoản ngân hàng không tồn tại', 404);
      }

      return successResponse(res, {
        bankAccount: {
          id: bankAccount.id,
          bankCode: bankAccount.bankCode,
          bankName: bankAccount.bankName,
          accountNumber: bankAccount.accountNumber,
          accountName: bankAccount.accountName,
          isDefault: bankAccount.isDefault,
          isVerified: bankAccount.isVerified,
          createdAt: bankAccount.createdAt,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get bank account error:', error);
      throw new AppError('GEN_004', 'Không thể lấy thông tin tài khoản ngân hàng', 500);
    }
  }

  /**
   * Cập nhật tài khoản ngân hàng
   * PUT /api/bank-accounts/:id
   */
  async updateBankAccount(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      const { bankName, accountNumber, accountName } = req.body;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const bankAccount = await prisma.bankAccount.findFirst({
        where: { id, userId },
      });

      if (!bankAccount) {
        throw new AppError('BANK_004', 'Tài khoản ngân hàng không tồn tại', 404);
      }

      // Không cho phép sửa tài khoản đã xác minh
      if (bankAccount.isVerified) {
        throw new AppError('BANK_005', 'Không thể sửa tài khoản đã xác minh', 400);
      }

      const updateData: any = {};
      if (bankName) updateData.bankName = bankName;
      if (accountNumber) {
        const cleanAccountNumber = accountNumber.replace(/\s/g, '');
        if (!/^\d{6,20}$/.test(cleanAccountNumber)) {
          throw new AppError('BANK_002', 'Số tài khoản không hợp lệ', 400);
        }
        updateData.accountNumber = cleanAccountNumber;
      }
      if (accountName) updateData.accountName = accountName.toUpperCase().trim();

      const updated = await prisma.bankAccount.update({
        where: { id },
        data: updateData,
      });

      logger.info(`Bank account updated: ${id} for user ${userId}`);

      return successResponse(res, {
        bankAccount: {
          id: updated.id,
          bankCode: updated.bankCode,
          bankName: updated.bankName,
          accountNumber: updated.accountNumber,
          accountName: updated.accountName,
          isDefault: updated.isDefault,
          isVerified: updated.isVerified,
        },
        message: 'Đã cập nhật tài khoản ngân hàng',
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Update bank account error:', error);
      throw new AppError('GEN_004', 'Không thể cập nhật tài khoản ngân hàng', 500);
    }
  }

  /**
   * Đặt làm tài khoản mặc định
   * PATCH /api/bank-accounts/:id/default
   */
  async setDefaultBankAccount(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      await prisma.$transaction(async (tx) => {
        const bankAccount = await tx.bankAccount.findFirst({
          where: { id, userId },
        });

        if (!bankAccount) {
          throw new AppError('BANK_004', 'Tài khoản ngân hàng không tồn tại', 404);
        }

        // Bỏ mặc định tất cả tài khoản khác
        await tx.bankAccount.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });

        // Đặt tài khoản này làm mặc định
        await tx.bankAccount.update({
          where: { id },
          data: { isDefault: true },
        });
      });

      logger.info(`Bank account set as default: ${id} for user ${userId}`);

      return successResponse(res, {
        message: 'Đã đặt làm tài khoản mặc định',
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Set default bank account error:', error);
      throw new AppError('GEN_004', 'Không thể đặt tài khoản mặc định', 500);
    }
  }

  /**
   * Xóa tài khoản ngân hàng
   * DELETE /api/bank-accounts/:id
   */
  async deleteBankAccount(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const bankAccount = await prisma.bankAccount.findFirst({
        where: { id, userId },
      });

      if (!bankAccount) {
        throw new AppError('BANK_004', 'Tài khoản ngân hàng không tồn tại', 404);
      }

      // Kiểm tra có pending withdrawal không
      const pendingWithdrawal = await prisma.fiatTransaction.findFirst({
        where: {
          bankAccountId: id,
          status: { in: ['PENDING', 'APPROVED', 'PROCESSING'] },
        },
      });

      if (pendingWithdrawal) {
        throw new AppError('BANK_006', 'Không thể xóa tài khoản đang có giao dịch chờ xử lý', 400);
      }

      await prisma.bankAccount.delete({ where: { id } });

      // Nếu xóa tài khoản mặc định, set tài khoản khác làm mặc định
      if (bankAccount.isDefault) {
        const otherAccount = await prisma.bankAccount.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });

        if (otherAccount) {
          await prisma.bankAccount.update({
            where: { id: otherAccount.id },
            data: { isDefault: true },
          });
        }
      }

      logger.info(`Bank account deleted: ${id} for user ${userId}`);

      return successResponse(res, {
        message: 'Đã xóa tài khoản ngân hàng',
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Delete bank account error:', error);
      throw new AppError('GEN_004', 'Không thể xóa tài khoản ngân hàng', 500);
    }
  }

  /**
   * Admin: Xác minh tài khoản ngân hàng
   * PATCH /api/bank-accounts/:id/verify
   */
  async verifyBankAccount(req: AuthRequest, res: Response) {
    try {
      const adminId = req.user?.id;
      const { id } = req.params;
      const { verified } = req.body;

      if (!adminId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const admin = await prisma.user.findUnique({ 
        where: { id: adminId },
        select: { id: true, email: true, role: true }
      });

      if (!admin || admin.role !== 'ADMIN') {
        throw new AppError('AUTH_003', 'Forbidden - Admin only', 403);
      }

      const bankAccount = await prisma.bankAccount.findUnique({
        where: { id },
        include: { user: { select: { id: true, name: true, email: true } } },
      });

      if (!bankAccount) {
        throw new AppError('BANK_004', 'Tài khoản ngân hàng không tồn tại', 404);
      }

      const updated = await prisma.bankAccount.update({
        where: { id },
        data: { isVerified: verified !== false },
      });

      // Notification cho user
      const notification = await prisma.notification.create({
        data: {
          userId: bankAccount.userId,
          type: 'SYSTEM',
          title: verified !== false ? 'Tài khoản ngân hàng đã xác minh' : 'Tài khoản ngân hàng chưa xác minh',
          message:
            verified !== false
              ? `Tài khoản ${bankAccount.bankName} - ${bankAccount.accountNumber} đã được xác minh.`
              : `Tài khoản ${bankAccount.bankName} - ${bankAccount.accountNumber} cần xác minh lại.`,
          data: { bankAccountId: id },
        },
      });

      // Gửi notification real-time qua WebSocket
      sendNotificationToUser(bankAccount.userId, notification);

      logger.info(`Bank account ${verified !== false ? 'verified' : 'unverified'}: ${id} by admin ${adminId}`);

      return successResponse(res, {
        message: verified !== false ? 'Đã xác minh tài khoản' : 'Đã hủy xác minh tài khoản',
        bankAccount: {
          id: updated.id,
          isVerified: updated.isVerified,
          user: bankAccount.user,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Verify bank account error:', error);
      throw new AppError('GEN_004', 'Không thể xác minh tài khoản ngân hàng', 500);
    }
  }

  /**
   * Admin: Lấy danh sách tài khoản ngân hàng cần xác minh
   * GET /api/bank-accounts/admin/unverified
   */
  async getUnverifiedBankAccounts(req: AuthRequest, res: Response) {
    try {
      const adminId = req.user?.id;
      const { page = 1, limit = 20 } = req.query;

      if (!adminId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const admin = await prisma.user.findUnique({ 
        where: { id: adminId },
        select: { id: true, email: true, role: true }
      });

      if (!admin || admin.role !== 'ADMIN') {
        throw new AppError('AUTH_003', 'Forbidden - Admin only', 403);
      }

      const [bankAccounts, total] = await Promise.all([
        prisma.bankAccount.findMany({
          where: { isVerified: false },
          orderBy: { createdAt: 'desc' },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
          include: {
            user: {
              select: { name: true, email: true },
            },
          },
        }),
        prisma.bankAccount.count({ where: { isVerified: false } }),
      ]);

      return successResponse(res, {
        bankAccounts: bankAccounts.map((acc) => ({
          id: acc.id,
          user: acc.user,
          bankName: acc.bankName,
          accountNumber: acc.accountNumber,
          accountName: acc.accountName,
          isVerified: acc.isVerified,
          createdAt: acc.createdAt,
        })),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get unverified bank accounts error:', error);
      throw new AppError('GEN_004', 'Không thể lấy danh sách tài khoản cần xác minh', 500);
    }
  }
}

export default new BankAccountController();
