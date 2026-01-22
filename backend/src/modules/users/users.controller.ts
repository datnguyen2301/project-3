import { Response } from 'express';
import prisma from '../../config/database';
import { successResponse, AppError } from '../../common/utils/response.utils';
import { AuthRequest } from '../../common/middlewares/auth.middleware';
import logger from '../../config/logger';

export class UserController {
  // Get current user profile
  async getProfile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          isVerified: true,
          isActive: true,
          kycStatus: true,
          twoFaEnabled: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          preferences: true,
        },
      });

      if (!user) {
        throw new AppError('GEN_002', 'User not found', 404);
      }

      return successResponse(res, user);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get profile error:', error);
      throw new AppError('GEN_004', 'Failed to get profile', 500);
    }
  }

  // Update profile
  async updateProfile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { name } = req.body;

      const user = await prisma.user.update({
        where: { id: userId },
        data: { name },
        select: {
          id: true,
          name: true,
          email: true,
          isVerified: true,
          kycStatus: true,
          updatedAt: true,
        },
      });

      return successResponse(res, user);
    } catch (error) {
      logger.error('Update profile error:', error);
      throw new AppError('GEN_004', 'Failed to update profile', 500);
    }
  }

  // Update preferences
  async updatePreferences(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { 
        language, 
        currency, 
        theme, 
        themeColor,
        notificationsEnabled, 
        emailNotifications,
        pushNotifications,
        priceAlertSound,
        tradingConfirmation,
        timezone,
        dateFormat
      } = req.body;

      // Build update data dynamically (only include provided fields)
      const updateData: Record<string, any> = {};
      if (language !== undefined) updateData.language = language;
      if (currency !== undefined) updateData.currency = currency;
      if (theme !== undefined) updateData.theme = theme;
      if (themeColor !== undefined) updateData.themeColor = themeColor;
      if (notificationsEnabled !== undefined) updateData.notificationsEnabled = notificationsEnabled;
      if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications;
      if (pushNotifications !== undefined) updateData.pushNotifications = pushNotifications;
      if (priceAlertSound !== undefined) updateData.priceAlertSound = priceAlertSound;
      if (tradingConfirmation !== undefined) updateData.tradingConfirmation = tradingConfirmation;
      if (timezone !== undefined) updateData.timezone = timezone;
      if (dateFormat !== undefined) updateData.dateFormat = dateFormat;

      const preferences = await prisma.userPreference.upsert({
        where: { userId },
        update: updateData,
        create: {
          userId: userId!,
          language: language || 'en',
          currency: currency || 'USD',
          theme: theme || 'dark',
          themeColor: themeColor || '#3B82F6',
          notificationsEnabled: notificationsEnabled ?? true,
          emailNotifications: emailNotifications ?? true,
          pushNotifications: pushNotifications ?? true,
          priceAlertSound: priceAlertSound ?? true,
          tradingConfirmation: tradingConfirmation ?? true,
          timezone: timezone || 'Asia/Ho_Chi_Minh',
          dateFormat: dateFormat || 'DD/MM/YYYY',
        },
      });

      return successResponse(res, preferences);
    } catch (error) {
      logger.error('Update preferences error:', error);
      throw new AppError('GEN_004', 'Failed to update preferences', 500);
    }
  }

  // Get preferences
  async getPreferences(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;

      let preferences = await prisma.userPreference.findUnique({
        where: { userId },
      });

      // Return default preferences if not found
      if (!preferences) {
        preferences = await prisma.userPreference.create({
          data: {
            userId: userId!,
            language: 'en',
            currency: 'USD',
            theme: 'dark',
            themeColor: '#3B82F6',
            notificationsEnabled: true,
            emailNotifications: true,
            pushNotifications: true,
            priceAlertSound: true,
            tradingConfirmation: true,
            timezone: 'Asia/Ho_Chi_Minh',
            dateFormat: 'DD/MM/YYYY',
          },
        });
      }

      return successResponse(res, preferences);
    } catch (error) {
      logger.error('Get preferences error:', error);
      throw new AppError('GEN_004', 'Failed to get preferences', 500);
    }
  }

  // Get security logs
  async getSecurityLogs(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { page = 1, limit = 20 } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const [logs, total] = await Promise.all([
        prisma.securityLog.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: Number(limit),
          skip,
        }),
        prisma.securityLog.count({ where: { userId } }),
      ]);

      return successResponse(res, {
        logs,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error('Get security logs error:', error);
      throw new AppError('GEN_004', 'Failed to get security logs', 500);
    }
  }

  // Delete account
  async deleteAccount(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;

      // Check if user has any open orders or active stakes
      const [openOrders, activeStakes] = await Promise.all([
        prisma.order.count({
          where: {
            userId,
            status: { in: ['OPEN', 'PARTIALLY_FILLED'] },
          },
        }),
        prisma.userStake.count({
          where: {
            userId,
            status: 'ACTIVE',
          },
        }),
      ]);

      if (openOrders > 0 || activeStakes > 0) {
        throw new AppError(
          'GEN_001',
          'Cannot delete account with active orders or stakes',
          400
        );
      }

      // Soft delete - deactivate account
      await prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      });

      return successResponse(res, { message: 'Account deleted successfully' });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Delete account error:', error);
      throw new AppError('GEN_004', 'Failed to delete account', 500);
    }
  }
}
