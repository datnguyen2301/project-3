"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, Shield, Target, Info, Loader2 } from "lucide-react";
import { placeOrder } from "@/services/ordersApi";
import { useAuth } from "@/contexts/AuthContext";
import { useBalance, BALANCE_EVENTS } from "@/contexts/BalanceContext";

type OrderType = "limit" | "market" | "stop-loss" | "take-profit" | "oco";
type OrderSide = "buy" | "sell";

interface AdvancedOrderFormProps {
  symbol?: string;
  currentPrice?: number;
  onOrderPlaced?: () => void;
}

export default function AdvancedOrderForm({ symbol = "BTCUSDT", currentPrice = 43250.50, onOrderPlaced }: AdvancedOrderFormProps) {
  const { isAuthenticated } = useAuth();
  const { notifyBalanceChange } = useBalance();
  const [orderType, setOrderType] = useState<OrderType>("limit");
  const [side, setSide] = useState<OrderSide>("buy");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [takeProfitPrice, setTakeProfitPrice] = useState("");
  const [stopLossPrice, setStopLossPrice] = useState("");
  const [mounted, setMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Only run on client side
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  // Update price when currentPrice changes
  useEffect(() => {
    if (currentPrice && !price) {
      setPrice(currentPrice.toString());
    }
  }, [currentPrice, price]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    if (!isAuthenticated) {
      setError("Vui lòng đăng nhập để đặt lệnh");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError("Vui lòng nhập số lượng hợp lệ");
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Map orderType to API format
      const apiOrderType = orderType === 'limit' ? 'LIMIT' : 
                          orderType === 'market' ? 'MARKET' :
                          orderType === 'stop-loss' ? 'STOP_LOSS' :
                          orderType === 'take-profit' ? 'TAKE_PROFIT' : 'LIMIT';
      
      const response = await placeOrder({
        symbol: symbol,
        side: side.toUpperCase() as 'BUY' | 'SELL',
        type: apiOrderType as 'LIMIT' | 'MARKET' | 'STOP_LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT',
        quantity: parseFloat(amount),
        price: orderType !== 'market' ? parseFloat(price) : undefined,
        stopPrice: stopPrice ? parseFloat(stopPrice) : undefined,
      });
      
      if (response.success) {
        setSuccess(`Đặt lệnh ${side === 'buy' ? 'MUA' : 'BÁN'} thành công!`);
        setAmount("");
        notifyBalanceChange(BALANCE_EVENTS.ORDER_PLACED, { symbol, side, amount });
        onOrderPlaced?.();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(response.error?.message || "Không thể đặt lệnh");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateProfitLoss = (targetPrice: number) => {
    if (!amount || !price) return null;
    const qty = parseFloat(amount);
    const entryPrice = parseFloat(price);
    const profit = qty * (targetPrice - entryPrice);
    const percentage = ((targetPrice - entryPrice) / entryPrice) * 100;
    return { profit, percentage };
  };

  const stopLossCalc = stopLossPrice ? calculateProfitLoss(parseFloat(stopLossPrice)) : null;
  const takeProfitCalc = takeProfitPrice ? calculateProfitLoss(parseFloat(takeProfitPrice)) : null;

  return (
    <div className="bg-[#181a20] rounded-lg p-6">
      <h3 className="text-xl font-semibold mb-6">Lệnh Nâng Cao</h3>

      {/* Order Type Selection */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        <button
          onClick={() => setOrderType("limit")}
          className={`px-3 py-2 text-sm rounded transition-colors ${
            orderType === "limit"
              ? "bg-yellow-500 text-black"
              : "bg-[#2b3139] text-gray-400 hover:text-white"
          }`}
        >
          Limit
        </button>
        <button
          onClick={() => setOrderType("market")}
          className={`px-3 py-2 text-sm rounded transition-colors ${
            orderType === "market"
              ? "bg-yellow-500 text-black"
              : "bg-[#2b3139] text-gray-400 hover:text-white"
          }`}
        >
          Market
        </button>
        <button
          onClick={() => setOrderType("stop-loss")}
          className={`px-3 py-2 text-sm rounded transition-colors ${
            orderType === "stop-loss"
              ? "bg-yellow-500 text-black"
              : "bg-[#2b3139] text-gray-400 hover:text-white"
          }`}
        >
          Stop-Loss
        </button>
        <button
          onClick={() => setOrderType("take-profit")}
          className={`px-3 py-2 text-sm rounded transition-colors ${
            orderType === "take-profit"
              ? "bg-yellow-500 text-black"
              : "bg-[#2b3139] text-gray-400 hover:text-white"
          }`}
        >
          Take-Profit
        </button>
        <button
          onClick={() => setOrderType("oco")}
          className={`px-3 py-2 text-sm rounded transition-colors ${
            orderType === "oco"
              ? "bg-yellow-500 text-black"
              : "bg-[#2b3139] text-gray-400 hover:text-white"
          }`}
        >
          OCO
        </button>
      </div>

      {/* Info Banner */}
      {orderType === "stop-loss" && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
          <Shield className="text-red-500 shrink-0 mt-0.5" size={20} />
          <div className="text-sm">
            <strong className="text-red-500">Stop-Loss:</strong>{" "}
            <span className="text-gray-300">
              Tự động bán khi giá giảm xuống mức stop để giảm thiểu thua lỗ
            </span>
          </div>
        </div>
      )}

      {orderType === "take-profit" && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start gap-3">
          <Target className="text-green-500 shrink-0 mt-0.5" size={20} />
          <div className="text-sm">
            <strong className="text-green-500">Take-Profit:</strong>{" "}
            <span className="text-gray-300">
              Tự động bán khi giá tăng lên mức target để chốt lời
            </span>
          </div>
        </div>
      )}

      {orderType === "oco" && (
        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-start gap-3">
          <Info className="text-blue-500 shrink-0 mt-0.5" size={20} />
          <div className="text-sm">
            <strong className="text-blue-500">OCO (One-Cancels-Other):</strong>{" "}
            <span className="text-gray-300">
              Đặt cả Stop-Loss và Take-Profit cùng lúc. Khi một lệnh khớp, lệnh còn lại sẽ tự động hủy
            </span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Buy/Sell Tabs */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSide("buy")}
            className={`py-3 rounded font-medium transition-colors ${
              side === "buy"
                ? "bg-green-500 text-black"
                : "bg-[#2b3139] text-gray-400 hover:text-white"
            }`}
          >
            <TrendingUp className="inline mr-2" size={18} />
            Mua
          </button>
          <button
            type="button"
            onClick={() => setSide("sell")}
            className={`py-3 rounded font-medium transition-colors ${
              side === "sell"
                ? "bg-red-500 text-black"
                : "bg-[#2b3139] text-gray-400 hover:text-white"
            }`}
          >
            <TrendingDown className="inline mr-2" size={18} />
            Bán
          </button>
        </div>

        {/* Price (for limit/stop-loss/take-profit) */}
        {orderType !== "market" && (
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              {orderType === "stop-loss" || orderType === "oco" ? "Giá Stop" : "Giá"}
            </label>
            <input
              type="number"
              value={orderType === "stop-loss" || orderType === "oco" ? stopPrice : price}
              onChange={(e) => orderType === "stop-loss" || orderType === "oco" ? setStopPrice(e.target.value) : setPrice(e.target.value)}
              placeholder={currentPrice.toString()}
              className="w-full bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139] focus:outline-none focus:border-yellow-500"
              step="0.01"
            />
            <div className="text-xs text-gray-400 mt-1" suppressHydrationWarning>
              Giá hiện tại: ${mounted ? currentPrice.toFixed(2) : '0.00'}
            </div>
          </div>
        )}

        {/* Take Profit (for OCO orders) */}
        {orderType === "oco" && (
          <div>
            <label className="flex text-sm text-gray-400 mb-2 items-center gap-2">
              <Target size={16} className="text-green-500" />
              Giá Take-Profit
            </label>
            <input
              type="number"
              value={takeProfitPrice}
              onChange={(e) => setTakeProfitPrice(e.target.value)}
              placeholder={(currentPrice * 1.05).toFixed(2)}
              className="w-full bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139] focus:outline-none focus:border-green-500"
              step="0.01"
            />
            {takeProfitCalc && mounted && (
              <div className="text-xs text-green-500 mt-1" suppressHydrationWarning>
                Lợi nhuận ước tính: ${takeProfitCalc.profit.toFixed(2)} ({takeProfitCalc.percentage > 0 ? '+' : ''}{takeProfitCalc.percentage.toFixed(2)}%)
              </div>
            )}
          </div>
        )}

        {/* Stop Loss (for OCO orders or standalone) */}
        {(orderType === "oco" || orderType === "stop-loss") && (
          <div>
            <label className="flex text-sm text-gray-400 mb-2 items-center gap-2">
              <Shield size={16} className="text-red-500" />
              {orderType === "oco" ? "Giá Stop-Loss" : "Giá Limit"}
            </label>
            <input
              type="number"
              value={stopLossPrice}
              onChange={(e) => setStopLossPrice(e.target.value)}
              placeholder={(currentPrice * 0.95).toFixed(2)}
              className="w-full bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139] focus:outline-none focus:border-red-500"
              step="0.01"
            />
            {stopLossCalc && mounted && (
              <div className="text-xs text-red-500 mt-1" suppressHydrationWarning>
                Thua lỗ tối đa: ${stopLossCalc.profit.toFixed(2)} ({stopLossCalc.percentage.toFixed(2)}%)
              </div>
            )}
          </div>
        )}

        {/* Take Profit Price (for standalone take-profit) */}
        {orderType === "take-profit" && (
          <div>
            <label className="block text-sm text-gray-400 mb-2">Giá Limit</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={(currentPrice * 1.05).toFixed(2)}
              className="w-full bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139] focus:outline-none focus:border-green-500"
              step="0.01"
            />
          </div>
        )}

        {/* Amount */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Số Lượng</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139] focus:outline-none focus:border-yellow-500"
            step="0.00001"
          />
        </div>

        {/* Percentage Buttons */}
        <div className="grid grid-cols-4 gap-2">
          {[25, 50, 75, 100].map((percent) => (
            <button
              key={percent}
              type="button"
              onClick={() => setAmount((0.01 * (percent / 100)).toFixed(5))}
              className="bg-[#2b3139] hover:bg-[#3b4149] text-gray-400 hover:text-white py-2 rounded text-sm transition-colors"
            >
              {percent}%
            </button>
          ))}
        </div>

        {/* Total */}
        {amount && (price || stopPrice || takeProfitPrice) && mounted && (
          <div className="pt-3 border-t border-[#2b3139]">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-400">Tổng cộng:</span>
              <span className="font-medium" suppressHydrationWarning>
                ${(parseFloat(amount) * (parseFloat(price || stopPrice || takeProfitPrice || "0"))).toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Error/Success Messages */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-500 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded text-green-500 text-sm">
            {success}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !isAuthenticated}
          className={`w-full py-3 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
            side === "buy"
              ? "bg-green-500 hover:bg-green-600 text-black"
              : "bg-red-500 hover:bg-red-600 text-black"
          }`}
        >
          {isSubmitting && <Loader2 size={18} className="animate-spin" />}
          {isSubmitting ? "Đang xử lý..." : `${side === "buy" ? "Mua" : "Bán"} ${symbol.replace("USDT", "")}`}
        </button>
        
        {!isAuthenticated && (
          <p className="text-center text-yellow-500 text-sm">Vui lòng đăng nhập để đặt lệnh</p>
        )}
      </form>

      {/* Warning */}
      {orderType !== "limit" && orderType !== "market" && (
        <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded flex items-start gap-2">
          <AlertTriangle className="text-yellow-500 shrink-0 mt-0.5" size={16} />
          <p className="text-xs text-gray-300">
            Lệnh {orderType === "stop-loss" ? "Stop-Loss" : orderType === "take-profit" ? "Take-Profit" : "OCO"} chỉ được kích hoạt khi giá thị trường đạt mức đã đặt
          </p>
        </div>
      )}
    </div>
  );
}
