import { Response } from 'express';
import prisma from '../../config/database';
import { successResponse, AppError } from '../../common/utils/response.utils';
import { AuthRequest } from '../../common/middlewares/auth.middleware';
import logger from '../../config/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { sendNotificationToUser } from '../../websocket/notificationHandler';

export class TradeController {
  /**
   * Mua crypto bằng VND
   */
  async buyCrypto(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { cryptoCurrency, amount, quoteAmount } = req.body;
      // cryptoCurrency: BTC, ETH, USDT...
      // amount: số lượng crypto muốn mua (optional)
      // quoteAmount: số tiền VND muốn dùng để mua (optional)

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      if (!cryptoCurrency) {
        throw new AppError('TRADE_001', 'Vui lòng chọn loại crypto', 400);
      }

      if (!amount && !quoteAmount) {
        throw new AppError('TRADE_002', 'Vui lòng nhập số lượng hoặc số tiền', 400);
      }

      // Lấy giá crypto hiện tại
      const price = await this.getCurrentCryptoPrice(cryptoCurrency);
      if (!price) {
        throw new AppError('TRADE_003', 'Không thể lấy giá crypto', 500);
      }

      // Tính toán số lượng
      let cryptoAmount: number;
      let vndAmount: number;

      if (quoteAmount) {
        // Mua theo số tiền VND
        vndAmount = Number(quoteAmount);
        cryptoAmount = vndAmount / price;
      } else {
        // Mua theo số lượng crypto
        cryptoAmount = Number(amount);
        vndAmount = cryptoAmount * price;
      }

      // Validate minimum
      const minVND = 10000; // 10,000 VND
      if (vndAmount < minVND) {
        throw new AppError('TRADE_004', `Số tiền tối thiểu là ${minVND.toLocaleString('vi-VN')} VND`, 400);
      }

      // Thực hiện giao dịch trong transaction
      const result = await prisma.$transaction(async (tx) => {
        // Lock và kiểm tra số dư VND
        const vndWallet = await tx.walletBalance.findUnique({
          where: {
            userId_symbol: {
              userId,
              symbol: 'VND',
            },
          },
        });

        if (!vndWallet || Number(vndWallet.available) < vndAmount) {
          throw new AppError(
            'TRADE_005',
            `Số dư không đủ. Cần ${vndAmount.toLocaleString('vi-VN')} VND, hiện có ${
              vndWallet ? Number(vndWallet.available).toLocaleString('vi-VN') : 0
            } VND`,
            400
          );
        }

        // Trừ tiền VND
        await tx.walletBalance.update({
          where: {
            userId_symbol: {
              userId,
              symbol: 'VND',
            },
          },
          data: {
            available: {
              decrement: vndAmount,
            },
          },
        });

        // Cộng crypto
        await tx.walletBalance.upsert({
          where: {
            userId_symbol: {
              userId,
              symbol: cryptoCurrency.toUpperCase(),
            },
          },
          update: {
            available: {
              increment: cryptoAmount,
            },
          },
          create: {
            userId,
            symbol: cryptoCurrency.toUpperCase(),
            available: new Decimal(cryptoAmount),
            locked: new Decimal(0),
          },
        });

        // Ghi log transaction - trừ VND
        await tx.walletTransaction.create({
          data: {
            userId,
            type: 'TRADE',
            symbol: 'VND',
            amount: new Decimal(-vndAmount),
            fee: new Decimal(0),
            status: 'COMPLETED',
            memo: `Mua ${cryptoAmount.toFixed(8)} ${cryptoCurrency} @ ${price.toLocaleString('vi-VN')} VND`,
          },
        });

        // Ghi log transaction - cộng crypto
        await tx.walletTransaction.create({
          data: {
            userId,
            type: 'TRADE',
            symbol: cryptoCurrency.toUpperCase(),
            amount: new Decimal(cryptoAmount),
            fee: new Decimal(0),
            status: 'COMPLETED',
            memo: `Mua từ ${vndAmount.toLocaleString('vi-VN')} VND @ ${price.toLocaleString('vi-VN')} VND`,
          },
        });

        // Tạo notification
        const notification = await tx.notification.create({
          data: {
            userId,
            type: 'TRADE',
            title: 'Mua crypto thành công',
            message: `Bạn đã mua ${cryptoAmount.toFixed(8)} ${cryptoCurrency} với giá ${vndAmount.toLocaleString('vi-VN')} VND`,
            data: {
              type: 'BUY',
              cryptoCurrency,
              cryptoAmount,
              vndAmount,
              price,
            },
          },
        });

        // Gửi notification real-time qua WebSocket
        sendNotificationToUser(userId, notification);

        // Update portfolio cho mua crypto bằng VND
        await this.updatePortfolioVND(tx, userId, cryptoCurrency, 'BUY', cryptoAmount, price);

        // Lấy số dư mới
        const [newVndBalance, newCryptoBalance] = await Promise.all([
          tx.walletBalance.findUnique({
            where: { userId_symbol: { userId, symbol: 'VND' } },
          }),
          tx.walletBalance.findUnique({
            where: { userId_symbol: { userId, symbol: cryptoCurrency.toUpperCase() } },
          }),
        ]);

        return {
          cryptoAmount,
          vndAmount,
          price,
          newVndBalance: Number(newVndBalance?.available || 0),
          newCryptoBalance: Number(newCryptoBalance?.available || 0),
        };
      });

      logger.info(
        `User ${userId} bought ${result.cryptoAmount} ${cryptoCurrency} for ${result.vndAmount} VND @ ${result.price}`
      );

      return successResponse(res, {
        success: true,
        trade: {
          type: 'BUY',
          cryptoCurrency: cryptoCurrency.toUpperCase(),
          cryptoAmount: result.cryptoAmount,
          vndAmount: result.vndAmount,
          price: result.price,
          executedAt: new Date(),
        },
        balances: {
          VND: result.newVndBalance,
          [cryptoCurrency.toUpperCase()]: result.newCryptoBalance,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Buy crypto error:', error);
      throw new AppError('GEN_004', 'Không thể thực hiện giao dịch', 500);
    }
  }

  /**
   * Bán crypto lấy VND
   */
  async sellCrypto(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { cryptoCurrency, amount } = req.body;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      if (!cryptoCurrency || !amount) {
        throw new AppError('TRADE_001', 'Vui lòng nhập đầy đủ thông tin', 400);
      }

      const cryptoAmount = Number(amount);
      if (cryptoAmount <= 0) {
        throw new AppError('TRADE_002', 'Số lượng không hợp lệ', 400);
      }

      // Lấy giá crypto hiện tại
      const price = await this.getCurrentCryptoPrice(cryptoCurrency);
      if (!price) {
        throw new AppError('TRADE_003', 'Không thể lấy giá crypto', 500);
      }

      const vndAmount = cryptoAmount * price;

      // Validate minimum
      const minVND = 10000;
      if (vndAmount < minVND) {
        throw new AppError('TRADE_004', `Giá trị tối thiểu là ${minVND.toLocaleString('vi-VN')} VND`, 400);
      }

      // Thực hiện giao dịch trong transaction
      const result = await prisma.$transaction(async (tx) => {
        // Kiểm tra số dư crypto
        const cryptoWallet = await tx.walletBalance.findUnique({
          where: {
            userId_symbol: {
              userId,
              symbol: cryptoCurrency.toUpperCase(),
            },
          },
        });

        if (!cryptoWallet || Number(cryptoWallet.available) < cryptoAmount) {
          throw new AppError(
            'TRADE_005',
            `Số dư không đủ. Cần ${cryptoAmount} ${cryptoCurrency}, hiện có ${
              cryptoWallet ? Number(cryptoWallet.available) : 0
            } ${cryptoCurrency}`,
            400
          );
        }

        // Trừ crypto
        await tx.walletBalance.update({
          where: {
            userId_symbol: {
              userId,
              symbol: cryptoCurrency.toUpperCase(),
            },
          },
          data: {
            available: {
              decrement: cryptoAmount,
            },
          },
        });

        // Cộng VND
        await tx.walletBalance.upsert({
          where: {
            userId_symbol: {
              userId,
              symbol: 'VND',
            },
          },
          update: {
            available: {
              increment: vndAmount,
            },
          },
          create: {
            userId,
            symbol: 'VND',
            available: new Decimal(vndAmount),
            locked: new Decimal(0),
          },
        });

        // Ghi log transactions
        await tx.walletTransaction.create({
          data: {
            userId,
            type: 'TRADE',
            symbol: cryptoCurrency.toUpperCase(),
            amount: new Decimal(-cryptoAmount),
            fee: new Decimal(0),
            status: 'COMPLETED',
            memo: `Bán ${cryptoAmount} ${cryptoCurrency} @ ${price.toLocaleString('vi-VN')} VND`,
          },
        });

        await tx.walletTransaction.create({
          data: {
            userId,
            type: 'TRADE',
            symbol: 'VND',
            amount: new Decimal(vndAmount),
            fee: new Decimal(0),
            status: 'COMPLETED',
            memo: `Bán ${cryptoAmount} ${cryptoCurrency} @ ${price.toLocaleString('vi-VN')} VND`,
          },
        });

        // Notification
        const notification = await tx.notification.create({
          data: {
            userId,
            type: 'TRADE',
            title: 'Bán crypto thành công',
            message: `Bạn đã bán ${cryptoAmount} ${cryptoCurrency} và nhận ${vndAmount.toLocaleString('vi-VN')} VND`,
            data: {
              type: 'SELL',
              cryptoCurrency,
              cryptoAmount,
              vndAmount,
              price,
            },
          },
        });

        // Gửi notification real-time qua WebSocket
        sendNotificationToUser(userId, notification);

        // Update portfolio cho bán crypto lấy VND
        await this.updatePortfolioVND(tx, userId, cryptoCurrency, 'SELL', cryptoAmount, price);

        // Lấy số dư mới
        const [newVndBalance, newCryptoBalance] = await Promise.all([
          tx.walletBalance.findUnique({
            where: { userId_symbol: { userId, symbol: 'VND' } },
          }),
          tx.walletBalance.findUnique({
            where: { userId_symbol: { userId, symbol: cryptoCurrency.toUpperCase() } },
          }),
        ]);

        return {
          cryptoAmount,
          vndAmount,
          price,
          newVndBalance: Number(newVndBalance?.available || 0),
          newCryptoBalance: Number(newCryptoBalance?.available || 0),
        };
      });

      logger.info(
        `User ${userId} sold ${result.cryptoAmount} ${cryptoCurrency} for ${result.vndAmount} VND @ ${result.price}`
      );

      return successResponse(res, {
        success: true,
        trade: {
          type: 'SELL',
          cryptoCurrency: cryptoCurrency.toUpperCase(),
          cryptoAmount: result.cryptoAmount,
          vndAmount: result.vndAmount,
          price: result.price,
          executedAt: new Date(),
        },
        balances: {
          VND: result.newVndBalance,
          [cryptoCurrency.toUpperCase()]: result.newCryptoBalance,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Sell crypto error:', error);
      throw new AppError('GEN_004', 'Không thể thực hiện giao dịch', 500);
    }
  }

  /**
   * Lấy báo giá (quote) trước khi mua/bán
   */
  async getQuote(req: AuthRequest, res: Response) {
    try {
      const { cryptoCurrency, amount, quoteAmount, side } = req.query;

      if (!cryptoCurrency) {
        throw new AppError('TRADE_001', 'Vui lòng chọn loại crypto', 400);
      }

      const price = await this.getCurrentCryptoPrice(cryptoCurrency as string);
      if (!price) {
        throw new AppError('TRADE_003', 'Không thể lấy giá crypto', 500);
      }

      let cryptoAmount: number;
      let vndAmount: number;

      if (quoteAmount) {
        vndAmount = Number(quoteAmount);
        cryptoAmount = vndAmount / price;
      } else if (amount) {
        cryptoAmount = Number(amount);
        vndAmount = cryptoAmount * price;
      } else {
        // Chỉ trả về giá
        return successResponse(res, {
          cryptoCurrency: (cryptoCurrency as string).toUpperCase(),
          price,
          priceVND: price.toLocaleString('vi-VN') + ' VND',
          validFor: 30, // seconds
          expiresAt: new Date(Date.now() + 30000),
        });
      }

      return successResponse(res, {
        cryptoCurrency: (cryptoCurrency as string).toUpperCase(),
        side: side || 'BUY',
        price,
        cryptoAmount,
        vndAmount,
        fee: 0,
        total: vndAmount,
        validFor: 30,
        expiresAt: new Date(Date.now() + 30000),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get quote error:', error);
      throw new AppError('GEN_004', 'Không thể lấy báo giá', 500);
    }
  }

  /**
   * Lấy lịch sử giao dịch mua/bán
   */
  async getTradeHistory(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { page = 1, limit = 20, symbol } = req.query;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const where: any = {
        userId,
        type: 'TRADE',
      };

      if (symbol) {
        where.symbol = (symbol as string).toUpperCase();
      }

      const [trades, total] = await Promise.all([
        prisma.walletTransaction.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
        }),
        prisma.walletTransaction.count({ where }),
      ]);

      return successResponse(res, {
        trades: trades.map((t) => ({
          id: t.id,
          symbol: t.symbol,
          amount: Number(t.amount),
          type: Number(t.amount) > 0 ? 'BUY' : 'SELL',
          memo: t.memo,
          createdAt: t.createdAt,
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
      logger.error('Get trade history error:', error);
      throw new AppError('GEN_004', 'Không thể lấy lịch sử giao dịch', 500);
    }
  }

  /**
   * Helper: Lấy giá crypto hiện tại từ Binance API
   */
  private async getCurrentCryptoPrice(symbol: string): Promise<number | null> {
    try {
      // Chuyển đổi symbol sang cặp với USDT
      const pair = `${symbol.toUpperCase()}USDT`;
      
      // Gọi Binance API
      const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`);
      
      if (!response.ok) {
        // Thử với VND nếu không có USDT pair
        logger.warn(`Cannot get ${pair} price from Binance`);
        return null;
      }

      const data = await response.json() as { price: string };
      const usdtPrice = parseFloat(data.price);

      // Chuyển đổi sang VND (giả sử 1 USDT = 25,000 VND)
      const usdtToVnd = 25000;
      const vndPrice = usdtPrice * usdtToVnd;

      logger.debug(`Price ${symbol}: ${usdtPrice} USDT = ${vndPrice} VND`);
      
      return vndPrice;
    } catch (error) {
      logger.error('Get crypto price error:', error);
      return null;
    }
  }

  /**
   * Helper: Update portfolio when trading with VND
   */
  private async updatePortfolioVND(
    tx: any,
    userId: string,
    symbol: string,
    side: 'BUY' | 'SELL',
    amount: number,
    priceInVND: number
  ) {
    try {
      // Convert VND price to USDT for portfolio (1 USDT = 25,000 VND)
      const priceInUSDT = priceInVND / 25000;

      if (side === 'BUY') {
        const portfolio = await tx.portfolio.findUnique({
          where: {
            userId_symbol: { userId, symbol: symbol.toUpperCase() },
          },
        });

        if (portfolio) {
          const currentAmount = parseFloat(portfolio.amount.toString());
          const currentInvested = parseFloat(portfolio.totalInvested.toString());
          const newAmount = currentAmount + amount;
          const newInvested = currentInvested + amount * priceInUSDT;
          const newAvgPrice = newInvested / newAmount;

          await tx.portfolio.update({
            where: { id: portfolio.id },
            data: {
              amount: new Decimal(newAmount),
              totalInvested: new Decimal(newInvested),
              avgBuyPrice: new Decimal(newAvgPrice),
            },
          });
        } else {
          await tx.portfolio.create({
            data: {
              userId,
              symbol: symbol.toUpperCase(),
              amount: new Decimal(amount),
              avgBuyPrice: new Decimal(priceInUSDT),
              totalInvested: new Decimal(amount * priceInUSDT),
            },
          });
        }
      } else {
        // SELL
        const portfolio = await tx.portfolio.findUnique({
          where: {
            userId_symbol: { userId, symbol: symbol.toUpperCase() },
          },
        });

        if (portfolio) {
          const currentAmount = parseFloat(portfolio.amount.toString());
          const currentInvested = parseFloat(portfolio.totalInvested.toString());
          const sellRatio = amount / currentAmount;
          const investedReduction = currentInvested * sellRatio;
          const newAmount = currentAmount - amount;
          const newInvested = currentInvested - investedReduction;

          if (newAmount <= 0) {
            await tx.portfolio.delete({
              where: { id: portfolio.id },
            });
          } else {
            await tx.portfolio.update({
              where: { id: portfolio.id },
              data: {
                amount: new Decimal(newAmount),
                totalInvested: new Decimal(newInvested),
              },
            });
          }
        }
      }
    } catch (error) {
      logger.error('Update portfolio VND error:', error);
      // Don't throw - portfolio update is not critical
    }
  }
}

export default new TradeController();
