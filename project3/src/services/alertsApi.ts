// Price Alerts API Service
import { fetchWithAuth } from './apiHelper';
import { getAuthToken } from './authApi';

const API_BASE = '/api';

export type AlertCondition = 'above' | 'below' | 'cross_up' | 'cross_down';

export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: AlertCondition;
  triggered: boolean;
  active: boolean;
  note?: string;
  createdAt: string;
  triggeredAt?: string;
}

// Get all alerts
export async function getAlerts(): Promise<PriceAlert[]> {
  const token = getAuthToken();

  if (!token) {
    console.log('[AlertsAPI] No token, returning empty');
    return [];
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/alerts`);

    const result = await response.json();
    console.log('[AlertsAPI] Get alerts response:', result);
    
    // Backend có thể trả về alerts ở nhiều vị trí khác nhau
    const alerts = result.data?.alerts || result.alerts || result.data || [];
    
    if (Array.isArray(alerts)) {
      // Normalize condition to lowercase
      return alerts.map((alert: Record<string, unknown>) => ({
        id: alert.id as string,
        symbol: alert.symbol as string,
        targetPrice: alert.targetPrice as number,
        triggered: alert.triggered as boolean,
        active: (alert.active !== undefined ? alert.active : !alert.triggered) as boolean,
        createdAt: alert.createdAt as string,
        note: alert.note as string | undefined,
        triggeredAt: alert.triggeredAt as string | undefined,
        condition: ((alert.condition as string) || 'above').toLowerCase() as AlertCondition,
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return [];
  }
}

// Create alert
export async function createAlert(data: {
  symbol: string;
  targetPrice: number;
  condition: AlertCondition;
  note?: string;
}): Promise<PriceAlert> {
  const token = getAuthToken();

  if (!token) {
    throw new Error('Please login to create alert');
  }

  const response = await fetchWithAuth(`${API_BASE}/alerts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...data,
      condition: data.condition.toUpperCase(),
    }),
  });

  const result = await response.json();
  
  if (!result.success || !result.data?.alert) {
    throw new Error(result.error?.message || 'Failed to create alert');
  }

  return {
    ...result.data.alert,
    condition: (result.data.alert.condition || 'above').toLowerCase() as AlertCondition,
  };
}

// Delete alert
export async function deleteAlert(alertId: string): Promise<boolean> {
  const token = getAuthToken();

  if (!token) return false;

  try {
    const response = await fetchWithAuth(`${API_BASE}/alerts/${alertId}`, {
      method: 'DELETE',
    });

    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Error deleting alert:', error);
    return false;
  }
}

// Toggle alert active status
export async function toggleAlert(alertId: string): Promise<PriceAlert> {
  const token = getAuthToken();

  if (!token) {
    throw new Error('Please login to toggle alert');
  }

  const response = await fetchWithAuth(`${API_BASE}/alerts/${alertId}/toggle`, {
    method: 'PATCH',
  });

  const result = await response.json();
  
  if (!result.success || !result.data?.alert) {
    throw new Error(result.error?.message || 'Failed to toggle alert');
  }

  return {
    ...result.data.alert,
    condition: (result.data.alert.condition || 'above').toLowerCase() as AlertCondition,
  };
}
