// API Service - Backend with Socket.IO Real-time Updates
import { io, Socket } from 'socket.io-client';

// Use Next.js proxy to avoid CORS issues
const API_BASE = '/api';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

// Socket.IO connection
let socket: Socket | null = null;

function getSocketConnection(): Socket | null {
  if (typeof window === 'undefined') {
    return null; // SSR - no socket
  }
  
  if (!socket) {
    socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      timeout: 10000,
    });

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected to backend');
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket.IO] Disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.warn('[Socket.IO] Connection error:', error.message);
    });
  }
  
  return socket;
}

// Cleanup function
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('[Socket.IO] Disconnected manually');
  }
}

// Helper function to fetch from backend with retry
async function fetchFromBackend<T>(url: string, retries: number = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      
      // Rate limited - wait and retry
      if (response.status === 429 && attempt < retries) {
        console.warn(`[API] Rate limited, retrying in ${(attempt + 1) * 2}s...`);
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Backend returns { success: true, data: [...] }
      if (result && typeof result === 'object') {
        if ('success' in result && 'data' in result && result.success) {
          return result.data;
        }
        if ('data' in result) {
          return result.data;
        }
      }
      
      return result;
    } catch (error) {
      if (attempt === retries) throw error;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  throw new Error('Max retries exceeded');
}

// Types
export interface Ticker24h {
  symbol: string;
  price: string | number;
  priceChange: string | number;
  priceChangePercent: string | number;
  high: string | number;
  low: string | number;
  volume: string | number;
  quoteVolume: string | number;
  lastPrice?: string;
  highPrice?: string;
  lowPrice?: string;
}

export type OrderBookEntry = [string, string];

export interface OrderBookData {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

export interface TradeData {
  id: number;
  price: string;
  qty: string;
  time: number;
  isBuyerMaker: boolean;
}

export interface Kline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
}

export interface GlobalStats {
  total_market_cap: { usd: number };
  total_volume: { usd: number };
  market_cap_percentage: { btc: number };
  market_cap_change_percentage_24h_usd: number;
}

// API Functions - Backend Only

// Get current price for a symbol
export async function getCurrentPrice(symbol: string): Promise<number | null> {
  try {
    const ticker = await get24hTicker(symbol);
    return ticker?.lastPrice ? parseFloat(String(ticker.lastPrice)) : null;
  } catch (error) {
    console.error(`Error getting price for ${symbol}:`, error);
    return null;
  }
}

// Get 24h ticker for a symbol
export async function get24hTicker(symbol: string): Promise<Ticker24h> {
  return fetchFromBackend<Ticker24h>(`${API_BASE}/market/ticker/${symbol}`);
}

// Get all tickers
export async function getAllTickers(): Promise<Ticker24h[]> {
  return fetchFromBackend<Ticker24h[]>(`${API_BASE}/market/tickers`);
}

// Get order book
export async function getOrderBook(symbol: string, limit: number = 20): Promise<OrderBookData> {
  return fetchFromBackend<OrderBookData>(`${API_BASE}/market/orderbook/${symbol}?limit=${limit}`);
}

// Get recent trades
export async function getRecentTrades(symbol: string, limit: number = 50): Promise<TradeData[]> {
  return fetchFromBackend<TradeData[]>(`${API_BASE}/market/trades/${symbol}?limit=${limit}`);
}

// Get klines (candlestick data)
export async function getKlines(
  symbol: string,
  interval: string = '1h',
  limit: number = 100
): Promise<Kline[]> {
  return fetchFromBackend<Kline[]>(`${API_BASE}/market/klines/${symbol}?interval=${interval}&limit=${limit}`);
}

// Get global market statistics
export async function getGlobalStats(): Promise<GlobalStats> {
  try {
    return await fetchFromBackend<GlobalStats>(`${API_BASE}/market/global`);
  } catch (error) {
    console.error('Error fetching global stats:', error);
    return {
      total_market_cap: { usd: 0 },
      total_volume: { usd: 0 },
      market_cap_percentage: { btc: 0 },
      market_cap_change_percentage_24h_usd: 0,
    };
  }
}

// WebSocket Subscriptions - Backend Real-time

// Subscribe to real-time trades
export function subscribeToTrades(symbol: string, callback: (trade: TradeData) => void): () => void {
  const sock = getSocketConnection();
  
  // Always use polling as primary method since backend socket events may not match expected format
  console.log('[Trades] Setting up polling for:', symbol);
  let lastTradeId = 0;
  
  const pollTrades = async () => {
    try {
      const trades = await getRecentTrades(symbol, 10);
      // Only emit new trades
      const newTrades = trades.filter(t => t.id > lastTradeId);
      if (newTrades.length > 0) {
        lastTradeId = Math.max(...newTrades.map(t => t.id));
        newTrades.forEach(callback);
      }
    } catch {
      // Silent fail - don't spam console
    }
  };
  
  // Initial fetch
  pollTrades();
  
  // Poll every 3 seconds
  const interval = setInterval(pollTrades, 3000);
  
  // Also try socket if available
  if (sock) {
    const eventNames = [
      `trade:${symbol.toLowerCase()}`,
      `trades:${symbol.toLowerCase()}`,
      `market:trade:${symbol.toUpperCase()}`,
      'trade',
      'trades'
    ];

    const handler = (data: unknown) => {
      const d = data as Record<string, unknown>;
      if (d.symbol && String(d.symbol).toUpperCase() !== symbol.toUpperCase()) {
        return;
      }
      if (d && (d.price !== undefined || d.p !== undefined)) {
        console.log('[Trades] Received socket event:', d);
        callback({
          id: (d.id || d.t || Date.now()) as number,
          price: String(d.price || d.p || 0),
          qty: String(d.qty || d.q || d.quantity || d.amount || 0),
          time: (d.time || d.T || Date.now()) as number,
          isBuyerMaker: (d.isBuyerMaker || d.m || false) as boolean,
        });
      }
    };

    eventNames.forEach(event => sock.on(event, handler));
    sock.emit('subscribe', { channel: 'trades', symbol: symbol.toUpperCase() });

    return () => {
      clearInterval(interval);
      eventNames.forEach(event => sock.off(event, handler));
    };
  }

  return () => clearInterval(interval);
}

// Subscribe to order book updates
export function subscribeToOrderBook(
  symbol: string,
  callback: (data: OrderBookData) => void
): () => void {
  const sock = getSocketConnection();
  
  // Always use polling as primary method
  console.log('[OrderBook] Setting up polling for:', symbol);
  
  const pollOrderBook = async () => {
    try {
      const data = await getOrderBook(symbol, 12);
      callback(data);
    } catch {
      // Silent fail
    }
  };
  
  // Initial fetch
  pollOrderBook();
  
  // Poll every 3 seconds
  const interval = setInterval(pollOrderBook, 3000);
  
  // Also try socket if available
  if (sock) {
    const eventNames = [
      `orderbook:${symbol.toLowerCase()}`,
      `depth:${symbol.toLowerCase()}`,
      `market:orderbook:${symbol.toUpperCase()}`,
      'orderbook',
      'depth'
    ];

    const handler = (data: unknown) => {
      const d = data as Record<string, unknown>;
      if (d.symbol && String(d.symbol).toUpperCase() !== symbol.toUpperCase()) {
        return;
      }
      if (d && (Array.isArray(d.bids) || Array.isArray(d.asks))) {
        console.log('[OrderBook] Received socket event');
        callback({
          bids: (d.bids || []) as OrderBookEntry[],
          asks: (d.asks || []) as OrderBookEntry[],
        });
      }
    };

    eventNames.forEach(event => sock.on(event, handler));
    sock.emit('subscribe', { channel: 'orderbook', symbol: symbol.toUpperCase() });

    return () => {
      clearInterval(interval);
      eventNames.forEach(event => sock.off(event, handler));
    };
  }

  return () => clearInterval(interval);
}

// Subscribe to ticker updates
export function subscribeToTicker(symbol: string, callback: (ticker: Ticker24h) => void): () => void {
  const sock = getSocketConnection();
  
  // Always use polling as primary method
  console.log('[Ticker] Setting up polling for:', symbol);
  
  const pollTicker = async () => {
    try {
      const ticker = await get24hTicker(symbol);
      callback(ticker);
    } catch {
      // Silent fail
    }
  };
  
  // Initial fetch
  pollTicker();
  
  // Poll every 5 seconds
  const interval = setInterval(pollTicker, 5000);
  
  // Also try socket if available
  if (sock) {
    const eventNames = [
      `ticker:${symbol.toLowerCase()}`,
      `market:ticker:${symbol.toUpperCase()}`,
      'ticker',
      'price'
    ];

    const handler = (data: unknown) => {
      const d = data as Record<string, unknown>;
      if (d.symbol && String(d.symbol).toUpperCase() !== symbol.toUpperCase()) {
        return;
      }
      if (d && d.price !== undefined) {
        console.log('[Ticker] Received socket event');
        callback({
          symbol: String(d.symbol || symbol),
          price: d.price as string | number,
          priceChange: (d.priceChange || d.change || '0') as string | number,
          priceChangePercent: (d.priceChangePercent || d.changePercent || '0') as string | number,
          high: (d.high || d.highPrice || '0') as string | number,
          low: (d.low || d.lowPrice || '0') as string | number,
          volume: (d.volume || '0') as string | number,
          quoteVolume: (d.quoteVolume || '0') as string | number,
          lastPrice: String(d.price),
          highPrice: String(d.high || d.highPrice || '0'),
          lowPrice: String(d.low || d.lowPrice || '0'),
        });
      }
    };

    eventNames.forEach(event => sock.on(event, handler));
    sock.emit('subscribe', { channel: 'ticker', symbol: symbol.toUpperCase() });

    return () => {
      clearInterval(interval);
      eventNames.forEach(event => sock.off(event, handler));
    };
  }

  return () => clearInterval(interval);
}
