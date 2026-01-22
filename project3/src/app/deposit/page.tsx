"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useBalance, BALANCE_EVENTS } from "@/contexts/BalanceContext";
import {
  Wallet,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronRight,
  ArrowLeft,
  History,
  Info,
  Copy,
  ExternalLink,
} from "lucide-react";
import {
  getDepositMethods,
  createDeposit,
  getDepositHistory,
  formatVND,
  type DepositMethod,
  type DepositTransaction,
} from "@/services/depositApi";
import { triggerNotificationRefresh } from "@/services/notificationApi";

const QUICK_AMOUNTS = [100000, 500000, 1000000, 2000000, 5000000, 10000000];

export default function DepositPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, refreshBalances } = useAuth();
  const { notifyBalanceChange } = useBalance();

  const [amount, setAmount] = useState<string>("");
  const [depositMethods, setDepositMethods] = useState<DepositMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<DepositMethod | null>(null);
  const [transactions, setTransactions] = useState<DepositTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [bankInfo, setBankInfo] = useState<{
    bankName: string;
    accountName: string;
    accountNumber: string;
    reference: string;
  } | null>(null);

  // Fetch deposit methods and history
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [methods, history] = await Promise.all([
          getDepositMethods(),
          getDepositHistory(),
        ]);

        console.log('[Deposit] Fetched methods:', methods);
        console.log('[Deposit] Fetched history:', history);
        
        // Backend dùng 'supported: true/false', frontend map sang 'enabled'
        // Filter chỉ hiển thị các phương thức được hỗ trợ
        const enabledMethods = methods.filter((m) => m.enabled !== false && m.supported !== false);
        console.log('[Deposit] Enabled methods:', enabledMethods);
        
        // Nếu sau filter không còn method nào, dùng tất cả
        const methodsToUse = enabledMethods.length > 0 ? enabledMethods : methods;
        
        setDepositMethods(methodsToUse);
        if (methodsToUse.length > 0) {
          setSelectedMethod(methodsToUse[0]);
        }
        setTransactions(history);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Không thể tải dữ liệu");
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const handleAmountChange = (value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, "");
    setAmount(numericValue);
    setError("");
  };

  const handleQuickAmount = (value: number) => {
    setAmount(value.toString());
    setError("");
  };

  const validateAmount = (): boolean => {
    const numAmount = parseFloat(amount);

    if (!amount || isNaN(numAmount)) {
      setError("Vui lòng nhập số tiền");
      return false;
    }

    if (selectedMethod) {
      if (numAmount < selectedMethod.minAmount) {
        setError(`Số tiền tối thiểu là ${formatVND(selectedMethod.minAmount)}`);
        return false;
      }

      if (numAmount > selectedMethod.maxAmount) {
        setError(`Số tiền tối đa là ${formatVND(selectedMethod.maxAmount)}`);
        return false;
      }
    }

    return true;
  };

  const handleDeposit = async () => {
    if (!validateAmount() || !selectedMethod) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await createDeposit({
        amount: parseFloat(amount),
        paymentMethod: selectedMethod.code,
      });

      if (response.success && response.data) {
        if (response.data.paymentUrl) {
          // Redirect to payment gateway
          window.location.href = response.data.paymentUrl;
        } else if (response.data.bankInfo) {
          // Show bank transfer info
          setBankInfo(response.data.bankInfo);
        } else {
          // Show success
          setSuccess(true);
          // Notify all components about balance change
          notifyBalanceChange(BALANCE_EVENTS.DEPOSIT_SUCCESS, {
            amount: parseFloat(amount),
            method: selectedMethod.code
          });
          // Trigger notification refresh immediately
          triggerNotificationRefresh();
          await refreshBalances();
          setTimeout(() => {
            setSuccess(false);
            setAmount("");
            getDepositHistory().then(setTransactions);
          }, 3000);
        }
      } else {
        setError(response.error?.message || "Có lỗi xảy ra");
      }
    } catch {
      setError("Không thể xử lý yêu cầu. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  };

  const getFeeAmount = (): number => {
    if (!selectedMethod || !amount) return 0;
    const numAmount = parseFloat(amount) || 0;
    return (numAmount * selectedMethod.fee) / 100;
  };

  const getTotalAmount = (): number => {
    const numAmount = parseFloat(amount) || 0;
    return numAmount + getFeeAmount();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full flex items-center gap-1">
            <CheckCircle size={12} />
            Hoàn thành
          </span>
        );
      case "PENDING":
      case "PROCESSING":
        return (
          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full flex items-center gap-1">
            <Clock size={12} />
            Đang xử lý
          </span>
        );
      case "FAILED":
      case "CANCELLED":
        return (
          <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full flex items-center gap-1">
            <AlertCircle size={12} />
            Thất bại
          </span>
        );
      default:
        return null;
    }
  };

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center">
        <Loader2 className="animate-spin text-yellow-500" size={48} />
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0b0e11]">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Wallet size={64} className="mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400 text-lg">Vui lòng đăng nhập để nạp tiền</p>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-[#0b0e11]">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Nạp Tiền Thành Công!</h2>
            <p className="text-gray-400">
              Bạn đã nạp {formatVND(parseFloat(amount))} vào ví
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Bank transfer info modal
  if (bankInfo) {
    return (
      <div className="min-h-screen bg-[#0b0e11]">
        <Header />
        <div className="max-w-md mx-auto px-4 py-8">
          <button
            onClick={() => setBankInfo(null)}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-6"
          >
            <ArrowLeft size={20} />
            Quay lại
          </button>

          <div className="bg-[#1e2329] rounded-lg p-6 border border-[#2b3139]">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Info size={32} className="text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Thông tin chuyển khoản</h2>
              <p className="text-gray-400 text-sm">
                Vui lòng chuyển khoản với nội dung chính xác
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-[#2b3139] rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Ngân hàng</p>
                <p className="text-white font-medium">{bankInfo.bankName}</p>
              </div>

              <div className="bg-[#2b3139] rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Tên tài khoản</p>
                <p className="text-white font-medium">{bankInfo.accountName}</p>
              </div>

              <div className="bg-[#2b3139] rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Số tài khoản</p>
                    <p className="text-white font-medium">{bankInfo.accountNumber}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(bankInfo.accountNumber)}
                    className="text-yellow-500 hover:text-yellow-400"
                  >
                    <Copy size={20} />
                  </button>
                </div>
              </div>

              <div className="bg-[#2b3139] rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Nội dung chuyển khoản</p>
                    <p className="text-yellow-500 font-medium">{bankInfo.reference}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(bankInfo.reference)}
                    className="text-yellow-500 hover:text-yellow-400"
                  >
                    <Copy size={20} />
                  </button>
                </div>
              </div>

              <div className="bg-[#2b3139] rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Số tiền</p>
                <p className="text-white font-medium text-lg">{formatVND(parseFloat(amount))}</p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
              <p className="text-yellow-400 text-sm">
                <strong>Lưu ý:</strong> Vui lòng chuyển đúng số tiền và nội dung. Tiền sẽ được
                cộng vào tài khoản trong vòng 1-24 giờ sau khi chúng tôi xác nhận.
              </p>
            </div>

            <button
              onClick={() => {
                setBankInfo(null);
                setAmount("");
                router.push("/wallet");
              }}
              className="w-full mt-6 bg-yellow-500 text-black font-semibold py-3 rounded-lg hover:bg-yellow-400 transition-colors"
            >
              Đã chuyển khoản
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      <Header />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Nạp Tiền</h1>
            <p className="text-gray-400">Nạp tiền VND vào ví của bạn</p>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-4 py-2 bg-[#2b3139] rounded-lg hover:bg-[#363d47] transition-colors"
          >
            <History size={20} />
            Lịch sử
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <div className="bg-[#1e2329] rounded-lg p-6 border border-[#2b3139]">
              {/* Amount Input */}
              <div className="mb-6">
                <label className="block text-gray-400 mb-2">Số tiền (VND)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={amount ? parseInt(amount).toLocaleString("vi-VN") : ""}
                    onChange={(e) =>
                      handleAmountChange(e.target.value.replace(/\./g, ""))
                    }
                    placeholder="Nhập số tiền"
                    className="w-full bg-[#2b3139] border border-[#363d47] rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:border-yellow-500 transition-colors"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                    VND
                  </span>
                </div>
                {selectedMethod && (
                  <p className="text-gray-500 text-sm mt-2">
                    Tối thiểu {formatVND(selectedMethod.minAmount)} - Tối đa{" "}
                    {formatVND(selectedMethod.maxAmount)}
                  </p>
                )}
              </div>

              {/* Quick Amount Buttons */}
              <div className="mb-6">
                <label className="block text-gray-400 mb-2">Số tiền nhanh</label>
                <div className="grid grid-cols-3 gap-2">
                  {QUICK_AMOUNTS.map((value) => (
                    <button
                      key={value}
                      onClick={() => handleQuickAmount(value)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        amount === value.toString()
                          ? "bg-yellow-500 text-black"
                          : "bg-[#2b3139] text-gray-300 hover:bg-[#363d47]"
                      }`}
                    >
                      {formatVND(value)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Methods */}
              <div className="mb-6">
                <label className="block text-gray-400 mb-2">Phương thức thanh toán</label>
                <div className="space-y-2">
                  {depositMethods.map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setSelectedMethod(method)}
                      className={`w-full flex items-center justify-between p-4 rounded-lg border transition-colors ${
                        selectedMethod?.id === method.id
                          ? "bg-yellow-500/10 border-yellow-500"
                          : "bg-[#2b3139] border-[#363d47] hover:border-[#4a5568]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl w-10 h-10 flex items-center justify-center">
                          {method.code === 'VNPAY' ? '💳' : method.code === 'MOMO' ? '📱' : method.icon}
                        </span>
                        <div className="text-left">
                          <p className="font-medium">{method.name}</p>
                          <p className="text-gray-400 text-sm">
                            {method.fee > 0 ? `Phí ${method.fee}%` : "Miễn phí"} •{" "}
                            {method.processingTime}
                          </p>
                        </div>
                      </div>
                      <ChevronRight
                        size={20}
                        className={
                          selectedMethod?.id === method.id
                            ? "text-yellow-500"
                            : "text-gray-500"
                        }
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400">
                  <AlertCircle size={20} />
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleDeposit}
                disabled={submitting || !amount || !selectedMethod}
                className="w-full bg-yellow-500 text-black font-semibold py-4 rounded-lg hover:bg-yellow-400 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    Tiếp tục thanh toán
                    <ExternalLink size={18} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-[#1e2329] rounded-lg p-6 border border-[#2b3139] sticky top-4">
              <h3 className="text-lg font-semibold mb-4">Chi tiết giao dịch</h3>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Số tiền nạp</span>
                  <span className="font-medium">
                    {amount ? formatVND(parseFloat(amount)) : "---"}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">Phí giao dịch</span>
                  <span className="font-medium">
                    {selectedMethod && selectedMethod.fee > 0
                      ? formatVND(getFeeAmount())
                      : "Miễn phí"}
                  </span>
                </div>

                <div className="border-t border-[#2b3139] pt-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tổng thanh toán</span>
                    <span className="font-bold text-lg text-yellow-500">
                      {amount ? formatVND(getTotalAmount()) : "---"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-[#2b3139] rounded-lg">
                <p className="text-gray-400 text-sm">
                  <strong className="text-white">Lưu ý:</strong> Tiền sẽ được cộng vào ví sau khi
                  thanh toán thành công.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        {showHistory && (
          <div className="mt-8">
            <div className="bg-[#1e2329] rounded-lg p-6 border border-[#2b3139]">
              <h3 className="text-lg font-semibold mb-4">Lịch sử nạp tiền</h3>

              {transactions.length === 0 ? (
                <div className="text-center py-8">
                  <History size={48} className="mx-auto text-gray-600 mb-4" />
                  <p className="text-gray-400">Chưa có giao dịch nào</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-gray-400 text-sm border-b border-[#2b3139]">
                        <th className="text-left py-3">Thời gian</th>
                        <th className="text-left py-3">Phương thức</th>
                        <th className="text-right py-3">Số tiền</th>
                        <th className="text-right py-3">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="border-b border-[#2b3139] last:border-0">
                          <td className="py-4">
                            {new Date(tx.createdAt).toLocaleDateString("vi-VN", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-4">{tx.method}</td>
                          <td className="py-4 text-right font-medium">
                            {formatVND(tx.amount)}
                          </td>
                          <td className="py-4 text-right">{getStatusBadge(tx.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
