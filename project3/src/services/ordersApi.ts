// Orders API Service
import { fetchWithAuth } from './apiHelper';
import { getAuthToken } from './authApi';

// Use Next.js proxy to avoid CORS issues
const API_BASE = '/api';

export interface Order {
  id: string;
  userId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET' | 'STOP_LIMIT';
  status: 'PENDING' | 'OPEN' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'REJECTED';
  price?: number;
  stopPrice?: number;
  // Support both field names from backend
  quantity?: number;
  amount?: number;
  filledQuantity?: number;
  filledAmount?: number;
  remainingQuantity?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlaceOrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET' | 'STOP_LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
  quantity: number;
  price?: number;
  stopPrice?: number;
}

export interface PlaceOrderResponse {
  success: boolean;
  data?: Order;
  error?: {
    code: string;
    message: string;
  };
}

// Place a new order
export async function placeOrder(orderData: PlaceOrderRequest): Promise<PlaceOrderResponse> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Please login to place orders',
      },
    };
  }

  try {
    // Backend expects 'amount' instead of 'quantity'
    const backendData = {
      symbol: orderData.symbol,
      side: orderData.side,
      type: orderData.type,
      amount: orderData.quantity,  // Map quantity -> amount
      price: orderData.price,
      stopPrice: orderData.stopPrice,
    };
    
    console.log('[Orders] Placing order:', JSON.stringify(backendData, null, 2));
    
    const response = await fetchWithAuth(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(backendData),
    });

    const data = await response.json();
    console.log('[Orders] Place order response:', JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error('Error placing order:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Unable to place order',
      },
    };
  }
}

// Get user's open orders
export async function getOpenOrders(symbol?: string): Promise<Order[]> {
  const token = getAuthToken();

  if (!token || token === 'undefined' || token === 'null') {
    // Not authenticated - return empty array silently
    return [];
  }

  try {
    // Lấy tất cả orders và filter ở client (backend có thể không hỗ trợ status filter)
    const url = symbol 
      ? `${API_BASE}/orders?symbol=${symbol}`
      : `${API_BASE}/orders`;

    const response = await fetchWithAuth(url);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    
    console.log('[Orders] getOpenOrders raw response:', JSON.stringify(data, null, 2));
    
    // Handle different response formats
    let orders: Order[] = [];
    if (data.success && Array.isArray(data.data)) {
      orders = data.data;
    } else if (data.success && data.data?.orders && Array.isArray(data.data.orders)) {
      orders = data.data.orders;
    } else if (Array.isArray(data)) {
      orders = data;
    }
    
    console.log('[Orders] All orders count:', orders.length);
    console.log('[Orders] Order statuses:', orders.map((o: Order) => o.status));
    
    // Filter chỉ lấy open orders (PENDING, PARTIALLY_FILLED, NEW, OPEN)
    const openOrders = orders.filter((order: Order) => {
      const status = order.status as string;
      return status === 'PENDING' || 
        status === 'PARTIALLY_FILLED' ||
        status === 'NEW' ||
        status === 'OPEN' ||
        status === 'pending' ||
        status === 'new' ||
        status === 'open';
    });
    
    console.log('[Orders] Open orders count:', openOrders.length);
    
    return openOrders;
  } catch (error) {
    console.error('Error fetching open orders:', error);
    return [];
  }
}

// Get order history
export async function getOrderHistory(params?: {
  symbol?: string;
  limit?: number;
  offset?: number;
}): Promise<Order[]> {
  const token = getAuthToken();

  if (!token) return [];

  try {
    const queryParams = new URLSearchParams();
    if (params?.symbol) queryParams.append('symbol', params.symbol);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const response = await fetchWithAuth(`${API_BASE}/orders/history?${queryParams}`);

    const data = await response.json();
    
    // Handle different response formats
    let orders: Order[] = [];
    if (data.success && Array.isArray(data.data)) {
      orders = data.data;
    } else if (data.success && data.data?.orders && Array.isArray(data.data.orders)) {
      orders = data.data.orders;
    } else if (Array.isArray(data)) {
      orders = data;
    }
    
    return orders;
  } catch (error) {
    console.error('Error fetching order history:', error);
    return [];
  }
}

// Cancel an order
export async function cancelOrder(orderId: string): Promise<{ success: boolean; message?: string; error?: { message: string } }> {
  const token = getAuthToken();

  if (!token) {
    return { success: false, message: 'Authentication required' };
  }

  try {
    // Try POST /orders/{id}/cancel first
    console.log('[Orders] Canceling order:', orderId);
    let response = await fetchWithAuth(`${API_BASE}/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // If 404, try DELETE /orders/{id}
    if (response.status === 404) {
      console.log('[Orders] POST cancel not found, trying DELETE...');
      response = await fetchWithAuth(`${API_BASE}/orders/${orderId}`, {
        method: 'DELETE',
      });
    }

    const data = await response.json();
    console.log('[Orders] Cancel response:', data);
    return data;
  } catch (error) {
    console.error('Error canceling order:', error);
    return { success: false, message: 'Unable to cancel order' };
  }
}

// Get order by ID
export async function getOrderById(orderId: string): Promise<Order | null> {
  const token = getAuthToken();

  if (!token) return null;

  try {
    const response = await fetchWithAuth(`${API_BASE}/orders/${orderId}`);

    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Error fetching order:', error);
    return null;
  }
}
