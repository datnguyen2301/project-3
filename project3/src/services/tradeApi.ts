// Trade API Service - Buy/Sell crypto with VND
import { fetchWithAuth } from './apiHelper';
import { getAuthToken } from './authApi';

const API_BASE = '/api';

export interface TradeQuote {
  cryptoCurrency: string;
  side: 'buy' | 'sell';
  cryptoAmount: number;
  vndAmount: number;
  rate: number;
  fee: number;
  expiresAt: string;
}

export interface TradeResponse {
  success: boolean;
  data?: {
    trade?: {
      type?: 'BUY' | 'SELL';
      cryptoCurrency: string;
      cryptoAmount: number;
      vndAmount: number;
      price: number;
      executedAt?: string;
    };
    balances?: {
      VND: number;
      [key: string]: number;
    };
    // Fallback for direct access
    transactionId?: string;
    cryptoCurrency?: string;
    cryptoAmount?: number;
    vndAmount?: number;
    rate?: number;
    fee?: number;
    side?: 'buy' | 'sell';
    status?: string;
    createdAt?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface TradeHistory {
  id: string;
  cryptoCurrency: string;
  cryptoAmount: number;
  vndAmount: number;
  rate: number;
  fee: number;
  side: 'buy' | 'sell';
  status: string;
  createdAt: string;
}

// Get quote for buy/sell
export async function getTradeQuote(params: {
  cryptoCurrency: string;
  amount?: number;
  quoteAmount?: number;
  side?: 'buy' | 'sell';
}): Promise<{ success: boolean; data?: TradeQuote; error?: { code: string; message: string } }> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: { code: 'AUTH_REQUIRED', message: 'Vui lòng đăng nhập' },
    };
  }

  try {
    const queryParams = new URLSearchParams();
    queryParams.append('cryptoCurrency', params.cryptoCurrency);
    if (params.amount) queryParams.append('amount', params.amount.toString());
    if (params.quoteAmount) queryParams.append('quoteAmount', params.quoteAmount.toString());
    if (params.side) queryParams.append('side', params.side);

    const response = await fetchWithAuth(`${API_BASE}/trade/quote?${queryParams}`);
    return await response.json();
  } catch (error) {
    console.error('Error getting trade quote:', error);
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Không thể lấy báo giá' },
    };
  }
}

// Buy crypto with VND
export async function buyCryptoWithVnd(params: {
  cryptoCurrency: string;
  amount?: number;      // Số lượng crypto muốn mua
  quoteAmount?: number; // Số tiền VND muốn chi
}): Promise<TradeResponse> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: { code: 'AUTH_REQUIRED', message: 'Vui lòng đăng nhập để mua crypto' },
    };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/trade/buy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    return await response.json();
  } catch (error) {
    console.error('Error buying crypto:', error);
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Không thể thực hiện giao dịch mua' },
    };
  }
}

// Sell crypto for VND
export async function sellCryptoForVnd(params: {
  cryptoCurrency: string;
  amount: number; // Số lượng crypto muốn bán
}): Promise<TradeResponse> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: { code: 'AUTH_REQUIRED', message: 'Vui lòng đăng nhập để bán crypto' },
    };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/trade/sell`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    return await response.json();
  } catch (error) {
    console.error('Error selling crypto:', error);
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Không thể thực hiện giao dịch bán' },
    };
  }
}

// Get trade history
export async function getTradeHistory(params?: {
  page?: number;
  limit?: number;
  symbol?: string;
}): Promise<TradeHistory[]> {
  const token = getAuthToken();
  if (!token) return [];

  try {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.symbol) queryParams.append('symbol', params.symbol);

    const response = await fetchWithAuth(`${API_BASE}/trade/history?${queryParams}`);
    const data = await response.json();
    
    if (data.success && Array.isArray(data.data)) {
      return data.data;
    }
    if (data.success && data.data?.trades && Array.isArray(data.data.trades)) {
      return data.data.trades;
    }
    return [];
  } catch (error) {
    console.error('Error fetching trade history:', error);
    return [];
  }
}
