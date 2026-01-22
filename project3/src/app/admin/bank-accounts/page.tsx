"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertTriangle, RefreshCw, Plus, Trash2, Edit2, Save, X } from "lucide-react";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/services/apiHelper";
import Link from "next/link";

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  branch?: string;
  isDefault: boolean;
  createdAt: string;
}

export default function AdminBankAccountsPage() {
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    bankName: "",
    accountNumber: "",
    accountName: "",
    branch: "",
  });

  const fetchBankAccounts = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetchWithAuth('/api/admin/bank-accounts');
      const data = await response.json();
      
      if (data.success) {
        setBankAccounts(data.data?.bankAccounts || data.data || []);
      } else {
        setError(data.error?.message || "Không thể tải danh sách tài khoản ngân hàng");
      }
    } catch {
      console.error('Fetch bank accounts error');
      setError("Không thể kết nối đến server");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/');
        return;
      }
      const adminCheck = user?.email?.includes('admin') || (user as { role?: string })?.role === 'ADMIN';
      setIsAdmin(adminCheck);
      if (adminCheck) {
        fetchBankAccounts();
      }
    }
  }, [isAuthenticated, authLoading, user, router]);

  const handleAdd = async () => {
    if (!formData.bankName || !formData.accountNumber || !formData.accountName) {
      alert("Vui lòng điền đầy đủ thông tin");
      return;
    }

    try {
      const response = await fetchWithAuth('/api/admin/bank-accounts', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      
      if (data.success) {
        fetchBankAccounts();
        setShowAddForm(false);
        setFormData({ bankName: "", accountNumber: "", accountName: "", branch: "" });
      } else {
        alert(data.error?.message || "Không thể thêm tài khoản");
      }
    } catch {
      alert("Không thể kết nối đến server");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa tài khoản này?")) return;

    try {
      const response = await fetchWithAuth(`/api/admin/bank-accounts/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      
      if (data.success) {
        setBankAccounts(bankAccounts.filter(b => b.id !== id));
      } else {
        alert(data.error?.message || "Không thể xóa tài khoản");
      }
    } catch {
      alert("Không thể kết nối đến server");
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

  return (
    <>
      <Header />
      <div className="min-h-screen bg-[#0b0e11] pt-20 px-4 pb-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Quản lý Tài khoản Ngân hàng</h1>
              <p className="text-gray-400 text-sm mt-1">Tài khoản ngân hàng để nhận tiền nạp từ người dùng</p>
            </div>
            <div className="flex gap-2">
              <Link href="/admin" className="px-4 py-2 bg-[#2b3139] text-gray-300 rounded hover:bg-[#363d47] transition-colors">
                ← Quay lại
              </Link>
              <button
                onClick={fetchBankAccounts}
                className="flex items-center gap-2 px-4 py-2 bg-[#2b3139] text-gray-300 rounded hover:bg-[#363d47] transition-colors"
              >
                <RefreshCw size={16} />
                Làm mới
              </button>
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-600 transition-colors font-medium"
              >
                <Plus size={16} />
                Thêm mới
              </button>
            </div>
          </div>

          {/* Add Form */}
          {showAddForm && (
            <div className="bg-[#1e2329] rounded-lg p-6 mb-6">
              <h3 className="text-lg font-bold text-white mb-4">Thêm tài khoản ngân hàng</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Tên ngân hàng</label>
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className="w-full bg-[#0b0e11] border border-[#2b3139] rounded px-3 py-2 text-white focus:outline-none focus:border-yellow-500"
                    placeholder="VD: Vietcombank"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Số tài khoản</label>
                  <input
                    type="text"
                    value={formData.accountNumber}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                    className="w-full bg-[#0b0e11] border border-[#2b3139] rounded px-3 py-2 text-white focus:outline-none focus:border-yellow-500"
                    placeholder="VD: 1234567890"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Tên chủ tài khoản</label>
                  <input
                    type="text"
                    value={formData.accountName}
                    onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                    className="w-full bg-[#0b0e11] border border-[#2b3139] rounded px-3 py-2 text-white focus:outline-none focus:border-yellow-500"
                    placeholder="VD: NGUYEN VAN A"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Chi nhánh (tùy chọn)</label>
                  <input
                    type="text"
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    className="w-full bg-[#0b0e11] border border-[#2b3139] rounded px-3 py-2 text-white focus:outline-none focus:border-yellow-500"
                    placeholder="VD: Hà Nội"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => { setShowAddForm(false); setFormData({ bankName: "", accountNumber: "", accountName: "", branch: "" }); }}
                  className="px-4 py-2 bg-[#2b3139] text-gray-300 rounded hover:bg-[#363d47]"
                >
                  Hủy
                </button>
                <button
                  onClick={handleAdd}
                  className="px-4 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-600 font-medium"
                >
                  Thêm
                </button>
              </div>
            </div>
          )}

          {/* Content */}
          {error ? (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-500">
              {error}
            </div>
          ) : isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
            </div>
          ) : bankAccounts.length === 0 ? (
            <div className="bg-[#1e2329] rounded-lg p-8 text-center">
              <p className="text-gray-400">Chưa có tài khoản ngân hàng nào</p>
              <p className="text-gray-500 text-sm mt-2">Nhấn &quot;Thêm mới&quot; để thêm tài khoản</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bankAccounts.map((account) => (
                <div key={account.id} className="bg-[#1e2329] rounded-lg p-4">
                  {editingId === account.id ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Edit form would go here */}
                      <div className="col-span-2 flex gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 bg-[#2b3139] text-gray-300 rounded hover:bg-[#363d47]"
                        >
                          <X size={16} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                        >
                          <Save size={16} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-white font-medium">{account.bankName}</h3>
                        <p className="text-gray-400 text-sm">STK: {account.accountNumber}</p>
                        <p className="text-gray-400 text-sm">Chủ TK: {account.accountName}</p>
                        {account.branch && <p className="text-gray-500 text-xs">Chi nhánh: {account.branch}</p>}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingId(account.id)}
                          className="p-2 bg-[#2b3139] text-gray-300 rounded hover:bg-[#363d47]"
                          title="Sửa"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(account.id)}
                          className="p-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                          title="Xóa"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
