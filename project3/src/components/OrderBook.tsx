"use client";

import { useState, useEffect } from "react";
import { getOrderBook, subscribeToOrderBook, type OrderBookData } from "@/services/binanceApi";

interface Order {
  price: number;
  amount: number;
  total: number;
}

interface OrderBookProps {
  symbol?: string;
}

// Helper to parse order entry (supports both array and object format)
function parseOrderEntry(entry: unknown): { price: number; amount: number } {
  // Handle array format: [price, amount]
  if (Array.isArray(entry)) {
    return {
      price: parseFloat(String(entry[0])) || 0,
      amount: parseFloat(String(entry[1])) || 0,
    };
  }
  
  // Handle object format: { price: "123", quantity: "0.5" } or { price: "123", amount: "0.5" }
  if (entry && typeof entry === 'object') {
    const obj = entry as Record<string, unknown>;
    const price = parseFloat(String(obj.price || obj.p || 0)) || 0;
    const amount = parseFloat(String(obj.quantity || obj.amount || obj.qty || obj.q || 0)) || 0;
    return { price, amount };
  }
  
  return { price: 0, amount: 0 };
}

// Process order data safely
function processOrders(orders: unknown[], limit: number = 12): Order[] {
  if (!Array.isArray(orders)) return [];
  
  return orders.slice(0, limit).map((entry) => {
    const { price, amount } = parseOrderEntry(entry);
    return {
      price,
      amount,
      total: price * amount,
    };
  }).filter(order => order.price > 0 && order.amount > 0);
}

export default function OrderBook({ symbol = 'BTCUSDT' }: OrderBookProps) {
  const [buyOrders, setBuyOrders] = useState<Order[]>([]);
  const [sellOrders, setSellOrders] = useState<Order[]>([]);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    
    // Fetch initial order book
    const fetchOrderBook = async () => {
      try {
        setLoading(true);
        console.log('[OrderBook] Fetching order book for:', symbol);
        const data: OrderBookData = await getOrderBook(symbol, 12);
        console.log('[OrderBook] Raw data received:', data);
        
        // Handle case where data might have nested structure
        const orderBookData = (data as unknown as { bids?: unknown[]; asks?: unknown[] });
        const rawBids = orderBookData?.bids || [];
        const rawAsks = orderBookData?.asks || [];
        
        console.log('[OrderBook] Bids count:', rawBids.length, 'Asks count:', rawAsks.length);
        
        // Process bids (buy orders)
        const bids = processOrders(rawBids, 12);
        
        // Process asks (sell orders) - reversed for display
        const asks = processOrders(rawAsks, 12).reverse();
        
        console.log('[OrderBook] Processed bids:', bids.length, 'asks:', asks.length);
        
        setBuyOrders(bids);
        setSellOrders(asks);
        
        // Set current price as mid price
        if (bids.length > 0 && asks.length > 0) {
          setCurrentPrice((bids[0].price + asks[asks.length - 1].price) / 2);
        }
      } catch (error) {
        console.error('[OrderBook] Error fetching order book:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderBook();

    // Subscribe to real-time order book updates
    const unsubscribe = subscribeToOrderBook(symbol, (data: OrderBookData) => {
      const bids = processOrders(data.bids, 12);
      const asks = processOrders(data.asks, 12).reverse();
      
      setBuyOrders(bids);
      setSellOrders(asks);
      
      if (bids.length > 0 && asks.length > 0) {
        setCurrentPrice((bids[0].price + asks[asks.length - 1].price) / 2);
      }
    });

    return () => unsubscribe();
  }, [symbol]);

  return (
    <div className="bg-[#181a20] rounded h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2b3139]">
        <h3 className="text-sm font-medium text-white">Order Book</h3>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-3 gap-2 px-4 py-2 text-xs text-gray-400 border-b border-[#2b3139]">
        <span className="text-right">Price(USDT)</span>
        <span className="text-right">Amount(BTC)</span>
        <span className="text-right">Total(USDT)</span>
      </div>

      {/* Order Book Content */}
      <div className="flex-1 overflow-auto" suppressHydrationWarning>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            Đang tải...
          </div>
        ) : buyOrders.length === 0 && sellOrders.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            Không có dữ liệu
          </div>
        ) : (
          <>
        {/* Sell Orders */}
        <div className="space-y-0.5">
          {sellOrders.map((order, index) => (
            <div
              key={`sell-${index}`}
              className="relative px-4 py-1 hover:bg-[#2b3139] cursor-pointer"
            >
              <div
                className="absolute inset-y-0 right-0 bg-red-500/10"
                style={{ width: `${(order.amount / 2) * 100}%` }}
              />
              <div className="relative grid grid-cols-3 gap-2 text-xs font-mono">
                <span className="text-red-500 font-medium text-right">
                  {order.price.toFixed(2)}
                </span>
                <span className="text-gray-400 text-right">{order.amount.toFixed(6)}</span>
                <span className="text-gray-400 text-right">
                  {order.total.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Current Price */}
        <div className="px-4 py-3 bg-[#2b3139]/50 border-y border-[#2b3139]">
          <div className="flex items-center justify-between">
            <div className="text-lg font-bold text-green-500">
              {currentPrice.toFixed(2)}
            </div>
            <div className="text-xs text-gray-400">≈ ${currentPrice.toFixed(2)}</div>
          </div>
        </div>

        {/* Buy Orders */}
        <div className="space-y-0.5">
          {buyOrders.map((order, index) => (
            <div
              key={`buy-${index}`}
              className="relative px-4 py-1 hover:bg-[#2b3139] cursor-pointer"
            >
              <div
                className="absolute inset-y-0 right-0 bg-green-500/10"
                style={{ width: `${(order.amount / 2) * 100}%` }}
              />
              <div className="relative grid grid-cols-3 gap-2 text-xs font-mono">
                <span className="text-green-500 font-medium text-right">
                  {order.price.toFixed(2)}
                </span>
                <span className="text-gray-400 text-right">{order.amount.toFixed(6)}</span>
                <span className="text-gray-400 text-right">
                  {order.total.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
          </>
        )}
      </div>
    </div>
  );
}
