"use client";

import { ChevronDown, Bell, User, Wallet, Settings, LogOut, Menu, X, Shield } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AuthModal from "./AuthModal";
import NotificationDropdown from "./NotificationDropdown";
import { ToastContainer, useToast } from "./Toast";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications, useWebSocket } from "@/hooks/useWebSocket";
import { getUnreadCount } from "@/services/notificationApi";
import { onPriceAlertCreated, onPriceAlert, onOrderUpdate, type PriceAlertCreatedEvent, type PriceAlertEvent, type OrderUpdateEvent } from "@/services/websocket";

export default function Header() {
  const { user, isAuthenticated, isLoading, totalBalance, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMarketsMenu, setShowMarketsMenu] = useState(false);
  const [showFuturesMenu, setShowFuturesMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasNewNotification, setHasNewNotification] = useState(false);
  
  // Toast hook
  const { toasts, removeToast, showAlert, showSuccess, showInfo } = useToast();

  // Connect WebSocket when authenticated
  useWebSocket({ autoConnect: isAuthenticated });

  // Listen for price alert created events
  useEffect(() => {
    if (!isAuthenticated) return;

    const handlePriceAlertCreated = (data: PriceAlertCreatedEvent) => {
      console.log('[Header] Price alert created:', data);
      showSuccess(
        '✅ Cảnh báo giá đã tạo',
        data.message || `Alert cho ${data.symbol} tại $${data.targetPrice}`
      );
    };

    const unsubscribe = onPriceAlertCreated(handlePriceAlertCreated);
    return () => unsubscribe();
  }, [isAuthenticated, showSuccess]);

  // Listen for price alert triggered events (when alert condition is met)
  useEffect(() => {
    if (!isAuthenticated) return;

    const handlePriceAlertTriggered = (data: PriceAlertEvent) => {
      console.log('[Header] Price alert triggered:', data);
      
      // Play notification sound
      if (typeof window !== 'undefined') {
        try {
          const audio = new Audio('/notification.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch (e) {
          // Ignore audio errors
        }
      }
      
      // Show toast notification
      const conditionText = data.condition === 'ABOVE' ? 'vượt lên trên' : 
                           data.condition === 'BELOW' ? 'xuống dưới' :
                           data.condition === 'CROSS_UP' ? 'cắt lên' : 'cắt xuống';
      
      showAlert(
        `🔔 Cảnh báo giá: ${data.symbol}`,
        `Giá ${conditionText} $${data.targetPrice}. Giá hiện tại: $${data.currentPrice.toFixed(2)}`
      );
      
      // Increment unread count
      setUnreadCount(prev => prev + 1);
      setHasNewNotification(true);
      setTimeout(() => setHasNewNotification(false), 5000);
      
      // Show browser notification
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(`🔔 Cảnh báo giá: ${data.symbol}`, {
          body: `Giá ${conditionText} $${data.targetPrice}. Giá hiện tại: $${data.currentPrice.toFixed(2)}`,
          icon: '/favicon.ico',
          tag: `price-alert-${data.alertId}`,
        });
      }
    };

    const unsubscribe = onPriceAlert(handlePriceAlertTriggered);
    return () => unsubscribe();
  }, [isAuthenticated, showAlert]);

  // Listen for order update events
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleOrderUpdate = (data: any) => {
      console.log('[Header] Order update received:', data);
      
      // Play notification sound
      if (typeof window !== 'undefined') {
        try {
          const audio = new Audio('/notification.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch (e) {
          // Ignore audio errors
        }
      }
      
      // Show toast and open dropdown
      const title = data.title || `Cập nhật lệnh: ${data.symbol}`;
      const message = data.message || `Lệnh ${data.side} ${data.symbol} - ${data.status}`;
      
      showSuccess(title, message);
      
      // Increment unread count (không mở dropdown)
      setUnreadCount(prev => prev + 1);
      setHasNewNotification(true);
      setTimeout(() => setHasNewNotification(false), 5000);
      
      // Show browser notification
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body: message,
          icon: '/favicon.ico',
          tag: `order-${data.orderId}`,
        });
      }
    };

    const unsubscribe = onOrderUpdate(handleOrderUpdate);
    return () => unsubscribe();
  }, [isAuthenticated, showSuccess]);

  // Listen for real-time notifications
  useNotifications((notification) => {
    console.log('[Header] New notification received:', notification);
    setUnreadCount((prev) => prev + 1);
    setHasNewNotification(true);
    
    // Lấy title và message với fallback
    const title = notification.title || 'Thông báo mới';
    const message = notification.message || (notification.data as Record<string, string>)?.message || '';
    
    // Chỉ hiển thị toast nếu có nội dung
    if (title || message) {
      if (notification.type === 'success') {
        showSuccess(title as string, message as string);
      } else if (notification.type === 'error') {
        showAlert(title as string, message as string);
      } else {
        showInfo(title as string, message as string);
      }
    }
    
    // Show browser notification if permitted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title as string, {
        body: message as string,
        icon: '/favicon.ico',
      });
    }
    
    // Auto-hide animation after 3 seconds
    setTimeout(() => setHasNewNotification(false), 3000);
  });

  // Function to fetch and show notifications
  const fetchAndShowNotifications = useCallback(() => {
    getUnreadCount().then((response) => {
      if (response.success && response.data) {
        const newCount = response.data.count;
        if (newCount > unreadCount) {
          setHasNewNotification(true);
          setTimeout(() => setHasNewNotification(false), 3000);
        }
        setUnreadCount(newCount);
      }
    });
  }, [unreadCount]);

  // Listen for custom event to refresh notifications immediately
  useEffect(() => {
    const handleRefreshNotifications = () => {
      console.log('[Header] Refresh notifications triggered');
      fetchAndShowNotifications();
    };

    window.addEventListener('refresh-notifications', handleRefreshNotifications);
    return () => window.removeEventListener('refresh-notifications', handleRefreshNotifications);
  }, [unreadCount]);

  // Fetch initial unread count and poll every 5 seconds for faster updates
  useEffect(() => {
    if (isAuthenticated) {
      fetchAndShowNotifications();
      
      // Poll every 5 seconds for faster notification updates
      const interval = setInterval(fetchAndShowNotifications, 5000);
      return () => clearInterval(interval);
    } else {
      // Reset count when logged out
      setUnreadCount(0);
    }
  }, [isAuthenticated]);

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
    // Redirect to home page after logout
    window.location.href = '/';
  };

  const openAuthModal = (mode: "login" | "register") => {
    setAuthMode(mode);
    setShowAuthModal(true);
    setShowMobileMenu(false);
  };

  const closeMenus = () => {
    setShowMarketsMenu(false);
    setShowFuturesMenu(false);
    setShowUserMenu(false);
    setShowNotifications(false);
  };
  
  return (
    <>
      {/* Toast Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
      
      <header className="bg-[#1e2329] border-b border-[#2b3139] px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Logo & Desktop Nav */}
        <div className="flex items-center gap-6">
          <Link href="/trade" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-500 rounded flex items-center justify-center">
              <span className="text-black font-bold text-sm">CT</span>
            </div>
            <span className="text-white font-bold text-lg hidden sm:block">CryptoTrade</span>
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/trade" className="text-yellow-500 hover:text-yellow-400 transition-colors font-medium">
              Trading
            </Link>
            
            {/* Markets Dropdown */}
            <div className="relative">
              <button 
                onClick={() => {
                  setShowMarketsMenu(!showMarketsMenu);
                  setShowFuturesMenu(false);
                }}
                className="text-gray-400 hover:text-white transition-colors flex items-center gap-1"
              >
                Markets <ChevronDown size={14} />
              </button>
              
              {showMarketsMenu && (
                <div className="absolute left-0 mt-2 w-56 bg-[#1e2329] border border-[#2b3139] rounded shadow-xl z-50">
                  <div className="py-1">
                    <Link href="/trade" onClick={closeMenus} className="flex items-center justify-between px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-[#2b3139]">
                      <span>Spot Trading</span>
                      <span className="text-xs text-green-500">Popular</span>
                    </Link>
                    <Link href="/alerts" onClick={closeMenus} className="flex items-center px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-[#2b3139]">
                      Price Alerts
                    </Link>
                    <div className="border-t border-[#2b3139] my-1"></div>
                    <Link href="/analytics" onClick={closeMenus} className="flex items-center px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-[#2b3139]">
                      Analytics
                    </Link>
                  </div>
                </div>
              )}
            </div>
            
            {/* Futures Dropdown */}
            <div className="relative">
              <button 
                onClick={() => {
                  setShowFuturesMenu(!showFuturesMenu);
                  setShowMarketsMenu(false);
                }}
                className="text-gray-400 hover:text-white transition-colors flex items-center gap-1"
              >
                Futures <ChevronDown size={14} />
              </button>
              
              {showFuturesMenu && (
                <div className="absolute left-0 mt-2 w-56 bg-[#1e2329] border border-[#2b3139] rounded shadow-xl z-50">
                  <div className="py-1">
                    <span className="flex items-center justify-between px-4 py-2.5 text-sm text-gray-400">
                      <span>USD-M Futures</span>
                      <span className="text-xs text-yellow-500">Coming Soon</span>
                    </span>
                    <span className="flex items-center px-4 py-2.5 text-sm text-gray-400">
                      COIN-M Futures
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            <Link href="/buy-crypto" className="text-gray-400 hover:text-white transition-colors">
              Buy Crypto
            </Link>
            <Link href="/sell-crypto" className="text-gray-400 hover:text-white transition-colors">
              Sell Crypto
            </Link>
            <Link href="/deposit" className="text-gray-400 hover:text-white transition-colors">
              Nạp tiền
            </Link>
            <Link href="/withdraw" className="text-gray-400 hover:text-white transition-colors">
              Rút tiền
            </Link>
            <Link href="/earn" className="text-gray-400 hover:text-white transition-colors">
              Earn
            </Link>
            <Link href="/wallet" className="text-gray-400 hover:text-white transition-colors">
              Wallet
            </Link>
          </nav>
        </div>

        {/* Desktop Right Side */}
        <div className="hidden md:flex items-center gap-4">
          {isLoading ? (
            /* Loading skeleton */
            <div className="flex items-center gap-4">
              <div className="w-24 h-8 bg-[#2b3139] rounded animate-pulse"></div>
              <div className="w-8 h-8 bg-[#2b3139] rounded animate-pulse"></div>
            </div>
          ) : isAuthenticated && user ? (
            <>
              {/* Wallet Info - Logged In */}
              <Link 
                href="/wallet"
                className="flex items-center gap-2 px-3 py-1.5 bg-[#2b3139] rounded hover:bg-[#3b4149] transition-colors"
              >
                <Wallet size={16} className="text-yellow-500" />
                <span className="text-white text-sm font-medium">
                  ${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </Link>

              {/* Notifications */}
              <div className="relative">
                <button 
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                    setHasNewNotification(false);
                  }}
                  className={`relative p-2 text-gray-400 hover:text-white hover:bg-[#2b3139] rounded transition-colors ${hasNewNotification ? 'animate-pulse' : ''}`}
                >
                  <Bell size={20} className={hasNewNotification ? 'text-yellow-500' : ''} />
                  {unreadCount > 0 && (
                    <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center text-[10px] text-white font-medium px-1 ${hasNewNotification ? 'animate-bounce' : ''}`}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
                
                {showNotifications && (
                  <NotificationDropdown 
                    onClose={() => setShowNotifications(false)} 
                    onUnreadCountChange={setUnreadCount}
                  />
                )}
              </div>

              {/* User Menu - Logged In */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 p-2 text-gray-400 hover:text-white hover:bg-[#2b3139] rounded transition-colors"
                >
                  <User size={20} />
                  <ChevronDown size={14} />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-[#1e2329] border border-[#2b3139] rounded shadow-xl z-50">
                    <div className="px-4 py-3 border-b border-[#2b3139]">
                      <div className="text-sm font-medium text-white">{user.email}</div>
                      <div className="text-xs text-gray-400 mt-1">{user.name}</div>
                    </div>
                    <div className="py-1">
                      <Link href="/profile" onClick={closeMenus} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-[#2b3139]">
                        <User size={16} />
                        Tài Khoản
                      </Link>
                      <Link href="/wallet" onClick={closeMenus} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-[#2b3139]">
                        <Wallet size={16} />
                        Ví
                      </Link>
                      <Link href="/settings" onClick={closeMenus} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-[#2b3139]">
                        <Settings size={16} />
                        Cài Đặt
                      </Link>
                      {(user.role === 'ADMIN' || user.email === 'admin@cryptoexchange.com') && (
                        <>
                          <div className="border-t border-[#2b3139] my-1"></div>
                          <Link href="/admin" onClick={closeMenus} className="flex items-center gap-2 px-4 py-2 text-sm text-yellow-500 hover:text-yellow-400 hover:bg-[#2b3139]">
                            <Shield size={16} />
                            Admin Panel
                          </Link>
                        </>
                      )}
                      <div className="border-t border-[#2b3139] my-1"></div>
                      <button 
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-[#2b3139] w-full text-left"
                      >
                        <LogOut size={16} />
                        Đăng Xuất
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Login/Register Buttons - Not Logged In */}
              <button
                onClick={() => openAuthModal("login")}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors font-medium"
              >
                Đăng Nhập
              </button>
              <button
                onClick={() => openAuthModal("register")}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black text-sm font-semibold rounded transition-colors"
              >
                Đăng Ký
              </button>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="md:hidden p-2 text-gray-400 hover:text-white"
        >
          {showMobileMenu ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {showMobileMenu && (
        <div className="md:hidden mt-4 pb-4 border-t border-[#2b3139] pt-4">
          <nav className="space-y-2">
            <Link href="/trade" onClick={() => setShowMobileMenu(false)} className="block px-4 py-2 text-yellow-500 hover:bg-[#2b3139] rounded">
              Trading
            </Link>
            <Link href="/buy-crypto" onClick={() => setShowMobileMenu(false)} className="block px-4 py-2 text-gray-400 hover:text-white hover:bg-[#2b3139] rounded">
              Buy Crypto
            </Link>
            <Link href="/sell-crypto" onClick={() => setShowMobileMenu(false)} className="block px-4 py-2 text-gray-400 hover:text-white hover:bg-[#2b3139] rounded">
              Sell Crypto
            </Link>
            <Link href="/deposit" onClick={() => setShowMobileMenu(false)} className="block px-4 py-2 text-gray-400 hover:text-white hover:bg-[#2b3139] rounded">
              Nạp tiền
            </Link>
            <Link href="/withdraw" onClick={() => setShowMobileMenu(false)} className="block px-4 py-2 text-gray-400 hover:text-white hover:bg-[#2b3139] rounded">
              Rút tiền
            </Link>
            <Link href="/earn" onClick={() => setShowMobileMenu(false)} className="block px-4 py-2 text-gray-400 hover:text-white hover:bg-[#2b3139] rounded">
              Earn
            </Link>
            <Link href="/wallet" onClick={() => setShowMobileMenu(false)} className="block px-4 py-2 text-gray-400 hover:text-white hover:bg-[#2b3139] rounded">
              Wallet
            </Link>
            <Link href="/alerts" onClick={() => setShowMobileMenu(false)} className="block px-4 py-2 text-gray-400 hover:text-white hover:bg-[#2b3139] rounded">
              Price Alerts
            </Link>
            <Link href="/analytics" onClick={() => setShowMobileMenu(false)} className="block px-4 py-2 text-gray-400 hover:text-white hover:bg-[#2b3139] rounded">
              Analytics
            </Link>
            
            <div className="border-t border-[#2b3139] my-2 pt-2">
              {isLoading ? (
                <div className="px-4">
                  <div className="w-full h-10 bg-[#2b3139] rounded animate-pulse"></div>
                </div>
              ) : isAuthenticated && user ? (
                <>
                  <Link href="/profile" onClick={() => setShowMobileMenu(false)} className="block px-4 py-2 text-gray-400 hover:text-white hover:bg-[#2b3139] rounded">
                    <User size={16} className="inline mr-2" /> Tài Khoản
                  </Link>
                  <Link href="/settings" onClick={() => setShowMobileMenu(false)} className="block px-4 py-2 text-gray-400 hover:text-white hover:bg-[#2b3139] rounded">
                    <Settings size={16} className="inline mr-2" /> Cài Đặt
                  </Link>
                  {(user.role === 'ADMIN' || user.email === 'admin@cryptoexchange.com') && (
                    <Link href="/admin" onClick={() => setShowMobileMenu(false)} className="block px-4 py-2 text-yellow-500 hover:text-yellow-400 hover:bg-[#2b3139] rounded">
                      <Shield size={16} className="inline mr-2" /> Admin Panel
                    </Link>
                  )}
                  <button 
                    onClick={() => { handleLogout(); setShowMobileMenu(false); }}
                    className="block w-full text-left px-4 py-2 text-red-500 hover:bg-[#2b3139] rounded"
                  >
                    <LogOut size={16} className="inline mr-2" /> Đăng Xuất
                  </button>
                </>
              ) : (
                <div className="flex gap-2 px-4">
                  <button
                    onClick={() => openAuthModal("login")}
                    className="flex-1 py-2 text-sm text-gray-400 hover:text-white border border-[#2b3139] rounded transition-colors"
                  >
                    Đăng Nhập
                  </button>
                  <button
                    onClick={() => openAuthModal("register")}
                    className="flex-1 py-2 bg-yellow-500 hover:bg-yellow-600 text-black text-sm font-semibold rounded transition-colors"
                  >
                    Đăng Ký
                  </button>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal
        key={`${authMode}-${showAuthModal}`}
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authMode}
      />
    </header>
    </>
  );
}
