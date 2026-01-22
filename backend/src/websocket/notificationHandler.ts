import { Server as SocketIOServer } from 'socket.io';
import logger from '../config/logger';

let io: SocketIOServer | null = null;

export function setSocketIO(socketIO: SocketIOServer) {
  io = socketIO;
  logger.info('✅ Socket.IO notification handler initialized');
}

export function sendNotificationToUser(userId: string, notification: any) {
  if (!io) {
    logger.warn('Socket.IO not initialized - notification not sent');
    return;
  }

  // Send to specific user room
  const room = `user:${userId}`;
  
  // Emit with specific event type if provided
  const eventType = notification.type || 'notification';
  const eventData = notification.data || notification;
  
  // Emit the specific event (priceAlert, priceAlertCreated, orderUpdate, etc.)
  io.to(room).emit(eventType, eventData);
  
  // Only emit generic 'notification' for price alerts (không emit cho orderUpdate)
  if (eventType === 'priceAlertCreated' || eventType === 'priceAlert') {
    let title = '';
    let message = '';
    
    if (eventType === 'priceAlertCreated') {
      title = 'Cảnh báo giá đã được tạo';
      message = eventData.message || `Alert cho ${eventData.symbol} tại $${eventData.targetPrice}`;
    } else if (eventType === 'priceAlert') {
      const conditionText = eventData.condition === 'ABOVE' ? 'vượt lên trên' : 
                           eventData.condition === 'BELOW' ? 'xuống dưới' :
                           eventData.condition === 'CROSS_UP' ? 'cắt lên' : 'cắt xuống';
      title = `🔔 Cảnh báo giá: ${eventData.symbol}`;
      message = `Giá ${conditionText} $${eventData.targetPrice}. Giá hiện tại: $${eventData.currentPrice?.toFixed(2) || 'N/A'}`;
    }
    
    io.to(room).emit('notification', {
      id: eventData.alertId || eventData.id || Date.now().toString(),
      type: eventType === 'priceAlert' ? 'warning' : 'info',
      title,
      message,
      createdAt: new Date().toISOString(),
      data: eventData,
    });
  }
  
  logger.info(`📢 Notification sent to ${room}: ${eventType}`);
}

export function sendNotificationToAll(notification: any) {
  if (!io) {
    logger.warn('Socket.IO not initialized');
    return;
  }

  const eventType = notification.type || 'notification';
  io.emit(eventType, notification.data || notification);
}
