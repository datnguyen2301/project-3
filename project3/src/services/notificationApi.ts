// Notification API Service
import { getAuthToken } from './authApi';
import { fetchWithAuth } from './apiHelper';

const API_BASE = '/api';

export interface Notification {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface NotificationsResponse {
  success: boolean;
  data?: {
    notifications: Notification[];
    total: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface UnreadCountResponse {
  success: boolean;
  data?: {
    count: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

// Get notifications
export async function getNotifications(): Promise<NotificationsResponse> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Please login to view notifications',
      },
    };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/notifications`);

    return await response.json();
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Unable to fetch notifications',
      },
    };
  }
}

// Get unread notifications count
export async function getUnreadCount(): Promise<UnreadCountResponse> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Please login to view unread count',
      },
    };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/notifications/unread-count`);

    return await response.json();
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Unable to fetch unread count',
      },
    };
  }
}

export interface MarkAsReadResponse {
  success: boolean;
  data?: {
    unreadCount: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

// Mark notification as read
export async function markAsRead(notificationId: string): Promise<MarkAsReadResponse> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: { code: 'AUTH_REQUIRED', message: 'Please login' },
    };
  }

  // Validate notificationId
  if (!notificationId || notificationId === 'undefined') {
    console.warn('[NotificationAPI] Invalid notificationId:', notificationId);
    return {
      success: false,
      error: { code: 'INVALID_ID', message: 'Invalid notification ID' },
    };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });

    return await response.json();
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Unable to mark as read' },
    };
  }
}

// Mark all notifications as read
export async function markAllAsRead(): Promise<MarkAsReadResponse> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: { code: 'AUTH_REQUIRED', message: 'Please login' },
    };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/notifications/read-all`, {
      method: 'PATCH',
    });

    return await response.json();
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Unable to mark all as read' },
    };
  }
}

// Delete notification
export async function deleteNotification(notificationId: string): Promise<boolean> {
  const token = getAuthToken();

  if (!token) return false;

  try {
    const response = await fetchWithAuth(`${API_BASE}/notifications/${notificationId}`, {
      method: 'DELETE',
    });

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error deleting notification:', error);
    return false;
  }
}

// Notification Settings interfaces
export interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  priceAlerts: boolean;
  tradeNotifications: boolean;
  securityAlerts: boolean;
  marketingEmails: boolean;
}

// Get notification settings
export async function getNotificationSettings(): Promise<NotificationSettings | null> {
  const token = getAuthToken();

  if (!token) return null;

  try {
    const response = await fetchWithAuth(`${API_BASE}/notifications/settings`);
    const data = await response.json();
    
    if (data.success && data.data) {
      return data.data;
    }
    return null;
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    return null;
  }
}

// Update notification settings
export async function updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<boolean> {
  const token = getAuthToken();

  if (!token) return false;

  try {
    const response = await fetchWithAuth(`${API_BASE}/notifications/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error updating notification settings:', error);
    return false;
  }
}

// Trigger notification refresh - call this after actions that create notifications
export function triggerNotificationRefresh(): void {
  if (typeof window !== 'undefined') {
    console.log('[notificationApi] Triggering notification refresh');
    window.dispatchEvent(new CustomEvent('refresh-notifications'));
  }
}
