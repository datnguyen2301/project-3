"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  ArrowLeft, 
  Building2, 
  Wallet, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  Plus, 
  Trash2,
  RefreshCw,
  X,
  ChevronDown
} from "lucide-react";
import Link from "next/link";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useBalance, BALANCE_EVENTS } from "@/contexts/BalanceContext";
import { type Balance } from "@/services/walletApi";
import {
  getBankAccounts,
  addBankAccount,
  deleteBankAccount,
  requestWithdrawal,
  getWithdrawalHistory,
  cancelWithdrawal,
  getWithdrawalInfo,
  formatVND,
  VIETNAM_BANKS,
  type BankAccount,
  type WithdrawalHistory
} from "@/services/withdrawApi";
import { triggerNotificationRefresh } from "@/services/notificationApi";

export default function WithdrawPage() {
  const { isAuthenticated } = useAuth();
  const { getAvailableBalance, notifyBalanceChange, isLoading: balanceLoading, refreshBalances: refreshContextBalances } = useBalance();
  
  // Get VND balance from context
  const vndBalanceAmount = getAvailableBalance('VND');
  const vndBalance: Balance | null = vndBalanceAmount > 0 
    ? { free: vndBalanceAmount, asset: 'VND', locked: 0, total: vndBalanceAmount } 
    : null;
  
  // Bank accounts
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  
  // Withdrawal form
  const [amount, setAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState(""); // Toast message
  
  // Withdrawal info
  const [withdrawInfo, setWithdrawInfo] = useState<{
    minAmount: number;
    maxAmount: number;
    fee: number;
    processingTime: string;
  } | null>(null);
  
  // History
  const [history, setHistory] = useState<WithdrawalHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Add bank modal
  const [showAddBank, setShowAddBank] = useState(false);
  const [newBank, setNewBank] = useState({
    bankCode: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
  });
  const [addingBank, setAddingBank] = useState(false);
  
  // Tab
  const [activeTab, setActiveTab] = useState<'withdraw' | 'history'>('withdraw');

  // Fetch bank accounts
  const fetchBankAccounts = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingAccounts(true);
    try {
      const accounts = await getBankAccounts();
      setBankAccounts(accounts);
      if (accounts.length > 0 && !selectedAccount) {
        const defaultAccount = accounts.find(a => a.isDefault) || accounts[0];
        setSelectedAccount(defaultAccount);
      }
    } catch (err) {
      console.error('Error fetching bank accounts:', err);
    } finally {
      setLoadingAccounts(false);
    }
  }, [isAuthenticated, selectedAccount]);

  // Fetch withdrawal history
  const fetchHistory = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingHistory(true);
    try {
      const data = await getWithdrawalHistory();
      setHistory(data);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [isAuthenticated]);

  // Initial data fetch
  useEffect(() => {
    if (isAuthenticated) {
      fetchBankAccounts();
      fetchHistory();
      getWithdrawalInfo().then(setWithdrawInfo);
    }
  }, [isAuthenticated, fetchBankAccounts, fetchHistory]);

  // Calculate fee and net amount
  const calculateNet = () => {
    const numAmount = parseFloat(amount.replace(/[^0-9]/g, '')) || 0;
    const fee = withdrawInfo?.fee || 0;
    return Math.max(0, numAmount - fee);
  };

  // Handle withdraw
  const handleWithdraw = async () => {
    if (!selectedAccount || !amount) return;
    
    const numAmount = parseFloat(amount.replace(/[^0-9]/g, '')) || 0;
    
    if (numAmount < (withdrawInfo?.minAmount || 100000)) {
      setError(`Số tiền tối thiểu là ${formatVND(withdrawInfo?.minAmount || 100000)} VND`);
      return;
    }
    
    if (vndBalance && numAmount > vndBalance.free) {
      setError('Số dư không đủ');
      return;
    }
    
    setWithdrawing(true);
    setError("");
    
    try {
      const response = await requestWithdrawal({
        amount: numAmount,
        bankAccountId: selectedAccount.id,
      });
      
      if (response.success) {
        setSuccess(true);
        setAmount("");
        // Notify all components about balance change
        notifyBalanceChange(BALANCE_EVENTS.WITHDRAW_SUCCESS, {
          amount: numAmount,
          bankAccount: selectedAccount.accountNumber
        });
        // Trigger notification refresh immediately
        triggerNotificationRefresh();
        await fetchHistory();
        setTimeout(() => setSuccess(false), 5000);
      } else {
        setError(response.error?.message || 'Không thể gửi yêu cầu rút tiền');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setWithdrawing(false);
    }
  };

  // Handle add bank
  const handleAddBank = async () => {
    if (!newBank.bankCode || !newBank.accountNumber || !newBank.accountName) {
      setError('Vui lòng điền đầy đủ thông tin');
      return;
    }
    
    setAddingBank(true);
    setError("");
    
    try {
      const bank = VIETNAM_BANKS.find(b => b.code === newBank.bankCode);
      const response = await addBankAccount({
        bankCode: newBank.bankCode,
        bankName: bank?.name || newBank.bankCode,
        accountNumber: newBank.accountNumber,
        accountName: newBank.accountName.toUpperCase(),
        isDefault: bankAccounts.length === 0,
      });
      
      if (response.success) {
        setShowAddBank(false);
        setNewBank({ bankCode: '', bankName: '', accountNumber: '', accountName: '' });
        setSuccessMessage('Thêm tài khoản ngân hàng thành công!');
        setTimeout(() => setSuccessMessage(''), 3000);
        await fetchBankAccounts();
      } else {
        setError(response.error?.message || 'Không thể thêm tài khoản ngân hàng');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setAddingBank(false);
    }
  };

  // Handle delete bank
  const handleDeleteBank = async (accountId: string) => {
    if (!confirm('Bạn có chắc muốn xóa tài khoản ngân hàng này?')) return;
    
    try {
      const response = await deleteBankAccount(accountId);
      if (response.success) {
        setSuccessMessage('Đã xóa tài khoản ngân hàng!');
        setTimeout(() => setSuccessMessage(''), 3000);
        await fetchBankAccounts();
        if (selectedAccount?.id === accountId) {
          setSelectedAccount(null);
        }
      } else {
        setError(response.error?.message || 'Không thể xóa tài khoản');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    }
  };

  // Handle cancel withdrawal
  const handleCancelWithdrawal = async (withdrawalId: string) => {
    if (!confirm('Bạn có chắc muốn hủy yêu cầu rút tiền này?')) return;
    
    try {
      const response = await cancelWithdrawal(withdrawalId);
      if (response.success) {
        await fetchHistory();
        notifyBalanceChange(BALANCE_EVENTS.WITHDRAW_SUCCESS, { cancelled: true });
      } else {
        setError(response.error?.message || 'Không thể hủy yêu cầu');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    }
  };

  // Status badge
  const getStatusBadge = (status: WithdrawalHistory['status']) => {
    const styles = {
      PENDING: 'bg-yellow-500/20 text-yellow-500',
      PROCESSING: 'bg-blue-500/20 text-blue-500',
      COMPLETED: 'bg-green-500/20 text-green-500',
      REJECTED: 'bg-red-500/20 text-red-500',
      CANCELLED: 'bg-gray-500/20 text-gray-500',
    };
    const labels = {
      PENDING: 'Chờ duyệt',
      PROCESSING: 'Đang xử lý',
      COMPLETED: 'Hoàn thành',
      REJECTED: 'Từ chối',
      CANCELLED: 'Đã hủy',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center p-6">
          <div className="text-center">
            <AlertCircle size={48} className="mx-auto text-yellow-500 mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Vui lòng đăng nhập</h2>
            <p className="text-gray-400 mb-4">Bạn cần đăng nhập để rút tiền</p>
            <Link href="/" className="text-yellow-500 hover:underline">
              Về trang chủ
            </Link>
          </div>
        </div>
      </>
    );
  }

  // Success message
  if (success) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Yêu cầu đã được gửi!</h2>
            <p className="text-gray-400 mb-6">
              Yêu cầu rút tiền của bạn đang chờ xử lý. Thời gian xử lý: {withdrawInfo?.processingTime || '1-24 giờ'}
            </p>
            <button
              onClick={() => setSuccess(false)}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium px-6 py-3 rounded transition-colors"
            >
              Tiếp tục
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      
      {/* Success Toast */}
      {successMessage && (
        <div className="fixed top-20 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-pulse">
          <CheckCircle size={20} />
          {successMessage}
        </div>
      )}
      
      <div className="min-h-screen bg-[#0b0e11] text-white p-6">
        <div className="max-w-4xl mx-auto">
          {/* Page Title */}
          <div className="flex items-center gap-4 mb-8">
            <Link href="/wallet" className="p-2 hover:bg-[#2b3139] rounded-lg transition-colors">
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Rút tiền VND</h1>
              <p className="text-gray-400">Rút tiền về tài khoản ngân hàng</p>
            </div>
          </div>

        {/* Balance Card */}
        <div className="bg-linear-to-r from-[#1e2329] to-[#2b3139] rounded-lg p-6 border border-[#363d47] mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                <Wallet size={24} className="text-green-500" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Số dư khả dụng</p>
                <p className="text-2xl font-bold">
                  {balanceLoading ? (
                    <Loader2 size={24} className="animate-spin" />
                  ) : (
                    `${formatVND(vndBalance?.free || 0)} VND`
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={refreshContextBalances}
              disabled={balanceLoading}
              className="p-2 text-gray-400 hover:text-white hover:bg-[#363d47] rounded-lg transition-colors"
            >
              <RefreshCw size={20} className={balanceLoading ? 'animate-spin' : ''} />
            </button>
          </div>
          {vndBalance && vndBalance.free < 100000 && (
            <div className="mt-4 p-3 bg-yellow-500/10 rounded-lg text-yellow-400 text-sm flex items-center justify-between">
              <span>Số dư chưa đủ để rút (tối thiểu 100,000 VND)</span>
              <Link href="/deposit" className="underline hover:no-underline">Nạp tiền</Link>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('withdraw')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'withdraw'
                ? 'bg-yellow-500 text-black'
                : 'bg-[#2b3139] text-gray-400 hover:text-white'
            }`}
          >
            Rút tiền
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-yellow-500 text-black'
                : 'bg-[#2b3139] text-gray-400 hover:text-white'
            }`}
          >
            Lịch sử rút tiền
          </button>
        </div>

        {activeTab === 'withdraw' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Bank Account Selection */}
              <div className="bg-[#1e2329] rounded-lg p-6 border border-[#2b3139]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Tài khoản ngân hàng</h3>
                  <button
                    onClick={() => setShowAddBank(true)}
                    className="flex items-center gap-2 text-yellow-500 hover:text-yellow-400 text-sm"
                  >
                    <Plus size={16} />
                    Thêm tài khoản
                  </button>
                </div>

                {loadingAccounts ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={24} className="animate-spin text-gray-400" />
                  </div>
                ) : bankAccounts.length === 0 ? (
                  <div className="text-center py-8">
                    <Building2 size={48} className="mx-auto text-gray-600 mb-3" />
                    <p className="text-gray-400 mb-4">Bạn chưa có tài khoản ngân hàng nào</p>
                    <button
                      onClick={() => setShowAddBank(true)}
                      className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium px-4 py-2 rounded transition-colors"
                    >
                      Thêm tài khoản ngân hàng
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bankAccounts.map((account) => (
                      <div
                        key={account.id}
                        onClick={() => setSelectedAccount(account)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          selectedAccount?.id === account.id
                            ? 'border-yellow-500 bg-yellow-500/10'
                            : 'border-[#2b3139] hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#2b3139] rounded-lg flex items-center justify-center">
                              <Building2 size={20} className="text-gray-400" />
                            </div>
                            <div>
                              <p className="font-medium">{account.bankName}</p>
                              <p className="text-sm text-gray-400">{account.accountNumber}</p>
                              <p className="text-xs text-gray-500">{account.accountName}</p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteBank(account.id);
                            }}
                            className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Amount Input */}
              <div className="bg-[#1e2329] rounded-lg p-6 border border-[#2b3139]">
                <h3 className="text-lg font-semibold mb-4">Số tiền rút</h3>
                <div className="bg-[#2b3139] rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={amount ? formatVND(parseInt(amount.replace(/[^0-9]/g, ''))) : ''}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        setAmount(value);
                      }}
                      placeholder="0"
                      className="bg-transparent text-white text-3xl font-bold outline-none w-full"
                    />
                    <span className="text-gray-400 text-xl font-semibold ml-4">VND</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    {[500000, 1000000, 5000000, 10000000].map((val) => (
                      <button
                        key={val}
                        onClick={() => setAmount(val.toString())}
                        className="flex-1 bg-[#1e2329] hover:bg-[#2b3139] text-gray-400 hover:text-white py-1.5 rounded text-sm font-medium transition-colors"
                      >
                        {formatVND(val)}
                      </button>
                    ))}
                  </div>
                  {vndBalance && (
                    <button
                      onClick={() => setAmount(Math.floor(vndBalance.free).toString())}
                      className="w-full mt-2 text-yellow-500 hover:text-yellow-400 text-sm"
                    >
                      Rút tối đa ({formatVND(Math.floor(vndBalance.free))} VND)
                    </button>
                  )}
                </div>

                {/* Summary */}
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Số tiền rút</span>
                    <span>{formatVND(parseInt(amount.replace(/[^0-9]/g, '')) || 0)} VND</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Phí rút tiền</span>
                    <span className="text-green-500">Miễn phí</span>
                  </div>
                  <div className="border-t border-[#2b3139] pt-2 flex justify-between">
                    <span className="text-gray-400">Thực nhận</span>
                    <span className="text-lg font-bold text-yellow-500">{formatVND(calculateNet())} VND</span>
                  </div>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm flex items-center gap-2">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleWithdraw}
                disabled={withdrawing || !selectedAccount || !amount || (vndBalance ? parseInt(amount) > vndBalance.free : true)}
                className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-4 rounded-lg transition-colors text-lg flex items-center justify-center gap-2"
              >
                {withdrawing && <Loader2 size={20} className="animate-spin" />}
                {withdrawing ? 'Đang xử lý...' : 'Gửi yêu cầu rút tiền'}
              </button>
            </div>

            {/* Side Info */}
            <div className="space-y-6">
              {/* Withdrawal Info */}
              <div className="bg-[#1e2329] rounded-lg p-6 border border-[#2b3139]">
                <h3 className="text-lg font-semibold mb-4">Thông tin rút tiền</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Số tiền tối thiểu</span>
                    <span>{formatVND(withdrawInfo?.minAmount || 100000)} VND</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Số tiền tối đa</span>
                    <span>{formatVND(withdrawInfo?.maxAmount || 500000000)} VND</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Phí rút tiền</span>
                    <span className="text-green-500">Miễn phí</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Thời gian xử lý</span>
                    <span>{withdrawInfo?.processingTime || '1-24 giờ'}</span>
                  </div>
                </div>
              </div>

              {/* Notice */}
              <div className="bg-[#1e2329] rounded-lg p-6 border border-[#2b3139]">
                <h3 className="text-lg font-semibold mb-4">Lưu ý</h3>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-start gap-2">
                    <Clock size={16} className="mt-0.5 text-yellow-500 shrink-0" />
                    Yêu cầu rút tiền sẽ được xử lý trong giờ làm việc
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 text-yellow-500 shrink-0" />
                    Tên tài khoản ngân hàng phải trùng với tên đăng ký
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle size={16} className="mt-0.5 text-yellow-500 shrink-0" />
                    Bạn có thể hủy yêu cầu nếu chưa được xử lý
                  </li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          /* History Tab */
          <div className="bg-[#1e2329] rounded-lg border border-[#2b3139]">
            <div className="p-4 border-b border-[#2b3139] flex items-center justify-between">
              <h3 className="text-lg font-semibold">Lịch sử rút tiền</h3>
              <button
                onClick={fetchHistory}
                disabled={loadingHistory}
                className="p-2 text-gray-400 hover:text-white hover:bg-[#2b3139] rounded-lg transition-colors"
              >
                <RefreshCw size={18} className={loadingHistory ? 'animate-spin' : ''} />
              </button>
            </div>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-gray-400" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12">
                <Clock size={48} className="mx-auto text-gray-600 mb-3" />
                <p className="text-gray-400">Chưa có lịch sử rút tiền</p>
              </div>
            ) : (
              <div className="divide-y divide-[#2b3139]">
                {history.map((item) => (
                  <div key={item.id} className="p-4 hover:bg-[#2b3139]/50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#2b3139] rounded-lg flex items-center justify-center">
                          <Building2 size={20} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium">{item.bankAccount.bankName}</p>
                          <p className="text-sm text-gray-400">
                            {item.bankAccount.accountNumber} - {item.bankAccount.accountName}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(item.status)}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <span className="text-gray-400">Số tiền: </span>
                        <span className="text-white font-medium">{formatVND(item.amount)} VND</span>
                        {item.fee > 0 && (
                          <span className="text-gray-500 ml-2">(Phí: {formatVND(item.fee)})</span>
                        )}
                      </div>
                      <span className="text-gray-500">
                        {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    {item.rejectedReason && (
                      <p className="text-red-400 text-sm mt-2">Lý do từ chối: {item.rejectedReason}</p>
                    )}
                    {item.status === 'PENDING' && (
                      <button
                        onClick={() => handleCancelWithdrawal(item.id)}
                        className="mt-2 text-red-400 hover:text-red-300 text-sm"
                      >
                        Hủy yêu cầu
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add Bank Modal */}
        {showAddBank && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1e2329] rounded-lg p-6 max-w-md w-full border border-[#2b3139]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Thêm tài khoản ngân hàng</h3>
                <button
                  onClick={() => setShowAddBank(false)}
                  className="p-2 hover:bg-[#2b3139] rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Bank Selection */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Ngân hàng</label>
                  <div className="relative">
                    <select
                      value={newBank.bankCode}
                      onChange={(e) => setNewBank({ ...newBank, bankCode: e.target.value })}
                      className="w-full bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139] focus:border-yellow-500 focus:outline-none appearance-none"
                    >
                      <option value="">Chọn ngân hàng</option>
                      {VIETNAM_BANKS.map((bank) => (
                        <option key={bank.code} value={bank.code}>
                          {bank.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Account Number */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Số tài khoản</label>
                  <input
                    type="text"
                    value={newBank.accountNumber}
                    onChange={(e) => setNewBank({ ...newBank, accountNumber: e.target.value.replace(/[^0-9]/g, '') })}
                    placeholder="Nhập số tài khoản"
                    className="w-full bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139] focus:border-yellow-500 focus:outline-none"
                  />
                </div>

                {/* Account Name */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Tên chủ tài khoản</label>
                  <input
                    type="text"
                    value={newBank.accountName}
                    onChange={(e) => setNewBank({ ...newBank, accountName: e.target.value.toUpperCase() })}
                    placeholder="VD: NGUYEN VAN A"
                    className="w-full bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139] focus:border-yellow-500 focus:outline-none uppercase"
                  />
                  <p className="text-xs text-gray-500 mt-1">Tên phải trùng với tên đăng ký trên sàn</p>
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-500 text-sm">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleAddBank}
                  disabled={addingBank || !newBank.bankCode || !newBank.accountNumber || !newBank.accountName}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3 rounded transition-colors flex items-center justify-center gap-2"
                >
                  {addingBank && <Loader2 size={18} className="animate-spin" />}
                  {addingBank ? 'Đang thêm...' : 'Thêm tài khoản'}
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  );
}
