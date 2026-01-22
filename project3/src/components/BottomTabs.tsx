"use client";

import { useState } from "react";
import { ClipboardList, PieChart, History } from "lucide-react";
import OpenOrders from "./OpenOrders";
import Portfolio from "./Portfolio";
import OrderHistory from "./OrderHistory";

interface BottomTabsProps {
  symbol: string;
}

type TabType = "orders" | "portfolio" | "history";

export default function BottomTabs({ symbol }: BottomTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("orders");

  const tabs = [
    { id: "orders" as TabType, label: "Lệnh Mở", icon: ClipboardList },
    { id: "portfolio" as TabType, label: "Danh Mục", icon: PieChart },
    { id: "history" as TabType, label: "Lịch Sử", icon: History },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Tabs Header */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-[#2b3139] shrink-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded transition-colors ${
                activeTab === tab.id
                  ? "bg-yellow-500/10 text-yellow-500"
                  : "text-gray-400 hover:text-white hover:bg-[#2b3139]"
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "orders" && <OpenOrders symbol={symbol} />}
        {activeTab === "portfolio" && <Portfolio />}
        {activeTab === "history" && <OrderHistory />}
      </div>
    </div>
  );
}
