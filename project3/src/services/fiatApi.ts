// Fiat/Buy Crypto API Service
import { getAuthToken } from './authApi';
import { fetchWithAuth } from './apiHelper';

const API_BASE = '/api';

export interface PaymentMethod {
  id: string;
  name: string;
  type: 'card' | 'bank' | 'crypto' | string;
  provider: string;
  minAmount: number;
  maxAmount: number;
  fee: number;
  processingTime: string;
}

export interface FiatTransaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  fiatAmount: number;
  cryptoAmount: number;
  cryptoSymbol: string;
  method: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  createdAt: string;
}

export interface BuyResponse {
  success: boolean;
  data?: {
    transaction: {
      id: string;
      clientSecret?: string;
      fiatAmount: number;
      cryptoAmount: number;
      feeAmount: number;
      totalAmount: number;
    };
    bankInfo?: {
      bankName: string;
      accountName: string;
      accountNumber: string;
      swiftCode: string;
      reference: string;
    };
    instructions?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

// Get payment methods
export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  try {
    const response = await fetch(`${API_BASE}/fiat/methods`);
    const result = await response.json();
    
    return result.success && result.data?.methods ? result.data.methods : [];
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    return [];
  }
}

// Initiate buy crypto
export async function buyCrypto(data: {
  method: string;
  fiatAmount: number;
  fiatCurrency: string;
  cryptoSymbol: string;
}): Promise<BuyResponse> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Please login to buy crypto',
      },
    };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/fiat/buy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    return await response.json();
  } catch (error) {
    console.error('Error buying crypto:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Unable to process purchase',
      },
    };
  }
}

// Get fiat transactions
export async function getFiatTransactions(): Promise<FiatTransaction[]> {
  const token = getAuthToken();

  if (!token) return [];

  try {
    const response = await fetchWithAuth(`${API_BASE}/fiat/transactions`);

    const result = await response.json();
    return result.success && result.data?.transactions ? result.data.transactions : [];
  } catch (error) {
    console.error('Error fetching fiat transactions:', error);
    return [];
  }
}

// Aliases for component compatibility
export const initiateBuy = buyCrypto;
export const getTransactions = getFiatTransactions;
