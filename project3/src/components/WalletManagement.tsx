"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Wallet, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Copy, 
  CheckCircle, 
  Loader2, 
  History,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  QrCode,
  ExternalLink,
  Shield,
  Clock,
  DollarSign
} from "lucide-react";
import { getBalances, getDepositAddress, requestWithdrawal, getTransactionHistory, type Balance, type Transaction } from "@/services/walletApi";
import { isAuthenticated } from "@/services/authApi";

// Crypto icons mapping
const cryptoIcons: Record<string, string> = {
  BTC: '₿',
  ETH: 'Ξ',
  USDT: '₮',
  BNB: '◆',
  SOL: '◎',
  XRP: '✕',
  ADA: '₳',
  DOGE: 'Ð',
};

const networkOptions: Record<string, string[]> = {
  BTC: ['Bitcoin', 'BEP20'],
  ETH: ['ERC20', 'BEP20', 'Arbitrum'],
  USDT: ['TRC20', 'ERC20', 'BEP20'],
  BNB: ['BEP20', 'BEP2'],
  SOL: ['Solana'],
};

export default function WalletManagement() {
  const [activeTab, setActiveTab] = useState<'overview' | 'deposit' | 'withdraw' | 'history'>('overview');
  const [balances, setBalances] = useState<Balance[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState('USDT');
  const [selectedNetwork, setSelectedNetwork] = useState('TRC20');
  const [depositAddress, setDepositAddress] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState('');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawNetwork, setWithdrawNetwork] = useState('TRC20');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Calculate totals
  const totalBalance = balances.reduce((sum, b) => sum + (b.total || 0), 0);
  const availableBalance = balances.reduce((sum, b) => sum + (b.free || 0), 0);
  const lockedBalance = balances.reduce((sum, b) => sum + (b.locked || 0), 0);

  useEffect(() => {
    queueMicrotask(() => {
      setIsMounted(true);
    });
  }, []);

  const loadBalances = useCallback(async () => {
    setIsLoading(true);
    const data = await getBalances();
    
    // Lọc bỏ balance không có asset name hoặc asset rỗng
    const validBalances = data.filter(b => b.asset && b.asset.trim() !== '');
    
    // Hiển thị các coin chính kể cả = 0
    const mainCoins = ['USDT', 'BTC', 'ETH', 'BNB'];
    const existingAssets = validBalances.map(b => b.asset);
    const missingCoins = mainCoins.filter(c => !existingAssets.includes(c)).map(c => ({
      asset: c,
      free: 0,
      locked: 0,
      total: 0
    }));
    
    // Sắp xếp: coin chính trước, sau đó theo tổng số dư
    const allBalances = [...validBalances, ...missingCoins];
    allBalances.sort((a, b) => {
      const aIsMain = mainCoins.indexOf(a.asset);
      const bIsMain = mainCoins.indexOf(b.asset);
      if (aIsMain !== -1 && bIsMain !== -1) return aIsMain - bIsMain;
      if (aIsMain !== -1) return -1;
      if (bIsMain !== -1) return 1;
      return (b.total || 0) - (a.total || 0);
    });
    
    setBalances(allBalances);
    setIsLoading(false);
  }, []);

  const loadTransactions = useCallback(async () => {
    const data = await getTransactionHistory({ limit: 20 });
    setTransactions(Array.isArray(data) ? data : []);
  }, []);

  const loadDepositAddress = useCallback(async () => {
    setDepositLoading(true);
    setDepositError('');
    setDepositAddress('');
    
    try {
      const address = await getDepositAddress(selectedAsset, selectedNetwork);
      if (address) {
        setDepositAddress(address.address);
      } else {
        setDepositError('Không thể tạo địa chỉ nạp tiền. Vui lòng thử lại.');
      }
    } catch (error) {
      console.error('Error loading deposit address:', error);
      setDepositError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setDepositLoading(false);
    }
  }, [selectedAsset, selectedNetwork]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadBalances(), loadTransactions()]);
    setRefreshing(false);
  };

  useEffect(() => {
    if (isMounted && isAuthenticated()) {
      queueMicrotask(() => {
        loadBalances();
        loadTransactions();
      });
    } else if (isMounted) {
      queueMicrotask(() => {
        setIsLoading(false);
      });
    }
  }, [isMounted, loadBalances, loadTransactions]);

  useEffect(() => {
    if (activeTab === 'deposit' && selectedAsset) {
      queueMicrotask(() => {
        loadDepositAddress();
      });
    }
  }, [activeTab, selectedAsset, selectedNetwork, loadDepositAddress]);

  // Update network when asset changes
  useEffect(() => {
    const networks = networkOptions[selectedAsset] || ['Default'];
    setSelectedNetwork(networks[0]);
    setWithdrawNetwork(networks[0]);
  }, [selectedAsset]);

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(depositAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || !withdrawAddress) {
      setMessage({ type: 'error', text: 'Vui lòng điền đầy đủ thông tin' });
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (amount <= 0) {
      setMessage({ type: 'error', text: 'Số tiền không hợp lệ' });
      return;
    }

    const assetBalance = balances.find(b => b.asset === selectedAsset);
    if (!assetBalance || amount > assetBalance.free) {
      setMessage({ type: 'error', text: 'Số dư không đủ' });
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    const result = await requestWithdrawal(selectedAsset, amount, withdrawAddress, withdrawNetwork);

    setIsProcessing(false);

    if (result.success) {
      setMessage({ type: 'success', text: 'Yêu cầu rút tiền đã được gửi!' });
      setWithdrawAmount('');
      setWithdrawAddress('');
      await loadBalances();
      await loadTransactions();
      setTimeout(() => {
        setMessage(null);
        setActiveTab('history');
      }, 2000);
    } else {
      setMessage({ type: 'error', text: result.error?.message || 'Không thể rút tiền' });
    }
  };

  const handleMaxAmount = () => {
    const assetBalance = balances.find(b => b.asset === selectedAsset);
    if (assetBalance) {
      setWithdrawAmount(assetBalance.free.toString());
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500/20 text-green-400';
      case 'FAILED':
      case 'CANCELLED':
        return 'bg-red-500/20 text-red-400';
      case 'PENDING':
        return 'bg-yellow-500/20 text-yellow-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'Hoàn thành';
      case 'FAILED':
        return 'Thất bại';
      case 'CANCELLED':
        return 'Đã hủy';
      case 'PENDING':
        return 'Đang xử lý';
      default:
        return status;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isMounted) {
    return (
      <div className="bg-linear-to-br from-[#1e2329] to-[#181a20] rounded-2xl p-8 min-h-[500px]">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="animate-spin text-yellow-500" size={48} />
        </div>
      </div>
    );
  }

  if (!isAuthenticated()) {
    return (
      <div className="bg-linear-to-br from-[#1e2329] to-[#181a20] rounded-2xl p-8 text-center min-h-[400px] flex flex-col items-center justify-center">
        <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mb-6">
          <Wallet size={40} className="text-yellow-500" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Đăng nhập để quản lý ví</h3>
        <p className="text-gray-400 max-w-sm">Đăng nhập hoặc tạo tài khoản để nạp, rút và quản lý tài sản của bạn</p>
      </div>
    );
  }

  return (
    <div className="bg-linear-to-br from-[#1e2329] to-[#181a20] rounded-2xl overflow-hidden">
      {/* Header với tổng số dư */}
      <div className="bg-linear-to-r from-yellow-600/20 to-orange-600/20 p-6 border-b border-[#2b3139]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
              <Wallet className="text-yellow-500" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Ví của tôi</h2>
              <p className="text-sm text-gray-400">Quản lý tài sản số</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg bg-[#2b3139] hover:bg-[#363c45] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`text-gray-400 ${refreshing ? 'animate-spin' : ''}`} size={20} />
          </button>
        </div>

        {/* Tổng số dư */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#181a20]/50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <DollarSign size={14} />
              Tổng số dư
            </div>
            <p className="text-2xl font-bold text-white">${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-[#181a20]/50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <TrendingUp size={14} />
              Khả dụng
            </div>
            <p className="text-2xl font-bold text-green-400">${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-[#181a20]/50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Shield size={14} />
              Đang khóa
            </div>
            <p className="text-2xl font-bold text-yellow-400">${lockedBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#2b3139]">
        {[
          { id: 'overview', label: 'Tổng quan', icon: Wallet },
          { id: 'deposit', label: 'Nạp tiền', icon: ArrowDownCircle },
          { id: 'withdraw', label: 'Rút tiền', icon: ArrowUpCircle },
          { id: 'history', label: 'Lịch sử', icon: History },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'text-yellow-500 border-b-2 border-yellow-500 bg-yellow-500/5'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Danh sách tài sản</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('deposit')}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <ArrowDownCircle size={16} />
                  Nạp
                </button>
                <button
                  onClick={() => setActiveTab('withdraw')}
                  className="px-4 py-2 bg-[#2b3139] hover:bg-[#363c45] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <ArrowUpCircle size={16} />
                  Rút
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-yellow-500" size={40} />
              </div>
            ) : balances.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wallet size={32} className="text-gray-600" />
                </div>
                <p className="text-gray-400">Chưa có tài sản nào</p>
                <button
                  onClick={() => setActiveTab('deposit')}
                  className="mt-4 px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-medium rounded-lg transition-colors"
                >
                  Nạp tiền ngay
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {balances.map((balance) => (
                  <div 
                    key={balance.asset} 
                    className="bg-[#2b3139] hover:bg-[#363c45] rounded-xl p-4 transition-colors cursor-pointer group"
                    onClick={() => {
                      setSelectedAsset(balance.asset);
                      setActiveTab('deposit');
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center text-yellow-500 font-bold">
                          {cryptoIcons[balance.asset] || balance.asset.charAt(0)}
                        </div>
                        <div>
                          <p className="text-white font-medium">{balance.asset}</p>
                          <p className="text-xs text-gray-400">
                            Khả dụng: {(balance.free ?? 0).toFixed(8)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-semibold">{(balance.total ?? 0).toFixed(8)}</p>
                        <p className="text-xs text-gray-400">
                          Đang khóa: {(balance.locked ?? 0).toFixed(8)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="mt-3 h-1.5 bg-[#181a20] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-linear-to-r from-green-500 to-green-400 rounded-full"
                        style={{ width: `${balance.total > 0 ? (balance.free / balance.total * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Deposit Tab */}
        {activeTab === 'deposit' && (
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <ArrowDownCircle className="text-green-500" size={32} />
              </div>
              <h3 className="text-xl font-semibold text-white">Nạp tiền vào ví</h3>
              <p className="text-sm text-gray-400 mt-1">Chọn loại tiền và mạng để nhận địa chỉ nạp</p>
            </div>

            {/* Chọn coin */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Chọn loại tiền</label>
              <div className="grid grid-cols-4 gap-2">
                {['USDT', 'BTC', 'ETH', 'BNB'].map((coin) => (
                  <button
                    key={coin}
                    onClick={() => setSelectedAsset(coin)}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      selectedAsset === coin
                        ? 'border-yellow-500 bg-yellow-500/10'
                        : 'border-[#2b3139] bg-[#2b3139] hover:border-gray-600'
                    }`}
                  >
                    <div className="text-2xl mb-1">{cryptoIcons[coin]}</div>
                    <div className="text-xs text-white font-medium">{coin}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Chọn mạng */}
            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">Chọn mạng</label>
              <div className="flex flex-wrap gap-2">
                {(networkOptions[selectedAsset] || ['Default']).map((network) => (
                  <button
                    key={network}
                    onClick={() => setSelectedNetwork(network)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedNetwork === network
                        ? 'bg-yellow-500 text-black'
                        : 'bg-[#2b3139] text-gray-400 hover:text-white'
                    }`}
                  >
                    {network}
                  </button>
                ))}
              </div>
            </div>

            {/* Địa chỉ nạp tiền */}
            <div className="bg-[#2b3139] rounded-xl p-5">
              {depositLoading ? (
                <div className="flex flex-col items-center py-8">
                  <Loader2 className="animate-spin text-yellow-500 mb-3" size={40} />
                  <p className="text-gray-400">Đang tạo địa chỉ...</p>
                </div>
              ) : depositError ? (
                <div className="text-center py-8">
                  <AlertCircle className="text-red-500 mx-auto mb-3" size={40} />
                  <p className="text-red-400 mb-4">{depositError}</p>
                  <button
                    onClick={loadDepositAddress}
                    className="px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-medium rounded-lg transition-colors"
                  >
                    Thử lại
                  </button>
                </div>
              ) : depositAddress ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-400">Địa chỉ nạp {selectedAsset}</span>
                    <button
                      onClick={() => setShowQR(!showQR)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <QrCode size={20} />
                    </button>
                  </div>

                  {showQR && (
                    <div className="bg-white p-4 rounded-xl mb-4 mx-auto w-fit">
                      {/* Placeholder QR - in production use a QR library */}
                      <div className="w-40 h-40 bg-gray-200 flex items-center justify-center">
                        <QrCode size={80} className="text-gray-400" />
                      </div>
                    </div>
                  )}

                  <div className="bg-[#181a20] rounded-lg p-4 mb-4">
                    <p className="text-white text-sm break-all font-mono">{depositAddress}</p>
                  </div>

                  <button
                    onClick={handleCopyAddress}
                    className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-3 rounded-xl transition-colors"
                  >
                    {copiedAddress ? (
                      <>
                        <CheckCircle size={20} />
                        Đã sao chép!
                      </>
                    ) : (
                      <>
                        <Copy size={20} />
                        Sao chép địa chỉ
                      </>
                    )}
                  </button>

                  {/* Cảnh báo */}
                  <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                    <div className="flex gap-3">
                      <AlertCircle className="text-yellow-500 shrink-0" size={20} />
                      <div className="text-sm">
                        <p className="text-yellow-500 font-medium mb-1">Lưu ý quan trọng</p>
                        <ul className="text-yellow-500/80 space-y-1 list-disc list-inside">
                          <li>Chỉ gửi {selectedAsset} đến địa chỉ này qua mạng {selectedNetwork}</li>
                          <li>Gửi coin khác hoặc qua mạng khác có thể mất tiền!</li>
                          <li>Số tiền nạp tối thiểu: 0.001 {selectedAsset}</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400">Chọn loại tiền và mạng để nhận địa chỉ nạp</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Withdraw Tab */}
        {activeTab === 'withdraw' && (
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <ArrowUpCircle className="text-orange-500" size={32} />
              </div>
              <h3 className="text-xl font-semibold text-white">Rút tiền</h3>
              <p className="text-sm text-gray-400 mt-1">Rút tiền về ví bên ngoài</p>
            </div>

            {message && (
              <div className={`mb-4 p-4 rounded-xl flex items-center gap-3 ${
                message.type === 'success' 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                {message.text}
              </div>
            )}

            <div className="space-y-4">
              {/* Chọn coin */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Loại tiền</label>
                <select
                  value={selectedAsset}
                  onChange={(e) => setSelectedAsset(e.target.value)}
                  className="w-full bg-[#2b3139] text-white px-4 py-3 rounded-xl border border-[#363c45] focus:outline-none focus:border-yellow-500 transition-colors"
                >
                  {balances.map((b) => (
                    <option key={b.asset} value={b.asset}>
                      {b.asset} - Khả dụng: {(b.free ?? 0).toFixed(8)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Chọn mạng */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Mạng rút tiền</label>
                <select
                  value={withdrawNetwork}
                  onChange={(e) => setWithdrawNetwork(e.target.value)}
                  className="w-full bg-[#2b3139] text-white px-4 py-3 rounded-xl border border-[#363c45] focus:outline-none focus:border-yellow-500 transition-colors"
                >
                  {(networkOptions[selectedAsset] || ['Default']).map((network) => (
                    <option key={network} value={network}>{network}</option>
                  ))}
                </select>
              </div>

              {/* Địa chỉ rút */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Địa chỉ ví nhận</label>
                <input
                  type="text"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  placeholder={`Nhập địa chỉ ${selectedAsset}...`}
                  className="w-full bg-[#2b3139] text-white px-4 py-3 rounded-xl border border-[#363c45] focus:outline-none focus:border-yellow-500 transition-colors"
                />
              </div>

              {/* Số lượng */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Số lượng</label>
                <div className="relative">
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#2b3139] text-white px-4 py-3 pr-20 rounded-xl border border-[#363c45] focus:outline-none focus:border-yellow-500 transition-colors"
                  />
                  <button
                    onClick={handleMaxAmount}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 bg-yellow-500/20 text-yellow-500 text-xs font-medium rounded-lg hover:bg-yellow-500/30 transition-colors"
                  >
                    MAX
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Số dư khả dụng: {(balances.find(b => b.asset === selectedAsset)?.free ?? 0).toFixed(8)} {selectedAsset}
                </p>
              </div>

              {/* Phí */}
              <div className="bg-[#2b3139] rounded-xl p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Phí rút tiền</span>
                  <span className="text-white">0.0005 {selectedAsset}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Số tiền nhận được</span>
                  <span className="text-green-400 font-medium">
                    {Math.max(0, parseFloat(withdrawAmount || '0') - 0.0005).toFixed(8)} {selectedAsset}
                  </span>
                </div>
              </div>

              {/* Nút rút tiền */}
              <button
                onClick={handleWithdraw}
                disabled={isProcessing || !withdrawAmount || !withdrawAddress}
                className="w-full bg-linear-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <ArrowUpCircle size={20} />
                    Rút tiền
                  </>
                )}
              </button>

              {/* Cảnh báo */}
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <div className="flex gap-3">
                  <Shield className="text-red-400 shrink-0" size={20} />
                  <div className="text-sm text-red-400">
                    <p className="font-medium mb-1">Bảo mật</p>
                    <p className="opacity-80">Kiểm tra kỹ địa chỉ ví trước khi rút. Giao dịch không thể hoàn tác!</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Lịch sử giao dịch</h3>
              <button
                onClick={loadTransactions}
                className="text-sm text-yellow-500 hover:text-yellow-400 transition-colors flex items-center gap-1"
              >
                <RefreshCw size={14} />
                Làm mới
              </button>
            </div>

            {!Array.isArray(transactions) || transactions.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <History size={32} className="text-gray-600" />
                </div>
                <p className="text-gray-400">Chưa có giao dịch nào</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div key={tx.id} className="bg-[#2b3139] rounded-xl p-4 hover:bg-[#363c45] transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          tx.type === 'DEPOSIT' 
                            ? 'bg-green-500/20' 
                            : 'bg-orange-500/20'
                        }`}>
                          {tx.type === 'DEPOSIT' ? (
                            <ArrowDownCircle className="text-green-500" size={20} />
                          ) : (
                            <ArrowUpCircle className="text-orange-500" size={20} />
                          )}
                        </div>
                        <div>
                          <p className="text-white font-medium">
                            {tx.type === 'DEPOSIT' ? 'Nạp tiền' : 'Rút tiền'}
                          </p>
                          <p className="text-xs text-gray-400">{tx.asset}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${
                          tx.type === 'DEPOSIT' ? 'text-green-400' : 'text-orange-400'
                        }`}>
                          {tx.type === 'DEPOSIT' ? '+' : '-'}{Number(tx.amount ?? 0).toFixed(8)} {tx.asset}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(tx.status)}`}>
                          {getStatusText(tx.status)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-[#181a20]">
                      <div className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDate(tx.createdAt)}
                      </div>
                      {tx.txHash && (
                        <a 
                          href={`https://blockchain.com/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-yellow-500 hover:text-yellow-400"
                        >
                          Xem TX <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
