// WebSocket Service for Real-time Updates
import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

let socket: Socket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

// Track subscribed channels
const subscribedChannels: Set<string> = new Set();

export interface PriceAlertEvent {
  alertId: string;
  symbol: string;
  targetPrice: number;
  currentPrice: number;
  condition: string;
}

export interface PriceAlertCreatedEvent {
  alertId: string;
  symbol: string;
  targetPrice: number;
  condition: 'ABOVE' | 'BELOW';
  message: string;
}

export interface NotificationEvent {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  createdAt: string;
}

export interface TickerUpdateEvent {
  symbol: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
  high: number;
  low: number;
  volume: number;
  timestamp: number;
}

export interface OrderBookUpdateEvent {
  symbol: string;
  bids: Array<{ price: number; quantity: number }>;
  asks: Array<{ price: number; quantity: number }>;
  timestamp: number;
}

export interface TradesUpdateEvent {
  symbol: string;
  trades: Array<{
    id: number;
    price: number;
    quantity: number;
    time: number;
    isBuyerMaker: boolean;
  }>;
  timestamp: number;
}

export interface OrderUpdateEvent {
  orderId: string;
  symbol: string;
  status: 'PENDING' | 'OPEN' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'REJECTED' | 'NEW';
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_LIMIT';
  quantity: number;
  filledQuantity: number;
  price?: number;
  filledPrice?: number;
  createdAt: string;
}

export interface BalanceUpdateEvent {
  symbol: string;
  available: number;
  locked: number;
  total: number;
}

export interface PortfolioUpdateEvent {
  totalValue: number;
  totalChange: number;
  totalPnl: number;
  assets: Array<{
    symbol: string;
    amount: number;
    value: number;
    pnl: number;
  }>;
}

// Legacy alias for backward compatibility
export type PriceUpdateEvent = TickerUpdateEvent;

// Event types for type-safe subscriptions
type WebSocketEventMap = {
  'notification': NotificationEvent;
  'priceAlert': PriceAlertEvent;
  'priceAlertCreated': PriceAlertCreatedEvent;
  'ticker:update': TickerUpdateEvent;
  'orderbook:update': OrderBookUpdateEvent;
  'trades:update': TradesUpdateEvent;
  'orders:update': OrderUpdateEvent;
  'wallet:update': BalanceUpdateEvent;
  'portfolio:update': PortfolioUpdateEvent;
  // Legacy events
  'price:update': TickerUpdateEvent;
  'order:update': OrderUpdateEvent;
  'balance:update': BalanceUpdateEvent;
  'market:price': TickerUpdateEvent;
};

// Connect to WebSocket
export function connectWebSocket(token?: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  // Disconnect existing socket if any
  if (socket) {
    socket.disconnect();
  }

  socket = io(WS_URL, {
    auth: token ? { token } : {},
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    timeout: 10000,
  });

  socket.on('connect', () => {
    console.log('[WebSocket] Connected to server');
    reconnectAttempts = 0;
    
    // Re-subscribe to all channels after reconnection
    subscribedChannels.forEach((channel) => {
      const [type, symbol] = channel.split(':');
      if (socket) {
        socket.emit(`subscribe:${type}`, symbol);
        console.log('[WebSocket] Re-subscribed to', channel);
      }
    });
    
    // Auto-subscribe to notifications if authenticated
    if (token && socket) {
      socket.emit('subscribe:notifications');
    }
    
    // Dispatch custom event for components to know connection is ready
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ws:connected'));
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('[WebSocket] Disconnected:', reason);
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ws:disconnected', { detail: { reason } }));
    }
  });

  socket.on('connect_error', (error: Error) => {
    console.error('[WebSocket] Connection error:', error.message);
    reconnectAttempts++;
    
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[WebSocket] Max reconnection attempts reached');
    }
  });

  socket.on('reconnect', (attemptNumber: number) => {
    console.log('[WebSocket] Reconnected after', attemptNumber, 'attempts');
  });

  // Handle pong for heartbeat
  socket.on('pong', () => {
    console.log('[WebSocket] Pong received');
  });

  // Handle authentication errors
  socket.on('auth:error', (error: { message: string }) => {
    console.error('[WebSocket] Authentication error:', error.message);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ws:auth-error'));
    }
  });

  // Start heartbeat
  setInterval(() => {
    if (socket?.connected) {
      socket.emit('ping');
    }
  }, 30000);

  return socket;
}

// Disconnect WebSocket
export function disconnectWebSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    subscribedChannels.clear();
  }
}

// Get socket instance
export function getSocket(): Socket | null {
  return socket;
}

// ========== Ticker Subscriptions (Real-time price updates) ==========

// Subscribe to ticker updates for a symbol
export function subscribeToTicker(symbol: string): void {
  if (socket?.connected) {
    const channel = `ticker:${symbol.toUpperCase()}`;
    socket.emit('subscribe:ticker', symbol.toUpperCase());
    subscribedChannels.add(channel);
    console.log('[WebSocket] Subscribed to ticker:', symbol);
  }
}

// Unsubscribe from ticker updates
export function unsubscribeFromTicker(symbol: string): void {
  if (socket?.connected) {
    const channel = `ticker:${symbol.toUpperCase()}`;
    socket.emit('unsubscribe:ticker', symbol.toUpperCase());
    subscribedChannels.delete(channel);
    console.log('[WebSocket] Unsubscribed from ticker:', symbol);
  }
}

// Listen for ticker updates
export function onTickerUpdate(callback: (data: TickerUpdateEvent) => void): () => void {
  if (socket) {
    socket.on('ticker:update', callback);
  }
  return () => {
    if (socket) {
      socket.off('ticker:update', callback);
    }
  };
}

// ========== OrderBook Subscriptions ==========

// Subscribe to orderbook updates for a symbol
export function subscribeToOrderBook(symbol: string): void {
  if (socket?.connected) {
    const channel = `orderbook:${symbol.toUpperCase()}`;
    socket.emit('subscribe:orderbook', symbol.toUpperCase());
    subscribedChannels.add(channel);
    console.log('[WebSocket] Subscribed to orderbook:', symbol);
  }
}

// Unsubscribe from orderbook updates
export function unsubscribeFromOrderBook(symbol: string): void {
  if (socket?.connected) {
    const channel = `orderbook:${symbol.toUpperCase()}`;
    socket.emit('unsubscribe:orderbook', symbol.toUpperCase());
    subscribedChannels.delete(channel);
    console.log('[WebSocket] Unsubscribed from orderbook:', symbol);
  }
}

// Listen for orderbook updates
export function onOrderBookUpdate(callback: (data: OrderBookUpdateEvent) => void): () => void {
  if (socket) {
    socket.on('orderbook:update', callback);
  }
  return () => {
    if (socket) {
      socket.off('orderbook:update', callback);
    }
  };
}

// ========== Trades Subscriptions ==========

// Subscribe to trades updates for a symbol
export function subscribeToTrades(symbol: string): void {
  if (socket?.connected) {
    const channel = `trades:${symbol.toUpperCase()}`;
    socket.emit('subscribe:trades', symbol.toUpperCase());
    subscribedChannels.add(channel);
    console.log('[WebSocket] Subscribed to trades:', symbol);
  }
}

// Unsubscribe from trades updates
export function unsubscribeFromTrades(symbol: string): void {
  if (socket?.connected) {
    const channel = `trades:${symbol.toUpperCase()}`;
    socket.emit('unsubscribe:trades', symbol.toUpperCase());
    subscribedChannels.delete(channel);
    console.log('[WebSocket] Unsubscribed from trades:', symbol);
  }
}

// Listen for trades updates
export function onTradesUpdate(callback: (data: TradesUpdateEvent) => void): () => void {
  if (socket) {
    socket.on('trades:update', callback);
  }
  return () => {
    if (socket) {
      socket.off('trades:update', callback);
    }
  };
}

// ========== User Private Channels (require authentication) ==========

// Subscribe to user orders
export function subscribeToOrders(): void {
  if (socket?.connected) {
    socket.emit('subscribe:orders');
    console.log('[WebSocket] Subscribed to orders');
  }
}

// Listen for order updates
export function onOrdersUpdate(callback: (data: OrderUpdateEvent) => void): () => void {
  if (socket) {
    // Listen to both event names for compatibility
    socket.on('orders:update', callback);
    socket.on('orderUpdate', callback);
  }
  return () => {
    if (socket) {
      socket.off('orders:update', callback);
      socket.off('orderUpdate', callback);
    }
  };
}

// Subscribe to user wallet/balance
export function subscribeToWallet(): void {
  if (socket?.connected) {
    socket.emit('subscribe:wallet');
    console.log('[WebSocket] Subscribed to wallet');
  }
}

// Listen for wallet/balance updates
export function onWalletUpdate(callback: (data: BalanceUpdateEvent) => void): () => void {
  if (socket) {
    socket.on('wallet:update', callback);
  }
  return () => {
    if (socket) {
      socket.off('wallet:update', callback);
    }
  };
}

// Subscribe to user portfolio
export function subscribeToPortfolio(): void {
  if (socket?.connected) {
    socket.emit('subscribe:portfolio');
    console.log('[WebSocket] Subscribed to portfolio');
  }
}

// Listen for portfolio updates
export function onPortfolioUpdate(callback: (data: PortfolioUpdateEvent) => void): () => void {
  if (socket) {
    socket.on('portfolio:update', callback);
  }
  return () => {
    if (socket) {
      socket.off('portfolio:update', callback);
    }
  };
}

// Subscribe to notifications
export function subscribeToNotifications(): void {
  if (socket?.connected) {
    socket.emit('subscribe:notifications');
    console.log('[WebSocket] Subscribed to notifications');
  }
}

// ========== Price Alerts ==========

// Subscribe to price alerts
export function onPriceAlert(callback: (data: PriceAlertEvent) => void): () => void {
  if (socket) {
    socket.on('priceAlert', callback);
  }
  // Return cleanup function
  return () => {
    if (socket) {
      socket.off('priceAlert', callback);
    }
  };
}

// Subscribe to price alert created events
export function onPriceAlertCreated(callback: (data: PriceAlertCreatedEvent) => void): () => void {
  if (socket) {
    socket.on('priceAlertCreated', callback);
  }
  // Return cleanup function
  return () => {
    if (socket) {
      socket.off('priceAlertCreated', callback);
    }
  };
}

// Subscribe to notifications
export function onNotification(callback: (data: NotificationEvent) => void): () => void {
  if (socket) {
    socket.on('notification', callback);
  }
  // Return cleanup function
  return () => {
    if (socket) {
      socket.off('notification', callback);
    }
  };
}

// Unsubscribe from notifications
export function offNotification(callback: (data: NotificationEvent) => void): void {
  if (socket) {
    socket.off('notification', callback);
  }
}

// ========== Legacy/Backward Compatibility Functions ==========

// Subscribe to market price updates (legacy)
export function subscribeToMarket(symbol: string): void {
  subscribeToTicker(symbol);
}

// Unsubscribe from market price updates (legacy)
export function unsubscribeFromMarket(symbol: string): void {
  unsubscribeFromTicker(symbol);
}

// Listen for market price updates (legacy)
export function onMarketPrice(callback: (data: TickerUpdateEvent) => void): () => void {
  return onTickerUpdate(callback);
}

// Subscribe to order updates (legacy)
export function onOrderUpdate(callback: (data: OrderUpdateEvent) => void): () => void {
  return onOrdersUpdate(callback);
}

// Subscribe to balance updates (legacy)
export function onBalanceUpdate(callback: (data: BalanceUpdateEvent) => void): () => void {
  return onWalletUpdate(callback);
}

// Subscribe to price updates for specific symbol (legacy)
export function onPriceUpdate(symbol: string, callback: (data: TickerUpdateEvent) => void): () => void {
  subscribeToTicker(symbol);
  
  // Create a filtered callback that only triggers for this symbol
  const filteredCallback = (data: TickerUpdateEvent) => {
    if (data.symbol === symbol.toUpperCase()) {
      callback(data);
    }
  };
  
  if (socket) {
    socket.on('ticker:update', filteredCallback);
  }
  
  return () => {
    unsubscribeFromTicker(symbol);
    if (socket) {
      socket.off('ticker:update', filteredCallback);
    }
  };
}

// ========== Utility Functions ==========

// Generic event subscription with cleanup
export function subscribe<K extends keyof WebSocketEventMap>(
  event: K,
  callback: (data: WebSocketEventMap[K]) => void
): () => void {
  if (socket) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on(event as string, callback as any);
  }
  
  return () => {
    if (socket) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket.off(event as string, callback as any);
    }
  };
}

// Check if WebSocket is connected
export function isConnected(): boolean {
  return socket?.connected ?? false;
}

// Get connection status
export function getConnectionStatus(): 'connected' | 'connecting' | 'disconnected' {
  if (!socket) return 'disconnected';
  if (socket.connected) return 'connected';
  return 'connecting';
}

// Emit event to server
export function emit(event: string, data?: unknown): void {
  if (socket?.connected) {
    socket.emit(event, data);
  }
}

// Subscribe to a trading pair (ticker + orderbook + trades)
export function subscribeToTradingPair(symbol: string): void {
  subscribeToTicker(symbol);
  subscribeToOrderBook(symbol);
  subscribeToTrades(symbol);
}

// Unsubscribe from a trading pair
export function unsubscribeFromTradingPair(symbol: string): void {
  unsubscribeFromTicker(symbol);
  unsubscribeFromOrderBook(symbol);
  unsubscribeFromTrades(symbol);
}

// Subscribe to all user private channels
export function subscribeToUserChannels(): void {
  subscribeToNotifications();
  subscribeToOrders();
  subscribeToWallet();
  subscribeToPortfolio();
}

// Request real-time price updates for multiple symbols
export function subscribeToSymbols(symbols: string[]): void {
  symbols.forEach((symbol) => subscribeToTicker(symbol));
}

// Unsubscribe from multiple symbols
export function unsubscribeFromSymbols(symbols: string[]): void {
  symbols.forEach((symbol) => unsubscribeFromTicker(symbol));
}

// Get list of subscribed channels
export function getSubscribedChannels(): string[] {
  return Array.from(subscribedChannels);
}
