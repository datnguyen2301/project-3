// Margin Trading API Service
import { fetchWithAuth } from './apiHelper';
import { getAuthToken } from './authApi';

const API_BASE = '/api/margin';

export interface MarginAccount {
  totalCollateral: number;
  borrowed: number;
  available: number;
  marginLevel: number;
  maxLeverage: number;
}

export interface MarginLoan {
  id: string;
  type: 'MARGIN_BORROW' | 'MARGIN_REPAY';
  symbol: string;
  amount: number;
  status: string;
  createdAt: string;
}

export interface MarginOrder {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: number;
  price?: number;
  leverage: number;
  status: string;
  createdAt: string;
}

// Get margin account info
export async function getMarginAccount(): Promise<{
  success: boolean;
  data?: MarginAccount;
  error?: { code: string; message: string };
}> {
  const token = getAuthToken();
  
  if (!token) {
    return {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Vui lòng đăng nhập để xem tài khoản margin',
      },
    };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/account`);
    const result = await response.json();

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    }

    return {
      success: false,
      error: result.error || { code: 'UNKNOWN', message: 'Lỗi không xác định' },
    };
  } catch (error) {
    console.error('[MarginAPI] Error getting margin account:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Không thể kết nối đến server',
      },
    };
  }
}

// Borrow assets
export async function borrowAsset(asset: string, amount: number): Promise<{
  success: boolean;
  data?: { message: string; amount: number; asset: string };
  error?: { code: string; message: string };
}> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Vui lòng đăng nhập',
      },
    };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/borrow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ asset, amount }),
    });
    const result = await response.json();

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    }

    return {
      success: false,
      error: result.error || { code: 'UNKNOWN', message: 'Không thể vay tài sản' },
    };
  } catch (error) {
    console.error('[MarginAPI] Error borrowing asset:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Không thể kết nối đến server',
      },
    };
  }
}

// Repay loan
export async function repayLoan(asset: string, amount: number): Promise<{
  success: boolean;
  data?: { message: string; amount: number; asset: string };
  error?: { code: string; message: string };
}> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Vui lòng đăng nhập',
      },
    };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/repay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ asset, amount }),
    });
    const result = await response.json();

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    }

    return {
      success: false,
      error: result.error || { code: 'UNKNOWN', message: 'Không thể trả nợ' },
    };
  } catch (error) {
    console.error('[MarginAPI] Error repaying loan:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Không thể kết nối đến server',
      },
    };
  }
}

// Get loan history
export async function getLoanHistory(): Promise<{
  success: boolean;
  data?: { loans: MarginLoan[] };
  error?: { code: string; message: string };
}> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Vui lòng đăng nhập',
      },
    };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/loans`);
    const result = await response.json();

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    }

    return {
      success: false,
      error: result.error || { code: 'UNKNOWN', message: 'Lỗi không xác định' },
    };
  } catch (error) {
    console.error('[MarginAPI] Error getting loan history:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Không thể kết nối đến server',
      },
    };
  }
}

// Create margin order
export async function createMarginOrder(order: {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: number;
  price?: number;
  leverage?: number;
}): Promise<{
  success: boolean;
  data?: { order: MarginOrder };
  error?: { code: string; message: string };
}> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Vui lòng đăng nhập',
      },
    };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(order),
    });
    const result = await response.json();

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    }

    return {
      success: false,
      error: result.error || { code: 'UNKNOWN', message: 'Không thể tạo lệnh margin' },
    };
  } catch (error) {
    console.error('[MarginAPI] Error creating margin order:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Không thể kết nối đến server',
      },
    };
  }
}

// Get margin level
export async function getMarginLevel(): Promise<{
  success: boolean;
  data?: { marginLevel: number; riskLevel: 'safe' | 'warning' | 'danger' };
  error?: { code: string; message: string };
}> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Vui lòng đăng nhập',
      },
    };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/level`);
    const result = await response.json();

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    }

    return {
      success: false,
      error: result.error || { code: 'UNKNOWN', message: 'Lỗi không xác định' },
    };
  } catch (error) {
    console.error('[MarginAPI] Error getting margin level:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Không thể kết nối đến server',
      },
    };
  }
}
