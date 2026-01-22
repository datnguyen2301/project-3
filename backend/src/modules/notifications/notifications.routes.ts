import { Router, Request, Response, NextFunction } from 'express';
import { NotificationController } from './notifications.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { validate } from '../../common/middlewares/validation.middleware';
import { updateNotificationSettingsSchema } from '../../common/validators/notification.validator';

const router = Router();
const notificationController = new NotificationController();

// All routes require authentication
router.use(authenticate);

// Get all notifications
router.get('/', (req: Request, res: Response, next: NextFunction) =>
  notificationController.getNotifications(req, res).catch(next)
);

// Get unread count
router.get('/unread-count', (req: Request, res: Response, next: NextFunction) =>
  notificationController.getUnreadCount(req, res).catch(next)
);

// Mark all as read (MUST be before /:id routes to avoid conflict)
router.patch('/read-all', (req: Request, res: Response, next: NextFunction) =>
  notificationController.markAllAsRead(req, res).catch(next)
);

// Also support POST for frontend compatibility
router.post('/read-all', (req: Request, res: Response, next: NextFunction) =>
  notificationController.markAllAsRead(req, res).catch(next)
);

// Mark notification as read
router.patch('/:id/read', (req: Request, res: Response, next: NextFunction) =>
  notificationController.markAsRead(req, res).catch(next)
);

// Delete notification
router.delete('/:id', (req: Request, res: Response, next: NextFunction) =>
  notificationController.deleteNotification(req, res).catch(next)
);

// Get notification settings
router.get('/settings', (req: Request, res: Response, next: NextFunction) =>
  notificationController.getSettings(req, res).catch(next)
);

// Update notification settings
router.put('/settings', validate(updateNotificationSettingsSchema), (req: Request, res: Response, next: NextFunction) =>
  notificationController.updateSettings(req, res).catch(next)
);

// Test notification (development only)
if (process.env.NODE_ENV === 'development') {
  router.post('/test', (req: Request, res: Response, next: NextFunction) =>
    notificationController.testNotification(req, res).catch(next)
  );
}

export default router;
