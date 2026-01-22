"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, Plus, Trash2, TrendingUp, TrendingDown, Check, X, Loader2, AlertCircle, Wifi, WifiOff } from "lucide-react";
import Header from "@/components/Header";
import { 
  getAlerts, 
  createAlert, 
  deleteAlert, 
  toggleAlert,
  type PriceAlert,
  type AlertCondition 
} from "@/services/alertsApi";
import { getCurrentPrice } from "@/services/binanceApi";
import { getNotifications, deleteNotification } from "@/services/notificationApi";
import { useWebSocket, usePriceAlerts, useNotifications, useConnectionStatus } from "@/hooks/useWebSocket";
import type { PriceAlertEvent, NotificationEvent } from "@/services/websocket";

export default function PriceAlertsPage() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({});
  const [newAlert, setNewAlert] = useState({
    symbol: "BTCUSDT",
    targetPrice: "",
    condition: "above" as AlertCondition,
    note: "",
  });
  
  // Track which alerts have been triggered (to only notify once per session)
  const triggeredAlertsRef = useRef<Set<string>>(new Set());
  
  // Ref for alerts to use in callbacks without stale closure
  const alertsRef = useRef<PriceAlert[]>(alerts);
  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);
  
  // WebSocket connection status
  const connectionStatus = useConnectionStatus();
  
  // Initialize WebSocket connection
  useWebSocket({ autoConnect: true });

  // Fetch alerts from backend
  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAlerts();
      console.log('[Alerts] Fetched alerts:', data);
      setAlerts(data);
      // Mark already triggered alerts
      data.forEach(alert => {
        if (alert.triggered || alert.triggeredAt) {
          triggeredAlertsRef.current.add(alert.id);
        }
      });
    } catch (err) {
      console.error('[Alerts] Error fetching alerts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Show notification for triggered alert
  const showAlertNotification = useCallback((event: PriceAlertEvent) => {
    const conditionText = event.condition === 'ABOVE' || event.condition === 'above' 
      ? 'đã vượt lên' : 'đã giảm xuống';
    const title = `🔔 Cảnh Báo Giá: ${event.symbol.replace('USDT', '/USDT')}`;
    const body = `Giá ${conditionText} $${event.targetPrice.toLocaleString()}! Giá hiện tại: $${event.currentPrice.toLocaleString()}`;

    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    }

    // Also show in-app toast/alert
    // Find the alert to get the note (use ref to avoid stale closure)
    const alertData = alertsRef.current.find(a => a.id === event.alertId);
    if (alertData?.note) {
      window.alert(`${title}\n${body}\n\nGhi chú: ${alertData.note}`);
    } else {
      window.alert(`${title}\n${body}`);
    }
  }, []);

  // Listen for real-time price alert events from backend
  usePriceAlerts(useCallback((event: PriceAlertEvent) => {
    console.log('[Alerts] Received price alert event:', event);
    
    // Update alert as triggered
    setAlerts(prev => prev.map(a => 
      a.id === event.alertId 
        ? { ...a, triggered: true, triggeredAt: new Date().toISOString() } 
        : a
    ));
    
    // Show notification if not already shown
    if (!triggeredAlertsRef.current.has(event.alertId)) {
      triggeredAlertsRef.current.add(event.alertId);
      showAlertNotification(event);
    }
  }, [showAlertNotification]));

  // Listen for all notifications (including price alerts)
  useNotifications(useCallback((notification: NotificationEvent) => {
    console.log('[Alerts] Received notification:', notification);
    
    // If it's a price alert notification, show it
    if (notification.type === 'PRICE_ALERT' || notification.type === 'price_alert') {
      // Browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, { 
          body: notification.message, 
          icon: '/favicon.ico' 
        });
      }
      
      // Refresh alerts list to get updated state
      fetchAlerts();
    }
  }, [fetchAlerts]));

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Fetch current price when changing symbol in form
  useEffect(() => {
    if (showAddForm && newAlert.symbol) {
      getCurrentPrice(newAlert.symbol).then(price => {
        if (price) {
          setCurrentPrices(prev => ({ ...prev, [newAlert.symbol]: price }));
        }
      });
    }
  }, [showAddForm, newAlert.symbol]);

  const handleAddAlert = async () => {
    if (!newAlert.targetPrice) return;

    setSubmitting(true);
    setError("");

    try {
      const created = await createAlert({
        symbol: newAlert.symbol,
        targetPrice: parseFloat(newAlert.targetPrice),
        condition: newAlert.condition,
        note: newAlert.note || undefined,
      });
      setAlerts([created, ...alerts]);
      setNewAlert({ symbol: "BTCUSDT", targetPrice: "", condition: "above", note: "" });
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create alert');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAlert = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa cảnh báo này?")) return;
    
    // Lấy thông tin alert trước khi xóa
    const alertToDelete = alerts.find(a => a.id === id);
    
    try {
      await deleteAlert(id);
      setAlerts(alerts.filter(a => a.id !== id));
      
      // Xóa các notification liên quan đến alert này
      if (alertToDelete) {
        try {
          const notifResponse = await getNotifications();
          if (notifResponse.success && notifResponse.data?.notifications) {
            // Tìm và xóa các notification có liên quan đến alert
            const relatedNotifs = notifResponse.data.notifications.filter(
              (n: { message?: string }) => n.message?.includes(alertToDelete.symbol) && 
                   n.message?.includes(String(alertToDelete.targetPrice))
            );
            for (const notif of relatedNotifs) {
              await deleteNotification(notif.id);
            }
          }
        } catch (e) {
          console.log('Could not delete related notifications:', e);
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete alert');
    }
  };

  const handleToggleAlert = async (id: string) => {
    try {
      const updated = await toggleAlert(id);
      setAlerts(alerts.map(a => a.id === id ? updated : a));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle alert');
    }
  };

  // Backend có thể không có field active, mặc định là true
  const activeAlerts = alerts.filter(a => (a.active !== false) && !a.triggeredAt);
  const triggeredAlerts = alerts.filter(a => a.triggeredAt);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0e11] text-white">
        <Header />
        <div className="flex items-center justify-center h-96">
          <Loader2 size={32} className="animate-spin text-yellow-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Cảnh Báo Giá</h1>
            <p className="text-gray-400">
              Nhận thông báo khi giá crypto đạt mức mong muốn
            </p>
            {/* WebSocket Connection Status */}
            <div className="flex items-center gap-2 mt-2">
              {connectionStatus === 'connected' ? (
                <>
                  <Wifi size={14} className="text-green-500" />
                  <span className="text-xs text-green-500">Real-time đang hoạt động</span>
                </>
              ) : connectionStatus === 'connecting' ? (
                <>
                  <Loader2 size={14} className="text-yellow-500 animate-spin" />
                  <span className="text-xs text-yellow-500">Đang kết nối...</span>
                </>
              ) : (
                <>
                  <WifiOff size={14} className="text-red-500" />
                  <span className="text-xs text-red-500">Mất kết nối real-time</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-black font-medium px-6 py-3 rounded transition-colors"
          >
            {showAddForm ? <X size={20} /> : <Plus size={20} />}
            {showAddForm ? "Hủy" : "Thêm Cảnh Báo"}
          </button>
        </div>

        {/* Add Alert Form */}
        {showAddForm && (
          <div className="bg-[#181a20] rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Tạo Cảnh Báo Mới</h3>
            
            {/* Current Price Display */}
            {currentPrices[newAlert.symbol] && (
              <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <span className="text-sm text-gray-400">Giá hiện tại của {newAlert.symbol.replace('USDT', '/USDT')}: </span>
                <span className="text-lg font-bold text-yellow-500">
                  ${currentPrices[newAlert.symbol]?.toLocaleString()}
                </span>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Cặp Giao Dịch</label>
                <select
                  value={newAlert.symbol}
                  onChange={(e) => setNewAlert({ ...newAlert, symbol: e.target.value })}
                  className="w-full bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139] focus:outline-none focus:border-yellow-500"
                >
                  <option value="BTCUSDT">BTC/USDT</option>
                  <option value="ETHUSDT">ETH/USDT</option>
                  <option value="BNBUSDT">BNB/USDT</option>
                  <option value="ADAUSDT">ADA/USDT</option>
                  <option value="SOLUSDT">SOL/USDT</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Điều Kiện</label>
                <select
                  value={newAlert.condition}
                  onChange={(e) => setNewAlert({ ...newAlert, condition: e.target.value as AlertCondition })}
                  className="w-full bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139] focus:outline-none focus:border-yellow-500"
                >
                  <option value="above">Giá cao hơn</option>
                  <option value="below">Giá thấp hơn</option>
                  <option value="cross_up">Vượt lên trên</option>
                  <option value="cross_down">Vượt xuống dưới</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Giá Mục Tiêu</label>
                <input
                  type="number"
                  value={newAlert.targetPrice}
                  onChange={(e) => setNewAlert({ ...newAlert, targetPrice: e.target.value })}
                  placeholder={currentPrices[newAlert.symbol] ? `VD: ${Math.round(currentPrices[newAlert.symbol] * 0.95)}` : "0.00"}
                  className="w-full bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139] focus:outline-none focus:border-yellow-500"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm text-gray-400 mb-2">Ghi Chú (Tùy chọn)</label>
              <input
                type="text"
                value={newAlert.note}
                onChange={(e) => setNewAlert({ ...newAlert, note: e.target.value })}
                placeholder="VD: Mua vào khi giá giảm..."
                className="w-full bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139] focus:outline-none focus:border-yellow-500"
              />
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2 text-red-500 text-sm">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button
              onClick={handleAddAlert}
              disabled={!newAlert.targetPrice || submitting}
              className="mt-4 flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-black font-medium px-6 py-2 rounded transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {submitting ? "Đang tạo..." : "Tạo Cảnh Báo"}
            </button>
          </div>
        )}

        {/* Active Alerts */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            Cảnh Báo Hoạt Động ({activeAlerts.length})
          </h2>
          
          {activeAlerts.length === 0 ? (
            <div className="bg-[#181a20] rounded-lg p-12 text-center">
              <Bell size={48} className="mx-auto text-gray-600 mb-4" />
              <p className="text-gray-400">Chưa có cảnh báo nào hoạt động</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeAlerts.map((alert) => {
                return (
                  <div key={alert.id} className="bg-[#181a20] rounded-lg p-5 border border-[#2b3139]">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">{alert.symbol.replace("USDT", "")}</span>
                        <span className="text-xs text-gray-400">/USDT</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleAlert(alert.id)}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            alert.active 
                              ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30' 
                              : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                          }`}
                        >
                          {alert.active ? 'ON' : 'OFF'}
                        </button>
                        <button
                          onClick={() => handleDeleteAlert(alert.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Điều kiện:</span>
                        <div className="flex items-center gap-2">
                          {(alert.condition === "above" || alert.condition === "cross_up") ? (
                            <TrendingUp size={16} className="text-green-500" />
                          ) : (alert.condition === "below" || alert.condition === "cross_down") ? (
                            <TrendingDown size={16} className="text-red-500" />
                          ) : (
                            <Bell size={16} className="text-yellow-500" />
                          )}
                          <span className="font-medium">
                            {alert.condition === "above" ? "Cao hơn" : 
                             alert.condition === "below" ? "Thấp hơn" : 
                             alert.condition === "cross_up" ? "Vượt lên" : 
                             alert.condition === "cross_down" ? "Vượt xuống" : ""} ${Number(alert.targetPrice).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {alert.note && (
                        <div className="text-sm text-gray-400 italic">
                          &quot;{alert.note}&quot;
                        </div>
                      )}

                      <div className="text-[10px] text-gray-500 pt-2">
                        Tạo: {new Date(alert.createdAt).toLocaleString("vi-VN")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Triggered Alerts */}
        {triggeredAlerts.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">
              Đã Kích Hoạt ({triggeredAlerts.length})
            </h2>
            
            <div className="space-y-3">
              {triggeredAlerts.map((alert) => (
                <div key={alert.id} className="bg-[#181a20] rounded-lg p-4 flex items-center justify-between opacity-60">
                  <div className="flex items-center gap-4" suppressHydrationWarning>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      (alert.condition === "above" || alert.condition === "cross_up") ? "bg-green-500/20" : "bg-red-500/20"
                    }`}>
                      {(alert.condition === "above" || alert.condition === "cross_up") ? (
                        <TrendingUp className="text-green-500" size={20} />
                      ) : (
                        <TrendingDown className="text-red-500" size={20} />
                      )}
                    </div>
                    
                    <div>
                      <div className="font-medium">
                        {alert.symbol.replace("USDT", "")} {
                          alert.condition === "above" ? "cao hơn" : 
                          alert.condition === "below" ? "thấp hơn" : 
                          alert.condition === "cross_up" ? "vượt lên" : 
                          alert.condition === "cross_down" ? "vượt xuống" : ""
                        } ${Number(alert.targetPrice).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-400">
                        Kích hoạt: {alert.triggeredAt && new Date(alert.triggeredAt).toLocaleString("vi-VN")}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteAlert(alert.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
