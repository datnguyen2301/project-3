// User Management API Service
import { fetchWithAuth } from './apiHelper';
import { getAuthToken } from './authApi';

const API_BASE = '/api';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  isEmailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  kycStatus?: string;
  avatar?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  success: boolean;
  error?: {
    code: string;
    message: string;
  };
}

// Get user profile
export async function getUserProfile(): Promise<UserProfile> {
  const token = getAuthToken();

  // Không throw error nếu chưa login - trả về null để component tự xử lý
  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/users/profile`);

    // Nếu 401, không throw error mà return quietly
    if (response.status === 401) {
      throw new Error('AUTH_REQUIRED');
    }

    const data = await response.json();
    
    console.log('[UserAPI] Profile response:', data);

    if (!data.success) {
      throw new Error(data.error?.message || 'Không thể tải thông tin người dùng');
    }

    // Backend có thể trả về twoFactorEnabled với nhiều tên khác nhau
    const profile = data.data;
    const twoFactorEnabled = profile.twoFactorEnabled ?? profile.twoFaEnabled ?? profile.is2FAEnabled ?? profile.mfaEnabled ?? false;
    
    // Backend có thể trả về emailVerified hoặc isEmailVerified hoặc isVerified
    const isEmailVerified = profile.isEmailVerified ?? profile.emailVerified ?? profile.isVerified ?? false;
    
    console.log('[UserAPI] twoFactorEnabled raw:', profile.twoFactorEnabled, 'normalized:', twoFactorEnabled);
    console.log('[UserAPI] isEmailVerified raw:', profile.isEmailVerified, profile.emailVerified, 'normalized:', isEmailVerified);

    return {
      ...profile,
      twoFactorEnabled: twoFactorEnabled,
      isEmailVerified: isEmailVerified,
    };
  } catch (err) {
    // Re-throw AUTH_REQUIRED errors silently
    if (err instanceof Error && err.message === 'AUTH_REQUIRED') {
      throw err;
    }
    throw err;
  }
}

// Change password
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<ChangePasswordResponse> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Please login to change password',
      },
    };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword,
        oldPassword: currentPassword, // Một số backend dùng oldPassword
        newPassword,
        confirmPassword: newPassword, // Một số backend yêu cầu confirmPassword
      }),
    });

    const result = await response.json();
    console.log('[UserAPI] Change password response:', result);
    return result;
  } catch (error) {
    console.error('Error changing password:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Unable to connect to server',
      },
    };
  }
}

// Resend verification email
export async function resendVerificationEmail(): Promise<{ success: boolean; message?: string; error?: { code: string; message: string } }> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Vui lòng đăng nhập để gửi email xác thực',
      },
    };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/auth/resend-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Không thể kết nối đến server',
      },
    };
  }
}

// Verify email with token
export async function verifyEmail(token: string): Promise<{ success: boolean; message?: string; error?: { code: string; message: string } }> {
  try {
    const response = await fetch(`${API_BASE}/auth/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error verifying email:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Không thể kết nối đến server',
      },
    };
  }
}
