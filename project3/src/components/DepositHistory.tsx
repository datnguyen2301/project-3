"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getDepositHistory,
  formatVND,
  type DepositTransaction,
} from "@/services/depositApi";
import {
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  History,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface DepositHistoryProps {
  limit?: number;
  showTitle?: boolean;
  compact?: boolean;
}

export default function DepositHistory({
  limit,
  showTitle = true,
  compact = false,
}: DepositHistoryProps) {
  const [deposits, setDeposits] = useState<DepositTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(!compact);
  const [error, setError] = useState("");

  const fetchHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    
    try {
      const data = await getDepositHistory();
      setDeposits(limit ? data.slice(0, limit) : data);
      setError("");
    } catch (err) {
      console.error("Error fetching deposit history:", err);
      setError("Không thể tải lịch sử nạp tiền");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleRefresh = () => {
    fetchHistory(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="px-2.5 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded-full inline-flex items-center gap-1">
            <CheckCircle size={12} />
            Thành công
          </span>
        );
      case "PENDING":
      case "PROCESSING":
        return (
          <span className="px-2.5 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded-full inline-flex items-center gap-1">
            <Clock size={12} />
            Đang xử lý
          </span>
        );
      case "FAILED":
      case "CANCELLED":
        return (
          <span className="px-2.5 py-1 bg-red-500/20 text-red-400 text-xs font-medium rounded-full inline-flex items-center gap-1">
            <XCircle size={12} />
            Thất bại
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 bg-gray-500/20 text-gray-400 text-xs font-medium rounded-full">
            {status}
          </span>
        );
    }
  };

  const getMethodLabel = (method: string) => {
    const methods: Record<string, { icon: string; name: string }> = {
      VNPAY: { icon: "🏦", name: "VNPay" },
      MOMO: { icon: "📱", name: "MoMo" },
      STRIPE: { icon: "💳", name: "Thẻ quốc tế" },
      BANK_TRANSFER: { icon: "🏛️", name: "Chuyển khoản" },
    };
    const info = methods[method] || { icon: "💰", name: method };
    return (
      <span className="inline-flex items-center gap-1.5">
        <span>{info.icon}</span>
        <span>{info.name}</span>
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-[#1e2329] rounded-lg p-6 border border-[#2b3139]">
        {showTitle && (
          <div className="flex items-center gap-2 mb-4">
            <History size={20} className="text-gray-400" />
            <h2 className="text-lg font-semibold text-white">Lịch sử nạp tiền</h2>
          </div>
        )}
        <div className="flex items-center justify-center py-8">
          <Loader2 size={32} className="animate-spin text-yellow-500" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-[#1e2329] rounded-lg p-6 border border-[#2b3139]">
        {showTitle && (
          <div className="flex items-center gap-2 mb-4">
            <History size={20} className="text-gray-400" />
            <h2 className="text-lg font-semibold text-white">Lịch sử nạp tiền</h2>
          </div>
        )}
        <div className="text-center py-8">
          <XCircle size={48} className="mx-auto text-red-500 mb-4" />
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="text-yellow-500 hover:text-yellow-400 inline-flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1e2329] rounded-lg border border-[#2b3139]">
      {/* Header */}
      {showTitle && (
        <div className="flex items-center justify-between p-4 border-b border-[#2b3139]">
          <button
            onClick={() => compact && setExpanded(!expanded)}
            className={`flex items-center gap-2 ${compact ? "cursor-pointer" : ""}`}
          >
            <History size={20} className="text-gray-400" />
            <h2 className="text-lg font-semibold text-white">Lịch sử nạp tiền</h2>
            {compact && (
              expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />
            )}
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#2b3139] rounded-lg transition-colors disabled:opacity-50"
            title="Làm mới"
          >
            <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      )}

      {/* Content */}
      {(!compact || expanded) && (
        <div className="p-4">
          {deposits.length === 0 ? (
            <div className="text-center py-8">
              <History size={48} className="mx-auto text-gray-600 mb-4" />
              <p className="text-gray-400">Chưa có giao dịch nào</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-gray-400 text-sm border-b border-[#2b3139]">
                      <th className="text-left py-3 px-2 font-medium">Thời gian</th>
                      <th className="text-left py-3 px-2 font-medium">Mã GD</th>
                      <th className="text-left py-3 px-2 font-medium">Phương thức</th>
                      <th className="text-right py-3 px-2 font-medium">Số tiền</th>
                      <th className="text-right py-3 px-2 font-medium">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deposits.map((deposit) => (
                      <tr
                        key={deposit.id}
                        className="border-b border-[#2b3139] last:border-0 hover:bg-[#2b3139]/50 transition-colors"
                      >
                        <td className="py-3 px-2 text-gray-300">
                          {formatDate(deposit.createdAt)}
                        </td>
                        <td className="py-3 px-2">
                          <span className="text-gray-400 font-mono text-sm">
                            {deposit.id.slice(0, 8)}...
                          </span>
                        </td>
                        <td className="py-3 px-2 text-white">
                          {getMethodLabel(deposit.method)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className="text-green-400 font-semibold">
                            +{formatVND(deposit.amount)}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          {getStatusBadge(deposit.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {deposits.map((deposit) => (
                  <div
                    key={deposit.id}
                    className="bg-[#2b3139] rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-white font-semibold">
                          {getMethodLabel(deposit.method)}
                        </p>
                        <p className="text-gray-400 text-sm">
                          {formatDate(deposit.createdAt)}
                        </p>
                      </div>
                      {getStatusBadge(deposit.status)}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm font-mono">
                        #{deposit.id.slice(0, 8)}
                      </span>
                      <span className="text-green-400 font-bold text-lg">
                        +{formatVND(deposit.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* View All Link */}
              {limit && deposits.length >= limit && (
                <div className="text-center mt-4 pt-4 border-t border-[#2b3139]">
                  <a
                    href="/deposit"
                    className="text-yellow-500 hover:text-yellow-400 text-sm inline-flex items-center gap-1"
                  >
                    Xem tất cả
                    <ChevronDown size={14} />
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
