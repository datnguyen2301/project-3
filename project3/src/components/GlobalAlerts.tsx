"use client";

import { useEffect, useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWebSocket } from "@/hooks/useWebSocket";
import { 
  onPriceAlert, 
  onPriceAlertCreated, 
  onNotification,
  type PriceAlertEvent, 
  type PriceAlertCreatedEvent,
  type NotificationEvent 
} from "@/services/websocket";
import { ToastContainer, useToast } from "./Toast";

interface GlobalAlertsProps {
  children: React.ReactNode;
}

export default function GlobalAlerts({ children }: GlobalAlertsProps) {
  const { isAuthenticated } = useAuth();
  const { toasts, removeToast, showAlert, showSuccess, showInfo, showWarning } = useToast();
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // Connect WebSocket when authenticated
  useWebSocket({ autoConnect: isAuthenticated });

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const currentPermission = Notification.permission;
      
      if (currentPermission === 'default') {
        Notification.requestPermission().then((permission) => {
          setNotificationPermission(permission);
        });
      } else {
        // Use a timeout to avoid setState during render
        const timer = setTimeout(() => {
          setNotificationPermission(currentPermission);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        const audio = new Audio('/notification.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {
          // Fallback to beep if audio file not found
          const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.frequency.value = 800;
          oscillator.type = 'sine';
          gainNode.gain.value = 0.3;
          oscillator.start();
          setTimeout(() => oscillator.stop(), 200);
        });
      } catch {
        // Ignore audio errors
      }
    }
  }, []);

  // Show browser notification
  const showBrowserNotification = useCallback((title: string, body: string, tag?: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window && notificationPermission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: tag || `notification-${Date.now()}`,
        requireInteraction: true,
      });
    }
  }, [notificationPermission]);

  // Listen for price alert TRIGGERED events (when condition is met)
  useEffect(() => {
    if (!isAuthenticated) return;

    const handlePriceAlertTriggered = (data: PriceAlertEvent) => {
      console.log('[GlobalAlerts] 🔔 Price alert triggered:', data);
      
      // Play sound
      playNotificationSound();
      
      // Format condition text
      const conditionText = data.condition === 'ABOVE' ? 'vượt lên trên' : 
                           data.condition === 'BELOW' ? 'xuống dưới' :
                           data.condition === 'CROSS_UP' ? 'cắt lên' : 'cắt xuống';
      
      const title = `🔔 Cảnh báo giá: ${data.symbol}`;
      const message = `Giá ${conditionText} $${data.targetPrice}. Giá hiện tại: $${data.currentPrice.toFixed(2)}`;
      
      // Show toast
      showWarning(title, message);
      
      // Show browser notification
      showBrowserNotification(title, message, `price-alert-${data.alertId}`);
      
      // Dispatch event for other components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('price-alert-triggered', { detail: data }));
      }
    };

    const unsubscribe = onPriceAlert(handlePriceAlertTriggered);
    return () => unsubscribe();
  }, [isAuthenticated, showWarning, playNotificationSound, showBrowserNotification]);

  // Listen for price alert CREATED events
  useEffect(() => {
    if (!isAuthenticated) return;

    const handlePriceAlertCreated = (data: PriceAlertCreatedEvent) => {
      console.log('[GlobalAlerts] ✅ Price alert created:', data);
      
      const title = '✅ Cảnh báo giá đã tạo';
      const message = data.message || `Alert cho ${data.symbol} tại $${data.targetPrice}`;
      
      showSuccess(title, message);
    };

    const unsubscribe = onPriceAlertCreated(handlePriceAlertCreated);
    return () => unsubscribe();
  }, [isAuthenticated, showSuccess]);

  // Listen for general notifications
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleNotification = (data: NotificationEvent) => {
      console.log('[GlobalAlerts] 📢 Notification received:', data);
      
      const title = data.title || 'Thông báo';
      const message = data.message || '';
      
      // Determine toast type
      switch (data.type) {
        case 'success':
          showSuccess(title, message);
          break;
        case 'error':
          showAlert(title, message);
          break;
        case 'warning':
          showWarning(title, message);
          break;
        default:
          showInfo(title, message);
      }
      
      // Play sound for important notifications
      if (data.type === 'success' || data.type === 'warning') {
        playNotificationSound();
      }
      
      // Show browser notification
      showBrowserNotification(title, message);
    };

    const unsubscribe = onNotification(handleNotification);
    return () => unsubscribe();
  }, [isAuthenticated, showSuccess, showAlert, showWarning, showInfo, playNotificationSound, showBrowserNotification]);

  return (
    <>
      {/* Global Toast Container - always visible */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
      
      {children}
    </>
  );
}
