"use client";

import { useState, useEffect, useRef } from "react";
import { Wallet, Loader2, CheckCircle, XCircle } from "lucide-react";
import { placeOrder } from "@/services/ordersApi";
import { isAuthenticated } from "@/services/authApi";
import { useBalance, BALANCE_EVENTS } from "@/contexts/BalanceContext";
import { triggerNotificationRefresh } from "@/services/notificationApi";

interface TradingFormProps {
  symbol?: string;
  currentPrice?: number;
}

export default function TradingForm({ symbol = "BTCUSDT", currentPrice }: TradingFormProps) {
  const { getAvailableBalance, refreshBalances, notifyBalanceChange } = useBalance();
  
  const [orderType, setOrderType] = useState<"limit" | "market">("limit");
  const [buyPrice, setBuyPrice] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [buyPercentage, setBuyPercentage] = useState(0);
  const [sellPrice, setSellPrice] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [sellPercentage, setSellPercentage] = useState(0);
  const [isLoadingBuy, setIsLoadingBuy] = useState(false);
  const [isLoadingSell, setIsLoadingSell] = useState(false);
  const [buyMessage, setBuyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sellMessage, setSellMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Track if initial price has been set
  const initialPriceSet = useRef(false);

  // Get balances from context
  const usdtBalance = getAvailableBalance('USDT');
  // Extract base asset from symbol (e.g., BTCUSDT -> BTC)
  const baseAsset = symbol.replace('USDT', '').replace('BUSD', '').replace('USD', '');
  const baseAssetBalance = getAvailableBalance(baseAsset);

  // Set initial price only once when component mounts (not on every price change)
  useEffect(() => {
    if (currentPrice && !initialPriceSet.current) {
      initialPriceSet.current = true;
      // Use setTimeout to avoid setState during render
      setTimeout(() => {
        setBuyPrice(currentPrice.toFixed(2));
        setSellPrice(currentPrice.toFixed(2));
      }, 0);
    }
  }, [currentPrice]);

  // Listen for balance update events
  useEffect(() => {
    const handleBalanceUpdate = () => {
      console.log('[TradingForm] Balance updated via event');
    };

    window.addEventListener(BALANCE_EVENTS.UPDATED, handleBalanceUpdate);
    return () => window.removeEventListener(BALANCE_EVENTS.UPDATED, handleBalanceUpdate);
  }, []);

  const calculateBuyTotal = () => {
    const amount = parseFloat(buyAmount) || 0;
    const price = parseFloat(buyPrice) || 0;
    return (amount * price).toFixed(2);
  };

  const calculateSellTotal = () => {
    const amount = parseFloat(sellAmount) || 0;
    const price = parseFloat(sellPrice) || 0;
    return (amount * price).toFixed(2);
  };

  const handleBuyPercentageChange = (percentage: number) => {
    setBuyPercentage(percentage);
    const balance = usdtBalance ?? 0;
    // Với Market order dùng currentPrice, với Limit order dùng buyPrice
    const price = orderType === 'market' 
      ? (currentPrice || 1) 
      : (parseFloat(buyPrice) || currentPrice || 1);
    const maxAmount = balance / price;
    const amount = (maxAmount * percentage / 100).toFixed(6);
    console.log('[TradingForm] Buy %:', { percentage, balance, price, maxAmount, amount, orderType });
    setBuyAmount(amount);
  };

  const handleSellPercentageChange = (percentage: number) => {
    setSellPercentage(percentage);
    const balance = baseAssetBalance ?? 0;
    const amount = (balance * percentage / 100).toFixed(6);
    setSellAmount(amount);
  };

  const handleBuyOrder = async () => {
    if (!isAuthenticated()) {
      setBuyMessage({ type: 'error', text: 'Vui lòng đăng nhập để giao dịch' });
      return;
    }

    const amount = parseFloat(buyAmount);
    if (!amount || amount <= 0) {
      setBuyMessage({ type: 'error', text: 'Vui lòng nhập số lượng hợp lệ' });
      return;
    }

    const price = orderType === "market" ? undefined : parseFloat(buyPrice);
    if (orderType !== "market" && (!price || price <= 0)) {
      setBuyMessage({ type: 'error', text: 'Vui lòng nhập giá hợp lệ' });
      return;
    }

    // Kiểm tra số dư USDT trước khi mua
    const totalCost = amount * (price || 0);
    if (totalCost > usdtBalance) {
      setBuyMessage({ type: 'error', text: `Số dư USDT không đủ. Cần: ${totalCost.toFixed(2)}, Có: ${usdtBalance.toFixed(2)}` });
      return;
    }

    setIsLoadingBuy(true);
    setBuyMessage(null);

    const orderData = {
      symbol,
      side: 'BUY' as const,
      type: orderType.toUpperCase() as 'LIMIT' | 'MARKET',
      quantity: amount,
      price,
    };
    
    console.log('[TradingForm] Placing BUY order:', JSON.stringify(orderData, null, 2));

    const result = await placeOrder(orderData);

    setIsLoadingBuy(false);

    if (result.success) {
      setBuyMessage({ type: 'success', text: 'Lệnh mua đã được đặt thành công!' });
      setBuyAmount('');
      setBuyPercentage(0);
      // Notify balance change to sync all components
      notifyBalanceChange(BALANCE_EVENTS.ORDER_PLACED, { side: 'BUY', symbol, amount });
      // Trigger notification refresh immediately
      triggerNotificationRefresh();
      
      // For Market orders, refresh balance immediately (order executes instantly)
      if (orderType === 'market') {
        setTimeout(() => refreshBalances(), 1000);
      }
      
      setTimeout(() => setBuyMessage(null), 3000);
    } else {
      setBuyMessage({ type: 'error', text: result.error?.message || 'Không thể đặt lệnh' });
    }
  };

  const handleSellOrder = async () => {
    if (!isAuthenticated()) {
      setSellMessage({ type: 'error', text: 'Vui lòng đăng nhập để giao dịch' });
      return;
    }

    const amount = parseFloat(sellAmount);
    if (!amount || amount <= 0) {
      setSellMessage({ type: 'error', text: 'Vui lòng nhập số lượng hợp lệ' });
      return;
    }

    const price = orderType === "market" ? undefined : parseFloat(sellPrice);
    if (orderType !== "market" && (!price || price <= 0)) {
      setSellMessage({ type: 'error', text: 'Vui lòng nhập giá hợp lệ' });
      return;
    }

    // Kiểm tra số dư crypto trước khi bán
    if (amount > baseAssetBalance) {
      setSellMessage({ type: 'error', text: `Số dư ${baseAsset} không đủ. Cần: ${amount.toFixed(8)}, Có: ${baseAssetBalance.toFixed(8)}` });
      return;
    }

    setIsLoadingSell(true);
    setSellMessage(null);

    const result = await placeOrder({
      symbol,
      side: 'SELL',
      type: orderType.toUpperCase() as 'LIMIT' | 'MARKET',
      quantity: amount,
      price,
    });

    setIsLoadingSell(false);

    if (result.success) {
      setSellMessage({ type: 'success', text: 'Lệnh bán đã được đặt thành công!' });
      setSellAmount('');
      setSellPercentage(0);
      // Notify balance change to sync all components
      notifyBalanceChange(BALANCE_EVENTS.ORDER_PLACED, { side: 'SELL', symbol, amount });
      // Trigger notification refresh immediately
      triggerNotificationRefresh();
      
      // For Market orders, refresh balance immediately (order executes instantly)
      if (orderType === 'market') {
        setTimeout(() => refreshBalances(), 1000);
      }
      
      setTimeout(() => setSellMessage(null), 3000);
    } else {
      setSellMessage({ type: 'error', text: result.error?.message || 'Không thể đặt lệnh' });
    }
  };

  return (
    <div className="bg-[#181a20]">
      <div className="flex items-center border-b border-[#2b3139]">
        <button onClick={() => setOrderType("limit")} className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${orderType === "limit" ? "text-yellow-500 border-yellow-500" : "text-gray-400 border-transparent hover:text-white"}`}>
          Limit
        </button>
        <button onClick={() => setOrderType("market")} className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${orderType === "market" ? "text-yellow-500 border-yellow-500" : "text-gray-400 border-transparent hover:text-white"}`}>
          Market
        </button>
      </div>

      <div className="grid grid-cols-2 divide-x divide-[#2b3139]">
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-medium text-white">Buy {baseAsset}</h3>
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <Wallet size={10} />
              <span>{(usdtBalance ?? 0).toFixed(2)} USDT</span>
            </div>
          </div>

          {orderType !== "market" && (
            <div>
              <label className="block text-[10px] text-gray-400 mb-1">Price</label>
              <div className="relative">
                <input type="text" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} className="w-full bg-[#2b3139] text-white px-2 py-1.5 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500" placeholder="0.00" />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">USDT</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] text-gray-400 mb-1">Amount</label>
            <div className="relative">
              <input type="text" value={buyAmount} onChange={(e) => { setBuyAmount(e.target.value); const amount = parseFloat(e.target.value) || 0; const maxAmount = usdtBalance / parseFloat(buyPrice || "1"); setBuyPercentage((amount / maxAmount) * 100); }} className="w-full bg-[#2b3139] text-white px-2 py-1.5 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500" placeholder="0.00" />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">{baseAsset}</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-1">
            {[25, 50, 75, 100].map((percent) => (
              <button key={percent} onClick={() => handleBuyPercentageChange(percent)} className={`flex-1 text-[10px] py-1 rounded transition-colors ${Math.abs(buyPercentage - percent) < 1 ? "bg-green-500 text-white" : "bg-[#2b3139] text-gray-400 hover:text-white"}`}>
                {percent}%
              </button>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
              <span>Total</span>
              <span className="text-white font-medium">{calculateBuyTotal()} USDT</span>
            </div>
          </div>

          {buyMessage && (
            <div className={`flex items-center gap-2 text-[10px] px-2 py-1.5 rounded ${
              buyMessage.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
            }`}>
              {buyMessage.type === 'success' ? <CheckCircle size={12} /> : <XCircle size={12} />}
              <span>{buyMessage.text}</span>
            </div>
          )}

          <button 
            onClick={handleBuyOrder}
            disabled={isLoadingBuy}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 rounded text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoadingBuy && <Loader2 size={14} className="animate-spin" />}
            {isLoadingBuy ? 'Đang xử lý...' : `Buy ${baseAsset}`}
          </button>
        </div>

        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-medium text-white">Sell {baseAsset}</h3>
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <Wallet size={10} />
              <span>{(baseAssetBalance ?? 0).toFixed(4)} {baseAsset}</span>
            </div>
          </div>

          {orderType !== "market" && (
            <div>
              <label className="block text-[10px] text-gray-400 mb-1">Price</label>
              <div className="relative">
                <input type="text" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} className="w-full bg-[#2b3139] text-white px-2 py-1.5 rounded text-xs focus:outline-none focus:ring-1 focus:ring-red-500" placeholder="0.00" />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">USDT</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] text-gray-400 mb-1">Amount</label>
            <div className="relative">
              <input type="text" value={sellAmount} onChange={(e) => { setSellAmount(e.target.value); const amount = parseFloat(e.target.value) || 0; setSellPercentage((amount / baseAssetBalance) * 100); }} className="w-full bg-[#2b3139] text-white px-2 py-1.5 rounded text-xs focus:outline-none focus:ring-1 focus:ring-red-500" placeholder="0.00" />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">{baseAsset}</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-1">
            {[25, 50, 75, 100].map((percent) => (
              <button key={percent} onClick={() => handleSellPercentageChange(percent)} className={`flex-1 text-[10px] py-1 rounded transition-colors ${Math.abs(sellPercentage - percent) < 1 ? "bg-red-500 text-white" : "bg-[#2b3139] text-gray-400 hover:text-white"}`}>
                {percent}%
              </button>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
              <span>Total</span>
              <span className="text-white font-medium">{calculateSellTotal()} USDT</span>
            </div>
          </div>

          {sellMessage && (
            <div className={`flex items-center gap-2 text-[10px] px-2 py-1.5 rounded ${
              sellMessage.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
            }`}>
              {sellMessage.type === 'success' ? <CheckCircle size={12} /> : <XCircle size={12} />}
              <span>{sellMessage.text}</span>
            </div>
          )}

          <button 
            onClick={handleSellOrder}
            disabled={isLoadingSell}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 rounded text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoadingSell && <Loader2 size={14} className="animate-spin" />}
            {isLoadingSell ? 'Đang xử lý...' : `Sell ${baseAsset}`}
          </button>
        </div>
      </div>
    </div>
  );
}
