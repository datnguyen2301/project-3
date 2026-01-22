"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { 
  getUser, 
  getAuthToken, 
  setAuthToken, 
  setRefreshToken,
  removeAuthToken,
  logout as apiLogout,
  type User 
} from "@/services/authApi";
import { getBalances, type Balance } from "@/services/walletApi";
import { connectWebSocket, disconnectWebSocket } from "@/services/websocket";
import { setLastLoginTime } from "@/services/apiHelper";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  balances: Balance[];
  totalBalance: number;
  login: (user: User, token: string, refreshToken: string) => void;
  logout: () => void;
  refreshBalances: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // Calculate total balance in USD
  const calculateTotalBalance = useCallback((balanceList: Balance[]) => {
    // Tỷ giá ước tính USD cho các crypto chính
    const CRYPTO_USD_PRICES: { [key: string]: number } = {
      USDT: 1,
      USDC: 1,
      BTC: 43000,  // Cập nhật giá ước tính
      ETH: 3300,
      BNB: 720,
      SOL: 190,
      XRP: 2.3,
      ADA: 0.6,
      DOGE: 0.12,
      LTC: 90,
      VND: 0.00004,  // 1 VND = ~$0.00004 (tỷ giá ~25,000)
    };
    // Đảm bảo balanceList là array
    if (!Array.isArray(balanceList)) {
      return 0;
    }
    
    let total = 0;
    for (const balance of balanceList) {
      const amount = balance.total || balance.free || 0;
      const usdPrice = CRYPTO_USD_PRICES[balance.asset] || 0;
      const usdValue = amount * usdPrice;
      total += usdValue;
    }
    
    return total;
  }, []);

  // Refresh balances from API
  const refreshBalances = useCallback(async () => {
    try {
      const balanceList = await getBalances();
      setBalances(balanceList);
      const calculatedTotal = calculateTotalBalance(balanceList);
      setTotalBalance(calculatedTotal);
    } catch (error) {
      console.error('[Auth] Error refreshing balances:', error);
    }
  }, [calculateTotalBalance]);

  // Initialize auth state on mount
  useEffect(() => {
    let mounted = true;
    
    const initAuth = async () => {
      const token = getAuthToken();
      if (token) {
        const userData = getUser();
        if (userData && mounted) {
          setUser(userData);
          // Connect WebSocket with token
          connectWebSocket(token);
          // Load balances
          await refreshBalances();
        }
      }
      if (mounted) {
        setIsLoading(false);
        setIsMounted(true);
      }
    };

    initAuth();

    // Cleanup WebSocket on unmount
    return () => {
      mounted = false;
      disconnectWebSocket();
    };
  }, [refreshBalances]);

  // Listen for session expired events
  useEffect(() => {
    const handleSessionExpired = () => {
      console.log('Session expired - logging out');
      apiLogout();
      setUser(null);
      setBalances([]);
      setTotalBalance(0);
      disconnectWebSocket();
      // Show alert and redirect to home page
      if (typeof window !== 'undefined') {
        alert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        window.location.href = '/';
      }
    };

    const handleAuthFailed = () => {
      console.log('Auth failed - logging out');
      apiLogout();
      setUser(null);
      setBalances([]);
      setTotalBalance(0);
      disconnectWebSocket();
      // Show alert and redirect
      if (typeof window !== 'undefined') {
        alert('Xác thực thất bại. Vui lòng đăng nhập lại.');
        window.location.href = '/';
      }
    };

    window.addEventListener('session-expired', handleSessionExpired);
    window.addEventListener('auth-failed', handleAuthFailed);
    return () => {
      window.removeEventListener('session-expired', handleSessionExpired);
      window.removeEventListener('auth-failed', handleAuthFailed);
    };
  }, []);

  // Login handler
  const login = useCallback((userData: User, token: string, refreshToken: string) => {
    // Mark login time to prevent immediate session-expired
    setLastLoginTime();
    
    // Chỉ lưu token nếu hợp lệ
    if (token && token !== 'undefined' && token !== 'null') {
      setAuthToken(token);
    } else {
      console.error('[AuthContext] Invalid token received:', token);
    }
    
    if (refreshToken && refreshToken !== 'undefined' && refreshToken !== 'null') {
      setRefreshToken(refreshToken);
    }
    
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    
    // Connect WebSocket
    connectWebSocket(token);
    
    // Dispatch login event for BalanceContext
    window.dispatchEvent(new CustomEvent('user-logged-in'));
    
    // Load balances after a small delay to ensure tokens are saved
    setTimeout(() => {
      refreshBalances();
    }, 100);
  }, [refreshBalances]);

  // Logout handler
  const logout = useCallback(() => {
    apiLogout();
    removeAuthToken(); // Clear localStorage tokens
    setUser(null);
    setBalances([]);
    setTotalBalance(0);
    disconnectWebSocket();
    
    // Dispatch logout event for BalanceContext
    window.dispatchEvent(new CustomEvent('user-logged-out'));
  }, []);

  // Update user data
  const updateUser = useCallback((userData: User) => {
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading: !isMounted || isLoading,
    balances,
    totalBalance,
    login,
    logout,
    refreshBalances,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
