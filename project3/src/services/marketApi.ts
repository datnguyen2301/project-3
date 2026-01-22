// Market API Service
import { fetchWithAuth } from './apiHelper';
import { getAuthToken } from './authApi';

const API_BASE = '/api/market';

export interface Ticker {
  symbol: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
  high: number;
  low: number;
  volume: number;
  quoteVolume: number;
}

export interface OrderBookEntry {
  price: number;
  quantity: number;
}

export interface OrderBook {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  lastUpdateId?: number;
}

export interface Trade {
  id: string;
  price: number;
  quantity: number;
  time: string;
  isBuyerMaker: boolean;
}

export interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

export interface GlobalStats {
  totalMarkets: number;
  totalVolume24h: number;
  gainers: number;
  losers: number;
  unchanged: number;
  btcDominance: number;
  marketCapChange24h: number;
  lastUpdated: string;
}

export interface FavoritePair {
  symbol: string;
  addedAt?: string;
}

// Get all tickers
export async function getTickers(): Promise<Ticker[]> {
  try {
    const response = await fetch(`${API_BASE}/tickers`);
    const result = await response.json();

    if (result.success && Array.isArray(result.data)) {
      return result.data;
    } else if (Array.isArray(result)) {
      return result;
    }

    return [];
  } catch (error) {
    console.error('[MarketAPI] Error fetching tickers:', error);
    return [];
  }
}

// Get single ticker
export async function getTicker(symbol: string): Promise<Ticker | null> {
  try {
    const response = await fetch(`${API_BASE}/ticker/${symbol.toUpperCase()}`);
    const result = await response.json();

    if (result.success && result.data) {
      return result.data;
    }

    return null;
  } catch (error) {
    console.error('[MarketAPI] Error fetching ticker:', error);
    return null;
  }
}

// Get order book
export async function getOrderBook(symbol: string, limit: number = 100): Promise<OrderBook> {
  try {
    const response = await fetch(`${API_BASE}/orderbook/${symbol.toUpperCase()}?limit=${limit}`);
    const result = await response.json();

    if (result.success && result.data) {
      return result.data;
    }

    return { bids: [], asks: [] };
  } catch (error) {
    console.error('[MarketAPI] Error fetching order book:', error);
    return { bids: [], asks: [] };
  }
}

// Get recent trades
export async function getTrades(symbol: string, limit: number = 50): Promise<Trade[]> {
  try {
    const response = await fetch(`${API_BASE}/trades/${symbol.toUpperCase()}?limit=${limit}`);
    const result = await response.json();

    if (result.success && Array.isArray(result.data)) {
      return result.data;
    }

    return [];
  } catch (error) {
    console.error('[MarketAPI] Error fetching trades:', error);
    return [];
  }
}

// Get klines/candlestick data
export async function getKlines(
  symbol: string,
  interval: string = '1h',
  limit: number = 100
): Promise<Kline[]> {
  try {
    const response = await fetch(
      `${API_BASE}/klines/${symbol.toUpperCase()}?interval=${interval}&limit=${limit}`
    );
    const result = await response.json();

    if (result.success && Array.isArray(result.data)) {
      return result.data;
    }

    return [];
  } catch (error) {
    console.error('[MarketAPI] Error fetching klines:', error);
    return [];
  }
}

// Get 24hr stats
export async function get24hrStats(symbol: string): Promise<Ticker | null> {
  try {
    const response = await fetch(`${API_BASE}/24hr/${symbol.toUpperCase()}`);
    const result = await response.json();

    if (result.success && result.data) {
      return result.data;
    }

    return null;
  } catch (error) {
    console.error('[MarketAPI] Error fetching 24hr stats:', error);
    return null;
  }
}

// Get global market stats
export async function getGlobalStats(): Promise<GlobalStats | null> {
  try {
    const response = await fetch(`${API_BASE}/global`);
    const result = await response.json();

    if (result.success && result.data) {
      return result.data;
    }

    return null;
  } catch (error) {
    console.error('[MarketAPI] Error fetching global stats:', error);
    return null;
  }
}

// ========== Favorites API (requires authentication) ==========

// Get user's favorite pairs
export async function getFavorites(): Promise<FavoritePair[]> {
  const token = getAuthToken();

  if (!token) {
    console.log('[MarketAPI] No token for favorites');
    return [];
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/favorites`);
    const result = await response.json();

    console.log('[MarketAPI] Favorites response:', result);

    if (result.success && result.data) {
      // Handle different response formats
      if (Array.isArray(result.data)) {
        return result.data.map((f: Record<string, unknown>) => ({
          symbol: String(f.symbol || f),
          addedAt: f.addedAt ? String(f.addedAt) : undefined,
        }));
      } else if (result.data.favorites && Array.isArray(result.data.favorites)) {
        return result.data.favorites.map((f: Record<string, unknown>) => ({
          symbol: String(f.symbol || f),
          addedAt: f.addedAt ? String(f.addedAt) : undefined,
        }));
      }
    }

    return [];
  } catch (error) {
    console.error('[MarketAPI] Error fetching favorites:', error);
    return [];
  }
}

// Add a pair to favorites
export async function addFavorite(symbol: string): Promise<{
  success: boolean;
  message?: string;
  error?: { code: string; message: string };
}> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Vui lòng đăng nhập để thêm yêu thích',
      },
    };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/favorites/${symbol.toUpperCase()}`, {
      method: 'POST',
    });
    const result = await response.json();

    if (result.success) {
      return {
        success: true,
        message: result.data?.message || result.message || 'Đã thêm vào yêu thích',
      };
    }

    return {
      success: false,
      error: result.error || { code: 'UNKNOWN', message: 'Không thể thêm yêu thích' },
    };
  } catch (error) {
    console.error('[MarketAPI] Error adding favorite:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Không thể kết nối đến server',
      },
    };
  }
}

// Remove a pair from favorites
export async function removeFavorite(symbol: string): Promise<{
  success: boolean;
  message?: string;
  error?: { code: string; message: string };
}> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Vui lòng đăng nhập',
      },
    };
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/favorites/${symbol.toUpperCase()}`, {
      method: 'DELETE',
    });
    const result = await response.json();

    if (result.success) {
      return {
        success: true,
        message: result.data?.message || result.message || 'Đã xóa khỏi yêu thích',
      };
    }

    return {
      success: false,
      error: result.error || { code: 'UNKNOWN', message: 'Không thể xóa yêu thích' },
    };
  } catch (error) {
    console.error('[MarketAPI] Error removing favorite:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Không thể kết nối đến server',
      },
    };
  }
}

// Check if a symbol is in favorites
export async function isFavorite(symbol: string): Promise<boolean> {
  const favorites = await getFavorites();
  return favorites.some((f) => f.symbol.toUpperCase() === symbol.toUpperCase());
}
