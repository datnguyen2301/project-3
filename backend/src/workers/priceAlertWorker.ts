import prisma from '../config/database';
import logger from '../config/logger';
import { sendNotificationToUser } from '../websocket/notificationHandler';
import axios from 'axios';

export class PriceAlertWorker {
  private isRunning = false;
  private intervalMs = 10000; // Check every 10 seconds
  private priceCache: Map<string, number> = new Map();

  /**
   * Start the price alert worker
   */
  start() {
    if (this.isRunning) {
      logger.warn('Price alert worker already running');
      return;
    }

    this.isRunning = true;
    logger.info('Price alert worker started');
    this.checkAlerts();
  }

  /**
   * Stop the worker
   */
  stop() {
    this.isRunning = false;
    logger.info('Price alert worker stopped');
  }

  /**
   * Main worker loop
   */
  private async checkAlerts() {
    while (this.isRunning) {
      try {
        await this.processAlerts();
      } catch (error) {
        logger.error('Price alert worker error:', error);
      }

      // Wait before next check
      await new Promise((resolve) => setTimeout(resolve, this.intervalMs));
    }
  }

  /**
   * Process all active alerts
   */
  private async processAlerts() {
    try {
      // Get all active alerts
      const alerts = await prisma.priceAlert.findMany({
        where: {
          triggered: false,
        },
      });

      if (alerts.length === 0) {
        return;
      }

      // Get unique symbols
      const symbols = [...new Set(alerts.map((alert) => alert.symbol))];

      // Fetch current prices
      await this.updatePrices(symbols);

      // Check each alert
      for (const alert of alerts) {
        const currentPrice = this.priceCache.get(alert.symbol);
        if (!currentPrice) continue;

        const targetPrice = Number(alert.targetPrice);
        const previousPrice = Number(alert.lastPrice || targetPrice);

        let shouldTrigger = false;

        switch (alert.condition) {
          case 'ABOVE':
            shouldTrigger = currentPrice > targetPrice;
            break;
          case 'BELOW':
            shouldTrigger = currentPrice < targetPrice;
            break;
          case 'CROSS_UP':
            shouldTrigger = previousPrice <= targetPrice && currentPrice > targetPrice;
            break;
          case 'CROSS_DOWN':
            shouldTrigger = previousPrice >= targetPrice && currentPrice < targetPrice;
            break;
        }

        if (shouldTrigger) {
          await this.triggerAlert(alert, currentPrice);
        } else {
          // Update last price for cross conditions
          if (['CROSS_UP', 'CROSS_DOWN'].includes(alert.condition)) {
            await prisma.priceAlert.update({
              where: { id: alert.id },
              data: { lastPrice: currentPrice },
            });
          }
        }
      }
    } catch (error) {
      logger.error('Process alerts error:', error);
    }
  }

  /**
   * Update prices for symbols
   */
  private async updatePrices(symbols: string[]) {
    try {
      const response = await axios.get('https://api.binance.com/api/v3/ticker/price');
      const prices = response.data;

      for (const symbol of symbols) {
        const ticker = prices.find((p: any) => p.symbol === symbol);
        if (ticker) {
          this.priceCache.set(symbol, parseFloat(ticker.price));
        }
      }
    } catch (error) {
      logger.error('Failed to update prices:', error);
    }
  }

  /**
   * Trigger an alert
   */
  private async triggerAlert(alert: any, currentPrice: number) {
    try {
      // Mark alert as triggered
      await prisma.priceAlert.update({
        where: { id: alert.id },
        data: {
          triggered: true,
          // TODO: Uncomment after Prisma regenerates with these fields
          // triggeredAt: new Date(),
          // triggeredPrice: currentPrice,
        },
      });

      // Create notification
      await prisma.notification.create({
        data: {
          userId: alert.userId,
          type: 'PRICE_ALERT',
          title: 'Price Alert Triggered',
          message: `${alert.symbol} ${alert.condition.toLowerCase().replace('_', ' ')} ${Number(
            alert.targetPrice
          ).toFixed(2)}. Current price: ${currentPrice.toFixed(2)}`,
          data: {
            alertId: alert.id,
            symbol: alert.symbol,
            targetPrice: Number(alert.targetPrice),
            currentPrice,
            condition: alert.condition,
          },
        },
      });

      // Send WebSocket notification
      sendNotificationToUser(alert.userId, {
        type: 'priceAlert',
        data: {
          alertId: alert.id,
          symbol: alert.symbol,
          targetPrice: Number(alert.targetPrice),
          currentPrice,
          condition: alert.condition,
          note: alert.note,
        },
      });

      logger.info(`Alert triggered: ${alert.symbol} ${alert.condition} ${alert.targetPrice}`);
    } catch (error) {
      logger.error('Trigger alert error:', error);
    }
  }
}

// Export singleton instance
export const priceAlertWorker = new PriceAlertWorker();
