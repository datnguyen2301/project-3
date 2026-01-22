import { Response } from 'express';
import prisma from '../../config/database';
import { successResponse, AppError } from '../../common/utils/response.utils';
import { AuthRequest } from '../../common/middlewares/auth.middleware';
import logger from '../../config/logger';
import { sendNotificationToUser } from '../../websocket/notificationHandler';
import emailService from '../../common/services/email.service';

export class NotificationController {
  // Get all notifications for user
  async getNotifications(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip,
        }),
        prisma.notification.count({ where: { userId } }),
      ]);

      return successResponse(res, {
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get notifications error:', error);
      throw new AppError('GEN_004', 'Failed to get notifications', 500);
    }
  }

  // Get unread count
  async getUnreadCount(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const count = await prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      });

      return successResponse(res, { unreadCount: count });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get unread count error:', error);
      throw new AppError('GEN_004', 'Failed to get unread count', 500);
    }
  }

  // Mark notification as read
  async markAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const notification = await prisma.notification.findFirst({
        where: { id, userId },
      });

      if (!notification) {
        throw new AppError('NOT_001', 'Notification not found', 404);
      }

      await prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });

      // Return updated unread count so frontend can update badge
      const unreadCount = await prisma.notification.count({
        where: { userId, isRead: false },
      });

      return successResponse(res, { 
        message: 'Notification marked as read',
        unreadCount,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Mark as read error:', error);
      throw new AppError('GEN_004', 'Failed to mark notification as read', 500);
    }
  }

  // Mark all as read
  async markAllAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const result = await prisma.notification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: { isRead: true },
      });

      return successResponse(res, { 
        message: 'All notifications marked as read',
        markedCount: result.count,
        unreadCount: 0,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Mark all as read error:', error);
      throw new AppError('GEN_004', 'Failed to mark all as read', 500);
    }
  }

  // Delete notification
  async deleteNotification(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const notification = await prisma.notification.findFirst({
        where: { id, userId },
      });

      if (!notification) {
        throw new AppError('NOT_001', 'Notification not found', 404);
      }

      await prisma.notification.delete({ where: { id } });

      return successResponse(res, { message: 'Notification deleted' });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Delete notification error:', error);
      throw new AppError('GEN_004', 'Failed to delete notification', 500);
    }
  }

  // Get notification settings
  async getSettings(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      let settings = await prisma.notificationSetting.findUnique({
        where: { userId },
      });

      // Create default settings if not exists
      if (!settings) {
        settings = await prisma.notificationSetting.create({
          data: {
            userId,
            emailNotifications: true,
            pushNotifications: true,
            orderFilled: true,
            priceAlert: true,
            deposit: true,
            withdrawal: true,
            security: true,
            marketing: false,
          },
        });
      }

      return successResponse(res, { settings });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get notification settings error:', error);
      throw new AppError('GEN_004', 'Failed to get notification settings', 500);
    }
  }

  // Update notification settings
  async updateSettings(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const settings = await prisma.notificationSetting.upsert({
        where: { userId },
        update: req.body,
        create: {
          userId,
          ...req.body,
        },
      });

      return successResponse(res, {
        message: 'Notification settings updated',
        settings,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Update notification settings error:', error);
      throw new AppError('GEN_004', 'Failed to update notification settings', 500);
    }
  }

  // Test notification (development only)
  async testNotification(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const { title, message, type } = req.body;

      // Create test notification with email
      const notification = await createNotification(
        userId,
        title || 'Test Notification',
        message || 'This is a test notification from the system.',
        type || 'SYSTEM',
        { test: true },
        '/dashboard'
      );

      if (!notification) {
        throw new AppError('GEN_004', 'Failed to create notification', 500);
      }

      return successResponse(res, {
        message: 'Test notification created and email sent',
        notification,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Test notification error:', error);
      throw new AppError('GEN_004', 'Failed to send test notification', 500);
    }
  }
}

/**
 * Helper function to create a notification
 */
export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: string,
  data?: any,
  link?: string
) {
  try {
    // Get user with notification settings
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        preferences: true,
      },
    });

    if (!user) {
      logger.error(`User not found: ${userId}`);
      return undefined;
    }

    // Get notification settings
    const notificationSettings = await prisma.notificationSetting.findUnique({
      where: { userId },
    });

    // Create notification in database
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        data,
        link,
        isRead: false,
        emailSent: false,
      } as any,
    });

    // Send real-time notification via WebSocket
    sendNotificationToUser(userId, notification);

    // Send email notification if enabled
    const shouldSendEmail = await shouldSendEmailForType(type, notificationSettings);
    
    if (shouldSendEmail) {
      const emailSent = await emailService.sendNotificationEmail(
        user.email,
        title,
        message,
        link
      );

      // Update emailSent status
      if (emailSent) {
        await prisma.notification.update({
          where: { id: notification.id },
          data: { emailSent: true } as any,
        });
        logger.info(`Email notification sent to ${user.email} for notification ${notification.id}`);
      }
    }

    return notification;
  } catch (error) {
    logger.error('Create notification error:', error);
    return undefined;
  }
}

/**
 * Check if email should be sent for notification type
 */
async function shouldSendEmailForType(
  type: string,
  settings: any
): Promise<boolean> {
  // If no settings, default to sending emails
  if (!settings) return true;

  // Check if email notifications are globally enabled
  if (!settings.emailNotifications) return false;

  // Check specific notification type settings
  switch (type) {
    case 'ORDER':
      return settings.orderFilled || false;
    case 'PRICE_ALERT':
      return settings.priceAlert || false;
    case 'DEPOSIT':
      return settings.deposit || false;
    case 'WITHDRAWAL':
      return settings.withdrawal || false;
    case 'SECURITY':
      return settings.security || false;
    case 'MARKETING':
      return settings.marketing || false;
    default:
      return true;
  }
}
