import cron from 'node-cron';
import prisma from '../config/database';
import logger from '../config/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { toNumber } from '../common/utils/decimal.utils';
import { calculateDailyReward } from '../common/utils/helpers';

export class WorkerService {
  public start() {
    logger.info('🔧 Starting background workers...');

    // Calculate earn rewards daily at 00:00 UTC
    cron.schedule('0 0 * * *', () => {
      this.calculateEarnRewards();
    });

    // Create portfolio snapshots daily at 00:05 UTC
    cron.schedule('5 0 * * *', () => {
      this.createPortfolioSnapshots();
    });

    // Clean up expired tokens every hour
    cron.schedule('0 * * * *', () => {
      this.cleanupExpiredTokens();
    });

    // Clean up old refresh tokens daily
    cron.schedule('0 2 * * *', () => {
      this.cleanupOldRefreshTokens();
    });

    logger.info('✅ Background workers started');
  }

  // Calculate and distribute earn rewards
  private async calculateEarnRewards() {
    try {
      logger.info('📊 Calculating earn rewards...');

      const activeStakes = await prisma.userStake.findMany({
        where: { status: 'ACTIVE' },
        include: { user: true },
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const stake of activeStakes) {
        try {
          // Check if reward already distributed for today
          const existingReward = await prisma.earnReward.findFirst({
            where: {
              stakeId: stake.id,
              rewardDate: today,
            },
          });

          if (existingReward) {
            continue;
          }

          // Calculate daily reward
          const amount = toNumber(stake.amount);
          const apy = toNumber(stake.apy);
          const dailyReward = calculateDailyReward(amount, apy);

          // Create reward record
          await prisma.$transaction(async (tx: any) => {
            // Create reward
            await tx.earnReward.create({
              data: {
                stakeId: stake.id,
                userId: stake.userId,
                symbol: stake.symbol,
                amount: new Decimal(dailyReward),
                apy: stake.apy,
                rewardDate: today,
              },
            });

            // Update stake
            await tx.userStake.update({
              where: { id: stake.id },
              data: {
                accumulatedRewards: {
                  increment: dailyReward,
                },
                lastRewardDate: new Date(),
              },
            });

            // Add to wallet balance
            await tx.walletBalance.upsert({
              where: {
                userId_symbol: {
                  userId: stake.userId,
                  symbol: stake.symbol,
                },
              },
              create: {
                userId: stake.userId,
                symbol: stake.symbol,
                available: new Decimal(dailyReward),
                locked: new Decimal(0),
              },
              update: {
                available: {
                  increment: dailyReward,
                },
              },
            });

            // Create wallet transaction
            await tx.walletTransaction.create({
              data: {
                userId: stake.userId,
                type: 'EARN_REWARD',
                symbol: stake.symbol,
                amount: new Decimal(dailyReward),
                status: 'COMPLETED',
                referenceId: stake.id,
                referenceType: 'EARN',
              },
            });
          });

          logger.info(
            `Reward distributed: ${dailyReward} ${stake.symbol} to user ${stake.userId}`
          );
        } catch (error) {
          logger.error(`Error processing stake ${stake.id}:`, error);
        }
      }

      logger.info('✅ Earn rewards calculated');
    } catch (error) {
      logger.error('Error calculating earn rewards:', error);
    }
  }

  // Create daily portfolio snapshots
  private async createPortfolioSnapshots() {
    try {
      logger.info('📸 Creating portfolio snapshots...');

      // Hardcoded prices (in production, fetch from price API)
      const prices: Record<string, number> = {
        BTC: 97000,
        ETH: 3400,
        BNB: 700,
        SOL: 200,
        XRP: 2.3,
        ADA: 1.0,
        DOGE: 0.35,
      };

      const users = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      for (const user of users) {
        try {
          const portfolios = await prisma.portfolio.findMany({
            where: { userId: user.id },
          });

          if (portfolios.length === 0) {
            continue;
          }

          // Calculate total value using current prices
          let totalValue = 0;
          const snapshotData: any[] = [];

          for (const portfolio of portfolios) {
            const amount = toNumber(portfolio.amount);
            const currentPrice = prices[portfolio.symbol] || toNumber(portfolio.avgBuyPrice);
            const value = amount * currentPrice;

            totalValue += value;

            snapshotData.push({
              symbol: portfolio.symbol,
              amount,
              price: currentPrice,
              value,
            });
          }

          // Add USDT balance
          const usdtBalance = await prisma.walletBalance.findUnique({
            where: {
              userId_symbol: {
                userId: user.id,
                symbol: 'USDT',
              },
            },
          });

          if (usdtBalance) {
            const usdtAmount =
              toNumber(usdtBalance.available) + toNumber(usdtBalance.locked);
            totalValue += usdtAmount;
            snapshotData.push({
              symbol: 'USDT',
              amount: usdtAmount,
              price: 1,
              value: usdtAmount,
            });
          }

          // Get previous snapshot to calculate PnL
          const previousSnapshot = await prisma.portfolioHistory.findFirst({
            where: { userId: user.id },
            orderBy: { timestamp: 'desc' },
          });

          const baselineValue = previousSnapshot
            ? toNumber(previousSnapshot.totalValue)
            : totalValue;
          const totalPnl = totalValue - baselineValue;
          const totalPnlPercentage = baselineValue > 0
            ? (totalPnl / baselineValue) * 100
            : 0;

          // Create snapshot
          await prisma.portfolioHistory.create({
            data: {
              userId: user.id,
              totalValue: new Decimal(totalValue),
              totalPnl: new Decimal(totalPnl),
              totalPnlPercentage: new Decimal(totalPnlPercentage),
              snapshotData,
            },
          });

          logger.info(`Snapshot created for user ${user.id}: $${totalValue.toFixed(2)} (PnL: ${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)})`);
        } catch (error) {
          logger.error(`Error creating snapshot for user ${user.id}:`, error);
        }
      }

      logger.info('✅ Portfolio snapshots created');
    } catch (error) {
      logger.error('Error creating portfolio snapshots:', error);
    }
  }

  // Clean up expired verification tokens
  private async cleanupExpiredTokens() {
    try {
      logger.info('🧹 Cleaning up expired tokens...');

      const result = await prisma.verificationToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { used: true, createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
          ],
        },
      });

      logger.info(`✅ Cleaned up ${result.count} expired tokens`);
    } catch (error) {
      logger.error('Error cleaning up tokens:', error);
    }
  }

  // Clean up old refresh tokens
  private async cleanupOldRefreshTokens() {
    try {
      logger.info('🧹 Cleaning up old refresh tokens...');

      const result = await prisma.refreshToken.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      logger.info(`✅ Cleaned up ${result.count} old refresh tokens`);
    } catch (error) {
      logger.error('Error cleaning up refresh tokens:', error);
    }
  }
}
