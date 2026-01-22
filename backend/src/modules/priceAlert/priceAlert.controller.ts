import { Response } from 'express';
import prisma from '../../config/database';
import { successResponse, AppError } from '../../common/utils/response.utils';
import { AuthRequest } from '../../common/middlewares/auth.middleware';
import logger from '../../config/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { sendNotificationToUser } from '../../websocket/notificationHandler';

export class PriceAlertController {
  // Get all price alerts
  async getAlerts(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const alerts = await prisma.priceAlert.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      return successResponse(res, { alerts });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get price alerts error:', error);
      throw new AppError('GEN_004', 'Failed to get price alerts', 500);
    }
  }

  // Create price alert
  async createAlert(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { symbol, targetPrice, condition, note } = req.body;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      // Check alert limit (max 50 active alerts per user)
      const activeCount = await prisma.priceAlert.count({
        where: {
          userId,
          triggered: false,
        },
      });

      if (activeCount >= 50) {
        throw new AppError('ALERT_001', 'Maximum 50 active alerts allowed', 400);
      }

      const alert = await prisma.priceAlert.create({
        data: {
          userId,
          symbol,
          targetPrice: new Decimal(targetPrice),
          condition,
          note: note || null,
          triggered: false,
        },
      });

      // Create notification in database
      await prisma.notification.create({
        data: {
          userId,
          type: 'PRICE_ALERT',
          title: 'Cảnh báo giá đã được tạo',
          message: `Bạn sẽ nhận được thông báo khi ${symbol} ${condition === 'ABOVE' ? 'vượt' : condition === 'BELOW' ? 'giảm dưới' : condition === 'CROSS_UP' ? 'vượt lên' : 'giảm xuống'} $${Number(targetPrice).toLocaleString()}`,
          data: {
            alertId: alert.id,
            symbol,
            targetPrice: Number(targetPrice),
            condition,
          },
        },
      });

      // Send real-time notification via WebSocket
      sendNotificationToUser(userId, {
        type: 'priceAlertCreated',
        data: {
          alertId: alert.id,
          symbol,
          targetPrice: Number(targetPrice),
          condition,
          note,
          message: `Cảnh báo giá ${symbol} đã được tạo thành công`,
        },
      });

      return successResponse(res, {
        message: 'Price alert created successfully',
        alert,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Create price alert error:', error);
      throw new AppError('GEN_004', 'Failed to create price alert', 500);
    }
  }

  // Delete price alert
  async deleteAlert(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const alert = await prisma.priceAlert.findFirst({
        where: { id, userId },
      });

      if (!alert) {
        throw new AppError('ALERT_002', 'Price alert not found', 404);
      }

      await prisma.priceAlert.delete({ where: { id } });

      return successResponse(res, { message: 'Price alert deleted' });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Delete price alert error:', error);
      throw new AppError('GEN_004', 'Failed to delete price alert', 500);
    }
  }

  // Reset alert (allow re-triggering)
  async toggleAlert(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const alert = await prisma.priceAlert.findFirst({
        where: { id, userId },
      });

      if (!alert) {
        throw new AppError('ALERT_002', 'Price alert not found', 404);
      }

      // Reset the alert to allow re-triggering
      const updated = await prisma.priceAlert.update({
        where: { id },
        data: { 
          triggered: false,
          triggeredAt: null,
          triggeredPrice: null,
        },
      });

      return successResponse(res, {
        message: alert.triggered ? 'Alert reset for re-triggering' : 'Alert status unchanged',
        alert: updated,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Toggle price alert error:', error);
      throw new AppError('GEN_004', 'Failed to toggle price alert', 500);
    }
  }
}
