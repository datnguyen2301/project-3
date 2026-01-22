"use client";

import { useState, useEffect } from "react";
import { Search, ChevronRight, TrendingUp, Clock, Loader2, CheckCircle, Wallet, RefreshCw } from "lucide-react";
import { getAllTickers, type Ticker24h } from "@/services/binanceApi";
import { 
  getPaymentMethods, 
  initiateBuy, 
  getTransactions,
  type PaymentMethod,
  type FiatTransaction 
} from "@/services/fiatApi";
import { buyCryptoWithVnd } from "@/services/tradeApi";
import { useAuth } from "@/contexts/AuthContext";
import { useBalance, BALANCE_EVENTS } from "@/contexts/BalanceContext";
import { triggerNotificationRefresh } from "@/services/notificationApi";

interface CryptoOption {
  symbol: string;
  name: string;
  price: number;
  priceVND: number;
  change: number;
}

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
};

// Tỷ giá USD/VND - phải khớp với backend (25,000)
const USD_TO_VND = 25000;

// Default payment methods as fallback
const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'stripe', name: 'Thẻ tín dụng/Ghi nợ', type: 'card', provider: 'stripe', minAmount: 10, maxAmount: 10000, fee: 2.5, processingTime: 'Ngay lập tức' },
  { id: 'bank', name: 'Chuyển khoản ngân hàng', type: 'bank', provider: 'manual', minAmount: 100, maxAmount: 50000, fee: 0, processingTime: '1-3 ngày làm việc' },
];

// Default crypto list as fallback when API fails
const DEFAULT_CRYPTO_LIST: CryptoOption[] = [
  { symbol: 'BTC', name: 'Bitcoin', price: 95000, priceVND: 95000 * USD_TO_VND, change: 2.5 },
  { symbol: 'ETH', name: 'Ethereum', price: 3400, priceVND: 3400 * USD_TO_VND, change: 1.8 },
  { symbol: 'BNB', name: 'Binance Coin', price: 720, priceVND: 720 * USD_TO_VND, change: 0.5 },
  { symbol: 'SOL', name: 'Solana', price: 190, priceVND: 190 * USD_TO_VND, change: 3.2 },
  { symbol: 'XRP', name: 'Ripple', price: 2.3, priceVND: 2.3 * USD_TO_VND, change: -0.8 },
  { symbol: 'ADA', name: 'Cardano', price: 1.05, priceVND: 1.05 * USD_TO_VND, change: 1.2 },
  { symbol: 'DOGE', name: 'Dogecoin', price: 0.38, priceVND: 0.38 * USD_TO_VND, change: 5.1 },
  { symbol: 'DOT', name: 'Polkadot', price: 7.5, priceVND: 7.5 * USD_TO_VND, change: -1.5 },
  { symbol: 'MATIC', name: 'Polygon', price: 0.52, priceVND: 0.52 * USD_TO_VND, change: 2.1 },
  { symbol: 'LTC', name: 'Litecoin', price: 105, priceVND: 105 * USD_TO_VND, change: 0.9 },
];

type BuyMode = 'fiat' | 'wallet';

export default function BuyCrypto() {
  const { isAuthenticated, refreshBalances } = useAuth();
  const { getAvailableBalance, notifyBalanceChange, isLoading: balanceLoading, refreshBalances: refreshContextBalances } = useBalance();
  
  const [cryptoList, setCryptoList] = useState<CryptoOption[]>([]);
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoOption | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [transactions, setTransactions] = useState<FiatTransaction[]>([]);
  const [amount, setAmount] = useState<string>("100");
  const [amountVND, setAmountVND] = useState<string>("1000000");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCryptoList, setShowCryptoList] = useState(false);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [buySuccess, setBuySuccess] = useState(false);
  const [error, setError] = useState("");
  
  // Store successful transaction details for display
  const [successDetails, setSuccessDetails] = useState<{
    cryptoAmount: string;
    vndAmount: string;
    crypto: string;
  } | null>(null);
  
  // New states for wallet mode
  const [buyMode, setBuyMode] = useState<BuyMode>('fiat');
  
  // Get VND balance from context
  const vndBalanceAmount = getAvailableBalance('VND');
  const vndBalance = vndBalanceAmount > 0 ? { free: vndBalanceAmount, asset: 'VND', locked: 0, total: vndBalanceAmount } : null;

  // Fetch crypto data and payment methods
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tickers, methods, txns] = await Promise.all([
          getAllTickers(),
          getPaymentMethods(),
          getTransactions()
        ]);

        // Process tickers
        const usdtPairs = tickers
          .filter((t: Ticker24h) => t.symbol.endsWith('USDT'))
          .map((ticker: Ticker24h) => {
            const symbol = ticker.symbol.replace('USDT', '');
            const priceUSD = parseFloat(String(ticker.price || ticker.lastPrice));
            return {
              symbol,
              name: CRYPTO_NAMES[symbol] || symbol,
              price: priceUSD,
              priceVND: priceUSD * USD_TO_VND,
              change: parseFloat(String(ticker.priceChangePercent)),
            };
          })
          .filter((crypto: CryptoOption) => CRYPTO_NAMES[crypto.symbol])
          .slice(0, 20);
        
        // Use fetched data or fallback
        const cryptoToUse = usdtPairs.length > 0 ? usdtPairs : DEFAULT_CRYPTO_LIST;
        setCryptoList(cryptoToUse);
        setSelectedCrypto(cryptoToUse[0]);

        const paymentMethodsToUse = methods.length > 0 ? methods : DEFAULT_PAYMENT_METHODS;
        setPaymentMethods(paymentMethodsToUse);
        setSelectedPayment(paymentMethodsToUse[0]);

        setTransactions(txns);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        // Use fallback data on error
        setCryptoList(DEFAULT_CRYPTO_LIST);
        setSelectedCrypto(DEFAULT_CRYPTO_LIST[0]);
        setPaymentMethods(DEFAULT_PAYMENT_METHODS);
        setSelectedPayment(DEFAULT_PAYMENT_METHODS[0]);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredCryptos = cryptoList.filter(
    (crypto) =>
      crypto.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      crypto.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate crypto amount based on mode
  const calculateCrypto = () => {
    if (!selectedCrypto) return "0";
    
    if (buyMode === 'wallet') {
      const numAmount = parseFloat(amountVND) || 0;
      return (numAmount / selectedCrypto.priceVND).toFixed(6);
    } else {
      if (!selectedPayment) return "0";
      const numAmount = parseFloat(amount) || 0;
      const fee = selectedPayment.fee / 100;
      const amountAfterFee = numAmount * (1 - fee);
      return (amountAfterFee / selectedCrypto.price).toFixed(6);
    }
  };

  // Format VND
  const formatVND = (value: number) => {
    return new Intl.NumberFormat('vi-VN').format(value);
  };

  // Check if can buy with wallet
  const canBuyWithWallet = () => {
    if (!vndBalance || !amountVND) return false;
    const numAmount = parseFloat(amountVND) || 0;
    return numAmount > 0 && numAmount <= vndBalance.free;
  };

  // Handle buy with wallet balance
  const handleBuyWithWallet = async () => {
    if (!selectedCrypto || !canBuyWithWallet()) return;
    
    setBuying(true);
    setError("");
    
    try {
      // Use trade/buy endpoint to buy crypto with VND
      const response = await buyCryptoWithVnd({
        cryptoCurrency: selectedCrypto.symbol,
        quoteAmount: parseFloat(amountVND) // Số tiền VND muốn chi
      });
      
      if (response.success) {
        // Save transaction details before showing success
        // Backend returns: { data: { trade: { cryptoAmount, vndAmount, ... }, balances: {...} } }
        const tradeData = response.data?.trade || response.data;
        const cryptoReceived = tradeData?.cryptoAmount?.toString() || calculateCrypto();
        setSuccessDetails({
          cryptoAmount: cryptoReceived,
          vndAmount: amountVND,
          crypto: selectedCrypto.symbol
        });
        setBuySuccess(true);
        // Notify all components about balance change
        notifyBalanceChange(BALANCE_EVENTS.BUY_SUCCESS, { 
          crypto: selectedCrypto.symbol, 
          amountVND: parseFloat(amountVND) 
        });
        // Trigger notification refresh immediately
        triggerNotificationRefresh();
        await refreshBalances();
        setTimeout(() => {
          setBuySuccess(false);
          setSuccessDetails(null);
          getTransactions().then(setTransactions);
        }, 3000);
      } else {
        setError(response.error?.message || 'Không thể thực hiện giao dịch');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setBuying(false);
    }
  };

  const handleBuy = async () => {
    // Use wallet mode handler if in wallet mode
    if (buyMode === 'wallet') {
      return handleBuyWithWallet();
    }
    
    if (!selectedCrypto || !selectedPayment) return;
    
    setBuying(true);
    setError("");
    
    try {
      const response = await initiateBuy({
        cryptoSymbol: selectedCrypto.symbol,
        fiatAmount: parseFloat(amount),
        fiatCurrency: 'USD',
        method: selectedPayment.id
      });
      
      // Check if response was successful
      if (response.success && response.data) {
        // Notify all components about balance change
        notifyBalanceChange(BALANCE_EVENTS.BUY_SUCCESS, { 
          crypto: selectedCrypto.symbol, 
          amountUSD: parseFloat(amount) 
        });
        // Trigger notification refresh immediately
        triggerNotificationRefresh();
        
        // If using Stripe, redirect to checkout
        if (response.data.transaction?.clientSecret) {
          // In production, you would use Stripe.js to handle the payment
          // For now, we'll show success
          setBuySuccess(true);
          setTimeout(() => {
            setBuySuccess(false);
            // Refresh transactions
            getTransactions().then(setTransactions);
          }, 3000);
        } else if (response.data.instructions) {
          // Show bank transfer instructions
          alert(response.data.instructions);
          setBuySuccess(true);
        } else {
          // Generic success
          setBuySuccess(true);
          setTimeout(() => setBuySuccess(false), 3000);
        }
      } else {
        setError(response.error?.message || 'Failed to process payment');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process payment');
    } finally {
      setBuying(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#0b0e11] text-white p-6 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading crypto data...</p>
        </div>
      </div>
    );
  }

  if (!selectedCrypto) {
    return (
      <div className="bg-[#0b0e11] text-white p-6 min-h-screen flex items-center justify-center">
        <p className="text-gray-400">No crypto data available</p>
      </div>
    );
  }

  // Success overlay
  if (buySuccess && successDetails) {
    return (
      <div className="bg-[#0b0e11] text-white p-6 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Mua Thành Công!</h2>
          <p className="text-gray-400">
            Bạn đã mua {successDetails.cryptoAmount} {successDetails.crypto} với giá {new Intl.NumberFormat('vi-VN').format(parseFloat(successDetails.vndAmount))} VND
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0b0e11] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Mua Crypto</h1>
          <p className="text-gray-400">Mua tiền điện tử bằng tiền fiat hoặc số dư ví</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Buy Form */}
          <div className="lg:col-span-2 bg-[#1e2329] rounded-lg p-6 border border-[#2b3139]">
            <div className="space-y-6">
              {/* Buy Mode Toggle */}
              {isAuthenticated && (
                <div className="flex gap-2 p-1 bg-[#2b3139] rounded-lg">
                  <button
                    onClick={() => setBuyMode('fiat')}
                    className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors ${
                      buyMode === 'fiat'
                        ? 'bg-yellow-500 text-black'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    💳 Thanh toán
                  </button>
                  <button
                    onClick={() => setBuyMode('wallet')}
                    className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors ${
                      buyMode === 'wallet'
                        ? 'bg-yellow-500 text-black'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    👛 Dùng số dư VND
                  </button>
                </div>
              )}

              {/* Wallet Balance Info (only in wallet mode) */}
              {buyMode === 'wallet' && isAuthenticated && (
                <div className="bg-linear-to-r from-[#2b3139] to-[#1e2329] rounded-lg p-4 border border-[#363d47]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                        <Wallet size={20} className="text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Số dư ví VND</p>
                        <p className="text-xl font-bold text-white">
                          {balanceLoading ? (
                            <Loader2 size={20} className="animate-spin" />
                          ) : vndBalance ? (
                            `${formatVND(vndBalance.free)} VND`
                          ) : (
                            '0 VND'
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={refreshContextBalances}
                      disabled={balanceLoading}
                      className="p-2 text-gray-400 hover:text-white hover:bg-[#363d47] rounded-lg transition-colors"
                    >
                      <RefreshCw size={18} className={balanceLoading ? 'animate-spin' : ''} />
                    </button>
                  </div>
                  {vndBalance && vndBalance.free < 100000 && (
                    <div className="mt-3 p-2 bg-yellow-500/10 rounded text-yellow-400 text-sm flex items-center justify-between">
                      <span>Số dư không đủ để mua crypto</span>
                      <a href="/deposit" className="underline hover:no-underline">Nạp tiền</a>
                    </div>
                  )}
                </div>
              )}

              {/* Amount Input - changes based on mode */}
              {buyMode === 'wallet' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Số tiền VND muốn dùng
                  </label>
                  <div className="bg-[#2b3139] rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={amountVND ? formatVND(parseInt(amountVND)) : ''}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9]/g, '');
                          setAmountVND(value);
                        }}
                        className="bg-transparent text-white text-3xl font-bold outline-none w-full"
                        placeholder="0"
                      />
                      <span className="text-gray-400 text-xl font-semibold ml-4">VND</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {[100000, 500000, 1000000, 5000000].map((val) => (
                        <button
                          key={val}
                          onClick={() => setAmountVND(val.toString())}
                          className="flex-1 bg-[#1e2329] hover:bg-[#2b3139] text-gray-400 hover:text-white py-1.5 rounded text-sm font-medium transition-colors"
                        >
                          {formatVND(val)}
                        </button>
                      ))}
                    </div>
                    {vndBalance && (
                      <button
                        onClick={() => setAmountVND(Math.floor(vndBalance.free).toString())}
                        className="w-full mt-2 text-yellow-500 hover:text-yellow-400 text-sm"
                      >
                        Dùng tối đa ({formatVND(Math.floor(vndBalance.free))} VND)
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Số tiền (USD)
                  </label>
                  <div className="bg-[#2b3139] rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={amount}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          if (value === '' || /^\d*\.?\d*$/.test(value)) {
                            setAmount(value);
                          }
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="bg-transparent text-white text-3xl font-bold outline-none w-full"
                        placeholder="0"
                      />
                      <span className="text-gray-400 text-xl font-semibold ml-4">USD</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {["50", "100", "500", "1000"].map((val) => (
                        <button
                          key={val}
                          onClick={() => setAmount(val)}
                          className="flex-1 bg-[#1e2329] hover:bg-[#2b3139] text-gray-400 hover:text-white py-1.5 rounded text-sm font-medium transition-colors"
                        >
                          ${val}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Crypto Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Tôi muốn mua
                </label>
                <div className="relative">
                  <button
                    onClick={() => setShowCryptoList(!showCryptoList)}
                    className="w-full bg-[#2b3139] text-white px-4 py-4 rounded border border-[#2b3139] hover:border-yellow-500 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center font-bold text-black">
                        {selectedCrypto.symbol[0]}
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">{selectedCrypto.name}</div>
                        <div className="text-sm text-gray-400">{selectedCrypto.symbol}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-medium">${selectedCrypto.price.toLocaleString()}</div>
                        {buyMode === 'wallet' && (
                          <div className="text-xs text-gray-400">≈ {formatVND(selectedCrypto.priceVND)} VND</div>
                        )}
                      </div>
                      <ChevronRight className={`transition-transform ${showCryptoList ? 'rotate-90' : ''}`} />
                    </div>
                  </button>

                  {showCryptoList && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-[#2b3139] border border-[#2b3139] rounded-lg shadow-xl z-10 max-h-80 overflow-y-auto">
                      <div className="p-3 border-b border-[#1e2329]">
                        <div className="relative">
                          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm crypto..."
                            className="w-full bg-[#1e2329] text-white pl-10 pr-4 py-2 rounded border border-[#1e2329] focus:outline-none focus:border-yellow-500"
                          />
                        </div>
                      </div>
                      {filteredCryptos.map((crypto) => (
                        <button
                          key={crypto.symbol}
                          onClick={() => {
                            setSelectedCrypto(crypto);
                            setShowCryptoList(false);
                          }}
                          className="w-full px-4 py-3 hover:bg-[#1e2329] transition-colors flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center font-bold text-black">
                              {crypto.symbol[0]}
                            </div>
                            <div className="text-left">
                              <div className="font-semibold">{crypto.name}</div>
                              <div className="text-sm text-gray-400">{crypto.symbol}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">${crypto.price.toLocaleString()}</div>
                            <div className={`text-sm ${crypto.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {crypto.change >= 0 ? '+' : ''}{crypto.change.toFixed(2)}%
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* You will receive */}
              <div className="bg-[#2b3139] p-4 rounded">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Bạn sẽ nhận được</span>
                  <TrendingUp size={16} className="text-green-500" />
                </div>
                <div className="text-2xl font-bold text-yellow-500">
                  {calculateCrypto()} {selectedCrypto.symbol}
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  {buyMode === 'wallet' 
                    ? `≈ ${formatVND(parseFloat(amountVND) || 0)} VND`
                    : `≈ $${amount} USD`
                  }
                </div>
              </div>

              {/* Payment Method - only show in fiat mode */}
              {buyMode === 'fiat' && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-3">
                    Phương thức thanh toán
                  </label>
                  <div className="space-y-3">
                    {paymentMethods.map((method) => (
                      <button
                        key={method.id}
                        onClick={() => setSelectedPayment(method)}
                        className={`w-full p-4 rounded border transition-all ${
                          selectedPayment?.id === method.id
                            ? 'border-yellow-500 bg-[#2b3139]'
                            : 'border-[#2b3139] bg-[#1e2329] hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">
                              {method.type === 'card' ? '💳' : method.type === 'bank' ? '🏦' : '💰'}
                            </span>
                            <div className="text-left">
                              <div className="font-semibold">{method.name}</div>
                              <div className="text-sm text-gray-400">Phí: {method.fee}%</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <Clock size={14} />
                            {method.processingTime}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm">
                  {error}
                </div>
              )}

              {/* Buy Button */}
              <button
                onClick={handleBuy}
                disabled={
                  buying || 
                  (buyMode === 'fiat' && (!amount || parseFloat(amount) <= 0)) ||
                  (buyMode === 'wallet' && !canBuyWithWallet())
                }
                className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-4 rounded transition-colors text-lg flex items-center justify-center gap-2"
              >
                {buying && <Loader2 size={20} className="animate-spin" />}
                {buying ? 'Đang xử lý...' : `Mua ${selectedCrypto.symbol}`}
              </button>

              {/* Disclaimer */}
              <p className="text-xs text-gray-500 text-center">
                Bằng việc nhấn &quot;Mua&quot;, bạn đồng ý với Điều khoản dịch vụ và thừa nhận rằng đầu tư 
                tiền điện tử có rủi ro. Số lượng cuối cùng có thể thay đổi do biến động thị trường.
              </p>
            </div>
          </div>

          {/* Side Info */}
          <div className="space-y-6">
            {/* Price Info */}
            <div className="bg-[#1e2329] rounded-lg p-6 border border-[#2b3139]">
              <h3 className="text-lg font-semibold mb-4">Thông tin giá</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Giá hiện tại</span>
                  <span className="font-semibold">${selectedCrypto.price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Giá VND</span>
                  <span className="font-semibold">{formatVND(selectedCrypto.priceVND)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Thay đổi 24h</span>
                  <span className={selectedCrypto.change >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {selectedCrypto.change >= 0 ? '+' : ''}{selectedCrypto.change.toFixed(2)}%
                  </span>
                </div>
                {buyMode === 'fiat' && selectedPayment && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Phí thanh toán</span>
                      <span className="font-semibold">{selectedPayment.fee}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Thời gian xử lý</span>
                      <span className="font-semibold">{selectedPayment.processingTime}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Quick Buy VND - only in wallet mode */}
            {buyMode === 'wallet' && (
              <div className="bg-[#1e2329] rounded-lg p-6 border border-[#2b3139]">
                <h3 className="text-lg font-semibold mb-4">Mua nhanh</h3>
                <div className="space-y-2">
                  {[500000, 1000000, 2000000, 5000000].map((val) => (
                    <button
                      key={val}
                      onClick={() => setAmountVND(val.toString())}
                      disabled={vndBalance !== null && val > vndBalance.free}
                      className="w-full bg-[#2b3139] hover:bg-[#3b4149] disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded transition-colors"
                    >
                      {formatVND(val)} VND
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Buy USD - only in fiat mode */}
            {buyMode === 'fiat' && (
              <div className="bg-[#1e2329] rounded-lg p-6 border border-[#2b3139]">
                <h3 className="text-lg font-semibold mb-4">Mua nhanh</h3>
                <div className="space-y-2">
                  {["$50", "$100", "$500", "$1000"].map((val) => (
                    <button
                      key={val}
                      onClick={() => setAmount(val.replace("$", ""))}
                      className="w-full bg-[#2b3139] hover:bg-[#3b4149] text-white py-2 rounded transition-colors"
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Why Buy Crypto */}
            <div className="bg-[#1e2329] rounded-lg p-6 border border-[#2b3139]">
              <h3 className="text-lg font-semibold mb-4">Tại sao nên mua Crypto?</h3>
              <ul className="space-y-3 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Nền tảng an toàn & được quản lý</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Phí thấp & xử lý nhanh chóng</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Hỗ trợ khách hàng 24/7</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Nhiều phương thức thanh toán</span>
                </li>
              </ul>
            </div>

            {/* Recent Transactions */}
            {transactions.length > 0 && (
              <div className="bg-[#1e2329] rounded-lg p-6 border border-[#2b3139]">
                <h3 className="text-lg font-semibold mb-4">Giao dịch gần đây</h3>
                <div className="space-y-3">
                  {transactions.slice(0, 5).map((tx) => (
                    <div key={tx.id} className="flex justify-between items-center text-sm">
                      <div>
                        <span className="text-white">{tx.cryptoAmount} {tx.cryptoSymbol}</span>
                        <span className="text-gray-400 ml-2">${tx.fiatAmount}</span>
                      </div>
                      <span className={
                        tx.status === 'COMPLETED' ? 'text-green-500' :
                        tx.status === 'PENDING' ? 'text-yellow-500' :
                        tx.status === 'FAILED' ? 'text-red-500' : 'text-gray-400'
                      }>
                        {tx.status === 'COMPLETED' ? 'Thành công' :
                         tx.status === 'PENDING' ? 'Đang xử lý' :
                         tx.status === 'FAILED' ? 'Thất bại' : tx.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
