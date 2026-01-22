"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertTriangle, Settings, RefreshCw, Save, ChevronLeft } from "lucide-react";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/services/apiHelper";
import Link from "next/link";

interface SystemSettings {
  [key: string]: string;
}

const DEFAULT_SETTINGS = [
  { key: 'maintenanceMode', label: 'Chế độ bảo trì', type: 'boolean', description: 'Bật/tắt chế độ bảo trì website' },
  { key: 'minWithdrawalBTC', label: 'Rút tối thiểu BTC', type: 'number', description: 'Số BTC tối thiểu được rút' },
  { key: 'minWithdrawalETH', label: 'Rút tối thiểu ETH', type: 'number', description: 'Số ETH tối thiểu được rút' },
  { key: 'minWithdrawalUSDT', label: 'Rút tối thiểu USDT', type: 'number', description: 'Số USDT tối thiểu được rút' },
  { key: 'tradingFeePercent', label: 'Phí giao dịch (%)', type: 'number', description: 'Phần trăm phí giao dịch' },
  { key: 'withdrawalFeePercent', label: 'Phí rút tiền (%)', type: 'number', description: 'Phần trăm phí rút tiền' },
  { key: 'maxWithdrawalDaily', label: 'Giới hạn rút/ngày (USD)', type: 'number', description: 'Giới hạn rút tiền mỗi ngày theo USD' },
  { key: 'kycRequiredForWithdrawal', label: 'Yêu cầu KYC để rút tiền', type: 'boolean', description: 'Bắt buộc KYC mới được rút tiền' },
  { key: 'referralBonusPercent', label: 'Thưởng giới thiệu (%)', type: 'number', description: 'Phần trăm thưởng cho người giới thiệu' },
  { key: 'supportEmail', label: 'Email hỗ trợ', type: 'string', description: 'Email liên hệ hỗ trợ' },
  { key: 'supportPhone', label: 'Số điện thoại hỗ trợ', type: 'string', description: 'Số điện thoại liên hệ' },
  { key: 'announcement', label: 'Thông báo hệ thống', type: 'text', description: 'Thông báo hiển thị trên website' },
];

export default function AdminSettingsPage() {
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<SystemSettings>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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
        fetchSettings();
      }
    }
  }, [isAuthenticated, authLoading, user, router]);

  const fetchSettings = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetchWithAuth('/api/admin/settings');
      const data = await response.json();
      
      if (data.success) {
        const settingsMap: SystemSettings = {};
        // Backend returns object directly { key: value }
        if (data.data && typeof data.data === 'object') {
          Object.entries(data.data).forEach(([key, value]) => {
            settingsMap[key] = String(value);
          });
        }
        // Set defaults for missing keys
        DEFAULT_SETTINGS.forEach(ds => {
          if (!settingsMap[ds.key]) {
            settingsMap[ds.key] = ds.type === 'boolean' ? 'false' : '';
          }
        });
        setSettings(settingsMap);
      } else {
        setError(data.error?.message || "Không thể tải cài đặt");
      }
    } catch (err) {
      console.error('Fetch settings error:', err);
      setError("Không thể kết nối đến server");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError("");
    setSuccess("");
    
    try {
      const response = await fetchWithAuth('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      const data = await response.json();

      if (data.success) {
        setSuccess("Đã lưu cài đặt thành công!");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error?.message || 'Lỗi lưu cài đặt');
      }
    } catch {
      setError('Lỗi kết nối');
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
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
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link href="/admin" className="text-gray-400 hover:text-white">
                <ChevronLeft size={24} />
              </Link>
              <Settings size={28} className="text-purple-500" />
              <h1 className="text-2xl font-bold text-white">Cài đặt hệ thống</h1>
            </div>
            <div className="flex gap-3">
              <button
                onClick={fetchSettings}
                disabled={isLoading}
                className="bg-[#181a20] hover:bg-[#1e2026] text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                Làm mới
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Lưu
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded-lg mb-6">
              {success}
            </div>
          )}

          {/* Settings Form */}
          <div className="bg-[#181a20] rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={40} className="animate-spin text-yellow-500" />
              </div>
            ) : (
              <div className="divide-y divide-[#2b3139]">
                {DEFAULT_SETTINGS.map((setting) => (
                  <div key={setting.key} className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1">
                      <label className="text-white font-medium">{setting.label}</label>
                      <p className="text-gray-400 text-sm mt-1">{setting.description}</p>
                    </div>
                    <div className="md:w-64">
                      {setting.type === 'boolean' ? (
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings[setting.key] === 'true'}
                            onChange={(e) => updateSetting(setting.key, e.target.checked ? 'true' : 'false')}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                        </label>
                      ) : setting.type === 'text' ? (
                        <textarea
                          value={settings[setting.key] || ''}
                          onChange={(e) => updateSetting(setting.key, e.target.value)}
                          className="w-full bg-[#0b0e11] text-white px-3 py-2 rounded-lg border border-[#2b3139] focus:border-yellow-500 outline-none resize-none"
                          rows={3}
                        />
                      ) : setting.type === 'number' ? (
                        <input
                          type="number"
                          step="0.0001"
                          value={settings[setting.key] || ''}
                          onChange={(e) => updateSetting(setting.key, e.target.value)}
                          className="w-full bg-[#0b0e11] text-white px-3 py-2 rounded-lg border border-[#2b3139] focus:border-yellow-500 outline-none"
                        />
                      ) : (
                        <input
                          type="text"
                          value={settings[setting.key] || ''}
                          onChange={(e) => updateSetting(setting.key, e.target.value)}
                          className="w-full bg-[#0b0e11] text-white px-3 py-2 rounded-lg border border-[#2b3139] focus:border-yellow-500 outline-none"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
