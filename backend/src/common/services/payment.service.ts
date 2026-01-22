import crypto from 'crypto';
import querystring from 'qs';
import logger from '../../config/logger';
import config from '../../config';

// Payment Gateway Configuration
interface PaymentConfig {
  vnpay: {
    tmnCode: string;
    hashSecret: string;
    url: string;
    returnUrl: string;
  };
  momo: {
    partnerCode: string;
    accessKey: string;
    secretKey: string;
    endpoint: string;
    returnUrl: string;
    ipnUrl: string;
  };
}

const paymentConfig: PaymentConfig = {
  vnpay: {
    tmnCode: process.env.VNPAY_TMN_CODE || 'DEMO',
    hashSecret: process.env.VNPAY_HASH_SECRET || 'DEMO_SECRET',
    url: process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    returnUrl: `${config.frontendUrl}/payment/vnpay/return`,
  },
  momo: {
    partnerCode: process.env.MOMO_PARTNER_CODE || 'DEMO',
    accessKey: process.env.MOMO_ACCESS_KEY || 'DEMO_ACCESS',
    secretKey: process.env.MOMO_SECRET_KEY || 'DEMO_SECRET',
    endpoint: process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create',
    returnUrl: `${config.frontendUrl}/payment/momo/return`,
    ipnUrl: `${config.apiUrl}/api/webhooks/momo`,
  },
};

export interface CreatePaymentParams {
  orderId: string;
  amount: number;
  orderInfo: string;
  ipAddress?: string;
  locale?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentUrl?: string;
  transactionId?: string;
  error?: string;
}

export interface VNPayReturnParams {
  vnp_Amount: string;
  vnp_BankCode: string;
  vnp_BankTranNo?: string;
  vnp_CardType?: string;
  vnp_OrderInfo: string;
  vnp_PayDate: string;
  vnp_ResponseCode: string;
  vnp_TmnCode: string;
  vnp_TransactionNo: string;
  vnp_TransactionStatus: string;
  vnp_TxnRef: string;
  vnp_SecureHash: string;
}

export interface MoMoReturnParams {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: number;
  orderInfo: string;
  orderType: string;
  transId: number;
  resultCode: number;
  message: string;
  payType: string;
  responseTime: number;
  extraData: string;
  signature: string;
}

class PaymentService {
  /**
   * Tạo URL thanh toán VNPay
   */
  async createVNPayUrl(params: CreatePaymentParams): Promise<PaymentResult> {
    try {
      const { orderId, amount, orderInfo, ipAddress = '127.0.0.1', locale = 'vn' } = params;

      const date = new Date();
      const createDate = this.formatDate(date);
      const expireDate = this.formatDate(new Date(date.getTime() + 15 * 60 * 1000)); // 15 phút

      // VNPay yêu cầu vnp_TxnRef tối đa 100 ký tự, chỉ chứa số và chữ
      // Tạo txnRef ngắn gọn từ timestamp + random
      const txnRef = `${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Loại bỏ dấu tiếng Việt và ký tự đặc biệt trong orderInfo
      const safeOrderInfo = this.removeVietnameseTones(orderInfo).substring(0, 255);

      const vnpParams: Record<string, string | number> = {
        vnp_Version: '2.1.0',
        vnp_Command: 'pay',
        vnp_TmnCode: paymentConfig.vnpay.tmnCode,
        vnp_Locale: locale,
        vnp_CurrCode: 'VND',
        vnp_TxnRef: txnRef,
        vnp_OrderInfo: safeOrderInfo,
        vnp_OrderType: 'other',
        vnp_Amount: amount * 100, // VNPay yêu cầu nhân 100
        vnp_ReturnUrl: paymentConfig.vnpay.returnUrl,
        vnp_IpAddr: ipAddress,
        vnp_CreateDate: createDate,
        vnp_ExpireDate: expireDate,
      };

      // Log để debug
      logger.info(`VNPay params: TmnCode=${paymentConfig.vnpay.tmnCode}, TxnRef=${txnRef}, Amount=${amount * 100}`);

      // Sắp xếp params theo alphabet
      const sortedParams = this.sortObject(vnpParams);

      // Tạo query string
      const signData = querystring.stringify(sortedParams, { encode: false });

      // Tạo secure hash
      const hmac = crypto.createHmac('sha512', paymentConfig.vnpay.hashSecret);
      const secureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

      // Thêm secure hash vào params
      const paymentUrl = `${paymentConfig.vnpay.url}?${signData}&vnp_SecureHash=${secureHash}`;

      logger.info(`VNPay payment URL created for order: ${orderId}`);

      return {
        success: true,
        paymentUrl,
        transactionId: orderId,
      };
    } catch (error) {
      logger.error('Create VNPay URL error:', error);
      return {
        success: false,
        error: 'Failed to create VNPay payment URL',
      };
    }
  }

  /**
   * Xác thực callback từ VNPay
   */
  verifyVNPayReturn(params: VNPayReturnParams): { isValid: boolean; isSuccess: boolean } {
    try {
      const secureHash = params.vnp_SecureHash;

      // Loại bỏ các trường hash để verify
      const verifyParams = { ...params } as Record<string, any>;
      delete verifyParams.vnp_SecureHash;
      delete verifyParams.vnp_SecureHashType;

      // Sắp xếp params
      const sortedParams = this.sortObject(verifyParams);
      const signData = querystring.stringify(sortedParams, { encode: false });

      // Tạo hash để verify
      const hmac = crypto.createHmac('sha512', paymentConfig.vnpay.hashSecret);
      const checkHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

      const isValid = secureHash === checkHash;
      const isSuccess = params.vnp_ResponseCode === '00' && params.vnp_TransactionStatus === '00';

      return { isValid, isSuccess };
    } catch (error) {
      logger.error('Verify VNPay return error:', error);
      return { isValid: false, isSuccess: false };
    }
  }

  /**
   * Tạo URL thanh toán MoMo
   */
  async createMoMoUrl(params: CreatePaymentParams): Promise<PaymentResult> {
    try {
      const { orderId, amount, orderInfo } = params;

      const requestId = `${orderId}_${Date.now()}`;

      const rawSignature = [
        `accessKey=${paymentConfig.momo.accessKey}`,
        `amount=${amount}`,
        `extraData=`,
        `ipnUrl=${paymentConfig.momo.ipnUrl}`,
        `orderId=${orderId}`,
        `orderInfo=${orderInfo}`,
        `partnerCode=${paymentConfig.momo.partnerCode}`,
        `redirectUrl=${paymentConfig.momo.returnUrl}`,
        `requestId=${requestId}`,
        `requestType=payWithMethod`,
      ].join('&');

      const signature = crypto
        .createHmac('sha256', paymentConfig.momo.secretKey)
        .update(rawSignature)
        .digest('hex');

      const requestBody = {
        partnerCode: paymentConfig.momo.partnerCode,
        partnerName: 'Crypto Exchange',
        storeId: 'CryptoExchangeStore',
        requestId,
        amount,
        orderId,
        orderInfo,
        redirectUrl: paymentConfig.momo.returnUrl,
        ipnUrl: paymentConfig.momo.ipnUrl,
        lang: 'vi',
        requestType: 'payWithMethod',
        autoCapture: true,
        extraData: '',
        signature,
      };

      // Gọi API MoMo
      const response = await fetch(paymentConfig.momo.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json() as { resultCode: number; payUrl?: string; message?: string };

      if (result.resultCode === 0) {
        logger.info(`MoMo payment URL created for order: ${orderId}`);
        return {
          success: true,
          paymentUrl: result.payUrl,
          transactionId: orderId,
        };
      } else {
        logger.error(`MoMo create payment failed: ${result.message}`);
        return {
          success: false,
          error: result.message || 'MoMo payment creation failed',
        };
      }
    } catch (error) {
      logger.error('Create MoMo URL error:', error);
      return {
        success: false,
        error: 'Failed to create MoMo payment URL',
      };
    }
  }

  /**
   * Xác thực callback từ MoMo
   */
  verifyMoMoReturn(params: MoMoReturnParams): { isValid: boolean; isSuccess: boolean } {
    try {
      const rawSignature = [
        `accessKey=${paymentConfig.momo.accessKey}`,
        `amount=${params.amount}`,
        `extraData=${params.extraData}`,
        `message=${params.message}`,
        `orderId=${params.orderId}`,
        `orderInfo=${params.orderInfo}`,
        `orderType=${params.orderType}`,
        `partnerCode=${params.partnerCode}`,
        `payType=${params.payType}`,
        `requestId=${params.requestId}`,
        `responseTime=${params.responseTime}`,
        `resultCode=${params.resultCode}`,
        `transId=${params.transId}`,
      ].join('&');

      const checkSignature = crypto
        .createHmac('sha256', paymentConfig.momo.secretKey)
        .update(rawSignature)
        .digest('hex');

      const isValid = params.signature === checkSignature;
      const isSuccess = params.resultCode === 0;

      return { isValid, isSuccess };
    } catch (error) {
      logger.error('Verify MoMo return error:', error);
      return { isValid: false, isSuccess: false };
    }
  }

  /**
   * Tạo URL thanh toán ZaloPay
   */
  async createZaloPayUrl(_params: CreatePaymentParams): Promise<PaymentResult> {
    // TODO: Implement ZaloPay integration
    logger.warn('ZaloPay integration not implemented yet');
    return {
      success: false,
      error: 'ZaloPay payment is not available yet',
    };
  }

  // Helper: Format date cho VNPay (yyyyMMddHHmmss)
  private formatDate(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return (
      date.getFullYear().toString() +
      pad(date.getMonth() + 1) +
      pad(date.getDate()) +
      pad(date.getHours()) +
      pad(date.getMinutes()) +
      pad(date.getSeconds())
    );
  }

  // Helper: Sắp xếp object theo key
  private sortObject(obj: Record<string, any>): Record<string, any> {
    const sorted: Record<string, any> = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      sorted[key] = obj[key];
    }
    return sorted;
  }

  // Helper: Loại bỏ dấu tiếng Việt
  private removeVietnameseTones(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9\s#]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export const paymentService = new PaymentService();
export default paymentService;
