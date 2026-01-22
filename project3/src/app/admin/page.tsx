"use client";

import { useState, useEffect } from "react";
import { Loader2, Shield, AlertTriangle, Users, RefreshCw, FileCheck, DollarSign, Settings, Clock, TrendingUp, Activity } from "lucide-react";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/services/apiHelper";
import Link from "next/link";

interface DashboardStats {
  users: {
    total: number;
    active: number;
    blocked: number;
    newLast7Days: number;
  };
  kyc: {
    pending: number;
    approved: number;
  };
  transactions: {
    pendingWithdrawals: number;
    pendingDeposits: number;
    pendingBankAccounts: number;
  };
  trading: {
    totalOrders: number;
    filledOrders: number;
    ordersLast7Days: number;
    volumeLast7Days: number;
  };
}

export default function AdminPage() {
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/');
        return;
      }
      const adminCheck = user?.email?.includes('admin') || (user as { role?: string })?.role === 'ADMIN';
      setIsAdmin(adminCheck);
      if (adminCheck) {
        fetchDashboardStats();
      }
    }
  }, [isAuthenticated, authLoading, user, router]);

  const fetchDashboardStats = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetchWithAuth('/api/admin/dashboard');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
      } else {
        setError(data.error?.message || "Không thể tải dữ liệu dashboard");
      }
    } catch (err) {
      console.error('Fetch dashboard error:', err);
      setError("Không thể kết nối đến server");
    } finally {
      setIsLoading(false);
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
            <button
              onClick={() => router.push('/')}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium px-6 py-2 rounded transition-colors"
            >
              Về Trang Chủ
            </button>
          </div>
        </div>
      </>
    );
  }

  const StatCard = ({ title, value, icon: Icon, color, link, subValue }: {
    title: string;
    value: number;
    icon: React.ElementType;
    color: string;
    link?: string;
    subValue?: string;
  }) => {
    const content = (
      <div className={`bg-[#181a20] rounded-xl p-5 border-l-4 ${color} hover:bg-[#1e2026] transition-colors cursor-pointer`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">{title}</p>
            <p className="text-2xl font-bold text-white mt-1">{value.toLocaleString()}</p>
            {subValue && <p className="text-gray-500 text-xs mt-1">{subValue}</p>}
          </div>
          <Icon className="text-gray-600" size={32} />
        </div>
      </div>
    );

    if (link) {
      return <Link href={link}>{content}</Link>;
    }
    return content;
  };

  const QuickAction = ({ title, icon: Icon, color, link }: {
    title: string;
    icon: React.ElementType;
    color: string;
    link: string;
  }) => (
    <Link href={link} className={`${color} hover:opacity-90 text-white p-4 rounded-xl text-center transition-all flex flex-col items-center gap-2`}>
      <Icon size={28} />
      <span className="font-medium text-sm">{title}</span>
    </Link>
  );

  return (
    <>
      <Header />
      <div className="min-h-screen bg-[#0b0e11] p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Shield size={32} className="text-yellow-500" />
              <div>
                <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
                <p className="text-gray-400 text-sm">Quản lý hệ thống Crypto Exchange</p>
              </div>
            </div>
            <button
              onClick={fetchDashboardStats}
              disabled={isLoading}
              className="bg-[#181a20] hover:bg-[#1e2026] text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
              Làm mới
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
            <QuickAction title="Quản lý Users" icon={Users} color="bg-blue-600" link="/admin/users" />
            <QuickAction title="Duyệt KYC" icon={FileCheck} color="bg-green-600" link="/admin/kyc" />
            <QuickAction title="Rút tiền" icon={DollarSign} color="bg-yellow-600" link="/admin/withdrawals" />
            <QuickAction title="System Logs" icon={Activity} color="bg-purple-600" link="/admin/logs" />
            <QuickAction title="Cài đặt" icon={Settings} color="bg-gray-600" link="/admin/settings" />
          </div>

          {isLoading && !stats ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={40} className="animate-spin text-yellow-500" />
            </div>
          ) : stats && (
            <>
              {/* Users Section */}
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Users size={20} className="text-blue-500" />
                Người dùng
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard title="Tổng users" value={stats.users.total} icon={Users} color="border-blue-500" link="/admin/users" />
                <StatCard title="Đang hoạt động" value={stats.users.active} icon={Users} color="border-green-500" />
                <StatCard title="Bị khóa" value={stats.users.blocked} icon={Users} color="border-red-500" />
                <StatCard title="Mới (7 ngày)" value={stats.users.newLast7Days} icon={Users} color="border-cyan-500" />
              </div>

              {/* Pending Actions */}
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Clock size={20} className="text-yellow-500" />
                Chờ xử lý
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard title="KYC chờ duyệt" value={stats.kyc.pending} icon={FileCheck} color="border-yellow-500" link="/admin/kyc" />
                <StatCard title="Rút tiền" value={stats.transactions.pendingWithdrawals} icon={DollarSign} color="border-orange-500" link="/admin/withdrawals" />
                <StatCard title="Nạp tiền" value={stats.transactions.pendingDeposits} icon={DollarSign} color="border-pink-500" link="/admin/deposits" />
                <StatCard title="Bank accounts" value={stats.transactions.pendingBankAccounts} icon={DollarSign} color="border-indigo-500" link="/admin/bank-accounts" />
              </div>

              {/* Trading Stats */}
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp size={20} className="text-green-500" />
                Giao dịch
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard title="Tổng lệnh" value={stats.trading.totalOrders} icon={TrendingUp} color="border-blue-500" />
                <StatCard title="Đã khớp" value={stats.trading.filledOrders} icon={TrendingUp} color="border-green-500" />
                <StatCard title="Lệnh (7 ngày)" value={stats.trading.ordersLast7Days} icon={TrendingUp} color="border-cyan-500" />
                <StatCard title="Volume (7 ngày)" value={Math.round(stats.trading.volumeLast7Days)} icon={TrendingUp} color="border-yellow-500" subValue="USDT" />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
