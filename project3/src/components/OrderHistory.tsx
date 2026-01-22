"use client";

import { useState, useEffect } from "react";
import { Clock, X, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { getOrderHistory, cancelOrder, type Order } from "@/services/ordersApi";
import { isAuthenticated } from "@/services/authApi";

export default function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'completed' | 'cancelled'>('all');
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  const loadOrders = async () => {
    setIsLoading(true);
    const data = await getOrderHistory({ limit: 50 });
    setOrders(data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated()) {
      queueMicrotask(() => {
        loadOrders();
      });
      // Refresh every 10 seconds
      const interval = setInterval(loadOrders, 10000);
      return () => clearInterval(interval);
    } else {
      queueMicrotask(() => {
        setIsLoading(false);
      });
    }
  }, []);

  const handleCancelOrder = async (orderId: string) => {
    setCancellingOrderId(orderId);
    const result = await cancelOrder(orderId);
    
    if (result.success) {
      await loadOrders();
    }
    
    setCancellingOrderId(null);
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    if (filter === 'open') return order.status === 'PENDING' || order.status === 'PARTIALLY_FILLED';
    if (filter === 'completed') return order.status === 'FILLED';
    if (filter === 'cancelled') return order.status === 'CANCELLED';
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'FILLED':
        return 'text-green-500';
      case 'CANCELLED':
        return 'text-red-500';
      case 'PARTIALLY_FILLED':
        return 'text-yellow-500';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'FILLED':
        return 'Đã khớp';
      case 'CANCELLED':
        return 'Đã hủy';
      case 'PARTIALLY_FILLED':
        return 'Khớp 1 phần';
      case 'PENDING':
        return 'Chờ khớp';
      default:
        return status;
    }
  };

  if (!isAuthenticated()) {
    return (
      <div className="bg-[#181a20] p-4">
        <div className="text-center text-gray-400 py-8">
          <p>Vui lòng đăng nhập để xem lịch sử lệnh</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#181a20]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2b3139]">
        <h3 className="text-sm font-medium text-white">Lịch Sử Lệnh</h3>
        <button 
          onClick={loadOrders}
          disabled={isLoading}
          className="text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        >
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : 'Làm mới'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#2b3139] overflow-x-auto">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 text-[10px] rounded transition-colors whitespace-nowrap ${
            filter === 'all'
              ? 'bg-yellow-500 text-black'
              : 'bg-[#2b3139] text-gray-400 hover:text-white'
          }`}
        >
          Tất cả
        </button>
        <button
          onClick={() => setFilter('open')}
          className={`px-3 py-1 text-[10px] rounded transition-colors whitespace-nowrap ${
            filter === 'open'
              ? 'bg-yellow-500 text-black'
              : 'bg-[#2b3139] text-gray-400 hover:text-white'
          }`}
        >
          Đang mở
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-3 py-1 text-[10px] rounded transition-colors whitespace-nowrap ${
            filter === 'completed'
              ? 'bg-yellow-500 text-black'
              : 'bg-[#2b3139] text-gray-400 hover:text-white'
          }`}
        >
          Hoàn thành
        </button>
        <button
          onClick={() => setFilter('cancelled')}
          className={`px-3 py-1 text-[10px] rounded transition-colors whitespace-nowrap ${
            filter === 'cancelled'
              ? 'bg-yellow-500 text-black'
              : 'bg-[#2b3139] text-gray-400 hover:text-white'
          }`}
        >
          Đã hủy
        </button>
      </div>

      {/* Orders List */}
      <div className="max-h-[400px] overflow-y-auto">
        {isLoading && orders.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-gray-400" size={24} />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <p className="text-xs">Không có lệnh nào</p>
          </div>
        ) : (
          <div className="divide-y divide-[#2b3139]">
            {filteredOrders.map((order) => (
              <div key={order.id} className="px-4 py-3 hover:bg-[#1e2329] transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {order.side === 'BUY' ? (
                      <TrendingUp size={14} className="text-green-500" />
                    ) : (
                      <TrendingDown size={14} className="text-red-500" />
                    )}
                    <span className={`text-xs font-medium ${
                      order.side === 'BUY' ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {order.side === 'BUY' ? 'MUA' : 'BÁN'}
                    </span>
                    <span className="text-xs text-white">{order.symbol}</span>
                  </div>
                  <span className={`text-[10px] ${getStatusColor(order.status)}`}>
                    {getStatusText(order.status)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] mb-2">
                  <div>
                    <span className="text-gray-400">Loại:</span>
                    <span className="text-white ml-1">{order.type}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Giá:</span>
                    <span className="text-white ml-1">
                      {order.price ? `${Number(order.price).toFixed(2)} USDT` : 'Market'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Số lượng:</span>
                    <span className="text-white ml-1">{Number(order.quantity || 0).toFixed(6)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Đã khớp:</span>
                    <span className="text-white ml-1">{Number(order.filledQuantity || 0).toFixed(6)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[10px] text-gray-400">
                    <Clock size={10} />
                    <span>{new Date(order.createdAt).toLocaleString('vi-VN')}</span>
                  </div>

                  {(order.status === 'PENDING' || order.status === 'PARTIALLY_FILLED') && (
                    <button
                      onClick={() => handleCancelOrder(order.id)}
                      disabled={cancellingOrderId === order.id}
                      className="flex items-center gap-1 text-[10px] text-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      {cancellingOrderId === order.id ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <X size={10} />
                      )}
                      <span>Hủy lệnh</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
