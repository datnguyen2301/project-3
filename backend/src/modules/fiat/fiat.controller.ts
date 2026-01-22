import { Response } from 'express';
import prisma from '../../config/database';
import { successResponse, AppError } from '../../common/utils/response.utils';
import { AuthRequest } from '../../common/middlewares/auth.middleware';
import logger from '../../config/logger';
import Stripe from 'stripe';
import { Decimal } from '@prisma/client/runtime/library';
import paymentService from '../../common/services/payment.service';
import { sendNotificationToUser } from '../../websocket/notificationHandler';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
  apiVersion: '2025-12-15.clover',
});

export class FiatController {
  /**
   * Get available payment methods
   */
  async getPaymentMethods(_req: AuthRequest, res: Response) {
    try {
      const methods = [
        {
          id: 'stripe_card',
          name: 'Credit/Debit Card',
          provider: 'stripe',
          type: 'CARD',
          minAmount: 10,
          maxAmount: 50000,
          fee: 2.9, // percentage
          processingTime: 'Instant',
          supported: true,
        },
        {
          id: 'bank_transfer',
          name: 'Bank Transfer',
          provider: 'manual',
          type: 'BANK_TRANSFER',
          minAmount: 100,
          maxAmount: 100000,
          fee: 0,
          processingTime: '1-3 business days',
          supported: true,
        },
        {
          id: 'paypal',
          name: 'PayPal',
          provider: 'paypal',
          type: 'PAYPAL',
          minAmount: 10,
          maxAmount: 10000,
          fee: 3.5,
          processingTime: 'Instant',
          supported: false, // Not implemented yet
        },
      ];

      return successResponse(res, { methods });
    } catch (error) {
      logger.error('Get payment methods error:', error);
      throw new AppError('GEN_004', 'Failed to get payment methods', 500);
    }
  }

  /**
   * Initiate buy crypto with fiat
   */
  async initiateBuy(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { method, fiatAmount, fiatCurrency, cryptoSymbol } = req.body;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      // Validate method
      if (!['stripe_card', 'bank_transfer'].includes(method)) {
        throw new AppError('FIAT_001', 'Invalid payment method', 400);
      }

      // Get current crypto price
      const cryptoPrice = await this.getCryptoPrice(cryptoSymbol);
      if (!cryptoPrice) {
        throw new AppError('FIAT_002', 'Failed to get crypto price', 500);
      }

      // Calculate crypto amount
      const cryptoAmount = fiatAmount / cryptoPrice;

      // Calculate fees
      const feePercentage = method === 'stripe_card' ? 2.9 : 0;
      const feeAmount = (fiatAmount * feePercentage) / 100;
      const totalFiatAmount = fiatAmount + feeAmount;

      if (method === 'stripe_card') {
        // Create Stripe payment intent
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(totalFiatAmount * 100), // Convert to cents
          currency: fiatCurrency.toLowerCase(),
          metadata: {
            userId,
            cryptoSymbol,
            cryptoAmount: cryptoAmount.toString(),
            type: 'buy_crypto',
          },
        });

        // Create transaction record
        const transaction = await prisma.fiatTransaction.create({
          data: {
            userId,
            type: 'DEPOSIT',
            fiatCurrency,
            fiatAmount: new Decimal(totalFiatAmount),
            cryptoSymbol,
            cryptoAmount: new Decimal(cryptoAmount),
            method: 'CARD',
            status: 'PENDING',
            provider: 'stripe',
            metadata: {
              paymentIntentId: paymentIntent.id,
              clientSecret: paymentIntent.client_secret,
              feeAmount,
            },
          },
        });

        return successResponse(res, {
          transaction: {
            id: transaction.id,
            clientSecret: paymentIntent.client_secret,
            fiatAmount,
            fiatCurrency,
            cryptoAmount,
            cryptoSymbol,
            feeAmount,
            totalAmount: totalFiatAmount,
            status: 'PENDING',
          },
        });
      } else if (method === 'bank_transfer') {
        // Manual bank transfer
        const transaction = await prisma.fiatTransaction.create({
          data: {
            userId,
            type: 'DEPOSIT',
            fiatCurrency,
            fiatAmount: new Decimal(fiatAmount),
            cryptoSymbol,
            cryptoAmount: new Decimal(cryptoAmount),
            method: 'BANK_TRANSFER',
            status: 'PENDING',
            provider: 'manual',
            metadata: {
              bankInfo: {
                bankName: 'Crypto Exchange Bank',
                accountName: 'Crypto Exchange Ltd',
                accountNumber: '1234567890',
                swiftCode: 'CRYPUS33',
                reference: `TXN-${Date.now()}`,
              },
            },
          },
        });

        return successResponse(res, {
          transaction: {
            id: transaction.id,
            fiatAmount,
            fiatCurrency,
            cryptoAmount,
            cryptoSymbol,
            status: 'PENDING',
            bankInfo: transaction.metadata as any,
          },
          instructions:
            'Please transfer the exact amount to the bank account provided. Include the reference number in your transfer.',
        });
      }

      // Should never reach here due to validation
      throw new AppError('FIAT_001', 'Invalid payment method', 400);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Initiate buy error:', error);
      throw new AppError('GEN_004', 'Failed to initiate buy', 500);
    }
  }

  /**
   * Get transaction history
   */
  async getTransactions(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const transactions = await prisma.fiatTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      const formattedTransactions = transactions.map((tx: any) => ({
        id: tx.id,
        type: tx.type,
        fiatCurrency: tx.fiatCurrency,
        fiatAmount: Number(tx.fiatAmount),
        cryptoSymbol: tx.cryptoSymbol,
        cryptoAmount: tx.cryptoAmount ? Number(tx.cryptoAmount) : null,
        method: tx.method,
        status: tx.status,
        provider: tx.provider,
        createdAt: tx.createdAt,
        completedAt: tx.completedAt,
      }));

      return successResponse(res, { transactions: formattedTransactions });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get transactions error:', error);
      throw new AppError('GEN_004', 'Failed to get transactions', 500);
    }
  }

  /**
   * Stripe webhook handler
   */
  async handleStripeWebhook(req: any, res: Response) {
    try {
      const sig = req.headers['stripe-signature'] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test';

      let event;
      try {
        // req.body should be raw buffer from express.raw() middleware
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err: any) {
        logger.error('Stripe webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Handle the event
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object as any);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object as any);
          break;
        default:
          logger.info(`Unhandled Stripe event type: ${event.type}`);
      }

      return res.json({ received: true });
    } catch (error) {
      logger.error('Stripe webhook error:', error);
      return res.status(500).json({ error: 'Webhook handler failed' });
    }
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSuccess(paymentIntent: any) {
    try {
      const transaction = await prisma.fiatTransaction.findFirst({
        where: {
          metadata: {
            path: ['paymentIntentId'],
            equals: paymentIntent.id,
          },
        },
      });

      if (!transaction) {
        logger.error(`Transaction not found for payment intent: ${paymentIntent.id}`);
        return;
      }

      // Update transaction status
      await prisma.fiatTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // Credit crypto to user's wallet
      if (transaction.cryptoSymbol && transaction.cryptoAmount) {
        await prisma.walletBalance.upsert({
          where: {
            userId_symbol: {
              userId: transaction.userId,
              symbol: transaction.cryptoSymbol,
            },
          },
          create: {
            userId: transaction.userId,
            symbol: transaction.cryptoSymbol,
            available: transaction.cryptoAmount,
            locked: new Decimal(0),
          },
          update: {
            available: {
              increment: transaction.cryptoAmount,
            },
          },
        });

        logger.info(
          `Credited ${transaction.cryptoAmount} ${transaction.cryptoSymbol} to user ${transaction.userId}`
        );
      }
    } catch (error) {
      logger.error('Handle payment success error:', error);
    }
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(paymentIntent: any) {
    try {
      const transaction = await prisma.fiatTransaction.findFirst({
        where: {
          metadata: {
            path: ['paymentIntentId'],
            equals: paymentIntent.id,
          },
        },
      });

      if (transaction) {
        await prisma.fiatTransaction.update({
          where: { id: transaction.id },
          data: {
            status: 'FAILED',
            metadata: {
              ...((transaction.metadata as any) || {}),
              failureReason: paymentIntent.last_payment_error?.message || 'Payment failed',
            },
          },
        });
      }
    } catch (error) {
      logger.error('Handle payment failed error:', error);
    }
  }

  /**
   * Get current crypto price in USD
   */
  private async getCryptoPrice(symbol: string): Promise<number | null> {
    try {
      const axios = (await import('axios')).default;
      const response = await axios.get(
        `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`
      );
      return parseFloat(response.data.price);
    } catch (error) {
      logger.error('Failed to get crypto price:', error);
      return null;
    }
  }

  /**
   * Tạo yêu cầu nạp tiền (VNPay/MoMo/ZaloPay)
   */
  async createDeposit(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      // Accept both paymentMethod and method field
      let { amount, paymentMethod, method, currency = 'VND' } = req.body;
      
      // Use method if paymentMethod not provided
      if (!paymentMethod && method) {
        paymentMethod = method.toUpperCase();
      }
      
      // Default to VNPAY if no method specified
      if (!paymentMethod) {
        paymentMethod = 'VNPAY';
      }

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      // Validate amount
      const minAmount = 10000; // 10,000 VND
      const maxAmount = 500000000; // 500 triệu VND
      
      if (amount < minAmount) {
        throw new AppError('DEPOSIT_001', `Số tiền tối thiểu ${minAmount.toLocaleString()} ${currency}`, 400);
      }
      
      if (amount > maxAmount) {
        throw new AppError('DEPOSIT_002', `Số tiền tối đa ${maxAmount.toLocaleString()} ${currency}`, 400);
      }

      // Validate payment method
      const validMethods = ['VNPAY', 'MOMO', 'ZALOPAY', 'BANK_TRANSFER'];
      if (!validMethods.includes(paymentMethod)) {
        throw new AppError('DEPOSIT_003', 'Phương thức thanh toán không hợp lệ', 400);
      }

      // Tạo record deposit với status PENDING
      const transaction = await prisma.fiatTransaction.create({
        data: {
          userId,
          type: 'DEPOSIT',
          fiatCurrency: currency,
          fiatAmount: new Decimal(amount),
          method: paymentMethod,
          status: 'PENDING',
          provider: paymentMethod.toLowerCase(),
          metadata: {
            ipAddress: req.ip || '127.0.0.1',
            userAgent: req.headers['user-agent'],
          },
        },
      });

      const orderInfo = `Nap tien vao vi Crypto Exchange #${transaction.id}`;

      let paymentResult;

      // Tạo payment URL từ gateway
      switch (paymentMethod) {
        case 'VNPAY':
          paymentResult = await paymentService.createVNPayUrl({
            orderId: transaction.id,
            amount,
            orderInfo,
            ipAddress: req.ip || '127.0.0.1',
          });
          break;

        case 'MOMO':
          paymentResult = await paymentService.createMoMoUrl({
            orderId: transaction.id,
            amount,
            orderInfo,
          });
          break;

        case 'ZALOPAY':
          // ZaloPay chưa được hỗ trợ
          await prisma.fiatTransaction.update({
            where: { id: transaction.id },
            data: { status: 'FAILED' },
          });
          throw new AppError('DEPOSIT_007', 'ZaloPay chưa được hỗ trợ, vui lòng chọn phương thức khác', 400);

        case 'BANK_TRANSFER':
          // Trả về thông tin chuyển khoản ngân hàng
          return successResponse(res, {
            transaction: {
              id: transaction.id,
              amount,
              currency,
              status: 'PENDING',
              method: paymentMethod,
            },
            bankInfo: {
              bankName: 'Vietcombank',
              accountName: 'CONG TY TNHH CRYPTO EXCHANGE',
              accountNumber: '0123456789',
              branch: 'Hà Nội',
              content: `NAP ${transaction.id}`,
            },
            instructions: 'Vui lòng chuyển khoản đúng số tiền và nội dung. Giao dịch sẽ được xử lý trong 5-15 phút.',
          });

        default:
          throw new AppError('DEPOSIT_003', 'Phương thức thanh toán không hợp lệ', 400);
      }

      if (!paymentResult.success) {
        // Cập nhật transaction thành FAILED
        await prisma.fiatTransaction.update({
          where: { id: transaction.id },
          data: {
            status: 'FAILED',
            gatewayResponse: { error: paymentResult.error },
          },
        });
        throw new AppError('DEPOSIT_004', paymentResult.error || 'Không thể tạo thanh toán', 500);
      }

      // Cập nhật transaction với payment URL
      await prisma.fiatTransaction.update({
        where: { id: transaction.id },
        data: {
          transactionId: paymentResult.transactionId,
          metadata: {
            ...(transaction.metadata as any || {}),
            paymentUrl: paymentResult.paymentUrl,
          },
        },
      });

      logger.info(`Deposit created: ${transaction.id}, method: ${paymentMethod}, amount: ${amount}`);

      return successResponse(res, {
        transaction: {
          id: transaction.id,
          amount,
          currency,
          status: 'PENDING',
          method: paymentMethod,
        },
        paymentUrl: paymentResult.paymentUrl,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Create deposit error:', error);
      throw new AppError('GEN_004', 'Không thể tạo yêu cầu nạp tiền', 500);
    }
  }

  /**
   * Callback từ VNPay
   */
  async vnpayReturn(req: AuthRequest, res: Response) {
    try {
      const vnpayParams = req.query as any;
      
      const { isValid, isSuccess } = paymentService.verifyVNPayReturn(vnpayParams);

      if (!isValid) {
        logger.warn('VNPay return invalid signature');
        throw new AppError('PAYMENT_001', 'Chữ ký không hợp lệ', 400);
      }

      const transactionId = vnpayParams.vnp_TxnRef;
      const transaction = await prisma.fiatTransaction.findFirst({
        where: { id: transactionId },
      });

      if (!transaction) {
        throw new AppError('PAYMENT_002', 'Không tìm thấy giao dịch', 404);
      }

      if (isSuccess) {
        // Cập nhật transaction thành công
        await prisma.fiatTransaction.update({
          where: { id: transaction.id },
          data: {
            status: 'COMPLETED',
            transactionId: vnpayParams.vnp_TransactionNo,
            gatewayResponse: vnpayParams,
            completedAt: new Date(),
          },
        });

        // Cộng tiền vào ví
        await this.creditWallet(transaction.userId, transaction.fiatCurrency, Number(transaction.fiatAmount));

        logger.info(`VNPay payment success: ${transaction.id}`);

        return successResponse(res, {
          success: true,
          message: 'Nạp tiền thành công',
          transaction: {
            id: transaction.id,
            amount: Number(transaction.fiatAmount),
            currency: transaction.fiatCurrency,
            status: 'COMPLETED',
          },
        });
      } else {
        // Cập nhật transaction thất bại
        await prisma.fiatTransaction.update({
          where: { id: transaction.id },
          data: {
            status: 'FAILED',
            gatewayResponse: vnpayParams,
          },
        });

        logger.warn(`VNPay payment failed: ${transaction.id}, code: ${vnpayParams.vnp_ResponseCode}`);

        return successResponse(res, {
          success: false,
          message: 'Thanh toán thất bại',
          transaction: {
            id: transaction.id,
            status: 'FAILED',
            errorCode: vnpayParams.vnp_ResponseCode,
          },
        });
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('VNPay return error:', error);
      throw new AppError('GEN_004', 'Lỗi xử lý callback VNPay', 500);
    }
  }

  /**
   * Callback từ MoMo (IPN)
   */
  async momoCallback(req: AuthRequest, res: Response) {
    try {
      const momoParams = req.body;
      
      const { isValid, isSuccess } = paymentService.verifyMoMoReturn(momoParams);

      if (!isValid) {
        logger.warn('MoMo callback invalid signature');
        return res.status(400).json({ resultCode: 1, message: 'Invalid signature' });
      }

      const transactionId = momoParams.orderId;
      const transaction = await prisma.fiatTransaction.findFirst({
        where: { id: transactionId },
      });

      if (!transaction) {
        return res.status(404).json({ resultCode: 1, message: 'Transaction not found' });
      }

      if (isSuccess) {
        await prisma.fiatTransaction.update({
          where: { id: transaction.id },
          data: {
            status: 'COMPLETED',
            transactionId: momoParams.transId.toString(),
            gatewayResponse: momoParams,
            completedAt: new Date(),
          },
        });

        // Cộng tiền vào ví
        await this.creditWallet(transaction.userId, transaction.fiatCurrency, Number(transaction.fiatAmount));

        logger.info(`MoMo payment success: ${transaction.id}`);
      } else {
        await prisma.fiatTransaction.update({
          where: { id: transaction.id },
          data: {
            status: 'FAILED',
            gatewayResponse: momoParams,
          },
        });

        logger.warn(`MoMo payment failed: ${transaction.id}, code: ${momoParams.resultCode}`);
      }

      // MoMo yêu cầu trả về resultCode = 0 để confirm đã nhận
      return res.json({ resultCode: 0, message: 'OK' });
    } catch (error) {
      logger.error('MoMo callback error:', error);
      return res.status(500).json({ resultCode: 1, message: 'Internal error' });
    }
  }

  /**
   * Lấy lịch sử nạp tiền
   */
  async getDepositHistory(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { page = 1, limit = 20, status } = req.query;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const where: any = {
        userId,
        type: 'DEPOSIT',
      };

      if (status) {
        where.status = status;
      }

      const [deposits, total] = await Promise.all([
        prisma.fiatTransaction.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
        }),
        prisma.fiatTransaction.count({ where }),
      ]);

      return successResponse(res, {
        deposits: deposits.map((d) => ({
          id: d.id,
          amount: Number(d.fiatAmount),
          currency: d.fiatCurrency,
          method: d.method,
          status: d.status,
          transactionId: d.transactionId,
          createdAt: d.createdAt,
          completedAt: d.completedAt,
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
      logger.error('Get deposit history error:', error);
      throw new AppError('GEN_004', 'Không thể lấy lịch sử nạp tiền', 500);
    }
  }

  /**
   * Demo: Xác nhận thanh toán demo (chỉ dùng cho development)
   */
  async confirmDemoPayment(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { orderId, success: paymentSuccess } = req.body;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      // Tìm transaction
      const transaction = await prisma.fiatTransaction.findFirst({
        where: {
          id: orderId,
          userId,
          type: 'DEPOSIT',
          status: 'PENDING',
        },
      });

      if (!transaction) {
        throw new AppError('DEPOSIT_006', 'Không tìm thấy giao dịch hoặc giao dịch đã được xử lý', 404);
      }

      if (paymentSuccess) {
        // Cập nhật transaction thành công
        await prisma.$transaction([
          prisma.fiatTransaction.update({
            where: { id: orderId },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
              gatewayResponse: { demo: true, confirmedAt: new Date().toISOString() },
            },
          }),
          // Cộng tiền vào ví
          prisma.walletBalance.upsert({
            where: {
              userId_symbol: {
                userId,
                symbol: transaction.fiatCurrency,
              },
            },
            update: {
              available: { increment: transaction.fiatAmount },
            },
            create: {
              userId,
              symbol: transaction.fiatCurrency,
              available: transaction.fiatAmount,
              locked: new Decimal(0),
            },
          }),
          // Tạo notification
          prisma.notification.create({
            data: {
              userId,
              type: 'DEPOSIT_SUCCESS',
              title: 'Nạp tiền thành công',
              message: `Bạn đã nạp thành công ${Number(transaction.fiatAmount).toLocaleString()} ${transaction.fiatCurrency}`,
              data: { transactionId: orderId },
            },
          }),
        ]);

        logger.info(`[DEMO] Deposit confirmed: ${orderId}, amount: ${transaction.fiatAmount}`);

        return successResponse(res, {
          message: 'Nạp tiền thành công',
          transaction: {
            id: orderId,
            amount: Number(transaction.fiatAmount),
            status: 'COMPLETED',
          },
        });
      } else {
        // Cập nhật transaction thất bại
        await prisma.fiatTransaction.update({
          where: { id: orderId },
          data: {
            status: 'FAILED',
            gatewayResponse: { demo: true, failedAt: new Date().toISOString() },
          },
        });

        logger.info(`[DEMO] Deposit failed: ${orderId}`);

        return successResponse(res, {
          message: 'Thanh toán thất bại',
          transaction: {
            id: orderId,
            status: 'FAILED',
          },
        });
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Confirm demo payment error:', error);
      throw new AppError('GEN_004', 'Không thể xác nhận thanh toán', 500);
    }
  }

  /**
   * Kiểm tra trạng thái nạp tiền theo ID
   */
  async getDepositStatus(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        throw new AppError('AUTH_001', 'Unauthorized', 401);
      }

      const deposit = await prisma.fiatTransaction.findFirst({
        where: {
          id,
          userId, // Chỉ cho phép xem deposit của chính mình
          type: 'DEPOSIT',
        },
      });

      if (!deposit) {
        throw new AppError('DEPOSIT_005', 'Không tìm thấy giao dịch', 404);
      }

      // Lấy thêm thông tin wallet balance nếu đã hoàn thành
      let walletBalance = null;
      if (deposit.status === 'COMPLETED') {
        const wallet = await prisma.walletBalance.findUnique({
          where: {
            userId_symbol: {
              userId,
              symbol: deposit.fiatCurrency,
            },
          },
        });
        walletBalance = wallet ? Number(wallet.available) : 0;
      }

      return successResponse(res, {
        deposit: {
          id: deposit.id,
          amount: Number(deposit.fiatAmount),
          currency: deposit.fiatCurrency,
          method: deposit.method,
          status: deposit.status,
          transactionId: deposit.transactionId,
          gatewayResponse: deposit.gatewayResponse,
          createdAt: deposit.createdAt,
          updatedAt: deposit.updatedAt,
          completedAt: deposit.completedAt,
        },
        walletBalance,
        statusMessage: this.getDepositStatusMessage(deposit.status),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Get deposit status error:', error);
      throw new AppError('GEN_004', 'Không thể lấy trạng thái giao dịch', 500);
    }
  }

  /**
   * Helper: Lấy message mô tả trạng thái
   */
  private getDepositStatusMessage(status: string): string {
    const messages: Record<string, string> = {
      PENDING: 'Đang chờ thanh toán',
      PROCESSING: 'Đang xử lý',
      COMPLETED: 'Nạp tiền thành công',
      FAILED: 'Giao dịch thất bại',
      CANCELLED: 'Đã hủy',
      EXPIRED: 'Đã hết hạn',
    };
    return messages[status] || 'Không xác định';
  }

  /**
   * Lấy phương thức nạp tiền khả dụng (VN)
   */
  async getDepositMethods(_req: AuthRequest, res: Response) {
    try {
      const methods = [
        {
          id: 'VNPAY',
          name: 'VNPay',
          description: 'Thanh toán qua VNPay (ATM/Visa/Master/QR)',
          minAmount: 10000,
          maxAmount: 500000000,
          fee: 0,
          feeType: 'percent',
          processingTime: 'Tức thì',
          supported: true,
          icon: 'vnpay',
        },
        {
          id: 'MOMO',
          name: 'Ví MoMo',
          description: 'Thanh toán qua ví MoMo',
          minAmount: 10000,
          maxAmount: 50000000,
          fee: 0,
          feeType: 'percent',
          processingTime: 'Tức thì',
          supported: true,
          icon: 'momo',
        },
        {
          id: 'ZALOPAY',
          name: 'ZaloPay',
          description: 'Thanh toán qua ví ZaloPay',
          minAmount: 10000,
          maxAmount: 50000000,
          fee: 0,
          feeType: 'percent',
          processingTime: 'Tức thì',
          supported: false,
          icon: 'zalopay',
        },
        {
          id: 'BANK_TRANSFER',
          name: 'Chuyển khoản ngân hàng',
          description: 'Chuyển khoản trực tiếp vào tài khoản công ty',
          minAmount: 50000,
          maxAmount: 1000000000,
          fee: 0,
          feeType: 'fixed',
          processingTime: '5-15 phút',
          supported: true,
          icon: 'bank',
        },
      ];

      return successResponse(res, { methods });
    } catch (error) {
      logger.error('Get deposit methods error:', error);
      throw new AppError('GEN_004', 'Không thể lấy danh sách phương thức nạp tiền', 500);
    }
  }

  /**
   * Generic Payment Webhook Handler
   * Xử lý callback từ bất kỳ payment gateway nào
   */
  async paymentWebhook(req: AuthRequest, res: Response) {
    try {
      const body = req.body;
      const { orderId, transactionId, status, gateway } = body;

      // Verify signature dựa vào gateway
      let isValid = false;
      switch (gateway) {
        case 'vnpay':
          isValid = paymentService.verifyVNPayReturn(body).isValid;
          break;
        case 'momo':
          isValid = paymentService.verifyMoMoReturn(body).isValid;
          break;
        case 'stripe':
          // Stripe webhook signature verification
          isValid = this.verifyStripeSignature(req);
          break;
        default:
          // Với các gateway khác, kiểm tra signature từ header
          isValid = this.verifyGenericSignature(body, req.headers);
      }

      if (!isValid) {
        logger.warn(`Payment webhook invalid signature: ${gateway}`);
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid signature' 
        });
      }

      // Dùng Prisma transaction để đảm bảo data consistency
      const result = await prisma.$transaction(async (tx) => {
        // Tìm giao dịch
        const transaction = await tx.fiatTransaction.findFirst({
          where: { id: orderId },
        });

        if (!transaction) {
          throw new AppError('PAYMENT_002', 'Không tìm thấy giao dịch', 404);
        }

        // Skip nếu đã xử lý rồi
        if (transaction.status !== 'PENDING') {
          logger.info(`Transaction ${orderId} already processed: ${transaction.status}`);
          return { alreadyProcessed: true, transaction };
        }

        const newStatus = status === 'SUCCESS' ? 'COMPLETED' : 'FAILED';

        // Update deposit status
        const updatedTransaction = await tx.fiatTransaction.update({
          where: { id: orderId },
          data: {
            status: newStatus,
            transactionId: transactionId,
            gatewayResponse: body,
            completedAt: newStatus === 'COMPLETED' ? new Date() : null,
          },
        });

        // Nếu thành công, cộng tiền vào ví
        if (status === 'SUCCESS') {
          const depositAmount = Number(transaction.fiatAmount);
          const currency = transaction.fiatCurrency;

          // Cộng tiền vào ví
          await tx.walletBalance.upsert({
            where: {
              userId_symbol: {
                userId: transaction.userId,
                symbol: currency,
              },
            },
            update: {
              available: {
                increment: depositAmount,
              },
            },
            create: {
              userId: transaction.userId,
              symbol: currency,
              available: new Decimal(depositAmount),
              locked: new Decimal(0),
            },
          });

          // Ghi log transaction
          await tx.walletTransaction.create({
            data: {
              userId: transaction.userId,
              type: 'DEPOSIT',
              symbol: currency,
              amount: new Decimal(depositAmount),
              fee: new Decimal(0),
              status: 'COMPLETED',
            },
          });

          // Tạo notification cho user
          const notification = await tx.notification.create({
            data: {
              userId: transaction.userId,
              type: 'DEPOSIT',
              title: 'Nạp tiền thành công',
              message: `Bạn đã nạp thành công ${depositAmount.toLocaleString('vi-VN')} ${currency} vào ví.`,
              data: {
                transactionId: orderId,
                amount: depositAmount,
                currency,
              },
            },
          });

          // Gửi notification real-time qua WebSocket
          sendNotificationToUser(transaction.userId, notification);

          logger.info(`Payment webhook success: ${orderId}, credited ${depositAmount} ${currency}`);
        } else {
          // Tạo notification thất bại
          const notification = await tx.notification.create({
            data: {
              userId: transaction.userId,
              type: 'DEPOSIT',
              title: 'Nạp tiền thất bại',
              message: `Giao dịch nạp tiền ${Number(transaction.fiatAmount).toLocaleString('vi-VN')} ${transaction.fiatCurrency} đã thất bại.`,
              data: {
                transactionId: orderId,
                errorCode: body.errorCode || body.resultCode,
              },
            },
          });

          // Gửi notification real-time qua WebSocket
          sendNotificationToUser(transaction.userId, notification);

          logger.warn(`Payment webhook failed: ${orderId}, status: ${status}`);
        }

        return { alreadyProcessed: false, transaction: updatedTransaction };
      });

      return res.json({ 
        success: true,
        alreadyProcessed: result.alreadyProcessed,
        transactionId: result.transaction.id,
      });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode || 500).json({
          success: false,
          error: error.message,
        });
      }
      logger.error('Payment webhook error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Internal error' 
      });
    }
  }

  /**
   * Verify Stripe webhook signature
   */
  private verifyStripeSignature(req: AuthRequest): boolean {
    try {
      const sig = req.headers['stripe-signature'] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      
      if (!sig || !webhookSecret) {
        return false;
      }

      // Stripe SDK sẽ verify signature
      stripe.webhooks.constructEvent(
        JSON.stringify(req.body),
        sig,
        webhookSecret
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verify generic webhook signature (HMAC-SHA256)
   */
  private verifyGenericSignature(body: any, headers: any): boolean {
    try {
      const signature = headers['x-signature'] || headers['x-webhook-signature'];
      const secret = process.env.WEBHOOK_SECRET;

      if (!signature || !secret) {
        return false;
      }

      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(body))
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  /**
   * Admin: Xác nhận nạp tiền thủ công (Bank Transfer)
   */
  async confirmBankTransfer(req: AuthRequest, res: Response) {
    try {
      const { transactionId } = req.params;
      const adminId = req.user?.id;

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

      // Xử lý trong transaction
      const result = await prisma.$transaction(async (tx) => {
        const transaction = await tx.fiatTransaction.findFirst({
          where: { 
            id: transactionId,
            method: 'BANK_TRANSFER',
            status: 'PENDING',
          },
        });

        if (!transaction) {
          throw new AppError('PAYMENT_002', 'Không tìm thấy giao dịch pending', 404);
        }

        // Update status
        const updatedTx = await tx.fiatTransaction.update({
          where: { id: transactionId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            gatewayResponse: {
              confirmedBy: adminId,
              confirmedAt: new Date().toISOString(),
            },
          },
        });

        // Credit wallet
        const amount = Number(transaction.fiatAmount);
        const currency = transaction.fiatCurrency;

        await tx.walletBalance.upsert({
          where: {
            userId_symbol: {
              userId: transaction.userId,
              symbol: currency,
            },
          },
          update: {
            available: { increment: amount },
          },
          create: {
            userId: transaction.userId,
            symbol: currency,
            available: new Decimal(amount),
            locked: new Decimal(0),
          },
        });

        await tx.walletTransaction.create({
          data: {
            userId: transaction.userId,
            type: 'DEPOSIT',
            symbol: currency,
            amount: new Decimal(amount),
            fee: new Decimal(0),
            status: 'COMPLETED',
          },
        });

        // Notification
        const notification = await tx.notification.create({
          data: {
            userId: transaction.userId,
            type: 'DEPOSIT',
            title: 'Nạp tiền thành công',
            message: `Giao dịch chuyển khoản ${amount.toLocaleString('vi-VN')} ${currency} đã được xác nhận.`,
            data: { transactionId },
          },
        });

        // Gửi notification real-time qua WebSocket
        sendNotificationToUser(transaction.userId, notification);

        return updatedTx;
      });

      logger.info(`Bank transfer confirmed: ${transactionId} by admin ${adminId}`);

      return successResponse(res, {
        message: 'Xác nhận nạp tiền thành công',
        transaction: {
          id: result.id,
          amount: Number(result.fiatAmount),
          currency: result.fiatCurrency,
          status: result.status,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Confirm bank transfer error:', error);
      throw new AppError('GEN_004', 'Không thể xác nhận giao dịch', 500);
    }
  }

  /**
   * Helper: Cộng tiền vào ví user
   */
  private async creditWallet(userId: string, currency: string, amount: number): Promise<void> {
    try {
      // Tìm hoặc tạo wallet balance
      const wallet = await prisma.walletBalance.upsert({
        where: {
          userId_symbol: {
            userId,
            symbol: currency,
          },
        },
        update: {
          available: {
            increment: amount,
          },
        },
        create: {
          userId,
          symbol: currency,
          available: new Decimal(amount),
          locked: new Decimal(0),
        },
      });

      // Tạo wallet transaction record
      await prisma.walletTransaction.create({
        data: {
          userId,
          type: 'DEPOSIT',
          symbol: currency,
          amount: new Decimal(amount),
          fee: new Decimal(0),
          status: 'COMPLETED',
        },
      });

      logger.info(`Credited ${amount} ${currency} to user ${userId}, new balance: ${wallet.available}`);
    } catch (error) {
      logger.error('Credit wallet error:', error);
      throw error;
    }
  }
}
