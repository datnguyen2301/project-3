// Two-Factor Authentication API Service
import { fetchWithAuth } from './apiHelper';
import { getAuthToken } from './authApi';

const API_BASE = '/api';

// Clean interface for component usage
export interface TwoFASetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

// Alias for backward compatibility
export type TwoFactorSetupResponse = TwoFASetupResponse;

export interface TwoFactorVerifyResponse {
  success: boolean;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface TwoFAStatus {
  enabled: boolean;
  backupCodesRemaining?: number;
}

// Get 2FA status
export async function get2FAStatus(): Promise<TwoFAStatus> {
  const token = getAuthToken();

  if (!token) {
    return { enabled: false };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/auth/2fa/status`);
    const result = await response.json();

    console.log('[2FA] Status response:', result);

    if (result.success && result.data) {
      return {
        enabled: result.data.enabled || result.data.twoFactorEnabled || false,
        backupCodesRemaining: result.data.backupCodesRemaining || result.data.backupCodesCount,
      };
    }

    return { enabled: false };
  } catch (error) {
    console.error('[2FA] Error getting status:', error);
    return { enabled: false };
  }
}

// Setup 2FA - Get QR code and backup codes
export async function setup2FA(password?: string): Promise<TwoFASetupResponse> {
  const token = getAuthToken();

  if (!token) {
    throw new Error('Vui lòng đăng nhập để thiết lập 2FA');
  }

  const response = await fetchWithAuth(`${API_BASE}/auth/2fa/setup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });

  const result = await response.json();
  
  console.log('[2FA] Setup API response:', result);
  
  if (!result.success || !result.data) {
    throw new Error(result.error?.message || 'Không thể thiết lập 2FA');
  }

  // Backend có thể trả về secret với nhiều tên khác nhau
  const secret = result.data.secret || result.data.secretKey || result.data.key || result.data.manualEntryKey || '';
  const qrCode = result.data.qrCode || result.data.qrCodeUrl || result.data.otpauthUrl || result.data.uri || '';
  
  console.log('[2FA] Extracted secret:', secret);
  console.log('[2FA] Extracted qrCode:', qrCode ? 'exists' : 'empty');

  return {
    secret: secret,
    qrCode: qrCode,
    backupCodes: result.data.backupCodes || [],
  };
}

// Verify 2FA token and enable
export async function verify2FA(token2fa: string): Promise<void> {
  const token = getAuthToken();

  if (!token) {
    throw new Error('Vui lòng đăng nhập để xác thực 2FA');
  }

  const response = await fetchWithAuth(`${API_BASE}/auth/2fa/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token: token2fa }),
  });

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error?.message || 'Invalid verification code');
  }
}

// Disable 2FA
export async function disable2FA(password: string): Promise<void> {
  const token = getAuthToken();

  if (!token) {
    throw new Error('Please login to disable 2FA');
  }

  const response = await fetchWithAuth(`${API_BASE}/auth/2fa/disable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error?.message || 'Failed to disable 2FA');
  }
}

