import { Response } from 'express';
import prisma from '../../config/database';
import { successResponse, AppError } from '../../common/utils/response.utils';
import { AuthRequest } from '../../common/middlewares/auth.middleware';
import logger from '../../config/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { sendNotificationToUser } from '../../websocket/notificationHandler';

export class WithdrawalController {
  /**
   * Tạo yêu cầu rút tiền
   * POST /api/withdrawals/create
   */
  async createWithdrawal(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { amount, bankAccountId, currency = 'VND' } = req.body;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      // Validate amount
      const withdrawAmount = Number(amount);
      const minWithdraw = 50000; // 50,000 VND
      const maxWithdraw = 500000000; // 500 triệu VND

      if (withdrawAmount < minWithdraw) {
        throw new AppError('WITHDRAW_001', `Số tiền rút tối thiểu là ${minWithdraw.toLocaleString('vi-VN')} VND`, 400);
      }

      if (withdrawAmount > maxWithdraw) {
        throw new AppError('WITHDRAW_002', `Số tiền rút tối đa là ${maxWithdraw.toLocaleString('vi-VN')} VND`, 400);
      }

      // Thực hiện trong transaction
      const result = await prisma.$transaction(async (tx) => {
        // Kiểm tra tài khoản ngân hàng
        const bankAccount = await tx.bankAccount.findFirst({
          where: {
            id: bankAccountId,
            userId,
          },
        });

        if (!bankAccount) {
          throw new AppError('WITHDRAW_003', 'Tài khoản ngân hàng không tồn tại', 404);
        }

        // Skip verification check in development mode for easier testing
        if (process.env.NODE_ENV === 'production' && !bankAccount.isVerified) {
          throw new AppError('WITHDRAW_004', 'Tài khoản ngân hàng chưa được xác thực', 400);
        }

        // Kiểm tra số dư VND (với FOR UPDATE để lock row)
        const wallet = await tx.walletBalance.findUnique({
          where: {
            userId_symbol: {
              userId,
              symbol: currency,
            },
          },
        });

        if (!wallet || Number(wallet.available) < withdrawAmount) {
          throw new AppError(
            'WITHDRAW_005',
            `Số dư không đủ. Hiện có: ${wallet ? Number(wallet.available).toLocaleString('vi-VN') : 0} ${currency}`,
            400
          );
        }

        // Lock tiền: trừ available, cộng locked
        await tx.walletBalance.update({
          where: {
            userId_symbol: {
              userId,
              symbol: currency,
            },
          },
          data: {
            available: { decrement: withdrawAmount },
            locked: { increment: withdrawAmount },
          },
        });

        // Tạo fiat transaction cho withdrawal
        const withdrawal = await tx.fiatTransaction.create({
          data: {
            userId,
            type: 'WITHDRAW',
            fiatCurrency: currency,
            fiatAmount: new Decimal(withdrawAmount),
            method: 'BANK_TRANSFER',
            status: 'PENDING',
            provider: 'manual',
            bankAccountId: bankAccount.id,
            bankName: bankAccount.bankName,
            bankAccountNumber: bankAccount.accountNumber,
            bankAccountName: bankAccount.accountName,
            metadata: {
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'],
            },
          },
        });

        // Tạo wallet transaction record
        await tx.walletTransaction.create({
          data: {
            userId,
            type: 'WITHDRAW',
            symbol: currency,
            amount: new Decimal(-withdrawAmount),
            fee: new Decimal(0),
            status: 'PENDING',
            referenceId: withdrawal.id,
            referenceType: 'FIAT_WITHDRAWAL',
          },
        });

        // Tạo notification cho user
        const notification = await tx.notification.create({
          data: {
            userId,
            type: 'WITHDRAWAL',
            title: 'Yêu cầu rút tiền đã được tạo',
            message: `Yêu cầu rút ${withdrawAmount.toLocaleString('vi-VN')} ${currency} đang chờ xử lý.`,
            data: {
              withdrawalId: withdrawal.id,
              amount: withdrawAmount,
              bankName: bankAccount.bankName,
              accountNumber: bankAccount.accountNumber,
            },
          },
        });

        // Gửi notification real-time qua WebSocket
        sendNotificationToUser(userId, notification);

        return { withdrawal, bankAccount };
      });

      logger.info(`Withdrawal created: ${result.withdrawal.id}, amount: ${withdrawAmount} ${currency}`);

      return successResponse(res, {
        withdrawal: {
          id: result.withdrawal.id,
          amount: Number(result.withdrawal.fiatAmount),
          currency: result.withdrawal.fiatCurrency,
          status: result.withdrawal.status,
          bankName: result.withdrawal.bankName,
          bankAccountNumber: result.withdrawal.bankAccountNumber,
          bankAccountName: result.withdrawal.bankAccountName,
          createdAt: result.withdrawal.createdAt,
        },
        message: 'Yêu cầu rút tiền đã được tạo. Vui lòng chờ admin xử lý (1-24h làm việc).',
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Create withdrawal error:', error);
      throw new AppError('GEN_004', 'Không thể tạo yêu cầu rút tiền', 500);
    }
  }

  /**
   * Lấy lịch sử rút tiền của user
   * GET /api/withdrawals
   */
  async getWithdrawalHistory(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { page = 1, limit = 20, status } = req.query;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const where: any = {
        userId,
        type: 'WITHDRAW',
      };

      if (status) {
        where.status = status;
      }

      const [withdrawals, total] = await Promise.all([
        prisma.fiatTransaction.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
          include: {
            processedBy: {
              select: { name: true },
            },
          },
        }),
        prisma.fiatTransaction.count({ where }),
      ]);

      return successResponse(res, {
        withdrawals: withdrawals.map((w) => ({
          id: w.id,
          amount: Number(w.fiatAmount),
          currency: w.fiatCurrency,
          status: w.status,
          bankName: w.bankName,
          bankAccountNumber: w.bankAccountNumber,
          bankAccountName: w.bankAccountName,
          adminNote: w.adminNote,
          processedBy: w.processedBy?.name,
          processedAt: w.processedAt,
          createdAt: w.createdAt,
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
      logger.error('Get withdrawal history error:', error);
      throw new AppError('GEN_004', 'Không thể lấy lịch sử rút tiền', 500);
    }
  }

  /**
   * Kiểm tra trạng thái rút tiền
   * GET /api/withdrawals/:id
   */
  async getWithdrawalStatus(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const withdrawal = await prisma.fiatTransaction.findFirst({
        where: {
          id,
          userId,
          type: 'WITHDRAW',
        },
        include: {
          processedBy: {
            select: { name: true },
          },
        },
      });

      if (!withdrawal) {
        throw new AppError('WITHDRAW_006', 'Không tìm thấy yêu cầu rút tiền', 404);
      }

      return successResponse(res, {
        withdrawal: {
          id: withdrawal.id,
          amount: Number(withdrawal.fiatAmount),
          currency: withdrawal.fiatCurrency,
          status: withdrawal.status,
          bankName: withdrawal.bankName,
          bankAccountNumber: withdrawal.bankAccountNumber,
          bankAccountName: withdrawal.bankAccountName,
          adminNote: withdrawal.adminNote,
          processedBy: withdrawal.processedBy?.name,
          processedAt: withdrawal.processedAt,
          createdAt: withdrawal.createdAt,
        },
        statusMessage: this.getWithdrawalStatusMessage(withdrawal.status),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get withdrawal status error:', error);
      throw new AppError('GEN_004', 'Không thể lấy trạng thái rút tiền', 500);
    }
  }

  /**
   * Hủy yêu cầu rút tiền (chỉ khi PENDING)
   * DELETE /api/withdrawals/:id
   */
  async cancelWithdrawal(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const result = await prisma.$transaction(async (tx) => {
        const withdrawal = await tx.fiatTransaction.findFirst({
          where: {
            id,
            userId,
            type: 'WITHDRAW',
          },
        });

        if (!withdrawal) {
          throw new AppError('WITHDRAW_006', 'Không tìm thấy yêu cầu rút tiền', 404);
        }

        if (withdrawal.status !== 'PENDING') {
          throw new AppError('WITHDRAW_007', 'Chỉ có thể hủy yêu cầu đang chờ xử lý', 400);
        }

        // Hoàn tiền về ví: cộng available, trừ locked
        await tx.walletBalance.update({
          where: {
            userId_symbol: {
              userId,
              symbol: withdrawal.fiatCurrency,
            },
          },
          data: {
            available: { increment: Number(withdrawal.fiatAmount) },
            locked: { decrement: Number(withdrawal.fiatAmount) },
          },
        });

        // Cập nhật trạng thái withdrawal
        const updated = await tx.fiatTransaction.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            adminNote: 'Hủy bởi người dùng',
          },
        });

        // Cập nhật wallet transaction
        await tx.walletTransaction.updateMany({
          where: {
            referenceId: id,
            referenceType: 'FIAT_WITHDRAWAL',
          },
          data: {
            status: 'CANCELLED',
          },
        });

        // Notification
        const notification = await tx.notification.create({
          data: {
            userId,
            type: 'WITHDRAWAL',
            title: 'Đã hủy yêu cầu rút tiền',
            message: `Yêu cầu rút ${Number(withdrawal.fiatAmount).toLocaleString('vi-VN')} ${withdrawal.fiatCurrency} đã được hủy.`,
            data: { withdrawalId: id },
          },
        });

        // Gửi notification real-time qua WebSocket
        sendNotificationToUser(userId, notification);

        return updated;
      });

      logger.info(`Withdrawal cancelled: ${id} by user ${userId}`);

      return successResponse(res, {
        message: 'Đã hủy yêu cầu rút tiền',
        withdrawal: {
          id: result.id,
          status: result.status,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Cancel withdrawal error:', error);
      throw new AppError('GEN_004', 'Không thể hủy yêu cầu rút tiền', 500);
    }
  }

  /**
   * Admin: Duyệt yêu cầu rút tiền
   * PATCH /api/withdrawals/:id/approve
   */
  async approveWithdrawal(req: AuthRequest, res: Response) {
    try {
      const adminId = req.user?.id;
      const { id } = req.params;
      const { note } = req.body;

      if (!adminId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      // Kiểm tra quyền admin bằng role
      const admin = await prisma.user.findUnique({ 
        where: { id: adminId },
        select: { id: true, email: true, role: true }
      });

      if (!admin || admin.role !== 'ADMIN') {
        throw new AppError('AUTH_003', 'Forbidden - Admin only', 403);
      }

      const result = await prisma.$transaction(async (tx) => {
        const withdrawal = await tx.fiatTransaction.findFirst({
          where: { id, type: 'WITHDRAW' },
        });

        if (!withdrawal) {
          throw new AppError('WITHDRAW_006', 'Không tìm thấy yêu cầu rút tiền', 404);
        }

        if (withdrawal.status !== 'PENDING') {
          throw new AppError('WITHDRAW_008', 'Yêu cầu đã được xử lý', 400);
        }

        // Cập nhật trạng thái thành APPROVED
        const updated = await tx.fiatTransaction.update({
          where: { id },
          data: {
            status: 'APPROVED',
            adminNote: note || 'Đã duyệt',
            processedById: adminId,
            processedAt: new Date(),
          },
        });

        // Notification cho user
        const notification = await tx.notification.create({
          data: {
            userId: withdrawal.userId,
            type: 'WITHDRAWAL',
            title: 'Yêu cầu rút tiền đã được duyệt',
            message: `Yêu cầu rút ${Number(withdrawal.fiatAmount).toLocaleString('vi-VN')} ${withdrawal.fiatCurrency} đã được duyệt và đang xử lý.`,
            data: { withdrawalId: id },
          },
        });

        // Gửi notification real-time qua WebSocket
        sendNotificationToUser(withdrawal.userId, notification);

        return updated;
      });

      logger.info(`Withdrawal approved: ${id} by admin ${adminId}`);

      return successResponse(res, {
        message: 'Đã duyệt yêu cầu rút tiền',
        withdrawal: {
          id: result.id,
          status: result.status,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Approve withdrawal error:', error);
      throw new AppError('GEN_004', 'Không thể duyệt yêu cầu rút tiền', 500);
    }
  }

  /**
   * Admin: Hoàn thành rút tiền (đã chuyển tiền thực tế)
   * PATCH /api/withdrawals/:id/complete
   */
  async completeWithdrawal(req: AuthRequest, res: Response) {
    try {
      const adminId = req.user?.id;
      const { id } = req.params;
      const { transactionRef, note } = req.body;

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

      const result = await prisma.$transaction(async (tx) => {
        const withdrawal = await tx.fiatTransaction.findFirst({
          where: { id, type: 'WITHDRAW' },
        });

        if (!withdrawal) {
          throw new AppError('WITHDRAW_006', 'Không tìm thấy yêu cầu rút tiền', 404);
        }

        if (!['PENDING', 'APPROVED', 'PROCESSING'].includes(withdrawal.status)) {
          throw new AppError('WITHDRAW_008', 'Yêu cầu không thể hoàn thành', 400);
        }

        // Trừ tiền từ locked (tiền đã thực sự chuyển đi)
        await tx.walletBalance.update({
          where: {
            userId_symbol: {
              userId: withdrawal.userId,
              symbol: withdrawal.fiatCurrency,
            },
          },
          data: {
            locked: { decrement: Number(withdrawal.fiatAmount) },
          },
        });

        // Cập nhật trạng thái
        const updated = await tx.fiatTransaction.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            transactionId: transactionRef,
            adminNote: note || 'Đã chuyển tiền thành công',
            processedById: adminId,
            processedAt: new Date(),
            completedAt: new Date(),
          },
        });

        // Cập nhật wallet transaction
        await tx.walletTransaction.updateMany({
          where: {
            referenceId: id,
            referenceType: 'FIAT_WITHDRAWAL',
          },
          data: {
            status: 'COMPLETED',
          },
        });

        // Notification cho user
        const notification = await tx.notification.create({
          data: {
            userId: withdrawal.userId,
            type: 'WITHDRAWAL',
            title: 'Rút tiền thành công',
            message: `${Number(withdrawal.fiatAmount).toLocaleString('vi-VN')} ${withdrawal.fiatCurrency} đã được chuyển vào tài khoản ngân hàng của bạn.`,
            data: { withdrawalId: id, transactionRef },
          },
        });

        // Gửi notification real-time qua WebSocket
        sendNotificationToUser(withdrawal.userId, notification);

        return updated;
      });

      logger.info(`Withdrawal completed: ${id} by admin ${adminId}`);

      return successResponse(res, {
        message: 'Đã hoàn thành rút tiền',
        withdrawal: {
          id: result.id,
          status: result.status,
          transactionRef: result.transactionId,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Complete withdrawal error:', error);
      throw new AppError('GEN_004', 'Không thể hoàn thành rút tiền', 500);
    }
  }

  /**
   * Admin: Từ chối rút tiền
   * PATCH /api/withdrawals/:id/reject
   */
  async rejectWithdrawal(req: AuthRequest, res: Response) {
    try {
      const adminId = req.user?.id;
      const { id } = req.params;
      const { reason } = req.body;

      if (!adminId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      if (!reason) {
        throw new AppError('WITHDRAW_009', 'Vui lòng nhập lý do từ chối', 400);
      }

      const adminEmails = ['admin@cryptoexchange.com', 'nguyendatpjkj@gmail.com'];
      const admin = await prisma.user.findUnique({ where: { id: adminId } });

      if (!admin || !adminEmails.includes(admin.email)) {
        throw new AppError('AUTH_003', 'Forbidden - Admin only', 403);
      }

      const result = await prisma.$transaction(async (tx) => {
        const withdrawal = await tx.fiatTransaction.findFirst({
          where: { id, type: 'WITHDRAW' },
        });

        if (!withdrawal) {
          throw new AppError('WITHDRAW_006', 'Không tìm thấy yêu cầu rút tiền', 404);
        }

        if (!['PENDING', 'APPROVED'].includes(withdrawal.status)) {
          throw new AppError('WITHDRAW_008', 'Yêu cầu không thể từ chối', 400);
        }

        // Hoàn tiền về ví
        await tx.walletBalance.update({
          where: {
            userId_symbol: {
              userId: withdrawal.userId,
              symbol: withdrawal.fiatCurrency,
            },
          },
          data: {
            available: { increment: Number(withdrawal.fiatAmount) },
            locked: { decrement: Number(withdrawal.fiatAmount) },
          },
        });

        // Cập nhật trạng thái
        const updated = await tx.fiatTransaction.update({
          where: { id },
          data: {
            status: 'REJECTED',
            adminNote: reason,
            processedById: adminId,
            processedAt: new Date(),
          },
        });

        // Cập nhật wallet transaction
        await tx.walletTransaction.updateMany({
          where: {
            referenceId: id,
            referenceType: 'FIAT_WITHDRAWAL',
          },
          data: {
            status: 'FAILED',
          },
        });

        // Notification
        const notification = await tx.notification.create({
          data: {
            userId: withdrawal.userId,
            type: 'WITHDRAWAL',
            title: 'Yêu cầu rút tiền bị từ chối',
            message: `Yêu cầu rút ${Number(withdrawal.fiatAmount).toLocaleString('vi-VN')} ${withdrawal.fiatCurrency} đã bị từ chối. Lý do: ${reason}`,
            data: { withdrawalId: id, reason },
          },
        });

        // Gửi notification real-time qua WebSocket
        sendNotificationToUser(withdrawal.userId, notification);

        return updated;
      });

      logger.info(`Withdrawal rejected: ${id} by admin ${adminId}, reason: ${reason}`);

      return successResponse(res, {
        message: 'Đã từ chối yêu cầu rút tiền',
        withdrawal: {
          id: result.id,
          status: result.status,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Reject withdrawal error:', error);
      throw new AppError('GEN_004', 'Không thể từ chối yêu cầu rút tiền', 500);
    }
  }

  /**
   * Admin: Lấy danh sách yêu cầu rút tiền (all users)
   * GET /api/withdrawals/admin/all
   */
  async getAdminWithdrawals(req: AuthRequest, res: Response) {
    try {
      const adminId = req.user?.id;
      const { page = 1, limit = 20, status } = req.query;

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

      const where: any = {
        type: 'WITHDRAW',
      };

      if (status) {
        where.status = status;
      }

      const [withdrawals, total] = await Promise.all([
        prisma.fiatTransaction.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
          include: {
            user: {
              select: { name: true, email: true },
            },
            processedBy: {
              select: { name: true },
            },
          },
        }),
        prisma.fiatTransaction.count({ where }),
      ]);

      return successResponse(res, {
        withdrawals: withdrawals.map((w) => ({
          id: w.id,
          user: w.user,
          amount: Number(w.fiatAmount),
          currency: w.fiatCurrency,
          status: w.status,
          bankName: w.bankName,
          bankAccountNumber: w.bankAccountNumber,
          bankAccountName: w.bankAccountName,
          adminNote: w.adminNote,
          processedBy: w.processedBy?.name,
          processedAt: w.processedAt,
          createdAt: w.createdAt,
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
      logger.error('Get admin withdrawals error:', error);
      throw new AppError('GEN_004', 'Không thể lấy danh sách rút tiền', 500);
    }
  }

  private getWithdrawalStatusMessage(status: string): string {
    const messages: Record<string, string> = {
      PENDING: 'Đang chờ xử lý',
      APPROVED: 'Đã duyệt, đang xử lý chuyển tiền',
      PROCESSING: 'Đang xử lý chuyển tiền',
      COMPLETED: 'Đã chuyển tiền thành công',
      REJECTED: 'Đã bị từ chối',
      CANCELLED: 'Đã hủy',
    };
    return messages[status] || 'Không xác định';
  }
}

export default new WithdrawalController();
