"use client";

import { Star, Search, TrendingUp, TrendingDown } from "lucide-react";
import { useState, useEffect } from "react";
import { getAllTickers, type Ticker24h } from "@/services/binanceApi";

interface CryptoData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  isPositive: boolean;
  starred: boolean;
  volume: number;
}

interface SidebarProps {
  currentSymbol?: string;
  onSelectPair?: (symbol: string) => void;
}

// Danh sách các crypto phổ biến với tên đầy đủ
const CRYPTO_NAMES: { [key: string]: string } = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  BNB: "Binance Coin",
  XRP: "Ripple",
  ADA: "Cardano",
  DOGE: "Dogecoin",
  SOL: "Solana",
  DOT: "Polkadot",
  MATIC: "Polygon",
  LTC: "Litecoin",
  AVAX: "Avalanche",
  LINK: "Chainlink",
  UNI: "Uniswap",
  ATOM: "Cosmos",
  ETC: "Ethereum Classic",
  XLM: "Stellar",
  ALGO: "Algorand",
  VET: "VeChain",
  FIL: "Filecoin",
  AAVE: "Aave",
  SAND: "The Sandbox",
  MANA: "Decentraland",
  GRT: "The Graph",
  NEAR: "NEAR Protocol",
  FTM: "Fantom",
  APE: "ApeCoin",
  OP: "Optimism",
  ARB: "Arbitrum",
  SUI: "Sui",
  APT: "Aptos",
  INJ: "Injective",
  SHIB: "Shiba Inu",
  PEPE: "Pepe",
  TRX: "TRON",
  TON: "Toncoin",
};

export default function Sidebar({ currentSymbol = "BTCUSDT", onSelectPair }: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"USDT" | "BTC" | "ETH" | "ALTS">("USDT");
  const [cryptoData, setCryptoData] = useState<CryptoData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch initial data from Binance API
    const fetchData = async () => {
      try {
        console.log('[Sidebar] Fetching tickers for tab:', activeTab);
        const tickers = await getAllTickers();
        
        console.log('[Sidebar] Tickers response:', tickers?.length || 0, 'items');
        
        if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
          console.error('[Sidebar] Invalid tickers data:', tickers);
          setLoading(false);
          return;
        }
        
        // Lọc theo base currency
        let filteredTickers = tickers;
        
        console.log('[Sidebar] Sample ticker:', tickers[0]);
        
        if (activeTab === "USDT") {
          filteredTickers = tickers.filter((t: Ticker24h) => t.symbol?.endsWith('USDT'));
        } else if (activeTab === "BTC") {
          filteredTickers = tickers.filter((t: Ticker24h) => t.symbol?.endsWith('BTC'));
        } else if (activeTab === "ETH") {
          filteredTickers = tickers.filter((t: Ticker24h) => t.symbol?.endsWith('ETH'));
        } else if (activeTab === "ALTS") {
          // Altcoins - các coin không phải BTC, ETH, BNB paired với USDT
          filteredTickers = tickers.filter((t: Ticker24h) => {
            const symbol = t.symbol?.replace('USDT', '');
            return t.symbol?.endsWith('USDT') && !['BTC', 'ETH', 'BNB'].includes(symbol);
          });
        }
        
        console.log('[Sidebar] Filtered tickers:', filteredTickers.length);
        
        // Lấy base currency suffix
        const suffix = activeTab === "ALTS" ? "USDT" : activeTab;
        
        // Map data
        const pairs = filteredTickers
          .slice(0, 50) // Lấy 50 cặp
          .map((ticker: Ticker24h) => {
            const symbol = ticker.symbol?.replace(suffix, '') || '';
            
            // Backend returns: price, priceChangePercent (not lastPrice, change)
            const priceValue = typeof ticker.price === 'number' ? ticker.price : parseFloat(String(ticker.price || ticker.lastPrice || '0'));
            const changeValue = typeof ticker.priceChangePercent === 'number' ? ticker.priceChangePercent : parseFloat(String(ticker.priceChangePercent || '0'));
            const volumeValue = typeof ticker.quoteVolume === 'number' ? ticker.quoteVolume : parseFloat(String(ticker.quoteVolume || '0'));
            
            return {
              symbol,
              name: CRYPTO_NAMES[symbol] || symbol,
              price: priceValue,
              change: changeValue,
              isPositive: changeValue >= 0,
              starred: ['BTC', 'ETH', 'BNB'].includes(symbol),
              volume: volumeValue,
            };
          })
          .filter((crypto: CryptoData) => crypto.price > 0); // Chỉ lấy crypto có giá hợp lệ
        
        console.log('[Sidebar] Final pairs:', pairs.length, pairs.slice(0, 3));
        
        setCryptoData(pairs);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching crypto data:', error);
        setLoading(false);
      }
    };

    fetchData();
    
    // Cập nhật dữ liệu mỗi 10 giây
    const interval = setInterval(fetchData, 10000);

    return () => clearInterval(interval);
  }, [activeTab]); // Re-fetch when tab changes

  const filteredCrypto = cryptoData.filter(
    (crypto) =>
      crypto.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      crypto.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleStar = (symbol: string) => {
    setCryptoData((prevData) =>
      prevData.map((crypto) =>
        crypto.symbol === symbol ? { ...crypto, starred: !crypto.starred } : crypto
      )
    );
  };

  return (
    <div className="bg-[#1e2329] border-r border-[#2b3139] h-full overflow-y-auto flex flex-col">
      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-3 border-b border-[#2b3139]">
        <button 
          onClick={() => setActiveTab("USDT")}
          className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "USDT" 
              ? "text-yellow-500 border-b-2 border-yellow-500" 
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Star size={14} fill={activeTab === "USDT" ? "currentColor" : "none"} />
          USDT
        </button>
        <button 
          onClick={() => setActiveTab("BTC")}
          className={`px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "BTC" 
              ? "text-yellow-500 border-b-2 border-yellow-500" 
              : "text-gray-400 hover:text-white"
          }`}
        >
          BTC
        </button>
        <button 
          onClick={() => setActiveTab("ETH")}
          className={`px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "ETH" 
              ? "text-yellow-500 border-b-2 border-yellow-500" 
              : "text-gray-400 hover:text-white"
          }`}
        >
          ETH
        </button>
        <button 
          onClick={() => setActiveTab("ALTS")}
          className={`px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "ALTS" 
              ? "text-yellow-500 border-b-2 border-yellow-500" 
              : "text-gray-400 hover:text-white"
          }`}
        >
          ALTS
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-[#2b3139]">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search Symbol/Name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#2b3139] text-sm text-gray-300 pl-9 pr-3 py-2 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500"
          />
        </div>
      </div>

      {/* Column Headers */}
      <div className="flex items-center justify-between px-4 py-2 text-xs text-gray-400 border-b border-[#2b3139] sticky top-0 bg-[#1e2329]">
        <span>Pair</span>
        <span>Price</span>
        <span className="text-right">24h Change</span>
      </div>

      {/* Crypto List */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            Loading market data...
          </div>
        ) : filteredCrypto.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            No results found
          </div>
        ) : (
          filteredCrypto.map((crypto) => {
            const pairSymbol = `${crypto.symbol}${activeTab === "ALTS" ? "USDT" : activeTab}`;
            const isSelected = currentSymbol === pairSymbol;
            
            return (
          <div
            key={crypto.symbol}
            onClick={() => onSelectPair?.(pairSymbol)}
            className={`px-4 py-3 hover:bg-[#2b3139] cursor-pointer transition-colors border-b border-[#2b3139]/50 ${
              isSelected ? "bg-yellow-500/10 border-l-2 border-l-yellow-500" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStar(crypto.symbol);
                  }}
                  className="hover:scale-110 transition-transform"
                >
                  <Star
                    size={14}
                    className={
                      crypto.starred
                        ? "text-yellow-500 fill-yellow-500"
                        : "text-gray-600 hover:text-gray-400"
                    }
                  />
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-1">
                    <span className={`text-sm font-medium ${isSelected ? "text-yellow-500" : "text-white"}`}>
                      {crypto.symbol}
                    </span>
                    <span className="text-xs text-gray-500">/{activeTab === "ALTS" ? "USDT" : activeTab}</span>
                    {crypto.isPositive ? (
                      <TrendingUp size={12} className="text-green-500" />
                    ) : (
                      <TrendingDown size={12} className="text-red-500" />
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{crypto.name}</div>
                </div>
              </div>
              <div className="text-right ml-2">
                <div className="text-sm font-medium text-white">
                  {isNaN(crypto.price) || crypto.price === 0 
                    ? "--" 
                    : crypto.price < 1 
                      ? crypto.price.toFixed(4) 
                      : crypto.price.toFixed(2)}
                </div>
                <div
                  className={`text-xs font-medium ${
                    crypto.isPositive ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {isNaN(crypto.change) 
                    ? "--" 
                    : `${crypto.isPositive ? "+" : ""}${crypto.change.toFixed(2)}%`}
                </div>
              </div>
            </div>
          </div>
        );
        })
        )}
      </div>
    </div>
  );
}
