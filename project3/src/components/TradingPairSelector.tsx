"use client";

import { useState } from "react";
import { ChevronDown, Star, Search } from "lucide-react";

interface TradingPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  starred: boolean;
}

const POPULAR_PAIRS: TradingPair[] = [
  { symbol: "BTCUSDT", baseAsset: "BTC", quoteAsset: "USDT", starred: true },
  { symbol: "ETHUSDT", baseAsset: "ETH", quoteAsset: "USDT", starred: true },
  { symbol: "BNBUSDT", baseAsset: "BNB", quoteAsset: "USDT", starred: false },
  { symbol: "SOLUSDT", baseAsset: "SOL", quoteAsset: "USDT", starred: false },
  { symbol: "XRPUSDT", baseAsset: "XRP", quoteAsset: "USDT", starred: false },
  { symbol: "ADAUSDT", baseAsset: "ADA", quoteAsset: "USDT", starred: false },
];

interface Props {
  currentPair: string;
  onPairChange: (symbol: string) => void;
}

export default function TradingPairSelector({ currentPair, onPairChange }: Props) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const current = POPULAR_PAIRS.find(p => p.symbol === currentPair) || POPULAR_PAIRS[0];
  
  const filteredPairs = POPULAR_PAIRS.filter(pair => 
    pair.baseAsset.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pair.quoteAsset.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (symbol: string) => {
    onPairChange(symbol);
    setShowDropdown(false);
    setSearchTerm("");
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-3 py-2 hover:bg-[#2b3139] rounded transition-colors"
      >
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-white">{current.baseAsset}/{current.quoteAsset}</h1>
          <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded font-medium">
            Spot
          </span>
        </div>
        <ChevronDown size={16} className="text-gray-400" />
      </button>

      {showDropdown && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-80 bg-[#1e2329] border border-[#2b3139] rounded shadow-xl z-50">
            {/* Search */}
            <div className="p-3 border-b border-[#2b3139]">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search pairs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#2b3139] text-white pl-9 pr-3 py-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Pairs List */}
            <div className="max-h-96 overflow-auto">
              <div className="px-3 py-2 text-xs text-gray-400 font-medium">Popular Pairs</div>
              {filteredPairs.map((pair) => (
                <button
                  key={pair.symbol}
                  onClick={() => handleSelect(pair.symbol)}
                  className={`w-full flex items-center justify-between px-3 py-2 hover:bg-[#2b3139] transition-colors ${
                    pair.symbol === currentPair ? 'bg-[#2b3139]' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Star
                      size={14}
                      className={pair.starred ? "text-yellow-500 fill-yellow-500" : "text-gray-600"}
                    />
                    <span className="text-sm font-medium text-white">
                      {pair.baseAsset}
                      <span className="text-gray-500">/{pair.quoteAsset}</span>
                    </span>
                  </div>
                  {pair.symbol === currentPair && (
                    <span className="text-xs text-yellow-500">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
