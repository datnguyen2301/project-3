// Authentication API Service
// Use Next.js proxy to avoid CORS issues
const API_BASE = '/api';

export interface User {
  id: string;
  email: string;
  name: string;
  isEmailVerified: boolean;
  twoFactorEnabled: boolean;
  kycStatus?: 'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  role?: 'USER' | 'ADMIN';
}

export interface LoginResponse {
  success: boolean;
  data?: {
    user: User;
    token: string;
    refreshToken: string;
  };
  error?: {
    code: string;
    message: string;
    details?: Array<{
      field: string;
      message: string;
    }>;
  };
}

export interface RegisterResponse {
  success: boolean;
  data?: {
    user: User;
    token: string;
    refreshToken: string;
  };
  error?: {
    code: string;
    message: string;
    details?: Array<{
      field: string;
      message: string;
    }>;
  };
}

// Token management
export const setAuthToken = (token: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('auth_token', token);
  }
};

export const getAuthToken = (): string | null => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    // Kiểm tra token hợp lệ (không phải null, undefined, hoặc string "undefined")
    if (token && token !== 'undefined' && token !== 'null') {
      return token;
    }
  }
  return null;
};

export const removeAuthToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  }
};

export const setRefreshToken = (token: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('refresh_token', token);
  }
};

export const setUser = (user: User) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('user', JSON.stringify(user));
  }
};

export const getUser = (): User | null => {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }
  return null;
};

// Register user
export async function register(
  email: string,
  password: string,
  name: string,
  confirmPassword?: string
): Promise<RegisterResponse> {
  try {
    console.log('Registering with URL:', `${API_BASE}/auth/register`);
    const requestBody = { email, password, name, confirmPassword: confirmPassword || password };
    console.log('Register data:', { email, name });
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Register response status:', response.status);
    const data = await response.json();
    console.log('Register response data:', data);

    // Handle rate limiting
    if (response.status === 429) {
      return {
        success: false,
        error: {
          code: 'RATE_LIMIT',
          message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
        },
      };
    }

    if (data.success && data.data) {
      // Backend có thể trả về accessToken hoặc token
      const accessToken = data.data.accessToken || data.data.token;
      if (accessToken) {
        setAuthToken(accessToken);
      }
      if (data.data.refreshToken) {
        setRefreshToken(data.data.refreshToken);
      }
      if (data.data.user) {
        setUser(data.data.user);
      }
    }

    return data;
  } catch (error) {
    console.error('Register error:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Unable to connect to server',
      },
    };
  }
}

// Login user
export async function login(email: string, password: string): Promise<LoginResponse> {
  try {
    console.log('Logging in with URL:', `${API_BASE}/auth/login`);
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    console.log('Login response status:', response.status);
    
    // Handle rate limiting
    if (response.status === 429) {
      return {
        success: false,
        error: {
          code: 'RATE_LIMIT',
          message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
        },
      };
    }
    
    const data = await response.json();
    console.log('Login response data:', data);
    console.log('Login data.data keys:', data.data ? Object.keys(data.data) : 'no data');

    if (data.success && data.data) {
      // Backend có thể trả về accessToken, token, hoặc access_token
      const accessToken = data.data.accessToken || data.data.token || data.data.access_token;
      console.log('Extracted accessToken:', accessToken);
      
      if (accessToken) {
        setAuthToken(accessToken);
        console.log('Token saved successfully');
      } else {
        console.error('No token found in response! Available keys:', Object.keys(data.data));
      }
      
      const refreshToken = data.data.refreshToken || data.data.refresh_token;
      if (refreshToken) {
        setRefreshToken(refreshToken);
      }
      
      // User có thể ở data.data.user hoặc trực tiếp trong data.data
      const userData = data.data.user || {
        id: data.data.id || data.data.userId || data.data._id,
        email: data.data.email,
        username: data.data.username || data.data.name,
        fullName: data.data.fullName || data.data.name || data.data.username,
        kycStatus: data.data.kycStatus || 'pending',
        twoFactorEnabled: data.data.twoFactorEnabled || false,
      };
      
      if (userData && (userData.id || userData.email)) {
        setUser(userData);
        console.log('User saved:', userData);
      } else {
        console.warn('No user data found in response');
      }
    }

    return data;
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Unable to connect to server',
      },
    };
  }
}

// Logout user
export async function logout(): Promise<void> {
  const token = getAuthToken();
  
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  } catch {
  }
}

// Get current user profile
export async function getCurrentUser(): Promise<User | null> {
  const token = getAuthToken();
  
  if (!token) return null;

  try {
    const response = await fetch(`${API_BASE}/users/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (data.success && data.data) {
      setUser(data.data);
      return data.data;
    }

    return null;
  } catch {
    return null;
  }
}

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  // Check cả token và user data
  const token = getAuthToken();
  const user = getUser();
  
  // Nếu có token thì authenticated
  if (token) return true;
  
  // Nếu không có token nhưng có user data (trường hợp backend không trả token)
  if (user && (user.id || user.email)) return true;
  
  return false;
};

// Forgot password - request password reset email
export async function forgotPassword(email: string): Promise<void> {
  const response = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  if (response.status === 429) {
    throw new Error('Quá nhiều yêu cầu. Vui lòng thử lại sau.');
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error?.message || 'Không thể gửi email đặt lại mật khẩu');
  }
}

// Reset password with token
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const response = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token, newPassword }),
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error?.message || 'Không thể đặt lại mật khẩu');
  }
}

// Verify email with token
export async function verifyEmail(token: string): Promise<void> {
  const response = await fetch(`${API_BASE}/auth/verify-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error?.message || 'Xác thực email thất bại');
  }
}

// Resend verification email
export async function resendVerification(email: string): Promise<void> {
  const response = await fetch(`${API_BASE}/auth/resend-verification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  if (response.status === 429) {
    throw new Error('Quá nhiều yêu cầu. Vui lòng thử lại sau.');
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error?.message || 'Không thể gửi lại email xác thực');
  }
}
