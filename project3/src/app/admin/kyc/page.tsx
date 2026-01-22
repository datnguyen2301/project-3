"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, AlertTriangle, FileCheck, RefreshCw, Check, X, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/services/apiHelper";
import Link from "next/link";

interface KYCApplication {
  id: string;
  status: string;
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  address: string;
  idType: string;
  idNumber: string;
  idFrontImage: string;
  idBackImage: string;
  selfieImage: string;
  proofOfAddress: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export default function AdminKYCPage() {
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [applications, setApplications] = useState<KYCApplication[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedKYC, setSelectedKYC] = useState<KYCApplication | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const fetchApplications = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        status: statusFilter,
      });
      
      const response = await fetchWithAuth(`/api/admin/kyc?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setApplications(data.data.kycApplications || []);
        setTotalPages(data.data.pagination?.totalPages || 1);
      } else {
        setError(data.error?.message || "Không thể tải danh sách KYC");
      }
    } catch {
      console.error('Fetch KYC error');
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
        fetchApplications();
      }
    }
  }, [isAuthenticated, authLoading, user, router, fetchApplications]);

  useEffect(() => {
    if (isAdmin) {
      fetchApplications();
    }
  }, [page, statusFilter, isAdmin, fetchApplications]);

  const handleApprove = async (kycId: string) => {
    if (!confirm('Bạn có chắc muốn duyệt KYC này?')) return;

    setActionLoading(kycId);
    try {
      const response = await fetchWithAuth(`/api/admin/kyc/${kycId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true }),
      });
      const data = await response.json();

      if (data.success) {
        setApplications(applications.map(a => a.id === kycId ? { ...a, status: 'APPROVED', reviewedAt: new Date().toISOString() } : a));
        setSelectedKYC(null);
      } else {
        alert(data.error?.message || 'Lỗi duyệt KYC');
      }
    } catch {
      alert('Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (kycId: string) => {
    if (!rejectionReason.trim()) {
      alert('Vui lòng nhập lý do từ chối');
      return;
    }

    setActionLoading(kycId);
    try {
      const response = await fetchWithAuth(`/api/admin/kyc/${kycId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: false, rejectReason: rejectionReason }),
      });
      const data = await response.json();

      if (data.success) {
        setApplications(applications.map(a => a.id === kycId ? { ...a, status: 'REJECTED', rejectionReason, reviewedAt: new Date().toISOString() } : a));
        setSelectedKYC(null);
        setRejectionReason("");
      } else {
        alert(data.error?.message || 'Lỗi từ chối KYC');
      }
    } catch {
      alert('Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || isAdmin === null) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center">
          <Loader2 size={40} className="animate-spin text-yellow-500" />
        </div>
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center p-8">
          <div className="text-center">
            <AlertTriangle size={64} className="mx-auto text-red-500 mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Truy Cập Bị Từ Chối</h1>
            <p className="text-gray-400 mb-6">Bạn không có quyền truy cập trang này.</p>
            <button onClick={() => router.push('/')} className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium px-6 py-2 rounded transition-colors">
              Về Trang Chủ
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-[#0b0e11] p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link href="/admin" className="text-gray-400 hover:text-white">
                <ChevronLeft size={24} />
              </Link>
              <FileCheck size={28} className="text-green-500" />
              <h1 className="text-2xl font-bold text-white">Quản lý KYC</h1>
            </div>
            <button
              onClick={fetchApplications}
              disabled={isLoading}
              className="bg-[#181a20] hover:bg-[#1e2026] text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
              Làm mới
            </button>
          </div>

          {/* Filters */}
          <div className="bg-[#181a20] rounded-lg p-4 mb-6">
            <div className="flex flex-wrap gap-2">
              {['PENDING', 'APPROVED', 'REJECTED'].map((status) => (
                <button
                  key={status}
                  onClick={() => { setStatusFilter(status); setPage(1); }}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    statusFilter === status 
                      ? 'bg-yellow-500 text-black' 
                      : 'bg-[#0b0e11] text-gray-400 hover:text-white'
                  }`}
                >
                  {status === 'PENDING' ? 'Chờ duyệt' : status === 'APPROVED' ? 'Đã duyệt' : 'Đã từ chối'}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* KYC Table */}
          <div className="bg-[#181a20] rounded-lg overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={40} className="animate-spin text-yellow-500" />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-[#0b0e11]">
                      <tr>
                        <th className="px-4 py-3 text-gray-400 font-medium">User</th>
                        <th className="px-4 py-3 text-gray-400 font-medium">Họ tên KYC</th>
                        <th className="px-4 py-3 text-gray-400 font-medium">ID</th>
                        <th className="px-4 py-3 text-gray-400 font-medium">Quốc tịch</th>
                        <th className="px-4 py-3 text-gray-400 font-medium">Ngày nộp</th>
                        <th className="px-4 py-3 text-gray-400 font-medium">Trạng thái</th>
                        <th className="px-4 py-3 text-gray-400 font-medium">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications.map((app) => (
                        <tr key={app.id} className="border-t border-[#2b3139] hover:bg-[#1e2026]">
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-white font-medium">{app.user.name}</p>
                              <p className="text-gray-400 text-sm">{app.user.email}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-white">{app.fullName}</td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-white text-sm">{app.idType}</p>
                              <p className="text-gray-400 text-xs">{app.idNumber}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-white">{app.nationality}</td>
                          <td className="px-4 py-3 text-gray-400 text-sm">
                            {new Date(app.submittedAt).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded ${
                              app.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                              app.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {app.status === 'PENDING' ? 'Chờ duyệt' : app.status === 'APPROVED' ? 'Đã duyệt' : 'Đã từ chối'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setSelectedKYC(app)}
                                className="p-2 rounded-lg hover:bg-blue-500/20 text-blue-400 transition-colors"
                                title="Xem chi tiết"
                              >
                                <Eye size={18} />
                              </button>
                              {app.status === 'PENDING' && (
                                <>
                                  <button
                                    onClick={() => handleApprove(app.id)}
                                    disabled={actionLoading === app.id}
                                    className="p-2 rounded-lg hover:bg-green-500/20 text-green-400 transition-colors"
                                    title="Duyệt"
                                  >
                                    <Check size={18} />
                                  </button>
                                  <button
                                    onClick={() => setSelectedKYC(app)}
                                    disabled={actionLoading === app.id}
                                    className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                                    title="Từ chối"
                                  >
                                    <X size={18} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 p-4 border-t border-[#2b3139]">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-lg hover:bg-[#1e2026] text-gray-400 disabled:opacity-50"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className="text-gray-400">
                      Trang {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-2 rounded-lg hover:bg-[#1e2026] text-gray-400 disabled:opacity-50"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                )}

                {applications.length === 0 && !isLoading && (
                  <p className="text-gray-400 text-center py-8">Không có đơn KYC nào</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* KYC Detail Modal */}
      {selectedKYC && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#181a20] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#2b3139] flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Chi tiết KYC</h2>
              <button onClick={() => { setSelectedKYC(null); setRejectionReason(""); }} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* User Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Email</p>
                  <p className="text-white">{selectedKYC.user.email}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Họ tên KYC</p>
                  <p className="text-white">{selectedKYC.fullName}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Ngày sinh</p>
                  <p className="text-white">{new Date(selectedKYC.dateOfBirth).toLocaleDateString('vi-VN')}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Quốc tịch</p>
                  <p className="text-white">{selectedKYC.nationality}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-400 text-sm">Địa chỉ</p>
                  <p className="text-white">{selectedKYC.address}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Loại giấy tờ</p>
                  <p className="text-white">{selectedKYC.idType}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Số giấy tờ</p>
                  <p className="text-white">{selectedKYC.idNumber}</p>
                </div>
              </div>

              {/* Images */}
              <div>
                <p className="text-gray-400 text-sm mb-2">Ảnh giấy tờ</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {selectedKYC.idFrontImage && (
                    <a href={`http://localhost:3001${selectedKYC.idFrontImage}`} target="_blank" rel="noreferrer" className="block">
                      <div className="bg-[#0b0e11] rounded-lg p-2 text-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`http://localhost:3001${selectedKYC.idFrontImage}`} alt="ID Front" className="w-full h-24 object-cover rounded mb-1" />
                        <p className="text-xs text-gray-400">Mặt trước</p>
                      </div>
                    </a>
                  )}
                  {selectedKYC.idBackImage && (
                    <a href={`http://localhost:3001${selectedKYC.idBackImage}`} target="_blank" rel="noreferrer" className="block">
                      <div className="bg-[#0b0e11] rounded-lg p-2 text-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`http://localhost:3001${selectedKYC.idBackImage}`} alt="ID Back" className="w-full h-24 object-cover rounded mb-1" />
                        <p className="text-xs text-gray-400">Mặt sau</p>
                      </div>
                    </a>
                  )}
                  {selectedKYC.selfieImage && (
                    <a href={`http://localhost:3001${selectedKYC.selfieImage}`} target="_blank" rel="noreferrer" className="block">
                      <div className="bg-[#0b0e11] rounded-lg p-2 text-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`http://localhost:3001${selectedKYC.selfieImage}`} alt="Selfie" className="w-full h-24 object-cover rounded mb-1" />
                        <p className="text-xs text-gray-400">Ảnh selfie</p>
                      </div>
                    </a>
                  )}
                  {selectedKYC.proofOfAddress && (
                    <a href={`http://localhost:3001${selectedKYC.proofOfAddress}`} target="_blank" rel="noreferrer" className="block">
                      <div className="bg-[#0b0e11] rounded-lg p-2 text-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`http://localhost:3001${selectedKYC.proofOfAddress}`} alt="Proof of Address" className="w-full h-24 object-cover rounded mb-1" />
                        <p className="text-xs text-gray-400">Xác nhận địa chỉ</p>
                      </div>
                    </a>
                  )}
                </div>
              </div>

              {/* Rejection reason for rejected */}
              {selectedKYC.status === 'REJECTED' && selectedKYC.rejectionReason && (
                <div className="bg-red-500/10 border border-red-500 rounded-lg p-4">
                  <p className="text-red-400 text-sm font-medium mb-1">Lý do từ chối:</p>
                  <p className="text-white">{selectedKYC.rejectionReason}</p>
                </div>
              )}

              {/* Actions for pending */}
              {selectedKYC.status === 'PENDING' && (
                <div className="border-t border-[#2b3139] pt-4 space-y-4">
                  <div>
                    <label className="text-gray-400 text-sm block mb-2">Lý do từ chối (nếu từ chối)</label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Nhập lý do từ chối..."
                      className="w-full bg-[#0b0e11] text-white px-4 py-2 rounded-lg border border-[#2b3139] focus:border-yellow-500 outline-none resize-none"
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApprove(selectedKYC.id)}
                      disabled={actionLoading === selectedKYC.id}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      {actionLoading === selectedKYC.id ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                      Duyệt KYC
                    </button>
                    <button
                      onClick={() => handleReject(selectedKYC.id)}
                      disabled={actionLoading === selectedKYC.id || !rejectionReason.trim()}
                      className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      {actionLoading === selectedKYC.id ? <Loader2 size={18} className="animate-spin" /> : <X size={18} />}
                      Từ chối
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
