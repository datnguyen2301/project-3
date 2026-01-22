"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, AlertTriangle, FileText, RefreshCw, ChevronLeft, ChevronRight, Shield, User, Key, AlertCircle } from "lucide-react";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/services/apiHelper";
import Link from "next/link";

interface SecurityLog {
  id: string;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  details: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

const ACTION_ICONS: { [key: string]: { icon: React.ReactNode; color: string } } = {
  'LOGIN': { icon: <Key size={16} />, color: 'text-green-400' },
  'LOGOUT': { icon: <Key size={16} />, color: 'text-gray-400' },
  'LOGIN_FAILED': { icon: <AlertCircle size={16} />, color: 'text-red-400' },
  'PASSWORD_CHANGE': { icon: <Shield size={16} />, color: 'text-yellow-400' },
  'PASSWORD_RESET': { icon: <Shield size={16} />, color: 'text-yellow-400' },
  'TWO_FA_ENABLED': { icon: <Shield size={16} />, color: 'text-blue-400' },
  'TWO_FA_DISABLED': { icon: <Shield size={16} />, color: 'text-orange-400' },
  'EMAIL_VERIFIED': { icon: <User size={16} />, color: 'text-green-400' },
  'KYC_SUBMITTED': { icon: <FileText size={16} />, color: 'text-blue-400' },
  'KYC_APPROVED': { icon: <FileText size={16} />, color: 'text-green-400' },
  'KYC_REJECTED': { icon: <FileText size={16} />, color: 'text-red-400' },
  'WITHDRAWAL_REQUEST': { icon: <AlertCircle size={16} />, color: 'text-yellow-400' },
};

const ACTION_LABELS: { [key: string]: string } = {
  'LOGIN': 'Đăng nhập',
  'LOGOUT': 'Đăng xuất',
  'LOGIN_FAILED': 'Đăng nhập thất bại',
  'PASSWORD_CHANGE': 'Đổi mật khẩu',
  'PASSWORD_RESET': 'Reset mật khẩu',
  'TWO_FA_ENABLED': 'Bật 2FA',
  'TWO_FA_DISABLED': 'Tắt 2FA',
  'EMAIL_VERIFIED': 'Xác thực email',
  'KYC_SUBMITTED': 'Nộp KYC',
  'KYC_APPROVED': 'KYC được duyệt',
  'KYC_REJECTED': 'KYC bị từ chối',
  'WITHDRAWAL_REQUEST': 'Yêu cầu rút tiền',
};

export default function AdminLogsPage() {
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...(actionFilter && { action: actionFilter }),
      });
      
      const response = await fetchWithAuth(`/api/admin/logs?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setLogs(data.data?.logs || []);
        setTotalPages(data.data?.pagination?.totalPages || 1);
      } else {
        setError(data.error?.message || "Không thể tải logs");
      }
    } catch {
      console.error('Fetch logs error');
      setError("Không thể kết nối đến server");
    } finally {
      setIsLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/');
        return;
      }
      const adminCheck = user?.email?.includes('admin') || (user as { role?: string })?.role === 'ADMIN';
      setIsAdmin(adminCheck);
      if (adminCheck) {
        fetchLogs();
      }
    }
  }, [isAuthenticated, authLoading, user, router, fetchLogs]);

  useEffect(() => {
    if (isAdmin) {
      fetchLogs();
    }
  }, [page, actionFilter, isAdmin, fetchLogs]);

  const getActionDisplay = (action: string) => {
    const config = ACTION_ICONS[action] || { icon: <FileText size={16} />, color: 'text-gray-400' };
    const label = ACTION_LABELS[action] || action;
    return { ...config, label };
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
              <FileText size={28} className="text-orange-500" />
              <h1 className="text-2xl font-bold text-white">Logs hệ thống</h1>
            </div>
            <button
              onClick={fetchLogs}
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
              <button
                onClick={() => { setActionFilter(""); setPage(1); }}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  actionFilter === '' 
                    ? 'bg-yellow-500 text-black' 
                    : 'bg-[#0b0e11] text-gray-400 hover:text-white'
                }`}
              >
                Tất cả
              </button>
              {Object.keys(ACTION_LABELS).map((action) => (
                <button
                  key={action}
                  onClick={() => { setActionFilter(action); setPage(1); }}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    actionFilter === action 
                      ? 'bg-yellow-500 text-black' 
                      : 'bg-[#0b0e11] text-gray-400 hover:text-white'
                  }`}
                >
                  {ACTION_LABELS[action]}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Logs Table */}
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
                        <th className="px-4 py-3 text-gray-400 font-medium">Thời gian</th>
                        <th className="px-4 py-3 text-gray-400 font-medium">User</th>
                        <th className="px-4 py-3 text-gray-400 font-medium">Hành động</th>
                        <th className="px-4 py-3 text-gray-400 font-medium">IP Address</th>
                        <th className="px-4 py-3 text-gray-400 font-medium">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => {
                        const display = getActionDisplay(log.action);
                        return (
                          <tr key={log.id} className="border-t border-[#2b3139] hover:bg-[#1e2026]">
                            <td className="px-4 py-3 text-gray-400 text-sm whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString('vi-VN')}
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-white text-sm">{log.user.name}</p>
                                <p className="text-gray-400 text-xs">{log.user.email}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className={`flex items-center gap-2 ${display.color}`}>
                                {display.icon}
                                <span className="text-sm">{display.label}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-sm">
                              {log.ipAddress || '-'}
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-sm max-w-[200px] truncate">
                              {log.details || '-'}
                            </td>
                          </tr>
                        );
                      })}
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

                {logs.length === 0 && !isLoading && (
                  <p className="text-gray-400 text-center py-8">Không có log nào</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
