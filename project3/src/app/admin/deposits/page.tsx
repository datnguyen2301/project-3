"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, AlertTriangle, RefreshCw, Check, X, ChevronLeft, ChevronRight } from "lucide-react";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/services/apiHelper";
import Link from "next/link";

interface DepositRequest {
  id: string;
  userId: string;
  type: string;
  status: string;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  reference?: string;
  adminNote?: string;
  createdAt: string;
  completedAt?: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
  bankAccount?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
}

export default function AdminDepositsPage() {
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);

  const fetchDeposits = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        status: statusFilter,
      });
      
      const response = await fetchWithAuth(`/api/admin/deposits?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setDeposits(data.data?.deposits || []);
        setTotalPages(data.data?.pagination?.totalPages || 1);
      } else {
        setError(data.error?.message || "Không thể tải danh sách nạp tiền");
      }
    } catch {
      console.error('Fetch deposits error');
      setError("Không thể kết nối đến server");
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/');
        return;
      }
      const adminCheck = user?.email?.includes('admin') || (user as { role?: string })?.role === 'ADMIN';
      setIsAdmin(adminCheck);
      if (adminCheck) {
        fetchDeposits();
      }
    }
  }, [isAuthenticated, authLoading, user, router, fetchDeposits]);

  useEffect(() => {
    if (isAdmin) {
      fetchDeposits();
    }
  }, [page, statusFilter, isAdmin, fetchDeposits]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const response = await fetchWithAuth(`/api/admin/deposits/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ approved: true }),
      });
      const data = await response.json();
      
      if (data.success) {
        setDeposits(deposits.map(d => d.id === id ? { ...d, status: 'COMPLETED', completedAt: new Date().toISOString() } : d));
      } else {
        alert(data.error?.message || "Không thể duyệt yêu cầu");
      }
    } catch {
      alert("Không thể kết nối đến server");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) {
      alert("Vui lòng nhập lý do từ chối");
      return;
    }
    
    setActionLoading(id);
    try {
      const response = await fetchWithAuth(`/api/admin/deposits/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ approved: false, rejectReason }),
      });
      const data = await response.json();
      
      if (data.success) {
        setDeposits(deposits.map(d => d.id === id ? { ...d, status: 'REJECTED', adminNote: rejectReason } : d));
        setShowRejectModal(null);
        setRejectReason("");
      } else {
        alert(data.error?.message || "Không thể từ chối yêu cầu");
      }
    } catch {
      alert("Không thể kết nối đến server");
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || isAdmin === null) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
        </div>
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Truy cập bị từ chối</h1>
            <p className="text-gray-400">Bạn không có quyền truy cập trang này</p>
            <Link href="/" className="mt-4 inline-block text-yellow-500 hover:underline">
              Về trang chủ
            </Link>
          </div>
        </div>
      </>
    );
  }

  const formatCurrency = (amount: number | undefined | null, currency: string) => {
    if (amount == null) return 'N/A';
    if (currency === 'VND') {
      return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
    }
    return amount.toLocaleString() + ' ' + currency;
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-[#0b0e11] pt-20 px-4 pb-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Quản lý Yêu cầu Nạp tiền</h1>
              <p className="text-gray-400 text-sm mt-1">Duyệt hoặc từ chối các yêu cầu nạp tiền</p>
            </div>
            <div className="flex gap-2">
              <Link href="/admin" className="px-4 py-2 bg-[#2b3139] text-gray-300 rounded hover:bg-[#363d47] transition-colors">
                ← Quay lại
              </Link>
              <button
                onClick={fetchDeposits}
                className="flex items-center gap-2 px-4 py-2 bg-[#2b3139] text-gray-300 rounded hover:bg-[#363d47] transition-colors"
              >
                <RefreshCw size={16} />
                Làm mới
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-[#1e2329] rounded-lg p-4 mb-6">
            <div className="flex flex-wrap gap-2">
              {['PENDING', 'COMPLETED', 'REJECTED'].map((status) => (
                <button
                  key={status}
                  onClick={() => { setStatusFilter(status); setPage(1); }}
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-yellow-500 text-black'
                      : 'bg-[#2b3139] text-gray-400 hover:text-white'
                  }`}
                >
                  {status === 'PENDING' ? 'Chờ duyệt' : status === 'COMPLETED' ? 'Đã duyệt' : 'Đã từ chối'}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          {error ? (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-500">
              {error}
            </div>
          ) : isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
            </div>
          ) : deposits.length === 0 ? (
            <div className="bg-[#1e2329] rounded-lg p-8 text-center">
              <p className="text-gray-400">Không có yêu cầu nạp tiền nào</p>
            </div>
          ) : (
            <>
              <div className="bg-[#1e2329] rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-[#0b0e11]">
                      <tr>
                        <th className="px-4 py-3 text-gray-400 font-medium">User</th>
                        <th className="px-4 py-3 text-gray-400 font-medium">Số tiền</th>
                        <th className="px-4 py-3 text-gray-400 font-medium">Mã tham chiếu</th>
                        <th className="px-4 py-3 text-gray-400 font-medium">Ngày tạo</th>
                        <th className="px-4 py-3 text-gray-400 font-medium">Trạng thái</th>
                        <th className="px-4 py-3 text-gray-400 font-medium">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deposits.map((d) => (
                        <tr key={d.id} className="border-t border-[#2b3139] hover:bg-[#1e2026]">
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-white font-medium">{d.user?.name || 'N/A'}</p>
                              <p className="text-gray-400 text-sm">{d.user?.email || 'N/A'}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-green-400 font-medium">
                            {formatCurrency(d.amount, d.currency)}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-sm">
                            {d.reference || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-sm">
                            {new Date(d.createdAt).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded ${
                              d.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' :
                              d.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {d.status === 'PENDING' ? 'Chờ duyệt' : d.status === 'COMPLETED' ? 'Đã duyệt' : 'Đã từ chối'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {d.status === 'PENDING' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApprove(d.id)}
                                  disabled={actionLoading === d.id}
                                  className="p-2 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 disabled:opacity-50"
                                  title="Duyệt"
                                >
                                  {actionLoading === d.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                </button>
                                <button
                                  onClick={() => setShowRejectModal(d.id)}
                                  disabled={actionLoading === d.id}
                                  className="p-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 disabled:opacity-50"
                                  title="Từ chối"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            )}
                            {d.status === 'REJECTED' && d.adminNote && (
                              <span className="text-xs text-gray-400">
                                Lý do: {d.adminNote}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-6">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 bg-[#2b3139] rounded hover:bg-[#363d47] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={20} className="text-gray-400" />
                  </button>
                  <span className="text-gray-400">
                    Trang {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 bg-[#2b3139] rounded hover:bg-[#363d47] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={20} className="text-gray-400" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2329] rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-white mb-4">Từ chối yêu cầu nạp tiền</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Nhập lý do từ chối..."
              className="w-full bg-[#0b0e11] border border-[#2b3139] rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 h-24 resize-none"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { setShowRejectModal(null); setRejectReason(""); }}
                className="flex-1 px-4 py-2 bg-[#2b3139] text-gray-300 rounded hover:bg-[#363d47]"
              >
                Hủy
              </button>
              <button
                onClick={() => handleReject(showRejectModal)}
                disabled={actionLoading === showRejectModal}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
              >
                {actionLoading === showRejectModal ? 'Đang xử lý...' : 'Từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
