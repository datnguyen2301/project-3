// Deposit API Service
import { getAuthToken } from './authApi';
import { fetchWithAuth } from './apiHelper';

const API_BASE = '/api/fiat';

export interface DepositMethod {
  id: string;
  name: string;
  code: 'VNPAY' | 'MOMO' | 'STRIPE' | 'BANK_TRANSFER';
  icon: string;
  minAmount: number;
  maxAmount: number;
  fee: number; // Percentage
  processingTime: string;
  currency: string;
  enabled?: boolean;
  supported?: boolean; // Backend sử dụng field này
}

export interface DepositTransaction {
  id: string;
  amount: number;
  currency: string;
  method: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  createdAt: string;
  completedAt?: string;
  reference?: string;
}

export interface CreateDepositResponse {
  success: boolean;
  data?: {
    transactionId: string;
    paymentUrl?: string;
    qrCode?: string;
    bankInfo?: {
      bankName: string;
      accountName: string;
      accountNumber: string;
      reference: string;
    };
    expiresAt?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

// Get available deposit methods
export async function getDepositMethods(): Promise<DepositMethod[]> {
  const defaultMethods: DepositMethod[] = [
    {
      id: 'vnpay',
      name: 'VNPay',
      code: 'VNPAY',
      icon: '🏦',
      minAmount: 10000,
      maxAmount: 100000000,
      fee: 0,
      processingTime: 'Tức thì',
      currency: 'VND',
      enabled: true,
    },
    {
      id: 'momo',
      name: 'MoMo',
      code: 'MOMO',
      icon: '📱',
      minAmount: 10000,
      maxAmount: 50000000,
      fee: 0,
      processingTime: 'Tức thì',
      currency: 'VND',
      enabled: true,
    },
    {
      id: 'stripe',
      name: 'Thẻ quốc tế (Visa/Mastercard)',
      code: 'STRIPE',
      icon: '💳',
      minAmount: 100000,
      maxAmount: 200000000,
      fee: 2.9,
      processingTime: 'Tức thì',
      currency: 'VND',
      enabled: true,
    },
    {
      id: 'bank_transfer',
      name: 'Chuyển khoản ngân hàng',
      code: 'BANK_TRANSFER',
      icon: '🏛️',
      minAmount: 100000,
      maxAmount: 500000000,
      fee: 0,
      processingTime: '1-24 giờ',
      currency: 'VND',
      enabled: true,
    },
  ];

  try {
    // Backend endpoint: GET /api/fiat/deposit-methods
    const response = await fetch(`${API_BASE}/deposit-methods`);
    const result = await response.json();
    
    console.log('[DepositAPI] Methods response:', result);
    
    // Backend trả về { success: true, data: { methods: [...] } }
    if (result.success && result.data?.methods && result.data.methods.length > 0) {
      // Map backend fields to frontend format
      return result.data.methods.map((m: Record<string, unknown>) => ({
        ...m,
        code: m.id || m.code, // Backend dùng 'id', frontend cần 'code'
        enabled: m.supported !== false, // Backend dùng 'supported'
      }));
    }
    
    // Return default methods if API not available or empty
    console.log('[DepositAPI] Using default methods');
    return defaultMethods;
  } catch (error) {
    console.error('[DepositAPI] Error fetching deposit methods:', error);
    // Return default methods on error
    return defaultMethods;
  }
}

// Create a new deposit
export async function createDeposit(data: {
  amount: number;
  paymentMethod: string;
  currency?: string;
}): Promise<CreateDepositResponse> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Vui lòng đăng nhập để nạp tiền',
      },
    };
  }

  try {
    console.log('[DepositAPI] Creating deposit:', data);
    // Backend endpoint: POST /api/fiat/deposit
    // Backend expects: { amount, paymentMethod: 'VNPAY' | 'MOMO' }
    const response = await fetchWithAuth(`${API_BASE}/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: data.amount,
        paymentMethod: (data.paymentMethod || 'BANK_TRANSFER').toUpperCase(), // Backend cần viết hoa
        currency: data.currency || 'VND',
      }),
    });

    const result = await response.json();
    console.log('[DepositAPI] Create deposit response:', result);
    return result;
  } catch (error) {
    console.error('Error creating deposit:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Không thể xử lý yêu cầu nạp tiền',
      },
    };
  }
}

// Get deposit history
export async function getDepositHistory(): Promise<DepositTransaction[]> {
  const token = getAuthToken();

  if (!token) return [];

  try {
    // Backend endpoint: GET /api/fiat/deposit/history
    const response = await fetchWithAuth(`${API_BASE}/deposit/history`);
    const result = await response.json();
    
    console.log('[DepositAPI] History response:', result);
    
    // Handle different response formats
    if (result.success && Array.isArray(result.data)) {
      return result.data;
    }
    if (result.success && result.data?.transactions) {
      return result.data.transactions;
    }
    if (result.success && result.data?.deposits) {
      return result.data.deposits;
    }
    return [];
  } catch (error) {
    console.error('[DepositAPI] Error fetching deposit history:', error);
    return [];
  }
}

// Get deposit status
export async function getDepositStatus(transactionId: string): Promise<DepositTransaction | null> {
  const token = getAuthToken();

  if (!token) return null;

  try {
    const response = await fetchWithAuth(`${API_BASE}/${transactionId}`);
    const result = await response.json();
    return result.success && result.data ? result.data : null;
  } catch (error) {
    console.error('Error fetching deposit status:', error);
    return null;
  }
}

// Format currency
export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}
