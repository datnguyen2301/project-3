// Settings API Service
import { fetchWithAuth } from './apiHelper';
import { getAuthToken } from './authApi';

const API_BASE = '/api';

export interface UserSettings {
  // Notifications
  emailNotifications: boolean;
  pushNotifications: boolean;
  priceAlerts: boolean;
  tradeConfirmations: boolean;
  newsUpdates: boolean;
  
  // Appearance
  theme: 'dark' | 'light';
  themeColor: string;
  
  // Language
  language: string;
}

export const DEFAULT_SETTINGS: UserSettings = {
  emailNotifications: true,
  pushNotifications: true,
  priceAlerts: true,
  tradeConfirmations: true,
  newsUpdates: false,
  theme: 'dark',
  themeColor: '#eab308', // Yellow
  language: 'vi',
};

// Get user settings
export async function getSettings(): Promise<UserSettings> {
  const token = getAuthToken();
  
  if (!token) {
    console.log('[Settings] No token, returning defaults');
    return DEFAULT_SETTINGS;
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/user/me/settings`);
    
    if (!response.ok) {
      // 404 = endpoint không tồn tại, hoặc backend chưa chạy - dùng defaults
      if (response.status === 404) {
        console.log('[Settings] Settings endpoint not available, using defaults');
      } else {
        console.warn('[Settings] Failed to fetch settings:', response.status);
      }
      return DEFAULT_SETTINGS;
    }
    
    const data = await response.json();
    console.log('[Settings] Fetched settings:', data);
    
    if (data.success && data.data) {
      // Merge with defaults to ensure all fields exist
      return {
        ...DEFAULT_SETTINGS,
        ...data.data,
      };
    }
    
    return DEFAULT_SETTINGS;
  } catch {
    // Network error hoặc backend chưa chạy - dùng defaults im lặng
    console.log('[Settings] Could not fetch settings, using defaults');
    return DEFAULT_SETTINGS;
  }
}

// Update user settings
export async function updateSettings(settings: Partial<UserSettings>): Promise<{ success: boolean; data?: UserSettings; error?: string }> {
  const token = getAuthToken();
  
  if (!token) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    console.log('[Settings] Updating settings:', settings);
    
    const response = await fetchWithAuth(`${API_BASE}/user/me/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });
    
    const data = await response.json();
    console.log('[Settings] Update response:', data);
    
    if (data.success) {
      return { success: true, data: data.data };
    }
    
    return { success: false, error: data.error?.message || 'Failed to update settings' };
  } catch (error) {
    console.error('[Settings] Error updating settings:', error);
    return { success: false, error: 'Network error' };
  }
}
