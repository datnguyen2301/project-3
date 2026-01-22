// Wallet API Service
import { fetchWithAuth } from './apiHelper';
import { getAuthToken } from './authApi';

// Use Next.js proxy to avoid CORS issues
const API_BASE = '/api';

export interface Balance {
  asset: string;
  free: number;
  locked: number;
  total: number;
}

export interface ConvertResponse {
  success: boolean;
  data?: {
    fromAmount: number;
    fromCurrency: string;
    toAmount: number;
    toCurrency: string;
    rate: number;
    transactionId: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  asset: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  txHash?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DepositAddress {
  asset: string;
  address: string;
  tag?: string;
  network: string;
}

// Get all balances
export async function getBalances(): Promise<Balance[]> {
  const token = getAuthToken();
  
  if (!token || token === 'undefined' || token === 'null') {
    // Not authenticated - return empty array silently
    return [];
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/wallet/balances`);
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    
    // Lấy array balances từ response - thử nhiều format khác nhau
    let balancesArray: unknown[] = [];
    
    // Format 1: { success: true, data: [...balances] }
    if (data.success && Array.isArray(data.data)) {
      balancesArray = data.data;
    } 
    // Format 2: { success: true, data: { balances: [...] } }
    else if (data.success && data.data?.balances && Array.isArray(data.data.balances)) {
      balancesArray = data.data.balances;
    }
    // Format 3: { balances: [...] } (không có success wrapper)
    else if (data.balances && Array.isArray(data.balances)) {
      balancesArray = data.balances;
    }
    // Format 4: data là array trực tiếp
    else if (Array.isArray(data)) {
      balancesArray = data;
    }
    
    // Normalize mỗi balance object để đảm bảo có đủ fields
    // Backend trả về: symbol, available, locked, total
    // Frontend cần: asset, free, locked, total
    return balancesArray.map((b: unknown) => {
      const balance = b as Record<string, unknown>;
      const asset = String(balance.symbol || balance.asset || '');
      // Đảm bảo số dương (không cho phép số âm)
      const free = Math.max(0, Number(balance.available ?? balance.free ?? 0));
      const locked = Math.max(0, Number(balance.locked ?? 0));
      const total = Math.max(0, Number(balance.total ?? (free + locked)));
      
      console.log('[Wallet] Balance:', { asset, free, locked, total, raw: balance });
      
      return {
        asset,
        free,
        locked,
        total,
      };
    });
  } catch (error) {
    console.error('Error fetching balances:', error);
    return [];
  }
}

// Get balance for specific asset
export async function getBalance(asset: string): Promise<Balance | null> {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const response = await fetchWithAuth(`${API_BASE}/wallet/balance/${asset}`);
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Error fetching balance:', error);
    return null;
  }
}

// Get deposit address
export async function getDepositAddress(asset: string, network?: string): Promise<DepositAddress | null> {
  const token = getAuthToken();
  if (!token) return null;

  try {
    // Backend dùng path parameter: /api/wallet/deposit-address/:symbol
    let url = `${API_BASE}/wallet/deposit-address/${asset}`;
    if (network) {
      url += `?network=${encodeURIComponent(network)}`;
    }
    
    console.log('[Wallet] Getting deposit address:', url);
    const response = await fetchWithAuth(url);
    const data = await response.json();
    console.log('[Wallet] Deposit address response:', data);
    
    if (!data.success) {
      console.error('Error getting deposit address:', data.error || data);
      return null;
    }
    
    return data.data;
  } catch (error) {
    console.error('Error fetching deposit address:', error);
    return null;
  }
}

// Request withdrawal
export async function requestWithdrawal(
  asset: string,
  amount: number,
  address: string,
  network: string = 'BTC',
  tag?: string
): Promise<{ success: boolean; data?: Transaction; error?: { code: string; message: string } }> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required' },
    };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/wallet/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ asset, amount, address, network, tag }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error requesting withdrawal:', error);
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Unable to process withdrawal' },
    };
  }
}

// Get transaction history
export async function getTransactionHistory(params?: {
  type?: 'DEPOSIT' | 'WITHDRAWAL';
  asset?: string;
  limit?: number;
  offset?: number;
}): Promise<Transaction[]> {
  const token = getAuthToken();
  if (!token) return [];

  try {
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.append('type', params.type);
    if (params?.asset) queryParams.append('asset', params.asset);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const response = await fetchWithAuth(`${API_BASE}/wallet/transactions?${queryParams}`);
    const data = await response.json();
    console.log('[Wallet] getTransactionHistory response:', data);
    
    // Đảm bảo trả về array
    if (data.success && Array.isArray(data.data)) {
      return data.data;
    }
    // Nếu data.data là object với transactions array
    if (data.success && data.data?.transactions && Array.isArray(data.data.transactions)) {
      return data.data.transactions;
    }
    return [];
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
}

// Get transaction by ID
export async function getTransaction(transactionId: string): Promise<Transaction | null> {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const response = await fetchWithAuth(`${API_BASE}/wallet/transactions/${transactionId}`);
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return null;
  }
}

// Cancel pending withdrawal
export async function cancelWithdrawal(transactionId: string): Promise<{ success: boolean; message?: string }> {
  const token = getAuthToken();

  if (!token) {
    return { success: false, message: 'Authentication required' };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/wallet/transactions/${transactionId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error canceling withdrawal:', error);
    return { success: false, message: 'Unable to cancel withdrawal' };
  }
}

// Convert currency (e.g., VND to BTC)
export async function convertCurrency(params: {
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
}): Promise<ConvertResponse> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: { code: 'AUTH_REQUIRED', message: 'Vui lòng đăng nhập để thực hiện giao dịch' },
    };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/wallet/convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error converting currency:', error);
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Không thể thực hiện giao dịch' },
    };
  }
}
