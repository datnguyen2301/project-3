"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, AlertTriangle, Users, RefreshCw, Search, Ban, UserCheck, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/services/apiHelper";
import Link from "next/link";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  isVerified: boolean;
  kycStatus: string;
  createdAt: string;
  _count: {
    orders: number;
    walletBalances: number;
  };
}

export default function AdminUsersPage() {
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      });
      
      const response = await fetchWithAuth(`/api/admin/users?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setUsers(data.data?.users || []);
        setTotalPages(data.data?.pagination?.totalPages || 1);
      } else {
        setError(data.error?.message || "Không thể tải danh sách users");
      }
    } catch {
      console.error('Fetch users error');
      setError("Không thể kết nối đến server");
    } finally {
      setIsLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/');
        return;
      }
      const adminCheck = user?.email?.includes('admin') || (user as { role?: string })?.role === 'ADMIN';
      setIsAdmin(adminCheck);
      if (adminCheck) {
        fetchUsers();
      }
    }
  }, [isAuthenticated, authLoading, user, router, fetchUsers]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [page, statusFilter, isAdmin, fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleBlockUser = async (userId: string, blocked: boolean) => {
    if (!confirm(blocked ? 'Bạn có chắc muốn khóa user này?' : 'Bạn có chắc muốn mở khóa user này?')) {
      return;
    }

    setActionLoading(userId);
    try {
      const response = await fetchWithAuth(`/api/admin/users/${userId}/block`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked, reason: blocked ? 'Admin blocked' : 'Admin unblocked' }),
      });
      const data = await response.json();

      if (data.success) {
        setUsers(users.map(u => u.id === userId ? { ...u, isActive: !blocked } : u));
      } else {
        alert(data.error?.message || 'Lỗi thao tác');
      }
    } catch {
      alert('Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Bạn có chắc muốn xóa user này? Thao tác này không thể hoàn tác!')) {
      return;
    }

    setActionLoading(userId);
    try {
      const response = await fetchWithAuth(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        setUsers(users.filter(u => u.id !== userId));
      } else {
        alert(data.error?.message || 'Lỗi xóa user');
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
              <Users size={28} className="text-blue-500" />
              <h1 className="text-2xl font-bold text-white">Quản lý Users</h1>
            </div>
            <button
              onClick={fetchUsers}
              disabled={isLoading}
              className="bg-[#181a20] hover:bg-[#1e2026] text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
              Làm mới
            </button>
          </div>

          {/* Filters */}
          <div className="bg-[#181a20] rounded-lg p-4 mb-6">
            <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Tìm theo email hoặc tên..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-[#0b0e11] text-white pl-10 pr-4 py-2 rounded-lg border border-[#2b3139] focus:border-yellow-500 outline-none"
                  />
                </div>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#0b0e11] text-white px-4 py-2 rounded-lg border border-[#2b3139] focus:border-yellow-500 outline-none"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="active">Đang hoạt động</option>
                <option value="blocked">Bị khóa</option>
              </select>
              <button type="submit" className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium px-6 py-2 rounded-lg transition-colors">
                Tìm kiếm
              </button>
            </form>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Users Table */}
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
                        <th className="px-4 py-3 text-gray-400 font-medium">Role</th>
                        <th className="px-4 py-3 text-gray-400 font-medium">Trạng thái</th>
                        <th className="px-4 py-3 text-gray-400 font-medium">KYC</th>
                        <th className="px-4 py-3 text-gray-400 font-medium">Orders</th>
                        <th className="px-4 py-3 text-gray-400 font-medium">Ngày tạo</th>
                        <th className="px-4 py-3 text-gray-400 font-medium">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-t border-[#2b3139] hover:bg-[#1e2026]">
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-white font-medium">{u.name}</p>
                              <p className="text-gray-400 text-sm">{u.email}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded ${
                              u.role === 'ADMIN' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-500/20 text-gray-400'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded ${
                              u.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {u.isActive ? 'Hoạt động' : 'Bị khóa'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded ${
                              u.kycStatus === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                              u.kycStatus === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                              u.kycStatus === 'REJECTED' ? 'bg-red-500/20 text-red-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {u.kycStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-white">{u._count.orders}</td>
                          <td className="px-4 py-3 text-gray-400 text-sm">
                            {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleBlockUser(u.id, !u.isActive)}
                                disabled={actionLoading === u.id}
                                className={`p-2 rounded-lg transition-colors ${
                                  u.isActive 
                                    ? 'hover:bg-red-500/20 text-red-400' 
                                    : 'hover:bg-green-500/20 text-green-400'
                                }`}
                                title={u.isActive ? 'Khóa' : 'Mở khóa'}
                              >
                                {u.isActive ? <Ban size={18} /> : <UserCheck size={18} />}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                disabled={actionLoading === u.id}
                                className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                                title="Xóa"
                              >
                                <Trash2 size={18} />
                              </button>
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

                {users.length === 0 && !isLoading && (
                  <p className="text-gray-400 text-center py-8">Không có user nào</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
