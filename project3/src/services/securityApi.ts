// Security API Service
import { fetchWithAuth } from './apiHelper';
import { getAuthToken } from './authApi';

const API_BASE = '/api';

export interface SecurityLog {
  id: string;
  action: string;
  status: 'success' | 'failed' | 'suspicious';
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

export interface SecurityLogsResponse {
  success: boolean;
  data?: {
    logs: SecurityLog[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

// Get security logs with pagination
export async function getSecurityLogs(page = 1, limit = 10): Promise<SecurityLogsResponse> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Please login to view security logs',
      },
    };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/user/me/security-logs?page=${page}&limit=${limit}`);

    return await response.json();
  } catch (error) {
    console.error('Error fetching security logs:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Unable to fetch security logs',
      },
    };
  }
}
