import { Request, Response } from 'express';
import prisma from '../../config/database';
import { AppError } from '../../common/utils/response.utils';
import logger from '../../config/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { sendNotificationToUser } from '../../websocket/notificationHandler';

export class AdminController {
  // Middleware kiểm tra admin
  private async checkAdmin(userId: string) {
    const admin = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true }
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new AppError('AUTH_003', 'Forbidden - Admin only', 403);
    }

    return admin;
  }

  // ==================== DASHBOARD ====================
  
  getDashboardStats = async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).user?.userId;
      await this.checkAdmin(adminId);

      const [
        totalUsers,
        activeUsers,
        blockedUsers,
        pendingKYC,
        approvedKYC,
        pendingWithdrawals,
        pendingDeposits,
        totalOrders,
        filledOrders,
        pendingBankAccounts
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({ where: { isActive: false } }),
        prisma.kycApplication.count({ where: { status: 'PENDING' } }),
        prisma.kycApplication.count({ where: { status: 'APPROVED' } }),
        prisma.fiatTransaction.count({ where: { type: 'WITHDRAW', status: 'PENDING' } }),
        prisma.fiatTransaction.count({ where: { type: 'DEPOSIT', status: 'PENDING' } }),
        prisma.order.count(),
        prisma.order.count({ where: { status: 'FILLED' } }),
        prisma.bankAccount.count({ where: { isVerified: false } })
      ]);

      // Thống kê 7 ngày gần nhất
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [newUsersLast7Days, ordersLast7Days, volumeLast7Days] = await Promise.all([
        prisma.user.count({
          where: { createdAt: { gte: sevenDaysAgo } }
        }),
        prisma.order.count({
          where: { createdAt: { gte: sevenDaysAgo }, status: 'FILLED' }
        }),
        prisma.order.aggregate({
          where: { createdAt: { gte: sevenDaysAgo }, status: 'FILLED' },
          _sum: { total: true }
        })
      ]);

      res.json({
        success: true,
        data: {
          users: {
            total: totalUsers,
            active: activeUsers,
            blocked: blockedUsers,
            newLast7Days: newUsersLast7Days
          },
          kyc: {
            pending: pendingKYC,
            approved: approvedKYC
          },
          transactions: {
            pendingWithdrawals,
            pendingDeposits,
            pendingBankAccounts
          },
          trading: {
            totalOrders,
            filledOrders,
            ordersLast7Days,
            volumeLast7Days: volumeLast7Days._sum.total || 0
          }
        }
      });
    } catch (error) {
      logger.error('Get dashboard stats error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('ADMIN_001', 'Lỗi lấy thống kê dashboard', 500);
    }
  };

  // ==================== USER MANAGEMENT ====================

  getAllUsers = async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).user?.userId;
      await this.checkAdmin(adminId);

      const { page = 1, limit = 20, search, status, role } = req.query;

      const where: any = {};

      if (search) {
        where.OR = [
          { email: { contains: String(search), mode: 'insensitive' } },
          { name: { contains: String(search), mode: 'insensitive' } }
        ];
      }

      if (status === 'active') where.isActive = true;
      if (status === 'blocked') where.isActive = false;
      if (role) where.role = String(role);

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            isVerified: true,
            kycStatus: true,
            createdAt: true,
            _count: {
              select: {
                orders: true,
                walletBalances: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit)
        }),
        prisma.user.count({ where })
      ]);

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      logger.error('Get all users error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('ADMIN_002', 'Lỗi lấy danh sách users', 500);
    }
  };

  getUserDetail = async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).user?.userId;
      await this.checkAdmin(adminId);

      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          isVerified: true,
          kycStatus: true,
          twoFaEnabled: true,
          createdAt: true,
          walletBalances: {
            select: {
              symbol: true,
              available: true,
              locked: true
            }
          },
          orders: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              symbol: true,
              side: true,
              type: true,
              status: true,
              amount: true,
              price: true,
              total: true,
              createdAt: true
            }
          },
          kycApplications: {
            select: {
              id: true,
              documentType: true,
              status: true,
              createdAt: true
            }
          },
          bankAccounts: {
            select: {
              id: true,
              bankName: true,
              accountNumber: true,
              isVerified: true
            }
          },
          _count: {
            select: {
              orders: true,
              notifications: true,
              securityLogs: true
            }
          }
        }
      });

      if (!user) {
        throw new AppError('USER_001', 'User không tồn tại', 404);
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      logger.error('Get user detail error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('ADMIN_003', 'Lỗi lấy thông tin user', 500);
    }
  };

  blockUser = async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).user?.userId;
      await this.checkAdmin(adminId);

      const { id } = req.params;
      const { blocked } = req.body;

      if (id === adminId) {
        throw new AppError('ADMIN_004', 'Không thể block chính mình', 400);
      }

      const user = await prisma.user.update({
        where: { id },
        data: { isActive: !blocked },
        select: { id: true, email: true, isActive: true }
      });

      // Log action
      await prisma.securityLog.create({
        data: {
          userId: id,
          action: blocked ? 'ACCOUNT_BLOCKED' : 'ACCOUNT_UNBLOCKED',
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          status: 'SUCCESS'
        }
      });

      logger.info(`Admin ${adminId} ${blocked ? 'blocked' : 'unblocked'} user ${id}`);

      res.json({
        success: true,
        message: blocked ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản',
        data: user
      });
    } catch (error) {
      logger.error('Block user error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('ADMIN_005', 'Lỗi khóa/mở khóa user', 500);
    }
  };

  updateUserRole = async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).user?.userId;
      await this.checkAdmin(adminId);

      const { id } = req.params;
      const { role } = req.body;

      if (id === adminId) {
        throw new AppError('ADMIN_006', 'Không thể thay đổi role chính mình', 400);
      }

      if (!['USER', 'ADMIN'].includes(role)) {
        throw new AppError('ADMIN_007', 'Role không hợp lệ', 400);
      }

      const user = await prisma.user.update({
        where: { id },
        data: { role },
        select: { id: true, email: true, role: true }
      });

      logger.info(`Admin ${adminId} changed role of user ${id} to ${role}`);

      res.json({
        success: true,
        message: 'Đã cập nhật role',
        data: user
      });
    } catch (error) {
      logger.error('Update user role error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('ADMIN_008', 'Lỗi cập nhật role', 500);
    }
  };

  deleteUser = async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).user?.userId;
      await this.checkAdmin(adminId);

      const { id } = req.params;

      if (id === adminId) {
        throw new AppError('ADMIN_009', 'Không thể xóa chính mình', 400);
      }

      // Kiểm tra user có balance không
      const balances = await prisma.walletBalance.findMany({
        where: { userId: id },
        select: { available: true, locked: true }
      });

      const hasBalance = balances.some((b: { available: unknown; locked: unknown }) => 
        Number(b.available) > 0 || Number(b.locked) > 0
      );

      if (hasBalance) {
        throw new AppError('ADMIN_010', 'Không thể xóa user còn số dư', 400);
      }

      // Soft delete - chỉ deactivate
      await prisma.user.update({
        where: { id },
        data: { 
          isActive: false,
          email: `deleted_${Date.now()}_${id}@deleted.com`
        }
      });

      logger.info(`Admin ${adminId} deleted user ${id}`);

      res.json({
        success: true,
        message: 'Đã xóa user'
      });
    } catch (error) {
      logger.error('Delete user error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('ADMIN_011', 'Lỗi xóa user', 500);
    }
  };

  // ==================== KYC MANAGEMENT ====================

  getPendingKYC = async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).user?.userId;
      await this.checkAdmin(adminId);

      const { page = 1, limit = 20, status = 'PENDING' } = req.query;

      const where: any = {};
      if (status !== 'all') {
        where.status = String(status);
      }

      const [kycApplications, total] = await Promise.all([
        prisma.kycApplication.findMany({
          where,
          include: {
            user: {
              select: { id: true, email: true, name: true, kycStatus: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit)
        }),
        prisma.kycApplication.count({ where })
      ]);

      // Map to expected format for frontend
      const formattedKYC = kycApplications.map(kyc => ({
        id: kyc.id,
        status: kyc.status,
        fullName: `${kyc.firstName} ${kyc.lastName}`.trim(),
        dateOfBirth: kyc.dateOfBirth,
        nationality: kyc.nationality,
        address: typeof kyc.address === 'object' ? JSON.stringify(kyc.address) : kyc.address,
        idType: kyc.documentType,
        idNumber: kyc.documentNumber,
        idFrontImage: kyc.frontDocumentUrl,
        idBackImage: kyc.backDocumentUrl,
        selfieImage: kyc.selfieUrl,
        proofOfAddress: null,
        submittedAt: kyc.createdAt,
        reviewedAt: kyc.reviewedAt,
        rejectionReason: kyc.rejectionReason,
        user: kyc.user
      }));

      res.json({
        success: true,
        data: {
          kycApplications: formattedKYC,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      logger.error('Get pending KYC error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('ADMIN_012', 'Lỗi lấy danh sách KYC', 500);
    }
  };

  approveKYC = async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).user?.userId;
      await this.checkAdmin(adminId);

      const { id } = req.params;
      const { approved, rejectReason } = req.body;

      const kycApp = await prisma.kycApplication.findUnique({
        where: { id },
        include: { user: true }
      });

      if (!kycApp) {
        throw new AppError('KYC_001', 'KYC application không tồn tại', 404);
      }

      if (kycApp.status !== 'PENDING') {
        throw new AppError('KYC_002', 'KYC đã được xử lý', 400);
      }

      const newStatus = approved ? 'APPROVED' : 'REJECTED';

      await prisma.$transaction([
        prisma.kycApplication.update({
          where: { id },
          data: {
            status: newStatus,
            reviewedAt: new Date(),
            rejectionReason: approved ? null : rejectReason
          }
        }),
        // Nếu approved, cập nhật KYC status của user
        ...(approved ? [
          prisma.user.update({
            where: { id: kycApp.userId },
            data: { kycStatus: 'APPROVED' }
          })
        ] : []),
        // Tạo notification
        prisma.notification.create({
          data: {
            userId: kycApp.userId,
            type: 'KYC_UPDATE',
            title: approved ? 'KYC đã được duyệt' : 'KYC bị từ chối',
            message: approved 
              ? 'Hồ sơ KYC của bạn đã được phê duyệt. Bạn có thể sử dụng đầy đủ chức năng.'
              : `Hồ sơ KYC của bạn bị từ chối. Lý do: ${rejectReason}`,
            data: { kycId: id, status: newStatus }
          }
        })
      ]);

      // Send realtime notification via WebSocket
      sendNotificationToUser(kycApp.userId, {
        type: 'KYC_UPDATE',
        data: {
          id: Date.now().toString(),
          type: approved ? 'success' : 'error',
          title: approved ? '✅ KYC đã được duyệt' : '❌ KYC bị từ chối',
          message: approved 
            ? 'Hồ sơ KYC của bạn đã được phê duyệt. Bạn có thể sử dụng đầy đủ chức năng.'
            : `Hồ sơ KYC của bạn bị từ chối. Lý do: ${rejectReason}`,
          kycStatus: newStatus,
          createdAt: new Date().toISOString(),
        }
      });

      logger.info(`Admin ${adminId} ${approved ? 'approved' : 'rejected'} KYC ${id}`);

      res.json({
        success: true,
        message: approved ? 'Đã duyệt KYC' : 'Đã từ chối KYC'
      });
    } catch (error) {
      logger.error('Approve KYC error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('ADMIN_013', 'Lỗi xử lý KYC', 500);
    }
  };

  // ==================== SYSTEM LOGS ====================

  getSystemLogs = async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).user?.userId;
      await this.checkAdmin(adminId);

      const { page = 1, limit = 50, userId, action, startDate, endDate } = req.query;

      const where: any = {};

      if (userId) where.userId = String(userId);
      if (action) where.action = String(action);
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(String(startDate));
        if (endDate) where.createdAt.lte = new Date(String(endDate));
      }

      const [logs, total] = await Promise.all([
        prisma.securityLog.findMany({
          where,
          include: {
            user: {
              select: { id: true, email: true, name: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit)
        }),
        prisma.securityLog.count({ where })
      ]);

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      logger.error('Get system logs error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('ADMIN_014', 'Lỗi lấy system logs', 500);
    }
  };

  // ==================== SYSTEM SETTINGS ====================

  getSettings = async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).user?.userId;
      await this.checkAdmin(adminId);

      const settings = await prisma.systemSetting.findMany();
      
      // Convert to object
      const settingsObj: Record<string, string> = {};
      settings.forEach((s: { key: string; value: string }) => {
        settingsObj[s.key] = s.value;
      });

      // Default values if not exist
      const defaultSettings = {
        tradingFeePercent: '0.1',
        withdrawalFeePercent: '0.5',
        minWithdrawalVND: '100000',
        maxWithdrawalVND: '500000000',
        minDepositVND: '50000',
        kycRequiredForWithdrawal: 'true',
        maintenanceMode: 'false',
        registrationEnabled: 'true'
      };

      res.json({
        success: true,
        data: { ...defaultSettings, ...settingsObj }
      });
    } catch (error) {
      logger.error('Get settings error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('ADMIN_015', 'Lỗi lấy cài đặt hệ thống', 500);
    }
  };

  updateSettings = async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).user?.userId;
      await this.checkAdmin(adminId);

      const settings = req.body;

      // Upsert each setting
      const updates = Object.entries(settings).map(([key, value]) =>
        prisma.systemSetting.upsert({
          where: { key },
          create: { key, value: String(value) },
          update: { value: String(value) }
        })
      );

      await prisma.$transaction(updates);

      logger.info(`Admin ${adminId} updated system settings`, settings);

      res.json({
        success: true,
        message: 'Đã cập nhật cài đặt'
      });
    } catch (error) {
      logger.error('Update settings error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('ADMIN_016', 'Lỗi cập nhật cài đặt', 500);
    }
  };

  // ==================== DEPOSITS/WITHDRAWALS ====================

  getPendingDeposits = async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).user?.userId;
      await this.checkAdmin(adminId);

      const { page = 1, limit = 20, status } = req.query;

      const where: any = { type: 'DEPOSIT' };
      if (status) where.status = String(status);

      const [deposits, total] = await Promise.all([
        prisma.fiatTransaction.findMany({
          where,
          include: {
            user: {
              select: { id: true, email: true, name: true }
            },
            bankAccount: {
              select: { bankName: true, accountNumber: true, accountName: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit)
        }),
        prisma.fiatTransaction.count({ where })
      ]);

      // Map to expected format
      const formattedDeposits = deposits.map(d => ({
        id: d.id,
        userId: d.userId,
        type: d.type,
        status: d.status,
        amount: Number(d.fiatAmount),
        fee: Number(d.fee || 0),
        netAmount: Number(d.netAmount || d.fiatAmount),
        currency: d.fiatCurrency,
        reference: d.transactionId || null,
        adminNote: d.adminNote,
        createdAt: d.createdAt,
        completedAt: d.completedAt,
        user: d.user
      }));

      res.json({
        success: true,
        data: {
          deposits: formattedDeposits,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      logger.error('Get pending deposits error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('ADMIN_017', 'Lỗi lấy danh sách nạp tiền', 500);
    }
  };

  approveDeposit = async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).user?.userId;
      await this.checkAdmin(adminId);

      const { id } = req.params;
      const { approved, rejectReason } = req.body;

      const deposit = await prisma.fiatTransaction.findFirst({
        where: { id, type: 'DEPOSIT' }
      });

      if (!deposit) {
        throw new AppError('DEPOSIT_001', 'Không tìm thấy giao dịch nạp tiền', 404);
      }

      if (deposit.status !== 'PENDING') {
        throw new AppError('DEPOSIT_002', 'Giao dịch đã được xử lý', 400);
      }

      if (approved) {
        // Lấy symbol tiền tệ từ giao dịch (VND, USD, etc.)
        const currency = deposit.fiatCurrency || 'VND';
        const depositAmount = new Decimal(deposit.fiatAmount);

        await prisma.$transaction([
          prisma.fiatTransaction.update({
            where: { id },
            data: { 
              status: 'COMPLETED', 
              completedAt: new Date(),
              processedById: adminId,
              processedAt: new Date()
            }
          }),
          prisma.walletBalance.upsert({
            where: {
              userId_symbol: { userId: deposit.userId, symbol: currency }
            },
            create: {
              userId: deposit.userId,
              symbol: currency,
              available: depositAmount,
              locked: new Decimal(0)
            },
            update: {
              available: { increment: depositAmount }
            }
          }),
          prisma.notification.create({
            data: {
              userId: deposit.userId,
              type: 'DEPOSIT_COMPLETED',
              title: 'Nạp tiền thành công',
              message: `Bạn đã nạp thành công ${Number(deposit.fiatAmount).toLocaleString('vi-VN')} ${currency}`,
              data: { transactionId: id, amount: Number(deposit.fiatAmount), currency }
            }
          })
        ]);
      } else {
        await prisma.$transaction([
          prisma.fiatTransaction.update({
            where: { id },
            data: { status: 'REJECTED', adminNote: rejectReason }
          }),
          prisma.notification.create({
            data: {
              userId: deposit.userId,
              type: 'DEPOSIT_REJECTED',
              title: 'Nạp tiền bị từ chối',
              message: `Yêu cầu nạp tiền bị từ chối. Lý do: ${rejectReason}`,
              data: { transactionId: id }
            }
          })
        ]);
      }

      logger.info(`Admin ${adminId} ${approved ? 'approved' : 'rejected'} deposit ${id}`);

      res.json({
        success: true,
        message: approved ? 'Đã duyệt nạp tiền' : 'Đã từ chối nạp tiền'
      });
    } catch (error) {
      logger.error('Approve deposit error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('ADMIN_018', 'Lỗi xử lý nạp tiền', 500);
    }
  };

  // ==================== WITHDRAWALS ====================

  getPendingWithdrawals = async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).user?.userId;
      await this.checkAdmin(adminId);

      const { page = 1, limit = 20, status = 'PENDING' } = req.query;

      const where: any = { type: 'WITHDRAW' };
      if (status) where.status = String(status);

      const [withdrawals, total] = await Promise.all([
        prisma.fiatTransaction.findMany({
          where,
          include: {
            user: {
              select: { id: true, email: true, name: true }
            },
            bankAccount: {
              select: { bankName: true, accountNumber: true, accountName: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit)
        }),
        prisma.fiatTransaction.count({ where })
      ]);

      // Map to expected format
      const formattedWithdrawals = withdrawals.map(w => ({
        id: w.id,
        userId: w.userId,
        type: w.type,
        status: w.status,
        amount: Number(w.fiatAmount),
        fee: Number(w.fee || 0),
        netAmount: Number(w.netAmount || w.fiatAmount),
        currency: w.fiatCurrency,
        bankName: w.bankAccount?.bankName || w.bankName,
        accountNumber: w.bankAccount?.accountNumber || w.bankAccountNumber,
        accountHolder: w.bankAccount?.accountName || w.bankAccountName,
        adminNote: w.adminNote,
        createdAt: w.createdAt,
        completedAt: w.completedAt,
        user: w.user
      }));

      res.json({
        success: true,
        data: {
          withdrawals: formattedWithdrawals,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      logger.error('Get pending withdrawals error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('ADMIN_019', 'Lỗi lấy danh sách rút tiền', 500);
    }
  };

  approveWithdrawal = async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).user?.userId;
      await this.checkAdmin(adminId);

      const { id } = req.params;

      const withdrawal = await prisma.fiatTransaction.findFirst({
        where: { id, type: 'WITHDRAW' }
      });

      if (!withdrawal) {
        throw new AppError('WITHDRAWAL_001', 'Không tìm thấy yêu cầu rút tiền', 404);
      }

      if (withdrawal.status !== 'PENDING') {
        throw new AppError('WITHDRAWAL_002', 'Yêu cầu đã được xử lý', 400);
      }

      await prisma.$transaction([
        prisma.fiatTransaction.update({
          where: { id },
          data: { status: 'COMPLETED', completedAt: new Date() }
        }),
        prisma.notification.create({
          data: {
            userId: withdrawal.userId,
            type: 'WITHDRAWAL_APPROVED',
            title: 'Rút tiền thành công',
            message: `Yêu cầu rút ${(withdrawal.netAmount || withdrawal.fiatAmount).toLocaleString()}đ đã được duyệt`,
            data: { transactionId: id }
          }
        })
      ]);

      logger.info(`Admin ${adminId} approved withdrawal ${id}`);

      res.json({
        success: true,
        message: 'Đã duyệt yêu cầu rút tiền'
      });
    } catch (error) {
      logger.error('Approve withdrawal error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('ADMIN_020', 'Lỗi duyệt rút tiền', 500);
    }
  };

  rejectWithdrawal = async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).user?.userId;
      await this.checkAdmin(adminId);

      const { id } = req.params;
      const { reason } = req.body;

      const withdrawal = await prisma.fiatTransaction.findFirst({
        where: { id, type: 'WITHDRAW' },
        include: { user: true }
      });

      if (!withdrawal) {
        throw new AppError('WITHDRAWAL_001', 'Không tìm thấy yêu cầu rút tiền', 404);
      }

      if (withdrawal.status !== 'PENDING') {
        throw new AppError('WITHDRAWAL_002', 'Yêu cầu đã được xử lý', 400);
      }

      // Refund the locked amount back to user
      await prisma.$transaction([
        prisma.fiatTransaction.update({
          where: { id },
          data: { status: 'REJECTED', adminNote: reason }
        }),
        // Refund VND balance
        prisma.walletBalance.updateMany({
          where: { userId: withdrawal.userId, symbol: 'VND' },
          data: { available: { increment: withdrawal.fiatAmount } }
        }),
        prisma.notification.create({
          data: {
            userId: withdrawal.userId,
            type: 'WITHDRAWAL_REJECTED',
            title: 'Rút tiền bị từ chối',
            message: `Yêu cầu rút tiền bị từ chối. Lý do: ${reason}. Số tiền đã được hoàn lại.`,
            data: { transactionId: id }
          }
        })
      ]);

      logger.info(`Admin ${adminId} rejected withdrawal ${id}`);

      res.json({
        success: true,
        message: 'Đã từ chối yêu cầu rút tiền'
      });
    } catch (error) {
      logger.error('Reject withdrawal error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('ADMIN_021', 'Lỗi từ chối rút tiền', 500);
    }
  };

  // ==================== BANK ACCOUNTS ====================

  getBankAccounts = async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).user?.userId;
      await this.checkAdmin(adminId);

      // Get system bank accounts (accounts owned by admin for receiving deposits)
      const bankAccounts = await prisma.bankAccount.findMany({
        where: { 
          user: { role: 'ADMIN' }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json({
        success: true,
        data: { bankAccounts }
      });
    } catch (error) {
      logger.error('Get bank accounts error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('ADMIN_022', 'Lỗi lấy danh sách tài khoản ngân hàng', 500);
    }
  };

  addBankAccount = async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).user?.userId;
      await this.checkAdmin(adminId);

      const { bankName, accountNumber, accountName, branch } = req.body;

      const bankAccount = await prisma.bankAccount.create({
        data: {
          userId: adminId,
          bankName,
          accountNumber,
          accountName,
          branch: branch || null,
          isDefault: false,
          isVerified: true
        }
      });

      logger.info(`Admin ${adminId} added bank account ${bankAccount.id}`);

      res.json({
        success: true,
        data: bankAccount
      });
    } catch (error) {
      logger.error('Add bank account error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('ADMIN_023', 'Lỗi thêm tài khoản ngân hàng', 500);
    }
  };

  deleteBankAccount = async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).user?.userId;
      await this.checkAdmin(adminId);

      const { id } = req.params;

      await prisma.bankAccount.delete({
        where: { id }
      });

      logger.info(`Admin ${adminId} deleted bank account ${id}`);

      res.json({
        success: true,
        message: 'Đã xóa tài khoản ngân hàng'
      });
    } catch (error) {
      logger.error('Delete bank account error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('ADMIN_024', 'Lỗi xóa tài khoản ngân hàng', 500);
    }
  };
}

export const adminController = new AdminController();
