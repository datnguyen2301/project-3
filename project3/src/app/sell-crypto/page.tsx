"use client";

import { useState, useEffect } from "react";
import { 
  Search, 
  ChevronRight, 
  TrendingDown, 
  Loader2, 
  CheckCircle, 
  Wallet, 
  RefreshCw,
  AlertCircle,
  ArrowDownUp
} from "lucide-react";
import Link from "next/link";
import Header from "@/components/Header";
import { getAllTickers, type Ticker24h } from "@/services/binanceApi";
import { type Balance } from "@/services/walletApi";
import { sellCryptoForVnd } from "@/services/tradeApi";
import { useAuth } from "@/contexts/AuthContext";
import { useBalance, BALANCE_EVENTS } from "@/contexts/BalanceContext";

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
  USDT: "Tether",
};

// Tỷ giá USD/VND - phải khớp với backend (25,000)
const USD_TO_VND = 25000;

// Default crypto list as fallback
const DEFAULT_CRYPTO_LIST: CryptoOption[] = [
  { symbol: 'BTC', name: 'Bitcoin', price: 95000, priceVND: 95000 * USD_TO_VND, change: 2.5 },
  { symbol: 'ETH', name: 'Ethereum', price: 3400, priceVND: 3400 * USD_TO_VND, change: 1.8 },
  { symbol: 'BNB', name: 'Binance Coin', price: 720, priceVND: 720 * USD_TO_VND, change: 0.5 },
  { symbol: 'SOL', name: 'Solana', price: 190, priceVND: 190 * USD_TO_VND, change: 3.2 },
  { symbol: 'XRP', name: 'Ripple', price: 2.3, priceVND: 2.3 * USD_TO_VND, change: -0.8 },
];

// Format VND
const formatVND = (value: number) => {
  return new Intl.NumberFormat('vi-VN').format(value);
};

export default function SellCrypto() {
  const { isAuthenticated, refreshBalances } = useAuth();
  const { getAvailableBalance, notifyBalanceChange, isLoading: balanceLoading, refreshBalances: refreshContextBalances } = useBalance();
  
  // Crypto list and selection
  const [cryptoList, setCryptoList] = useState<CryptoOption[]>([]);
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoOption | null>(null);
  const [showCryptoList, setShowCryptoList] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Form
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [selling, setSelling] = useState(false);
  const [sellSuccess, setSellSuccess] = useState(false);
  const [error, setError] = useState("");
  
  // Store successful transaction details for display
  const [successDetails, setSuccessDetails] = useState<{
    cryptoAmount: string;
    vndAmount: number;
    crypto: string;
  } | null>(null);

  // Get crypto balance from context  
  const cryptoBalanceAmount = selectedCrypto ? getAvailableBalance(selectedCrypto.symbol) : 0;
  const cryptoBalance: Balance | null = selectedCrypto && cryptoBalanceAmount > 0 
    ? { free: cryptoBalanceAmount, asset: selectedCrypto.symbol, locked: 0, total: cryptoBalanceAmount } 
    : null;

  // Fetch crypto prices
  useEffect(() => {
    const fetchData = async () => {
      try {
        const tickers = await getAllTickers();
        
        const usdtPairs = tickers
          .filter((t: Ticker24h) => t.symbol.endsWith('USDT'))
          .map((ticker: Ticker24h) => {
            const symbol = ticker.symbol.replace('USDT', '');
            const priceUSD = parseFloat(String(ticker.price || ticker.lastPrice)) || 0;
            const changePercent = parseFloat(String(ticker.priceChangePercent)) || 0;
            return {
              symbol,
              name: CRYPTO_NAMES[symbol] || symbol,
              price: priceUSD,
              priceVND: priceUSD * USD_TO_VND,
              change: changePercent,
            };
          })
          .filter((crypto: CryptoOption) => CRYPTO_NAMES[crypto.symbol] && crypto.price > 0)
          .slice(0, 20);

        const cryptoToUse = usdtPairs.length > 0 ? usdtPairs : DEFAULT_CRYPTO_LIST;
        setCryptoList(cryptoToUse);
        setSelectedCrypto(cryptoToUse[0]);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setCryptoList(DEFAULT_CRYPTO_LIST);
        setSelectedCrypto(DEFAULT_CRYPTO_LIST[0]);
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

  // Calculate VND amount
  const calculateVND = () => {
    if (!selectedCrypto || !amount) return 0;
    const numAmount = parseFloat(amount) || 0;
    return numAmount * selectedCrypto.priceVND;
  };

  // Check if can sell
  const canSell = () => {
    if (!cryptoBalance || !amount) return false;
    const numAmount = parseFloat(amount) || 0;
    return numAmount > 0 && numAmount <= cryptoBalance.free;
  };

  // Handle sell
  const handleSell = async () => {
    if (!selectedCrypto || !canSell()) return;
    
    setSelling(true);
    setError("");
    
    try {
      // Use trade/sell to sell crypto for VND
      const response = await sellCryptoForVnd({
        cryptoCurrency: selectedCrypto.symbol,
        amount: parseFloat(amount)
      });
      
      if (response.success) {
        // Save transaction details before resetting form
        // Backend returns: { data: { trade: { cryptoAmount, vndAmount, ... }, balances: {...} } }
        const tradeData = response.data?.trade || response.data;
        const soldAmount = amount;
        const receivedVND = tradeData?.vndAmount || calculateVND();
        
        setSuccessDetails({
          cryptoAmount: soldAmount,
          vndAmount: receivedVND,
          crypto: selectedCrypto.symbol
        });
        setSellSuccess(true);
        setAmount("");
        // Notify all components about balance change
        notifyBalanceChange(BALANCE_EVENTS.SELL_SUCCESS, {
          crypto: selectedCrypto.symbol,
          amount: parseFloat(soldAmount),
          vndAmount: receivedVND
        });
        await refreshBalances();
        setTimeout(() => {
          setSellSuccess(false);
          setSuccessDetails(null);
        }, 3000);
      } else {
        setError(response.error?.message || 'Không thể thực hiện giao dịch');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setSelling(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <>
        <Header />
        <div className="bg-[#0b0e11] text-white p-6 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Đang tải dữ liệu...</p>
          </div>
        </div>
      </>
    );
  }

  if (!selectedCrypto) {
    return (
      <>
        <Header />
        <div className="bg-[#0b0e11] text-white p-6 min-h-screen flex items-center justify-center">
          <p className="text-gray-400">Không có dữ liệu crypto</p>
        </div>
      </>
    );
  }

  // Success overlay
  if (sellSuccess && successDetails) {
    return (
      <>
        <Header />
        <div className="bg-[#0b0e11] text-white p-6 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Bán Thành Công!</h2>
            <p className="text-gray-400">
              Bạn đã bán {successDetails.cryptoAmount} {successDetails.crypto} và nhận được {formatVND(successDetails.vndAmount)} VND
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="bg-[#0b0e11] text-white p-6">
        <div className="max-w-6xl mx-auto">
          {/* Page Title */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-3xl font-bold">Bán Crypto</h1>
              <Link 
                href="/buy-crypto" 
                className="flex items-center gap-1 text-sm text-yellow-500 hover:text-yellow-400"
              >
                <ArrowDownUp size={16} />
                Chuyển sang Mua
              </Link>
            </div>
            <p className="text-gray-400">Bán tiền điện tử và nhận VND vào ví</p>
          </div>

          {/* Not authenticated warning */}
        {!isAuthenticated && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-3">
            <AlertCircle size={20} className="text-yellow-500" />
            <span className="text-yellow-400">Vui lòng đăng nhập để bán crypto</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Sell Form */}
          <div className="lg:col-span-2 bg-[#1e2329] rounded-lg p-6 border border-[#2b3139]">
            <div className="space-y-6">
              {/* Crypto Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Tôi muốn bán
                </label>
                <div className="relative">
                  <button
                    onClick={() => setShowCryptoList(!showCryptoList)}
                    className="w-full bg-[#2b3139] text-white px-4 py-4 rounded border border-[#2b3139] hover:border-yellow-500 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center font-bold text-white">
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
                        <div className="text-xs text-gray-400">≈ {formatVND(selectedCrypto.priceVND)} VND</div>
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
                            setAmount("");
                          }}
                          className="w-full px-4 py-3 hover:bg-[#1e2329] transition-colors flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center font-bold text-white">
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
                              {crypto.change >= 0 ? '+' : ''}{(crypto.change || 0).toFixed(2)}%
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Crypto Balance */}
              {isAuthenticated && (
                <div className="bg-linear-to-r from-[#2b3139] to-[#1e2329] rounded-lg p-4 border border-[#363d47]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
                        <Wallet size={20} className="text-yellow-500" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Số dư {selectedCrypto.symbol}</p>
                        <p className="text-xl font-bold text-white">
                          {balanceLoading ? (
                            <Loader2 size={20} className="animate-spin" />
                          ) : cryptoBalance && typeof cryptoBalance.free === 'number' ? (
                            `${cryptoBalance.free.toFixed(6)} ${selectedCrypto.symbol}`
                          ) : (
                            `0 ${selectedCrypto.symbol}`
                          )}
                        </p>
                        {cryptoBalance && typeof cryptoBalance.free === 'number' && cryptoBalance.free > 0 && (
                          <p className="text-xs text-gray-500">
                            ≈ {formatVND(cryptoBalance.free * selectedCrypto.priceVND)} VND
                          </p>
                        )}
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
                  {cryptoBalance && cryptoBalance.free === 0 && (
                    <div className="mt-3 p-2 bg-yellow-500/10 rounded text-yellow-400 text-sm flex items-center justify-between">
                      <span>Bạn chưa có {selectedCrypto.symbol} để bán</span>
                      <Link href="/buy-crypto" className="underline hover:no-underline">Mua ngay</Link>
                    </div>
                  )}
                </div>
              )}

              {/* Amount Input */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Số lượng {selectedCrypto.symbol} muốn bán
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
                      className="bg-transparent text-white text-3xl font-bold outline-none w-full"
                      placeholder="0"
                    />
                    <span className="text-gray-400 text-xl font-semibold ml-4">{selectedCrypto.symbol}</span>
                  </div>
                  {cryptoBalance && typeof cryptoBalance.free === 'number' && cryptoBalance.free > 0 && (
                    <>
                      <div className="flex gap-2 mt-3">
                        {[25, 50, 75, 100].map((pct) => (
                          <button
                            key={pct}
                            onClick={() => setAmount(((cryptoBalance.free || 0) * pct / 100).toFixed(6))}
                            className="flex-1 bg-[#1e2329] hover:bg-[#2b3139] text-gray-400 hover:text-white py-1.5 rounded text-sm font-medium transition-colors"
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setAmount((cryptoBalance.free || 0).toFixed(6))}
                        className="w-full mt-2 text-yellow-500 hover:text-yellow-400 text-sm"
                      >
                        Bán tối đa ({(cryptoBalance.free || 0).toFixed(6)} {selectedCrypto.symbol})
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* You will receive */}
              <div className="bg-[#2b3139] p-4 rounded">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Bạn sẽ nhận được</span>
                  <TrendingDown size={16} className="text-red-500" />
                </div>
                <div className="text-2xl font-bold text-green-500">
                  {formatVND(calculateVND())} VND
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  Giá: 1 {selectedCrypto.symbol} = {formatVND(selectedCrypto.priceVND)} VND
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm flex items-center gap-2">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              {/* Sell Button */}
              <button
                onClick={handleSell}
                disabled={selling || !isAuthenticated || !canSell()}
                className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded transition-colors text-lg flex items-center justify-center gap-2"
              >
                {selling && <Loader2 size={20} className="animate-spin" />}
                {selling ? 'Đang xử lý...' : `Bán ${selectedCrypto.symbol}`}
              </button>

              {/* Disclaimer */}
              <p className="text-xs text-gray-500 text-center">
                Bằng việc nhấn &quot;Bán&quot;, bạn đồng ý với Điều khoản dịch vụ. 
                Số tiền VND sẽ được cộng vào ví của bạn ngay lập tức. 
                Giá có thể thay đổi do biến động thị trường.
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
                  <span className="text-gray-400">Giá hiện tại (USD)</span>
                  <span className="font-semibold">${selectedCrypto.price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Giá hiện tại (VND)</span>
                  <span className="font-semibold">{formatVND(selectedCrypto.priceVND)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Thay đổi 24h</span>
                  <span className={selectedCrypto.change >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {selectedCrypto.change >= 0 ? '+' : ''}{(selectedCrypto.change || 0).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Phí giao dịch</span>
                  <span className="text-green-500">Miễn phí</span>
                </div>
              </div>
            </div>

            {/* Quick Sell */}
            {cryptoBalance && cryptoBalance.free > 0 && (
              <div className="bg-[#1e2329] rounded-lg p-6 border border-[#2b3139]">
                <h3 className="text-lg font-semibold mb-4">Bán nhanh</h3>
                <div className="space-y-2">
                  {[0.001, 0.01, 0.1, 0.5].map((val) => {
                    const displayVal = val <= cryptoBalance.free ? val : cryptoBalance.free;
                    return (
                      <button
                        key={val}
                        onClick={() => setAmount(displayVal.toString())}
                        disabled={displayVal > cryptoBalance.free}
                        className="w-full bg-[#2b3139] hover:bg-[#3b4149] disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded transition-colors"
                      >
                        {displayVal} {selectedCrypto.symbol}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* After Sell Info */}
            <div className="bg-[#1e2329] rounded-lg p-6 border border-[#2b3139]">
              <h3 className="text-lg font-semibold mb-4">Sau khi bán</h3>
              <ul className="space-y-3 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>VND được cộng vào ví ngay lập tức</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Có thể rút về ngân hàng</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Hoặc dùng mua crypto khác</span>
                </li>
              </ul>
              <Link 
                href="/withdraw" 
                className="mt-4 block w-full bg-[#2b3139] hover:bg-[#3b4149] text-white py-2 rounded text-center transition-colors"
              >
                Rút tiền về ngân hàng →
              </Link>
            </div>
          </div>
        </div>
        </div>
      </div>
    </>
  );
}
