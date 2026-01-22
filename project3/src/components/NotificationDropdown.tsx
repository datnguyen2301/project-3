"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertCircle, CheckCircle, Bell, X, Settings } from "lucide-react";
import Link from "next/link";
import { getNotifications, markAsRead, markAllAsRead, deleteNotification, type Notification } from "@/services/notificationApi";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications as useNotificationsHook } from "@/hooks/useWebSocket";
import { type NotificationEvent } from "@/services/websocket";

interface NotificationDropdownProps {
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

export default function NotificationDropdown({ onClose, onUnreadCountChange }: NotificationDropdownProps) {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getNotifications();
      if (response.success && response.data) {
        setNotifications(response.data.notifications);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle real-time notifications via hook
  const handleNewNotification = useCallback((event: NotificationEvent) => {
    // Validate event has required id
    if (!event.id) {
      console.warn('[NotificationDropdown] Received notification without id:', event);
      return;
    }
    
    const newNotification: Notification = {
      id: event.id,
      type: event.type as Notification["type"],
      title: event.title,
      message: event.message,
      read: false,
      createdAt: event.createdAt,
    };
    setNotifications(prev => [newNotification, ...prev]);
    // Note: Header already handles incrementing unreadCount via its own useNotifications hook
  }, []);

  // Subscribe to real-time notifications using the proper hook
  useNotificationsHook(handleNewNotification);

  // Load notifications mỗi khi mở dropdown
  useEffect(() => {
    if (!isAuthenticated) return;
    loadNotifications();
  }, [isAuthenticated, loadNotifications]);

  // Cập nhật unread count sau khi load xong (tách riêng để tránh lỗi setState)
  useEffect(() => {
    if (notifications.length > 0 && onUnreadCountChange) {
      const unreadCount = notifications.filter(n => !n.read).length;
      // Dùng setTimeout để tránh setState during render
      setTimeout(() => {
        onUnreadCountChange(unreadCount);
      }, 0);
    }
  }, [notifications, onUnreadCountChange]);

  const handleMarkAsRead = async (id: string) => {
    // Validate id before calling API
    if (!id || id === 'undefined') {
      console.warn('[NotificationDropdown] Invalid notification id:', id);
      return;
    }
    
    const response = await markAsRead(id);
    if (response.success) {
      setNotifications(prev => prev.map(n => 
        n.id === id ? { ...n, read: true } : n
      ));
      // Update badge count from response
      if (response.data && onUnreadCountChange) {
        setTimeout(() => onUnreadCountChange((response.data as { unreadCount: number }).unreadCount), 0);
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    const response = await markAllAsRead();
    if (response.success) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      // Update badge count from response
      if (onUnreadCountChange) {
        setTimeout(() => onUnreadCountChange(response.data?.unreadCount ?? 0), 0);
      }
    }
  };

  const handleDeleteNotification = async (id: string) => {
    const success = await deleteNotification(id);
    if (success) {
      setNotifications(prev => {
        const updated = prev.filter(n => n.id !== id);
        // Cập nhật unread count - dùng setTimeout để tránh lỗi React
        if (onUnreadCountChange) {
          const unreadCount = updated.filter(n => !n.read).length;
          setTimeout(() => onUnreadCountChange(unreadCount), 0);
        }
        return updated;
      });
    }
  };
  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle size={20} className="text-green-500" />;
      case "warning":
        return <AlertCircle size={20} className="text-yellow-500" />;
      case "error":
        return <X size={20} className="text-red-500" />;
      default:
        return <Bell size={20} className="text-blue-500" />;
    }
  };

  const getBgColor = (type: Notification["type"], read: boolean) => {
    if (!read) return "bg-[#2b3139]";
    switch (type) {
      case "success":
        return "bg-green-500/5";
      case "warning":
        return "bg-yellow-500/5";
      case "error":
        return "bg-red-500/5";
      default:
        return "bg-[#1e2329]";
    }
  };

  const filteredNotifications = filter === "all" 
    ? notifications 
    : notifications.filter(n => !n.read);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="absolute right-0 mt-2 w-96 bg-[#1e2329] border border-[#2b3139] rounded-lg shadow-2xl z-50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2b3139]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Bell size={18} />
            Thông Báo
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              filter === "all"
                ? "bg-yellow-500 text-black"
                : "bg-[#2b3139] text-gray-400 hover:text-white"
            }`}
          >
            Tất Cả ({notifications.length})
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              filter === "unread"
                ? "bg-yellow-500 text-black"
                : "bg-[#2b3139] text-gray-400 hover:text-white"
            }`}
          >
            Chưa Đọc ({unreadCount})
          </button>
          
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="ml-auto text-xs text-yellow-500 hover:text-yellow-400"
            >
              Đánh dấu tất cả
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="py-12 text-center text-gray-400">Loading...</div>
        ) : filteredNotifications.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <Bell size={48} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">Không có thông báo mới</p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => handleMarkAsRead(notification.id)}
              className={`px-4 py-3 border-b border-[#2b3139] hover:bg-[#2b3139] cursor-pointer transition-colors ${
                !notification.read ? "border-l-2 border-l-yellow-500" : ""
              } ${getBgColor(notification.type, notification.read)}`}
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  {getIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium text-white">{notification.title}</h4>
                    <div className="flex items-center gap-2 shrink-0">
                      {!notification.read && (
                        <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNotification(notification.id);
                        }}
                        className="text-gray-500 hover:text-red-500 transition-colors"
                        title="Xóa thông báo"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-2">
                    {new Date(notification.createdAt).toLocaleString("vi-VN")}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#2b3139] flex items-center justify-between">
        <Link 
          href="/settings" 
          onClick={onClose}
          className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
        >
          <Settings size={14} />
          Cài đặt thông báo
        </Link>
        <Link 
          href="/alerts" 
          onClick={onClose}
          className="text-xs text-yellow-500 hover:text-yellow-400 transition-colors"
        >
          Xem tất cả
        </Link>
      </div>
    </div>
  );
}
