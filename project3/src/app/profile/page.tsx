"use client";

import { useState, useEffect } from "react";
import { User, Shield, Key, FileText, Clock, ChevronRight, Loader2, Mail, CheckCircle } from "lucide-react";
import Header from "@/components/Header";
import { getUser, isAuthenticated } from "@/services/authApi";
import { resendVerificationEmail, getUserProfile } from "@/services/userApi";
import ChangePassword from "@/components/ChangePassword";
import TwoFactorAuth from "@/components/TwoFactorAuth";
import KYCVerification from "@/components/KYCVerification";
import SecurityLogs from "@/components/SecurityLogs";
import type { User as UserType } from "@/services/authApi";

type TabType = "profile" | "password" | "2fa" | "kyc" | "security";

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<TabType>("profile");
  const [user, setUser] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    const loadUserProfile = async () => {
      if (isAuthenticated()) {
        // Lấy user từ localStorage trước
        const localUser = getUser();
        setUser(localUser);
        
        // Sau đó gọi API để lấy dữ liệu mới nhất
        try {
          const profile = await getUserProfile();
          console.log('[Profile] API response:', profile);
          // Merge profile mới với user hiện tại
          setUser(prev => prev ? { 
            ...prev, 
            ...profile, 
            twoFactorEnabled: profile.twoFactorEnabled,
            isEmailVerified: profile.isEmailVerified ?? prev.isEmailVerified,
            kycStatus: (profile.kycStatus as UserType['kycStatus']) ?? prev.kycStatus
          } : null);
        } catch (err) {
          // Nếu lỗi, giữ nguyên user từ localStorage
          console.log('[Profile] Could not fetch profile:', err);
        }
      }
      setIsLoading(false);
    };
    
    loadUserProfile();
  }, [activeTab]); // Re-fetch khi chuyển tab

  const handleSendVerificationEmail = async () => {
    setEmailSending(true);
    setEmailError("");
    setEmailSent(false);

    try {
      const result = await resendVerificationEmail();
      if (result.success) {
        setEmailSent(true);
        setTimeout(() => setEmailSent(false), 5000);
      } else {
        const errorMsg = result.error?.message || "";
        // Nếu backend trả về "already verified" -> cập nhật state
        if (errorMsg.toLowerCase().includes("already verified") || errorMsg.toLowerCase().includes("đã xác thực")) {
          setUser(prev => prev ? { ...prev, isEmailVerified: true } : null);
        } else {
          setEmailError(errorMsg || "Không thể gửi email xác thực");
        }
      }
    } catch {
      setEmailError("Đã xảy ra lỗi khi gửi email");
    } finally {
      setEmailSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center">
        <Loader2 className="animate-spin text-yellow-500" size={48} />
      </div>
    );
  }

  if (!isAuthenticated() || !user) {
    return (
      <div className="min-h-screen bg-[#0b0e11]">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <User size={64} className="mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400 text-lg">Vui lòng đăng nhập để xem profile</p>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "profile" as TabType, label: "Thông Tin Cá Nhân", icon: User },
    { id: "password" as TabType, label: "Đổi Mật Khẩu", icon: Key },
    { id: "2fa" as TabType, label: "Xác Thực 2 Bước", icon: Shield },
    { id: "kyc" as TabType, label: "Xác Minh Danh Tính", icon: FileText },
    { id: "security" as TabType, label: "Lịch Sử Bảo Mật", icon: Clock },
  ];

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Tài Khoản Của Tôi</h1>
        
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-64 shrink-0">
            <div className="bg-[#181a20] rounded-lg p-4 sticky top-4">
              <div className="mb-6 pb-6 border-b border-[#2b3139]">
                <div className="w-16 h-16 rounded-full bg-linear-to-r from-yellow-500 to-orange-500 flex items-center justify-center text-2xl font-bold mb-3">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <h3 className="font-semibold text-lg">{user?.name || "User"}</h3>
                <p className="text-sm text-gray-400">{user.email}</p>
              </div>
              
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        activeTab === tab.id
                          ? "bg-yellow-500/10 text-yellow-500"
                          : "text-gray-400 hover:bg-[#2b3139] hover:text-white"
                      }`}
                    >
                      <Icon size={20} />
                      <span className="flex-1 text-left text-sm">{tab.label}</span>
                      <ChevronRight size={16} />
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
          
          {/* Main Content */}
          <div className="flex-1">
            <div className="bg-[#181a20] rounded-lg p-6">
              {activeTab === "profile" && (
                <div>
                  <h2 className="text-2xl font-semibold mb-6">Thông Tin Cá Nhân</h2>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Họ và Tên</label>
                      <input
                        type="text"
                        value={user.name}
                        disabled
                        className="w-full bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139] focus:outline-none focus:border-yellow-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Email</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="email"
                          value={user.email}
                          disabled
                          className="flex-1 bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139]"
                        />
                        {user.isEmailVerified ? (
                          <span className="text-green-500 text-sm flex items-center gap-1">
                            <CheckCircle size={16} />
                            Đã xác thực
                          </span>
                        ) : emailSent ? (
                          <span className="text-green-500 text-sm flex items-center gap-1">
                            <Mail size={16} />
                            Đã gửi email!
                          </span>
                        ) : (
                          <button 
                            onClick={handleSendVerificationEmail}
                            disabled={emailSending}
                            className="bg-yellow-500 hover:bg-yellow-600 text-black text-sm px-4 py-2 rounded font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                          >
                            {emailSending ? (
                              <>
                                <Loader2 size={14} className="animate-spin" />
                                Đang gửi...
                              </>
                            ) : (
                              <>
                                <Mail size={14} />
                                Xác thực ngay
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      {emailError && (
                        <p className="text-red-500 text-sm mt-2">{emailError}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">ID Người Dùng</label>
                      <input
                        type="text"
                        value={user.id}
                        disabled
                        className="w-full bg-[#2b3139] text-gray-500 px-4 py-3 rounded border border-[#2b3139] font-mono text-sm"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Xác Thực 2 Bước</label>
                        <div className={`px-4 py-3 rounded border ${
                          user.twoFactorEnabled
                            ? "bg-green-500/10 border-green-500 text-green-500"
                            : "bg-red-500/10 border-red-500 text-red-500"
                        }`}>
                          {user.twoFactorEnabled ? "Đã bật" : "Chưa bật"}
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Trạng Thái KYC</label>
                        <div className={`px-4 py-3 rounded border ${
                          user.kycStatus === 'APPROVED'
                            ? "bg-green-500/10 border-green-500 text-green-500"
                            : user.kycStatus === 'PENDING'
                            ? "bg-yellow-500/10 border-yellow-500 text-yellow-500"
                            : user.kycStatus === 'REJECTED'
                            ? "bg-red-500/10 border-red-500 text-red-500"
                            : "bg-gray-500/10 border-gray-500 text-gray-400"
                        }`}>
                          {user.kycStatus === 'APPROVED'
                            ? "Đã xác minh"
                            : user.kycStatus === 'PENDING'
                            ? "Đang chờ duyệt"
                            : user.kycStatus === 'REJECTED'
                            ? "Bị từ chối"
                            : "Chưa xác minh"}
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-4">
                      <button className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium px-6 py-3 rounded transition-colors">
                        Cập Nhật Thông Tin
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === "password" && <ChangePassword />}
              {activeTab === "2fa" && <TwoFactorAuth />}
              {activeTab === "kyc" && <KYCVerification />}
              {activeTab === "security" && <SecurityLogs />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
