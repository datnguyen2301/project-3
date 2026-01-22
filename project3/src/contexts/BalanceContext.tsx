"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { getBalances, type Balance } from "@/services/walletApi";
import { getAuthToken } from "@/services/authApi";

// Tỷ giá USD cho các loại tiền
const CRYPTO_USD_PRICES: { [key: string]: number } = {
  USDT: 1,
  USDC: 1,
  BTC: 95000,
  ETH: 3400,
  BNB: 720,
  SOL: 190,
  XRP: 2.3,
  ADA: 0.6,
  DOGE: 0.12,
  LTC: 90,
  VND: 0.00004,  // 1 VND = ~$0.00004 (tỷ giá ~25,000)
};

// Event names for balance updates
export const BALANCE_EVENTS = {
  UPDATED: 'balance-updated',
  DEPOSIT_SUCCESS: 'deposit-success',
  WITHDRAW_SUCCESS: 'withdraw-success',
  BUY_SUCCESS: 'buy-success',
  SELL_SUCCESS: 'sell-success',
  ORDER_PLACED: 'order-placed',
  ORDER_FILLED: 'order-filled',
  ORDER_CANCELLED: 'order-cancelled',
};

interface BalanceContextType {
  balances: Balance[];
  totalBalanceUSD: number;
  isLoading: boolean;
  lastUpdated: Date | null;
  getBalance: (asset: string) => Balance | undefined;
  getAvailableBalance: (asset: string) => number;
  getLockedBalance: (asset: string) => number;
  refreshBalances: () => Promise<void>;
  notifyBalanceChange: (eventType: string, details?: Record<string, unknown>) => void;
}

const BalanceContext = createContext<BalanceContextType | undefined>(undefined);

export function BalanceProvider({ children }: { children: ReactNode }) {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [totalBalanceUSD, setTotalBalanceUSD] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Calculate total balance in USD
  const calculateTotalUSD = useCallback((balanceList: Balance[]) => {
    if (!Array.isArray(balanceList)) return 0;
    
    let total = 0;
    for (const balance of balanceList) {
      const amount = balance.total || balance.free || 0;
      const usdPrice = CRYPTO_USD_PRICES[balance.asset] || 0;
      total += amount * usdPrice;
    }
    return total;
  }, []);

  // Refresh balances from API
  const refreshBalances = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      console.log('[Balance] No token, skipping refresh');
      return;
    }

    setIsLoading(true);
    try {
      console.log('[Balance] Refreshing balances...');
      const balanceList = await getBalances();
      console.log('[Balance] Got balances:', balanceList.length, 'items');
      
      setBalances(balanceList);
      setTotalBalanceUSD(calculateTotalUSD(balanceList));
      setLastUpdated(new Date());
      
      // Dispatch global event for any listeners
      window.dispatchEvent(new CustomEvent(BALANCE_EVENTS.UPDATED, {
        detail: { balances: balanceList }
      }));
    } catch (error) {
      console.error('[Balance] Error refreshing:', error);
    } finally {
      setIsLoading(false);
    }
  }, [calculateTotalUSD]);

  // Get balance for specific asset
  const getBalance = useCallback((asset: string): Balance | undefined => {
    return balances.find(b => b.asset.toUpperCase() === asset.toUpperCase());
  }, [balances]);

  // Get available (free) balance for an asset
  const getAvailableBalance = useCallback((asset: string): number => {
    const balance = getBalance(asset);
    return balance?.free || 0;
  }, [getBalance]);

  // Get locked balance for an asset
  const getLockedBalance = useCallback((asset: string): number => {
    const balance = getBalance(asset);
    return balance?.locked || 0;
  }, [getBalance]);

  // Notify balance change and refresh
  const notifyBalanceChange = useCallback((eventType: string, details?: Record<string, unknown>) => {
    console.log('[Balance] Notifying balance change:', eventType, details);
    
    // Dispatch specific event
    window.dispatchEvent(new CustomEvent(eventType, { detail: details }));
    
    // Auto refresh after short delay to let backend process
    setTimeout(() => {
      refreshBalances();
    }, 500);
  }, [refreshBalances]);

  // Initial load
  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      refreshBalances();
    }
  }, [refreshBalances]);

  // Listen for login/logout
  useEffect(() => {
    const handleLogin = () => {
      console.log('[Balance] Login detected, refreshing...');
      setTimeout(refreshBalances, 100);
    };

    const handleLogout = () => {
      console.log('[Balance] Logout detected, clearing...');
      setBalances([]);
      setTotalBalanceUSD(0);
      setLastUpdated(null);
    };

    window.addEventListener('user-logged-in', handleLogin);
    window.addEventListener('user-logged-out', handleLogout);
    
    return () => {
      window.removeEventListener('user-logged-in', handleLogin);
      window.removeEventListener('user-logged-out', handleLogout);
    };
  }, [refreshBalances]);

  // Auto refresh every 10 seconds if authenticated (faster for trading)
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    const interval = setInterval(() => {
      console.log('[Balance] Auto-refreshing...');
      refreshBalances();
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [refreshBalances]);

  const value: BalanceContextType = {
    balances,
    totalBalanceUSD,
    isLoading,
    lastUpdated,
    getBalance,
    getAvailableBalance,
    getLockedBalance,
    refreshBalances,
    notifyBalanceChange,
  };

  return (
    <BalanceContext.Provider value={value}>
      {children}
    </BalanceContext.Provider>
  );
}

export function useBalance() {
  const context = useContext(BalanceContext);
  if (context === undefined) {
    throw new Error('useBalance must be used within a BalanceProvider');
  }
  return context;
}

// Hook to get specific asset balance
export function useAssetBalance(asset: string) {
  const { getBalance, getAvailableBalance, getLockedBalance, isLoading, refreshBalances } = useBalance();
  
  return {
    balance: getBalance(asset),
    available: getAvailableBalance(asset),
    locked: getLockedBalance(asset),
    isLoading,
    refresh: refreshBalances,
  };
}
