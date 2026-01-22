"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Eye, EyeOff } from "lucide-react";
import { isAuthenticated } from "@/services/authApi";
import { get24hTicker } from "@/services/binanceApi";
import { useBalance, BALANCE_EVENTS } from "@/contexts/BalanceContext";

interface Asset {
  name: string;
  symbol: string;
  amount: number;
  value: number;
  change: number;
}

const ASSET_NAMES: { [key: string]: string } = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  USDT: "Tether",
  BNB: "Binance Coin",
  ADA: "Cardano",
  DOT: "Polkadot",
  SOL: "Solana",
  VND: "Vietnamese Dong",
};

export default function Portfolio() {
  const router = useRouter();
  const { balances, isLoading: balanceLoading } = useBalance();
  const [showBalance, setShowBalance] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);

  // Convert balances to assets with prices
  const loadAssetsWithPrices = useCallback(async () => {
    if (!balances || balances.length === 0) return;
    
    setLoading(true);
    try {
      const assetsWithPrices = await Promise.all(
        balances
          .filter(b => b.total > 0)
          .map(async (balance) => {
            let value = balance.total;
            let change = 0;
            
            if (balance.asset === 'VND') {
              // Convert VND to USD (approximately)
              value = balance.total * 0.00004;
            } else if (balance.asset !== 'USDT') {
              try {
                const ticker = await get24hTicker(`${balance.asset}USDT`);
                const price = parseFloat(String(ticker.price ?? ticker.lastPrice ?? 0));
                value = balance.total * price;
                change = parseFloat(String(ticker.priceChangePercent ?? 0));
              } catch {
                // If can't get price, assume 0
              }
            }
            
            return {
              name: ASSET_NAMES[balance.asset] || balance.asset,
              symbol: balance.asset,
              amount: balance.total,
              value,
              change,
            };
          })
      );
      setAssets(assetsWithPrices);
    } catch (error) {
      console.error('Error loading asset prices:', error);
    } finally {
      setLoading(false);
    }
  }, [balances]);

  // Load assets when balances change
  useEffect(() => {
    if (isAuthenticated() && balances.length > 0) {
      loadAssetsWithPrices();
    }
  }, [balances, loadAssetsWithPrices]);

  // Listen for balance update events
  useEffect(() => {
    const handleBalanceUpdate = () => {
      console.log('[Portfolio] Balance updated, reloading assets...');
      loadAssetsWithPrices();
    };

    window.addEventListener(BALANCE_EVENTS.UPDATED, handleBalanceUpdate);
    return () => window.removeEventListener(BALANCE_EVENTS.UPDATED, handleBalanceUpdate);
  }, [loadAssetsWithPrices]);

  const totalValue = assets.reduce((sum, asset) => sum + asset.value, 0);
  const totalChange = assets.length > 0 
    ? assets.reduce((sum, asset) => sum + asset.change * (asset.value / totalValue), 0)
    : 0;

  return (
    <div className="bg-[#181a20] rounded">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2b3139] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-yellow-500" />
          <h3 className="text-sm font-medium text-white">Portfolio</h3>
        </div>
        <button
          onClick={() => setShowBalance(!showBalance)}
          className="text-gray-400 hover:text-white"
        >
          {showBalance ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
      </div>

      {/* Total Balance */}
      <div className="px-4 py-4 border-b border-[#2b3139]">
        <div className="text-xs text-gray-400 mb-1">Total Balance</div>
        <div className="flex items-center gap-3">
          <div className="text-2xl font-bold text-white">
            {showBalance ? `$${totalValue.toFixed(2)}` : "****"}
          </div>
          <div
            className={`text-sm font-medium ${
              totalChange >= 0 ? "text-green-500" : "text-red-500"
            }`}
          >
            {totalChange >= 0 ? "↑" : "↓"} {Math.abs(totalChange)}%
          </div>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          ≈ {showBalance ? `${totalValue.toFixed(2)} USDT` : "****"}
        </div>
      </div>

      {/* Assets List */}
      <div className="p-4">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : assets.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {isAuthenticated() ? 'No assets found' : 'Please login to view portfolio'}
          </div>
        ) : (
        <div className="space-y-3">
          {assets.map((asset) => (
            <div
              key={asset.symbol}
              className="flex items-center justify-between p-3 bg-[#2b3139] rounded hover:bg-[#2b3139]/80 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-yellow-500">
                    {asset.symbol.charAt(0)}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-medium text-white">
                    {asset.symbol}
                  </div>
                  <div className="text-xs text-gray-500">{asset.name}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-white">
                  {showBalance ? `$${asset.value.toFixed(2)}` : "****"}
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-gray-400">
                    {showBalance ? asset.amount.toFixed(4) : "****"} {asset.symbol}
                  </div>
                  <div
                    className={`text-xs ${
                      asset.change >= 0 ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {asset.change >= 0 ? "↑" : "↓"} {Math.abs(asset.change)}%
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}

        {/* Action Buttons */}
        {assets.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mt-4">
          <button 
            onClick={() => router.push('/deposit')}
            className="py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded transition-colors"
          >
            Deposit
          </button>
          <button 
            onClick={() => router.push('/withdraw')}
            className="py-2 bg-[#2b3139] hover:bg-[#3b4149] text-white text-sm font-medium rounded transition-colors"
          >
            Withdraw
          </button>
          <button 
            onClick={() => router.push('/wallet')}
            className="py-2 bg-[#2b3139] hover:bg-[#3b4149] text-white text-sm font-medium rounded transition-colors"
          >
            Transfer
          </button>
        </div>
        )}
      </div>
    </div>
  );
}
