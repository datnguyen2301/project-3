"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Lock, Zap, Shield, Info, Loader2, Wallet, AlertCircle } from "lucide-react";
import Header from "@/components/Header";
import { useBalance } from "@/contexts/BalanceContext";
import { 
  getEarnProducts, 
  getMyStakes, 
  stake as stakeApi, 
  unstake as unstakeApi,
  type EarnProduct, 
  type Stake,
  type StakeSummary 
} from "@/services/earnApi";

// Unused for now, but could be used for display names
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CRYPTO_NAMES: { [key: string]: string } = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  BNB: "BNB",
  SOL: "Solana",
  ADA: "Cardano",
  DOT: "Polkadot",
  MATIC: "Polygon",
  USDT: "Tether",
  USDC: "USD Coin",
};

export default function Earn() {
  const { getAvailableBalance } = useBalance();
  
  const [activeTab, setActiveTab] = useState<"products" | "my-stakes">("products");
  const [productFilter, setProductFilter] = useState<"all" | "flexible" | "locked">("all");
  const [selectedProduct, setSelectedProduct] = useState<EarnProduct | null>(null);
  const [stakeAmount, setStakeAmount] = useState("");
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [earnProducts, setEarnProducts] = useState<EarnProduct[]>([]);
  const [myStakes, setMyStakes] = useState<Stake[]>([]);
  const [stakeSummary, setStakeSummary] = useState<StakeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [staking, setStaking] = useState(false);
  const [error, setError] = useState("");

  // Fetch earn products from backend
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [products, stakesData] = await Promise.all([
          getEarnProducts(),
          getMyStakes()
        ]);
        console.log('[Earn] Products:', products);
        console.log('[Earn] Stakes:', stakesData);
        setEarnProducts(products);
        setMyStakes(stakesData.stakes);
        setStakeSummary(stakesData.summary);
      } catch (err) {
        console.error('[Earn] Error fetching earn data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load earn products');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredProducts = earnProducts.filter(
    (product) => productFilter === "all" || product.type === productFilter
  );

  const calculateEarnings = (product: EarnProduct, amount: number) => {
    const days = product.duration || 365;
    return ((amount * product.apy) / 100 / 365) * days;
  };

  const handleStake = async () => {
    if (!selectedProduct || !stakeAmount) return;
    
    const amount = parseFloat(stakeAmount);
    const availableBalance = getAvailableBalance(selectedProduct.symbol);
    
    // Validate
    if (amount < selectedProduct.minAmount) {
      setError(`Số tiền tối thiểu là ${selectedProduct.minAmount} ${selectedProduct.symbol}`);
      return;
    }
    
    if (amount > availableBalance) {
      setError(`Số dư không đủ. Bạn có ${availableBalance} ${selectedProduct.symbol}`);
      return;
    }
    
    setStaking(true);
    setError("");
    
    try {
      const response = await stakeApi(selectedProduct.id, amount);
      console.log('[Earn] Stake response:', response);
      
      if (response.success) {
        // Refresh stakes data
        const stakesData = await getMyStakes();
        setMyStakes(stakesData.stakes);
        setStakeSummary(stakesData.summary);
        setShowStakeModal(false);
        setStakeAmount("");
        setActiveTab("my-stakes");
      } else {
        setError(response.error?.message || 'Failed to stake');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stake');
    } finally {
      setStaking(false);
    }
  };

  const handleUnstake = async (stakeId: string) => {
    if (!confirm("Bạn có chắc muốn rút stake này?")) return;
    
    try {
      const response = await unstakeApi(stakeId);
      console.log('[Earn] Unstake response:', response);
      
      if (response.success) {
        // Refresh stakes data
        const stakesData = await getMyStakes();
        setMyStakes(stakesData.stakes);
        setStakeSummary(stakesData.summary);
        alert('Rút stake thành công!');
      } else {
        alert(response.error?.message || 'Failed to unstake');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to unstake');
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="bg-[#0b0e11] text-white p-6 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading earn products...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
    <Header />
    <div className="bg-[#0b0e11] text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Earn</h1>
          <p className="text-gray-400">Grow your crypto holdings with staking and savings</p>
        </div>

        {/* Stats Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-linear-to-br from-yellow-500/20 to-yellow-500/5 rounded-lg p-6 border border-yellow-500/30">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="text-yellow-500" size={24} />
              <span className="text-sm text-gray-400">Total Value Locked</span>
            </div>
            <div className="text-3xl font-bold">
              ${(earnProducts.reduce((sum, p) => sum + (Number(p.totalStaked) || 0), 0) * 0.5).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="bg-linear-to-br from-green-500/20 to-green-500/5 rounded-lg p-6 border border-green-500/30">
            <div className="flex items-center gap-3 mb-2">
              <Zap className="text-green-500" size={24} />
              <span className="text-sm text-gray-400">Average APY</span>
            </div>
            <div className="text-3xl font-bold">
              {earnProducts.length > 0 ? (earnProducts.reduce((sum, p) => sum + (Number(p.apy) || 0), 0) / earnProducts.length).toFixed(1) : '0'}%
            </div>
          </div>
          <div className="bg-linear-to-br from-blue-500/20 to-blue-500/5 rounded-lg p-6 border border-blue-500/30">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="text-blue-500" size={24} />
              <span className="text-sm text-gray-400">Active Products</span>
            </div>
            <div className="text-3xl font-bold">{earnProducts.length}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-[#2b3139]">
          <button
            onClick={() => setActiveTab("products")}
            className={`px-4 py-3 font-medium transition-colors relative ${
              activeTab === "products" ? "text-yellow-500" : "text-gray-400 hover:text-white"
            }`}
          >
            Sản Phẩm Earn
            {activeTab === "products" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab("my-stakes")}
            className={`px-4 py-3 font-medium transition-colors relative flex items-center gap-2 ${
              activeTab === "my-stakes" ? "text-yellow-500" : "text-gray-400 hover:text-white"
            }`}
          >
            <Wallet size={18} />
            Stake Của Tôi
            {myStakes.length > 0 && (
              <span className="bg-yellow-500 text-black text-xs px-2 py-0.5 rounded-full">
                {myStakes.length}
              </span>
            )}
            {activeTab === "my-stakes" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500"></div>
            )}
          </button>
        </div>

        {/* My Stakes Tab */}
        {activeTab === "my-stakes" && (
          <div>
            {/* Summary Cards */}
            {stakeSummary && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-[#1e2329] rounded-lg p-4 border border-[#2b3139]">
                  <div className="text-sm text-gray-400 mb-1">Tổng Đã Stake</div>
                  <div className="text-2xl font-bold">${stakeSummary.totalStaked.toLocaleString()}</div>
                </div>
                <div className="bg-[#1e2329] rounded-lg p-4 border border-[#2b3139]">
                  <div className="text-sm text-gray-400 mb-1">Lợi Nhuận</div>
                  <div className="text-2xl font-bold text-green-500">
                    +${stakeSummary.totalEarned.toLocaleString()}
                  </div>
                </div>
                <div className="bg-[#1e2329] rounded-lg p-4 border border-[#2b3139]">
                  <div className="text-sm text-gray-400 mb-1">Stake Đang Hoạt Động</div>
                  <div className="text-2xl font-bold">{stakeSummary.activeStakes}</div>
                </div>
              </div>
            )}

            {/* Stakes List */}
            {myStakes.length === 0 ? (
              <div className="bg-[#1e2329] rounded-lg p-12 text-center border border-[#2b3139]">
                <Wallet size={48} className="mx-auto text-gray-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Chưa Có Stake Nào</h3>
                <p className="text-gray-400 mb-4">Bắt đầu kiếm lãi bằng cách stake crypto của bạn</p>
                <button
                  onClick={() => setActiveTab("products")}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium px-6 py-2 rounded transition-colors"
                >
                  Xem Sản Phẩm
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {myStakes.map((stakeItem) => (
                  <div
                    key={stakeItem.id}
                    className="bg-[#1e2329] rounded-lg p-6 border border-[#2b3139]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center font-bold text-black text-lg">
                          {stakeItem.symbol[0]}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{stakeItem.symbol}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            stakeItem.status === 'active' ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {stakeItem.status === 'active' ? 'Đang hoạt động' : 'Đã kết thúc'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">
                          {stakeItem.amount} {stakeItem.symbol}
                        </div>
                        <div className="text-green-500 text-sm">
                          +{stakeItem.earned.toFixed(6)} {stakeItem.symbol}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#2b3139]">
                      <div className="text-sm text-gray-400">
                        APY: <span className="text-green-500 font-medium">{stakeItem.apy}%</span>
                        {stakeItem.endDate && (
                          <span className="ml-4">
                            Kết thúc: {new Date(stakeItem.endDate).toLocaleDateString('vi-VN')}
                          </span>
                        )}
                      </div>
                      {stakeItem.status === 'active' && !stakeItem.endDate && (
                        <button
                          onClick={() => handleUnstake(stakeItem.id)}
                          className="text-red-500 hover:text-red-400 text-sm font-medium"
                        >
                          Rút Stake
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Products Tab */}
        {activeTab === "products" && (
          <>
            {/* Product Filters */}
            <div className="flex gap-2 mb-6">
              {(['all', 'flexible', 'locked'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setProductFilter(filter)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    productFilter === filter
                      ? 'bg-yellow-500 text-black'
                      : 'bg-[#2b3139] text-gray-400 hover:text-white'
                  }`}
                >
                  {filter === 'all' ? 'Tất cả' : filter === 'flexible' ? 'Linh hoạt' : 'Cố định'}
                </button>
              ))}
            </div>

            {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="bg-[#1e2329] rounded-lg p-6 border border-[#2b3139] hover:border-yellow-500/50 transition-all cursor-pointer"
              onClick={() => {
                setSelectedProduct(product);
                setShowStakeModal(true);
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center font-bold text-black text-lg">
                    {product.symbol[0]}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{product.name}</h3>
                    <span className="text-sm text-gray-400">{product.symbol}</span>
                  </div>
                </div>
                {product.type === "flexible" ? (
                  <Zap size={20} className="text-green-500" />
                ) : (
                  <Lock size={20} className="text-blue-500" />
                )}
              </div>

              {/* APY */}
              <div className="mb-4">
                <div className="text-sm text-gray-400 mb-1">Est. APY</div>
                <div className="text-3xl font-bold text-green-500">{Number(product.apy).toFixed(2)}%</div>
              </div>

              {/* Details */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Type</span>
                  <span className="font-medium">
                    {product.type === "flexible" ? "Flexible" : `Locked ${product.duration}d`}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Min. Amount</span>
                  <span className="font-medium">
                    {product.minAmount} {product.symbol}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total Staked</span>
                  <span className="font-medium">
                    {product.totalStaked.toLocaleString()} {product.symbol}
                  </span>
                </div>
              </div>

              {/* Risk Badge */}
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs px-3 py-1 rounded-full ${
                    product.risk === "low"
                      ? "bg-green-500/20 text-green-500"
                      : product.risk === "medium"
                      ? "bg-yellow-500/20 text-yellow-500"
                      : "bg-red-500/20 text-red-500"
                  }`}
                >
                  {(product.risk || 'medium').toUpperCase()} RISK
                </span>
                <button className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded font-semibold text-sm transition-colors">
                  Stake Now
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-12 bg-[#1e2329] rounded-lg p-6 border border-[#2b3139]">
          <div className="flex items-start gap-3 mb-4">
            <Info className="text-yellow-500 mt-1" size={20} />
            <div>
              <h3 className="text-lg font-semibold mb-2">Cách hoạt động?</h3>
              <div className="text-gray-400 space-y-2 text-sm">
                <p>
                  <strong className="text-white">Linh hoạt:</strong> Stake và rút bất cứ lúc nào với APY thấp hơn. Phù hợp cho khoản đầu tư ngắn hạn.
                </p>
                <p>
                  <strong className="text-white">Cố định:</strong> Khóa crypto trong thời gian cố định để nhận APY cao hơn. Không thể rút trước khi đáo hạn.
                </p>
                <p>
                  <strong className="text-white">Phần thưởng:</strong> Được tính hàng ngày và phân phối tự động vào ví spot của bạn.
                </p>
              </div>
            </div>
          </div>
        </div>
          </>
        )}
      </div>

      {/* Stake Modal */}
      {showStakeModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2329] rounded-lg w-full max-w-md border border-[#2b3139] shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2b3139]">
              <h2 className="text-xl font-semibold">
                Stake {selectedProduct.symbol}
              </h2>
              <button
                onClick={() => setShowStakeModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Available Balance */}
              <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded flex items-center justify-between">
                <span className="text-sm text-gray-400">Số dư khả dụng:</span>
                <span className="font-bold text-white">
                  {getAvailableBalance(selectedProduct.symbol).toLocaleString()} {selectedProduct.symbol}
                </span>
              </div>
              
              {/* Product Info */}
              <div className="bg-[#2b3139] p-4 rounded">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">APY</span>
                  <span className="text-green-500 font-bold text-lg">{Number(selectedProduct.apy).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">Type</span>
                  <span className="font-medium">
                    {selectedProduct.type === "flexible"
                      ? "Flexible"
                      : `Locked ${selectedProduct.duration} days`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Min. Stake</span>
                  <span className="font-medium">
                    {selectedProduct.minAmount} {selectedProduct.symbol}
                  </span>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Stake Amount
                </label>
                <input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  style={{ caretColor: 'transparent' }}
                  className="w-full bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139] focus:outline-none focus:border-yellow-500 transition-colors"
                  placeholder={`Min. ${selectedProduct.minAmount}`}
                />
              </div>

              {/* Estimated Earnings */}
              {stakeAmount && parseFloat(stakeAmount) > 0 && (
                <div className="bg-green-500/10 border border-green-500/30 p-4 rounded">
                  <div className="text-sm text-gray-400 mb-1">Estimated Earnings</div>
                  <div className="text-2xl font-bold text-green-500">
                    {calculateEarnings(selectedProduct, parseFloat(stakeAmount)).toFixed(6)}{" "}
                    {selectedProduct.symbol}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    For {selectedProduct.duration || 365} days
                  </div>
                </div>
              )}

              {/* Insufficient Balance Warning */}
              {stakeAmount && parseFloat(stakeAmount) > getAvailableBalance(selectedProduct.symbol) && (
                <div className="bg-red-500/10 border border-red-500/30 p-3 rounded flex items-center gap-2 text-red-400">
                  <AlertCircle size={18} />
                  <span className="text-sm">Số dư không đủ để stake</span>
                </div>
              )}

              {/* Stake Button */}
              <button
                onClick={handleStake}
                disabled={
                  staking || 
                  !stakeAmount || 
                  parseFloat(stakeAmount) < selectedProduct.minAmount ||
                  parseFloat(stakeAmount) > getAvailableBalance(selectedProduct.symbol)
                }
                className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-bold py-3 rounded transition-colors flex items-center justify-center gap-2"
              >
                {staking && <Loader2 size={18} className="animate-spin" />}
                {staking ? "Đang xử lý..." : "Xác Nhận Stake"}
              </button>

              {error && (
                <p className="text-red-500 text-sm text-center">{error}</p>
              )}

              <p className="text-xs text-gray-500 text-center">
                {selectedProduct.type === "locked" &&
                  `Your funds will be locked for ${selectedProduct.duration} days. Early withdrawal is not possible.`}
                {selectedProduct.type === "flexible" &&
                  "You can unstake your funds anytime without penalty."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
