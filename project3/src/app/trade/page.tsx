"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import TradingChart from "@/components/TradingChart";
import TradingForm from "@/components/TradingForm";
import OrderBook from "@/components/OrderBook";
import RecentTrades from "@/components/RecentTrades";
import BottomTabs from "@/components/BottomTabs";
import TradingPairSelector from "@/components/TradingPairSelector";
import { get24hTicker, subscribeToTicker, type Ticker24h } from "@/services/binanceApi";

export default function TradePage() {
  const [currentSymbol, setCurrentSymbol] = useState("BTCUSDT");
  const [ticker, setTicker] = useState<Ticker24h | null>(null);

  useEffect(() => {
    // Fetch initial ticker data
    const fetchTicker = async () => {
      try {
        const data = await get24hTicker(currentSymbol);
        setTicker(data);
      } catch (error) {
        console.error('Error fetching ticker:', error);
      }
    };

    fetchTicker();

    // Subscribe to real-time ticker updates
    const unsubscribe = subscribeToTicker(currentSymbol, (data: Ticker24h) => {
      setTicker(data);
    });

    return () => unsubscribe();
  }, [currentSymbol]);

  const currentPrice = ticker ? parseFloat(String(ticker.price ?? ticker.lastPrice ?? 0)) : 0;
  const priceChange = ticker ? parseFloat(String(ticker.priceChangePercent ?? 0)) : 0;
  const high24h = ticker ? parseFloat(String(ticker.high ?? ticker.highPrice ?? 0)) : 0;
  const low24h = ticker ? parseFloat(String(ticker.low ?? ticker.lowPrice ?? 0)) : 0;
  const volume24hBTC = ticker ? parseFloat(String(ticker.volume ?? 0)) : 0;
  const volume24hUSDT = ticker ? parseFloat(String(ticker.quoteVolume ?? 0)) : 0;

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white flex flex-col overflow-auto">
      <Header />
      
      <div className="flex flex-1">
        {/* Sidebar - Hidden on mobile */}
        <div className="hidden lg:block w-64 shrink-0 h-[900px] overflow-hidden">
          <Sidebar 
            currentSymbol={currentSymbol}
            onSelectPair={setCurrentSymbol}
          />
        </div>
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Trading Pair Header */}
          <div className="bg-[#1e2329] border-b border-[#2b3139] px-4 py-2">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <TradingPairSelector 
                  currentPair={currentSymbol}
                  onPairChange={setCurrentSymbol}
                />
                
                {/* Price Info */}
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-bold ${priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    ${currentPrice.toFixed(2)}
                  </span>
                  <span className={`text-sm ${priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-6 text-xs">
                <div>
                  <div className="text-gray-400">24h High</div>
                  <div className="text-white font-medium">${high24h > 0 ? high24h.toFixed(2) : '-'}</div>
                </div>
                <div>
                  <div className="text-gray-400">24h Low</div>
                  <div className="text-white font-medium">${low24h > 0 ? low24h.toFixed(2) : '-'}</div>
                </div>
                <div>
                  <div className="text-gray-400">24h Volume({currentSymbol.replace('USDT', '')})</div>
                  <div className="text-white font-medium">{volume24hBTC > 0 ? volume24hBTC.toFixed(2) : '-'}</div>
                </div>
                <div>
                  <div className="text-gray-400">24h Volume(USDT)</div>
                  <div className="text-white font-medium">{volume24hUSDT > 0 ? `$${(volume24hUSDT / 1000000).toFixed(2)}M` : '-'}</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Main Trading Area */}
          <div className="flex-1 flex flex-col gap-2 p-2">
            {/* Chart */}
            <div className="h-[500px] bg-[#1e2329] rounded">
              <TradingChart />
            </div>
            
            {/* Bottom Tabs - Orders, Portfolio, etc */}
            <div className="min-h-[300px] bg-[#1e2329] rounded overflow-auto">
              <BottomTabs symbol={currentSymbol} />
            </div>
          </div>
        </div>

        {/* Right Sidebar - OrderBook & Recent Trades - Hidden on small screens */}
        <div className="hidden md:flex w-80 shrink-0 bg-[#1e2329] border-l border-[#2b3139] flex-col min-h-[calc(100vh-64px)]">
          {/* Trading Form */}
          <div className="border-b border-[#2b3139] shrink-0">
            <TradingForm symbol={currentSymbol} currentPrice={currentPrice} />
          </div>
          
          <div className="h-[300px] shrink-0 overflow-auto">
            <OrderBook symbol={currentSymbol} />
          </div>
          <div className="h-[300px] shrink-0 border-t border-[#2b3139] overflow-auto">
            <RecentTrades symbol={currentSymbol} />
          </div>
        </div>
      </div>
    </div>
  );
}
