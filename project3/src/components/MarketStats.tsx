"use client";

import { TrendingUp, Activity, DollarSign } from "lucide-react";
import { useState, useEffect } from "react";
import { getGlobalStats } from "@/services/binanceApi";

interface StatItem {
  label: string;
  value: string;
  change: string;
  isPositive: boolean;
  icon: typeof DollarSign;
}

export default function MarketStats() {
  const [stats, setStats] = useState<StatItem[]>([
    {
      label: "Market Cap",
      value: "$2.1T",
      change: "+2.5%",
      isPositive: true,
      icon: DollarSign,
    },
    {
      label: "24h Volume",
      value: "$98.5B",
      change: "+5.2%",
      isPositive: true,
      icon: Activity,
    },
    {
      label: "BTC Dominance",
      value: "48.2%",
      change: "-0.3%",
      isPositive: false,
      icon: TrendingUp,
    },
    {
      label: "Active Traders",
      value: "2.5M",
      change: "+12.8%",
      isPositive: true,
      icon: TrendingUp,
    },
  ]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const loadMarketStats = async () => {
      try {
        const data = await getGlobalStats();
        
        // Update stats with real data
        setStats([
          {
            label: "Market Cap",
            value: `$${(data.total_market_cap?.usd / 1e12 || 2.1).toFixed(1)}T`,
            change: `${data.market_cap_change_percentage_24h_usd > 0 ? '+' : ''}${data.market_cap_change_percentage_24h_usd?.toFixed(1) || '+2.5'}%`,
            isPositive: (data.market_cap_change_percentage_24h_usd || 2.5) > 0,
            icon: DollarSign,
          },
          {
            label: "24h Volume",
            value: `$${(data.total_volume?.usd / 1e9 || 98.5).toFixed(1)}B`,
            change: "+5.2%",
            isPositive: true,
            icon: Activity,
          },
          {
            label: "BTC Dominance",
            value: `${data.market_cap_percentage?.btc?.toFixed(1) || '48.2'}%`,
            change: "-0.3%",
            isPositive: false,
            icon: TrendingUp,
          },
          {
            label: "Active Traders",
            value: "2.5M",
            change: "+12.8%",
            isPositive: true,
            icon: TrendingUp,
          },
        ]);
      } catch (error) {
        console.error('Error loading market stats:', error);
        // Keep default stats on error
      }
    };

    loadMarketStats();
    const interval = setInterval(loadMarketStats, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [mounted]);

  if (!mounted) {
    return (
      <div className="bg-[#181a20] rounded p-4">
        <h3 className="text-sm font-medium text-white mb-4">Market Statistics</h3>
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#2b3139] rounded p-3 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
              <div className="h-6 bg-gray-700 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#181a20] rounded p-4">
      <h3 className="text-sm font-medium text-white mb-4">Market Statistics</h3>
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-[#2b3139] rounded p-3 hover:bg-[#3b4149] transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <stat.icon size={16} className="text-gray-400" />
              <span
                className={`text-xs font-medium ${
                  stat.isPositive ? "text-green-500" : "text-red-500"
                }`}
              >
                {stat.change}
              </span>
            </div>
            <div className="text-xs text-gray-400 mb-1">{stat.label}</div>
            <div className="text-lg font-bold text-white">{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
