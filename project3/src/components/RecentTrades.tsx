"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { getRecentTrades, subscribeToTrades, type TradeData } from "@/services/binanceApi";

interface Trade {
  price: number;
  amount: number;
  time: string;
  isBuy: boolean;
}

interface RecentTradesProps {
  symbol?: string;
}

// Helper to parse trade data (supports multiple field names)
function parseTrade(trade: TradeData): Trade {
  // Support multiple field names for price
  const price = parseFloat(String(trade.price || (trade as unknown as Record<string, unknown>).p || 0)) || 0;
  
  // Support multiple field names for quantity/amount
  const rawTrade = trade as unknown as Record<string, unknown>;
  const amount = parseFloat(String(
    trade.qty || 
    rawTrade.quantity || 
    rawTrade.amount || 
    rawTrade.q || 
    0
  )) || 0;
  
  // Parse time
  const timestamp = trade.time || rawTrade.timestamp || rawTrade.t || Date.now();
  const date = new Date(Number(timestamp));
  const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
  
  // isBuyerMaker = true means seller initiated, so it's a sell
  const isBuyerMaker = trade.isBuyerMaker ?? rawTrade.m ?? false;
  const isBuy = !isBuyerMaker;
  
  return { price, amount, time, isBuy };
}

export default function RecentTrades({ symbol = 'BTCUSDT' }: RecentTradesProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    
    // Fetch initial trades
    const fetchTrades = async () => {
      try {
        setLoading(true);
        console.log('[RecentTrades] Fetching trades for:', symbol);
        const data: TradeData[] = await getRecentTrades(symbol, 30);
        console.log('[RecentTrades] Raw data received:', data);
        
        // Handle case where data might not be an array
        const tradesArray = Array.isArray(data) ? data : [];
        console.log('[RecentTrades] Trades count:', tradesArray.length);
        
        const formattedTrades = tradesArray
          .map(parseTrade)
          .filter(t => t.price > 0) // Filter invalid trades
          .reverse(); // Hiển thị trades mới nhất trước
        
        console.log('[RecentTrades] Formatted trades:', formattedTrades.length);
        setTrades(formattedTrades);
      } catch (error) {
        console.error('[RecentTrades] Error fetching trades:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrades();

    // Subscribe to real-time trades
    const unsubscribe = subscribeToTrades(symbol, (trade: TradeData) => {
      const newTrade = parseTrade(trade);
      if (newTrade.price > 0) {
        setTrades((prev) => [newTrade, ...prev.slice(0, 29)]); // Giữ 30 trades gần nhất
      }
    });

    return () => unsubscribe();
  }, [symbol]);

  return (
    <div className="bg-[#181a20] rounded h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2b3139]">
        <h3 className="text-sm font-medium text-white">Recent Trades</h3>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-3 gap-2 px-4 py-2 text-xs text-gray-400 border-b border-[#2b3139]">
        <span className="text-right">Price(USDT)</span>
        <span className="text-right">Amount(BTC)</span>
        <span className="text-right">Time</span>
      </div>

      {/* Trades List */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            Đang tải...
          </div>
        ) : trades.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            Không có dữ liệu
          </div>
        ) : (
          trades.map((trade, index) => (
          <div
            key={index}
            className="grid grid-cols-3 gap-2 px-4 py-1.5 hover:bg-[#2b3139] cursor-pointer text-xs font-mono"
          >
            <div className="flex items-center justify-end gap-1">
              {trade.isBuy ? (
                <TrendingUp size={12} className="text-green-500" />
              ) : (
                <TrendingDown size={12} className="text-red-500" />
              )}
              <span
                className={`font-medium ${
                  trade.isBuy ? "text-green-500" : "text-red-500"
                }`}
              >
                {trade.price.toFixed(2)}
              </span>
            </div>
            <span className="text-gray-400 text-right">{trade.amount.toFixed(6)}</span>
            <span className="text-gray-500 text-right" suppressHydrationWarning>{trade.time}</span>
          </div>
        ))
        )}
      </div>
    </div>
  );
}
