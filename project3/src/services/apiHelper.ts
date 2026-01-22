// API Helper with automatic token refresh
import { getAuthToken, setAuthToken, setRefreshToken, removeAuthToken } from './authApi';

const API_BASE = '/api';

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

export function setLastLoginTime() {
  // Placeholder for future use
  console.log('[Auth] Login time marked');
}

// Refresh the access token using refresh token
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = typeof window !== 'undefined' 
    ? localStorage.getItem('refresh_token') 
    : null;

  if (!refreshToken) {
    console.log('[Auth] No refresh token found');
    return null;
  }

  try {
    console.log('[Auth] Attempting to refresh token...');
    const response = await fetch(`${API_BASE}/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    // Check if response is ok before parsing JSON
    if (!response.ok) {
      console.log('[Auth] Refresh failed with status:', response.status);
      removeAuthToken();
      return null;
    }

    const text = await response.text();
    console.log('[Auth] Refresh response text:', text);
    
    // Try to parse JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('[Auth] Failed to parse refresh response as JSON');
      removeAuthToken();
      return null;
    }

    console.log('[Auth] Refresh response:', data);

    // Backend có thể trả về accessToken hoặc token
    const newAccessToken = data.data?.accessToken || data.data?.token;
    if (data.success && newAccessToken) {
      setAuthToken(newAccessToken);
      if (data.data.refreshToken) {
        setRefreshToken(data.data.refreshToken);
      }
      return newAccessToken;
    }

    // Refresh failed - clear tokens
    removeAuthToken();
    return null;
  } catch {
    removeAuthToken();
    return null;
  }
}

// Fetch with automatic auth header and token refresh
export async function fetchWithAuth(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { skipAuth, ...fetchOptions } = options;

  // Get current token
  const token = getAuthToken();
  console.log('[FetchWithAuth] URL:', url, 'Token exists:', !!token, 'Token preview:', token ? token.substring(0, 20) + '...' : 'null');

  // If auth is required but no token, throw error
  if (!skipAuth && !token) {
    console.log('[FetchWithAuth] No token and auth required');
    throw new Error('AUTH_REQUIRED');
  }

  // Check if body is FormData - don't set Content-Type for FormData (browser will set it with boundary)
  const isFormData = fetchOptions.body instanceof FormData;

  // Add auth header if token exists
  const headers: HeadersInit = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...fetchOptions.headers,
  };

  if (token && !skipAuth) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  console.log('[FetchWithAuth] Headers:', JSON.stringify(headers));

  // Make the request
  let response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  console.log('[FetchWithAuth] Response status:', response.status);

  // If unauthorized, try to refresh token
  if (response.status === 401 && !skipAuth) {
    console.log('[FetchWithAuth] Got 401, attempting token refresh...');
    const newToken = await refreshAccessToken();

    if (newToken) {
      // Retry with new token
      (headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(url, {
        ...fetchOptions,
        headers,
      });
    } else {
      // Refresh failed - user needs to login again
      // Dispatch event so UI components can redirect to login
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('session-expired'));
      }
      throw new Error('SESSION_EXPIRED');
    }
  }

  return response;
}

// Helper to make authenticated GET request
export async function authGet<T>(url: string): Promise<{ success: boolean; data?: T; error?: { code: string; message: string } }> {
  try {
    const response = await fetchWithAuth(url);
    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: {
          code: error.message === 'SESSION_EXPIRED' ? 'SESSION_EXPIRED' : 'AUTH_REQUIRED',
          message: error.message === 'SESSION_EXPIRED' 
            ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
            : 'Vui lòng đăng nhập để tiếp tục.',
        },
      };
    }
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Không thể kết nối đến máy chủ',
      },
    };
  }
}

// Helper to make authenticated POST request
export async function authPost<T>(
  url: string,
  body: unknown
): Promise<{ success: boolean; data?: T; error?: { code: string; message: string } }> {
  try {
    const response = await fetchWithAuth(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: {
          code: error.message === 'SESSION_EXPIRED' ? 'SESSION_EXPIRED' : 'AUTH_REQUIRED',
          message: error.message === 'SESSION_EXPIRED' 
            ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
            : 'Vui lòng đăng nhập để tiếp tục.',
        },
      };
    }
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Không thể kết nối đến máy chủ',
      },
    };
  }
}

// Helper to make authenticated DELETE request
export async function authDelete<T>(url: string): Promise<{ success: boolean; data?: T; error?: { code: string; message: string } }> {
  try {
    const response = await fetchWithAuth(url, {
      method: 'DELETE',
    });
    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: {
          code: error.message === 'SESSION_EXPIRED' ? 'SESSION_EXPIRED' : 'AUTH_REQUIRED',
          message: error.message === 'SESSION_EXPIRED' 
            ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
            : 'Vui lòng đăng nhập để tiếp tục.',
        },
      };
    }
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Không thể kết nối đến máy chủ',
      },
    };
  }
}
