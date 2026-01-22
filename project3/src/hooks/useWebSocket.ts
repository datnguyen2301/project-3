// Custom React Hook for WebSocket connections
import { useEffect, useCallback, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  connectWebSocket,
  disconnectWebSocket,
  isConnected,
  onNotification,
  onPriceAlert,
  onOrderUpdate,
  onBalanceUpdate,
  onPriceUpdate,
  onTickerUpdate,
  onOrderBookUpdate,
  onTradesUpdate,
  onOrdersUpdate,
  onWalletUpdate,
  onPortfolioUpdate,
  subscribeToTicker,
  unsubscribeFromTicker,
  subscribeToOrderBook,
  unsubscribeFromOrderBook,
  subscribeToTrades,
  unsubscribeFromTrades,
  subscribeToTradingPair,
  unsubscribeFromTradingPair,
  subscribeToSymbols,
  unsubscribeFromSymbols,
  subscribeToUserChannels,
  subscribeToOrders,
  subscribeToWallet,
  subscribeToPortfolio,
  type NotificationEvent,
  type PriceAlertEvent,
  type OrderUpdateEvent,
  type BalanceUpdateEvent,
  type TickerUpdateEvent,
  type OrderBookUpdateEvent,
  type TradesUpdateEvent,
  type PortfolioUpdateEvent,
} from '@/services/websocket';
import { getAuthToken } from '@/services/authApi';

// Re-export types for convenience
export type {
  NotificationEvent,
  PriceAlertEvent,
  OrderUpdateEvent,
  BalanceUpdateEvent,
  TickerUpdateEvent,
  OrderBookUpdateEvent,
  TradesUpdateEvent,
  PortfolioUpdateEvent,
};

// Legacy type alias
export type PriceUpdateEvent = TickerUpdateEvent;

interface UseWebSocketOptions {
  autoConnect?: boolean;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

// Main WebSocket hook
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { autoConnect = true, onConnected, onDisconnected } = options;
  const { isAuthenticated } = useAuth();
  const [connected, setConnected] = useState(() => isConnected());

  const connect = useCallback(() => {
    const token = getAuthToken();
    if (token) {
      connectWebSocket(token);
    }
  }, []);

  const disconnect = useCallback(() => {
    disconnectWebSocket();
  }, []);

  useEffect(() => {
    if (!autoConnect || !isAuthenticated) return;

    const token = getAuthToken();
    if (token) {
      connectWebSocket(token);
    }

    const handleConnected = () => {
      setConnected(true);
      onConnected?.();
    };

    const handleDisconnected = () => {
      setConnected(false);
      onDisconnected?.();
    };

    window.addEventListener('ws:connected', handleConnected);
    window.addEventListener('ws:disconnected', handleDisconnected);

    return () => {
      window.removeEventListener('ws:connected', handleConnected);
      window.removeEventListener('ws:disconnected', handleDisconnected);
    };
  }, [autoConnect, isAuthenticated, onConnected, onDisconnected]);

  return {
    isConnected: connected,
    connect,
    disconnect,
  };
}

// Hook for real-time notifications
export function useNotifications(
  callback: (notification: NotificationEvent) => void
): void {
  const callbackRef = useRef(callback);
  const [socketConnected, setSocketConnected] = useState(() => isConnected());
  
  useEffect(() => {
    callbackRef.current = callback;
  });

  // Track connection state changes
  useEffect(() => {
    const handleConnected = () => setSocketConnected(true);
    const handleDisconnected = () => setSocketConnected(false);
    
    window.addEventListener('ws:connected', handleConnected);
    window.addEventListener('ws:disconnected', handleDisconnected);
    
    return () => {
      window.removeEventListener('ws:connected', handleConnected);
      window.removeEventListener('ws:disconnected', handleDisconnected);
    };
  }, []);

  // Subscribe when connected
  useEffect(() => {
    if (!socketConnected) return;
    
    const cleanup = onNotification((data) => {
      callbackRef.current(data);
    });

    return cleanup;
  }, [socketConnected]);
}

// Hook for price alerts
export function usePriceAlerts(
  callback: (alert: PriceAlertEvent) => void
): void {
  const callbackRef = useRef(callback);
  const [socketConnected, setSocketConnected] = useState(() => isConnected());
  
  useEffect(() => {
    callbackRef.current = callback;
  });

  // Track connection state changes
  useEffect(() => {
    const handleConnected = () => setSocketConnected(true);
    const handleDisconnected = () => setSocketConnected(false);
    
    window.addEventListener('ws:connected', handleConnected);
    window.addEventListener('ws:disconnected', handleDisconnected);
    
    return () => {
      window.removeEventListener('ws:connected', handleConnected);
      window.removeEventListener('ws:disconnected', handleDisconnected);
    };
  }, []);

  // Subscribe when connected
  useEffect(() => {
    if (!socketConnected) return;

    const cleanup = onPriceAlert((data) => {
      callbackRef.current(data);
    });

    return cleanup;
  }, [socketConnected]);
}

// Hook for order updates
export function useOrderUpdates(
  callback: (order: OrderUpdateEvent) => void
): void {
  const callbackRef = useRef(callback);
  const [socketConnected, setSocketConnected] = useState(() => isConnected());
  
  useEffect(() => {
    callbackRef.current = callback;
  });

  // Track connection state changes
  useEffect(() => {
    const handleConnected = () => setSocketConnected(true);
    const handleDisconnected = () => setSocketConnected(false);
    
    window.addEventListener('ws:connected', handleConnected);
    window.addEventListener('ws:disconnected', handleDisconnected);
    
    return () => {
      window.removeEventListener('ws:connected', handleConnected);
      window.removeEventListener('ws:disconnected', handleDisconnected);
    };
  }, []);

  // Subscribe when connected
  useEffect(() => {
    if (!socketConnected) return;

    const cleanup = onOrderUpdate((data) => {
      callbackRef.current(data);
    });

    return cleanup;
  }, [socketConnected]);
}

// Hook for balance updates
export function useBalanceUpdates(
  callback: (balance: BalanceUpdateEvent) => void
): void {
  const callbackRef = useRef(callback);
  const [socketConnected, setSocketConnected] = useState(() => isConnected());
  
  useEffect(() => {
    callbackRef.current = callback;
  });

  // Track connection state changes
  useEffect(() => {
    const handleConnected = () => setSocketConnected(true);
    const handleDisconnected = () => setSocketConnected(false);
    
    window.addEventListener('ws:connected', handleConnected);
    window.addEventListener('ws:disconnected', handleDisconnected);
    
    return () => {
      window.removeEventListener('ws:connected', handleConnected);
      window.removeEventListener('ws:disconnected', handleDisconnected);
    };
  }, []);

  // Subscribe when connected
  useEffect(() => {
    if (!socketConnected) return;

    const cleanup = onBalanceUpdate((data) => {
      callbackRef.current(data);
    });

    return cleanup;
  }, [socketConnected]);
}

// Hook for real-time price updates for specific symbol
export function useSymbolPrice(symbol: string): PriceUpdateEvent | null {
  const [price, setPrice] = useState<PriceUpdateEvent | null>(null);

  useEffect(() => {
    if (!symbol) return;

    const cleanup = onPriceUpdate(symbol, (data) => {
      setPrice(data);
    });

    return cleanup;
  }, [symbol]);

  return price;
}

// Hook for multiple symbol prices
export function useSymbolPrices(symbols: string[]): Record<string, PriceUpdateEvent> {
  const [prices, setPrices] = useState<Record<string, PriceUpdateEvent>>({});
  const symbolsKey = symbols.join(',');

  useEffect(() => {
    if (!symbols.length) return;

    // Subscribe to all symbols
    subscribeToSymbols(symbols);

    const cleanups: (() => void)[] = [];

    symbols.forEach((symbol) => {
      const cleanup = onPriceUpdate(symbol, (data) => {
        setPrices((prev) => ({
          ...prev,
          [symbol]: data,
        }));
      });
      cleanups.push(cleanup);
    });

    return () => {
      unsubscribeFromSymbols(symbols);
      cleanups.forEach((cleanup) => cleanup());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  return prices;
}

// Hook for connection status
export function useConnectionStatus(): 'connected' | 'connecting' | 'disconnected' {
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected'>(
    () => isConnected() ? 'connected' : 'disconnected'
  );

  useEffect(() => {
    const handleConnected = () => setStatus('connected');
    const handleDisconnected = () => setStatus('disconnected');

    window.addEventListener('ws:connected', handleConnected);
    window.addEventListener('ws:disconnected', handleDisconnected);

    return () => {
      window.removeEventListener('ws:connected', handleConnected);
      window.removeEventListener('ws:disconnected', handleDisconnected);
    };
  }, []);

  return status;
}

// ========== New Hooks for Real-time Trading Data ==========

// Hook for real-time ticker updates
export function useTicker(symbol: string | null): TickerUpdateEvent | null {
  const [ticker, setTicker] = useState<TickerUpdateEvent | null>(null);
  const [socketConnected, setSocketConnected] = useState(() => isConnected());

  // Track connection state
  useEffect(() => {
    const handleConnected = () => setSocketConnected(true);
    const handleDisconnected = () => setSocketConnected(false);
    
    window.addEventListener('ws:connected', handleConnected);
    window.addEventListener('ws:disconnected', handleDisconnected);
    
    return () => {
      window.removeEventListener('ws:connected', handleConnected);
      window.removeEventListener('ws:disconnected', handleDisconnected);
    };
  }, []);

  useEffect(() => {
    if (!symbol || !socketConnected) return;

    const upperSymbol = symbol.toUpperCase();
    
    // Subscribe to ticker
    subscribeToTicker(upperSymbol);

    // Listen for updates
    const cleanup = onTickerUpdate((data) => {
      if (data.symbol === upperSymbol) {
        setTicker(data);
      }
    });

    return () => {
      unsubscribeFromTicker(upperSymbol);
      cleanup();
    };
  }, [symbol, socketConnected]);

  return ticker;
}

// Hook for real-time order book updates
export function useOrderBook(symbol: string | null): OrderBookUpdateEvent | null {
  const [orderBook, setOrderBook] = useState<OrderBookUpdateEvent | null>(null);
  const [socketConnected, setSocketConnected] = useState(() => isConnected());

  // Track connection state
  useEffect(() => {
    const handleConnected = () => setSocketConnected(true);
    const handleDisconnected = () => setSocketConnected(false);
    
    window.addEventListener('ws:connected', handleConnected);
    window.addEventListener('ws:disconnected', handleDisconnected);
    
    return () => {
      window.removeEventListener('ws:connected', handleConnected);
      window.removeEventListener('ws:disconnected', handleDisconnected);
    };
  }, []);

  useEffect(() => {
    if (!symbol || !socketConnected) return;

    const upperSymbol = symbol.toUpperCase();

    // Subscribe to orderbook
    subscribeToOrderBook(upperSymbol);

    // Listen for updates
    const cleanup = onOrderBookUpdate((data) => {
      if (data.symbol === upperSymbol) {
        setOrderBook(data);
      }
    });

    return () => {
      unsubscribeFromOrderBook(upperSymbol);
      cleanup();
    };
  }, [symbol, socketConnected]);

  return orderBook;
}

// Hook for real-time trades updates
export function useTrades(symbol: string | null): TradesUpdateEvent | null {
  const [trades, setTrades] = useState<TradesUpdateEvent | null>(null);
  const [socketConnected, setSocketConnected] = useState(() => isConnected());

  // Track connection state
  useEffect(() => {
    const handleConnected = () => setSocketConnected(true);
    const handleDisconnected = () => setSocketConnected(false);
    
    window.addEventListener('ws:connected', handleConnected);
    window.addEventListener('ws:disconnected', handleDisconnected);
    
    return () => {
      window.removeEventListener('ws:connected', handleConnected);
      window.removeEventListener('ws:disconnected', handleDisconnected);
    };
  }, []);

  useEffect(() => {
    if (!symbol || !socketConnected) return;

    const upperSymbol = symbol.toUpperCase();

    // Subscribe to trades
    subscribeToTrades(upperSymbol);

    // Listen for updates
    const cleanup = onTradesUpdate((data) => {
      if (data.symbol === upperSymbol) {
        setTrades(data);
      }
    });

    return () => {
      unsubscribeFromTrades(upperSymbol);
      cleanup();
    };
  }, [symbol, socketConnected]);

  return trades;
}

// Hook for complete trading pair data (ticker + orderbook + trades)
export function useTradingPair(symbol: string | null) {
  const [data, setData] = useState<{
    ticker: TickerUpdateEvent | null;
    orderBook: OrderBookUpdateEvent | null;
    trades: TradesUpdateEvent | null;
  }>({
    ticker: null,
    orderBook: null,
    trades: null,
  });
  const [socketConnected, setSocketConnected] = useState(() => isConnected());

  // Track connection state
  useEffect(() => {
    const handleConnected = () => setSocketConnected(true);
    const handleDisconnected = () => setSocketConnected(false);
    
    window.addEventListener('ws:connected', handleConnected);
    window.addEventListener('ws:disconnected', handleDisconnected);
    
    return () => {
      window.removeEventListener('ws:connected', handleConnected);
      window.removeEventListener('ws:disconnected', handleDisconnected);
    };
  }, []);

  useEffect(() => {
    if (!symbol || !socketConnected) return;

    const upperSymbol = symbol.toUpperCase();

    // Subscribe to all channels
    subscribeToTradingPair(upperSymbol);

    // Listen for updates
    const cleanupTicker = onTickerUpdate((tickerData) => {
      if (tickerData.symbol === upperSymbol) {
        setData((prev) => ({ ...prev, ticker: tickerData }));
      }
    });

    const cleanupOrderBook = onOrderBookUpdate((orderBookData) => {
      if (orderBookData.symbol === upperSymbol) {
        setData((prev) => ({ ...prev, orderBook: orderBookData }));
      }
    });

    const cleanupTrades = onTradesUpdate((tradesData) => {
      if (tradesData.symbol === upperSymbol) {
        setData((prev) => ({ ...prev, trades: tradesData }));
      }
    });

    return () => {
      unsubscribeFromTradingPair(upperSymbol);
      cleanupTicker();
      cleanupOrderBook();
      cleanupTrades();
    };
  }, [symbol, socketConnected]);

  return data;
}

// Hook for user orders updates (private channel)
export function useUserOrders(callback?: (order: OrderUpdateEvent) => void) {
  const [latestOrder, setLatestOrder] = useState<OrderUpdateEvent | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const [socketConnected, setSocketConnected] = useState(() => isConnected());

  // Track connection state
  useEffect(() => {
    const handleConnected = () => setSocketConnected(true);
    const handleDisconnected = () => setSocketConnected(false);
    
    window.addEventListener('ws:connected', handleConnected);
    window.addEventListener('ws:disconnected', handleDisconnected);
    
    return () => {
      window.removeEventListener('ws:connected', handleConnected);
      window.removeEventListener('ws:disconnected', handleDisconnected);
    };
  }, []);

  useEffect(() => {
    if (!socketConnected) return;
    
    subscribeToOrders();

    const cleanup = onOrdersUpdate((order) => {
      setLatestOrder(order);
      callbackRef.current?.(order);
    });

    return cleanup;
  }, [socketConnected]);

  return latestOrder;
}

// Hook for user wallet updates (private channel)
export function useUserWallet(callback?: (balance: BalanceUpdateEvent) => void) {
  const [latestBalance, setLatestBalance] = useState<BalanceUpdateEvent | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const [socketConnected, setSocketConnected] = useState(() => isConnected());

  // Track connection state
  useEffect(() => {
    const handleConnected = () => setSocketConnected(true);
    const handleDisconnected = () => setSocketConnected(false);
    
    window.addEventListener('ws:connected', handleConnected);
    window.addEventListener('ws:disconnected', handleDisconnected);
    
    return () => {
      window.removeEventListener('ws:connected', handleConnected);
      window.removeEventListener('ws:disconnected', handleDisconnected);
    };
  }, []);

  useEffect(() => {
    if (!socketConnected) return;

    subscribeToWallet();

    const cleanup = onWalletUpdate((balance) => {
      setLatestBalance(balance);
      callbackRef.current?.(balance);
    });

    return cleanup;
  }, [socketConnected]);

  return latestBalance;
}

// Hook for user portfolio updates (private channel)
export function useUserPortfolio(callback?: (portfolio: PortfolioUpdateEvent) => void) {
  const [latestPortfolio, setLatestPortfolio] = useState<PortfolioUpdateEvent | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const [socketConnected, setSocketConnected] = useState(() => isConnected());

  // Track connection state
  useEffect(() => {
    const handleConnected = () => setSocketConnected(true);
    const handleDisconnected = () => setSocketConnected(false);
    
    window.addEventListener('ws:connected', handleConnected);
    window.addEventListener('ws:disconnected', handleDisconnected);
    
    return () => {
      window.removeEventListener('ws:connected', handleConnected);
      window.removeEventListener('ws:disconnected', handleDisconnected);
    };
  }, []);

  useEffect(() => {
    if (!socketConnected) return;

    subscribeToPortfolio();

    const cleanup = onPortfolioUpdate((portfolio) => {
      setLatestPortfolio(portfolio);
      callbackRef.current?.(portfolio);
    });

    return cleanup;
  }, [socketConnected]);

  return latestPortfolio;
}

// Hook to get real-time price with fallback
export function useRealtimePrice(symbol: string | null, fallbackPrice?: number) {
  const ticker = useTicker(symbol);
  
  return {
    price: ticker?.price ?? fallbackPrice ?? 0,
    change: ticker?.priceChange ?? 0,
    changePercent: ticker?.priceChangePercent ?? 0,
    high: ticker?.high ?? 0,
    low: ticker?.low ?? 0,
    volume: ticker?.volume ?? 0,
    isLive: ticker !== null,
    timestamp: ticker?.timestamp,
  };
}

// Hook to subscribe to user private channels
export function useUserChannels() {
  const { isAuthenticated } = useAuth();
  const [socketConnected, setSocketConnected] = useState(() => isConnected());

  // Track connection state
  useEffect(() => {
    const handleConnected = () => setSocketConnected(true);
    const handleDisconnected = () => setSocketConnected(false);
    
    window.addEventListener('ws:connected', handleConnected);
    window.addEventListener('ws:disconnected', handleDisconnected);
    
    return () => {
      window.removeEventListener('ws:connected', handleConnected);
      window.removeEventListener('ws:disconnected', handleDisconnected);
    };
  }, []);

  useEffect(() => {
    if (!socketConnected || !isAuthenticated) return;

    // Subscribe to all user private channels
    subscribeToUserChannels();
  }, [socketConnected, isAuthenticated]);
}
