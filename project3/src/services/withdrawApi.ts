// Withdrawal API Service
import { getAuthToken } from './authApi';
import { fetchWithAuth } from './apiHelper';

// API endpoints based on backend routes
const WITHDRAWALS_API = '/api/withdrawals';
const BANK_ACCOUNTS_API = '/api/bank-accounts';

export interface BankAccount {
  id: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
  createdAt: string;
}

export interface WithdrawalRequest {
  amount: number;
  bankAccountId: string;
}

export interface WithdrawalResponse {
  success: boolean;
  data?: {
    transaction: {
      id: string;
      amount: number;
      fee: number;
      netAmount: number;
      status: string;
      estimatedTime: string;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface WithdrawalHistory {
  id: string;
  amount: number;
  fee: number;
  netAmount: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  bankAccount: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  createdAt: string;
  processedAt?: string;
  rejectedReason?: string;
}

// Format VND currency
export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount);
}

// Get user's bank accounts
export async function getBankAccounts(): Promise<BankAccount[]> {
  const token = getAuthToken();
  if (!token) {
    console.log('[WithdrawAPI] No token, returning empty bank accounts');
    return [];
  }

  try {
    console.log('[WithdrawAPI] Fetching bank accounts from:', BANK_ACCOUNTS_API);
    const response = await fetchWithAuth(BANK_ACCOUNTS_API);
    const result = await response.json();
    
    console.log('[WithdrawAPI] Bank accounts response:', result);
    
    // Handle different response formats from backend
    if (result.success && Array.isArray(result.data)) {
      return result.data;
    }
    if (result.success && result.data?.accounts) {
      return result.data.accounts;
    }
    if (result.success && result.data?.bankAccounts) {
      return result.data.bankAccounts;
    }
    // Backend có thể trả về trực tiếp array
    if (Array.isArray(result)) {
      return result;
    }
    
    console.log('[WithdrawAPI] Unknown response format, returning empty');
    return [];
  } catch (error) {
    console.error('[WithdrawAPI] Error fetching bank accounts:', error);
    return [];
  }
}

// Add new bank account
export async function addBankAccount(data: {
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  isDefault?: boolean;
}): Promise<{ success: boolean; data?: BankAccount; error?: { message: string } }> {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: { message: 'Vui lòng đăng nhập' } };
  }

  try {
    console.log('[WithdrawAPI] Adding bank account:', data);
    const response = await fetchWithAuth(BANK_ACCOUNTS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    console.log('[WithdrawAPI] Add bank response:', result);
    return result;
  } catch (error) {
    console.error('Error adding bank account:', error);
    return { success: false, error: { message: 'Không thể thêm tài khoản ngân hàng' } };
  }
}

// Delete bank account
export async function deleteBankAccount(accountId: string): Promise<{ success: boolean; error?: { message: string } }> {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: { message: 'Vui lòng đăng nhập' } };
  }

  try {
    const response = await fetchWithAuth(`${BANK_ACCOUNTS_API}/${accountId}`, {
      method: 'DELETE',
    });

    return await response.json();
  } catch (error) {
    console.error('Error deleting bank account:', error);
    return { success: false, error: { message: 'Không thể xóa tài khoản ngân hàng' } };
  }
}

// Request withdrawal
export async function requestWithdrawal(data: WithdrawalRequest): Promise<WithdrawalResponse> {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: { code: 'AUTH_REQUIRED', message: 'Vui lòng đăng nhập' } };
  }

  try {
    console.log('[WithdrawAPI] Requesting withdrawal:', data);
    const response = await fetchWithAuth(WITHDRAWALS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    console.log('[WithdrawAPI] Withdrawal response:', result);
    return result;
  } catch (error) {
    console.error('Error requesting withdrawal:', error);
    return { success: false, error: { code: 'NETWORK_ERROR', message: 'Không thể gửi yêu cầu rút tiền' } };
  }
}

// Get withdrawal history
export async function getWithdrawalHistory(limit: number = 20): Promise<WithdrawalHistory[]> {
  const token = getAuthToken();
  if (!token) return [];

  try {
    const response = await fetchWithAuth(`${WITHDRAWALS_API}?limit=${limit}`);
    const result = await response.json();
    
    // Handle different response formats
    if (result.success && Array.isArray(result.data)) {
      return result.data;
    }
    if (result.success && result.data?.withdrawals) {
      return result.data.withdrawals;
    }
    return [];
  } catch (error) {
    console.error('Error fetching withdrawal history:', error);
    return [];
  }
}

// Cancel pending withdrawal
export async function cancelWithdrawal(withdrawalId: string): Promise<{ success: boolean; error?: { message: string } }> {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: { message: 'Vui lòng đăng nhập' } };
  }

  try {
    const response = await fetchWithAuth(`${WITHDRAWALS_API}/${withdrawalId}`, {
      method: 'DELETE',
    });

    return await response.json();
  } catch (error) {
    console.error('Error canceling withdrawal:', error);
    return { success: false, error: { message: 'Không thể hủy yêu cầu rút tiền' } };
  }
}

// Get withdrawal limits and fees
export async function getWithdrawalInfo(): Promise<{
  minAmount: number;
  maxAmount: number;
  dailyLimit: number;
  fee: number;
  feeType: 'fixed' | 'percentage';
  processingTime: string;
} | null> {
  // Return default values since backend doesn't have a dedicated info endpoint
  return {
    minAmount: 50000,
    maxAmount: 500000000,
    dailyLimit: 1000000000,
    fee: 0,
    feeType: 'fixed',
    processingTime: '1-24 giờ làm việc'
  };
}

// Vietnam banks list
export const VIETNAM_BANKS = [
  { code: 'VCB', name: 'Vietcombank' },
  { code: 'TCB', name: 'Techcombank' },
  { code: 'MB', name: 'MB Bank' },
  { code: 'VPB', name: 'VPBank' },
  { code: 'ACB', name: 'ACB' },
  { code: 'TPB', name: 'TPBank' },
  { code: 'STB', name: 'Sacombank' },
  { code: 'HDB', name: 'HDBank' },
  { code: 'VIB', name: 'VIB' },
  { code: 'SHB', name: 'SHB' },
  { code: 'EIB', name: 'Eximbank' },
  { code: 'MSB', name: 'MSB' },
  { code: 'OCB', name: 'OCB' },
  { code: 'LPB', name: 'LienVietPostBank' },
  { code: 'BIDV', name: 'BIDV' },
  { code: 'CTG', name: 'Vietinbank' },
  { code: 'AGR', name: 'Agribank' },
];
