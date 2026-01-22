"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { getOpenOrders, getOrderHistory, cancelOrder, type Order as ApiOrder } from "@/services/ordersApi";
import { isAuthenticated } from "@/services/authApi";

interface Order {
  id: string;
  pair: string;
  type: "Buy" | "Sell";
  orderType: "Limit" | "Market";
  price: number;
  amount: number;
  filled: number;
  total: number;
  status: "Open" | "Partial" | "Filled" | "Cancelled";
  time: string;
}

interface OpenOrdersProps {
  symbol?: string;
}

export default function OpenOrders({ symbol }: OpenOrdersProps) {
  const [activeTab, setActiveTab] = useState<"open" | "history">("open");
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
    console.log('[OpenOrders] activeTab:', activeTab, 'isAuthenticated:', isAuthenticated());
    if (isAuthenticated()) {
      loadOrders();
    }
  }, [activeTab]);

  // Auto refresh orders every 10 seconds
  useEffect(() => {
    if (!isAuthenticated()) return;
    
    const interval = setInterval(() => {
      console.log('[OpenOrders] Auto-refreshing orders...');
      loadOrders();
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [activeTab]);

  const loadOrders = async () => {
    console.log('[OpenOrders] loadOrders called, activeTab:', activeTab);
    setLoading(true);
    try {
      if (activeTab === "open") {
        console.log('[OpenOrders] Fetching open orders...');
        const orders = await getOpenOrders();
        console.log('[OpenOrders] Open orders result:', orders);
        // Ensure orders is array before mapping
        const ordersArray = Array.isArray(orders) ? orders : [];
        setOpenOrders(ordersArray.map(mapApiOrderToOrder));
      } else {
        console.log('[OpenOrders] Fetching order history...');
        const orders = await getOrderHistory();
        // Ensure orders is array before mapping
        const ordersArray = Array.isArray(orders) ? orders : [];
        setOrderHistory(ordersArray.map(mapApiOrderToOrder));
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      // If 403, backend may not have this endpoint implemented yet
      if (error instanceof Error && error.message.includes('403')) {
        console.warn('[OpenOrders] 403 Forbidden - endpoint may not be implemented on backend');
      }
    } finally {
      setLoading(false);
    }
  };

  const mapApiOrderToOrder = (apiOrder: ApiOrder): Order => ({
    id: apiOrder.id,
    pair: apiOrder.symbol || 'UNKNOWN',
    type: apiOrder.side === 'BUY' ? 'Buy' : 'Sell',
    orderType: apiOrder.type === 'LIMIT' ? 'Limit' : apiOrder.type === 'MARKET' ? 'Market' : 'Limit',
    price: Number(apiOrder.price) || 0,
    // Backend may return 'amount' instead of 'quantity'
    amount: Number(apiOrder.quantity ?? apiOrder.amount) || 0,
    filled: Number(apiOrder.filledQuantity ?? apiOrder.filledAmount) || 0,
    total: (Number(apiOrder.price) || 0) * (Number(apiOrder.quantity ?? apiOrder.amount) || 0),
    status: apiOrder.status === 'FILLED' ? 'Filled' : apiOrder.status === 'PARTIALLY_FILLED' ? 'Partial' : apiOrder.status === 'CANCELLED' ? 'Cancelled' : 'Open',
    time: apiOrder.createdAt ? new Date(apiOrder.createdAt).toLocaleString('vi-VN') : '',
  });

  const handleCancelOrder = async (orderId: string) => {
    try {
      console.log('[OpenOrders] Canceling order:', orderId);
      const result = await cancelOrder(orderId);
      console.log('[OpenOrders] Cancel result:', result);
      if (result.success) {
        alert('Lệnh đã được hủy thành công!');
      } else {
        alert('Không thể hủy lệnh: ' + (result.error?.message || 'Lỗi không xác định'));
      }
      loadOrders();
    } catch (error) {
      console.error('Error canceling order:', error);
      alert('Lỗi khi hủy lệnh');
    }
  };

  return (
    <div className="bg-[#181a20] rounded">
      {/* Tabs */}
      <div className="flex items-center border-b border-[#2b3139]">
        <button
          onClick={() => setActiveTab("open")}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "open"
              ? "text-yellow-500 border-yellow-500"
              : "text-gray-400 border-transparent hover:text-white"
          }`}
        >
          Open Orders ({openOrders.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "history"
              ? "text-yellow-500 border-yellow-500"
              : "text-gray-400 border-transparent hover:text-white"
          }`}
        >
          Order History
        </button>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-9 gap-2 px-4 py-2 text-xs text-gray-400 border-b border-[#2b3139]">
        <span>Pair</span>
        <span>Type</span>
        <span>Side</span>
        <span>Price</span>
        <span>Amount</span>
        <span>Filled</span>
        <span>Total</span>
        <span>Time</span>
        <span className="text-center">Action</span>
      </div>

      {/* Orders List */}
      <div className="overflow-auto max-h-64">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            Loading...
          </div>
        ) : activeTab === "open" ? (
          openOrders.length > 0 ? (
            openOrders.map((order) => (
              <div
                key={order.id}
                className="grid grid-cols-9 gap-2 px-4 py-3 text-xs hover:bg-[#2b3139] border-b border-[#2b3139]/50"
              >
                <span className="text-white font-medium">{order.pair}</span>
                <span className="text-gray-400">{order.orderType}</span>
                <span
                  className={`font-medium ${
                    order.type === "Buy" ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {order.type}
                </span>
                <span className="text-white">{order.price.toFixed(2)}</span>
                <span className="text-gray-400">{order.amount.toFixed(4)}</span>
                <span className="text-gray-400">
                  {order.filled.toFixed(4)} ({order.amount > 0 ? ((order.filled / order.amount) * 100).toFixed(0) : 0}%)
                </span>
                <span className="text-white">{order.total.toFixed(2)}</span>
                <span className="text-gray-500">{order.time}</span>
                <div className="text-center">
                  <button 
                    onClick={() => handleCancelOrder(order.id)}
                    className="text-red-500 hover:text-red-400 hover:bg-red-500/20 p-1 rounded transition-colors cursor-pointer"
                    title="Hủy lệnh"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center py-12 text-gray-500" suppressHydrationWarning>
              {mounted && isAuthenticated() ? 'No open orders' : 'Please login to view orders'}
            </div>
          )
        ) : (
          orderHistory.map((order) => (
            <div
              key={order.id}
              className="grid grid-cols-9 gap-2 px-4 py-3 text-xs hover:bg-[#2b3139] border-b border-[#2b3139]/50"
            >
              <span className="text-white font-medium">{order.pair}</span>
              <span className="text-gray-400">{order.orderType}</span>
              <span
                className={`font-medium ${
                  order.type === "Buy" ? "text-green-500" : "text-red-500"
                }`}
              >
                {order.type}
              </span>
              <span className="text-white">{order.price.toFixed(2)}</span>
              <span className="text-gray-400">{order.amount.toFixed(4)}</span>
              <span className="text-green-500">{order.filled.toFixed(4)}</span>
              <span className="text-white">{order.total.toFixed(2)}</span>
              <span className="text-gray-500">{order.time}</span>
              <span className="text-center text-green-500">{order.status}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
