"use client";

import { useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { 
  Settings, 
  Bell, 
  Shield, 
  Globe, 
  Moon, 
  Smartphone,
  Mail,
  Loader2,
  Check,
  Sun
} from "lucide-react";

type SettingSection = "notifications" | "security" | "appearance" | "language";

// ToggleSwitch component - defined outside of render
function ToggleSwitch({ enabled, onChange, disabled }: { enabled: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? "bg-yellow-500" : "bg-gray-600"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// Theme colors
const THEME_COLORS = [
  { name: "Yellow", value: "#eab308" },
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Red", value: "#ef4444" },
];

export default function SettingsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { settings, updateSetting, isLoading: settingsLoading } = useSettings();
  const [activeSection, setActiveSection] = useState<SettingSection>("notifications");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleToggle = async (key: keyof typeof settings) => {
    if (typeof settings[key] !== 'boolean') return;
    
    setSaving(true);
    await updateSetting(key, !settings[key] as never);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleThemeChange = async (theme: 'dark' | 'light') => {
    setSaving(true);
    await updateSetting('theme', theme);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleThemeColorChange = async (color: string) => {
    setSaving(true);
    await updateSetting('themeColor', color);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLanguageChange = async (lang: string) => {
    setSaving(true);
    await updateSetting('language', lang);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isLoading = authLoading || settingsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center">
        <Loader2 className="animate-spin text-yellow-500" size={48} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0b0e11]">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Settings size={64} className="mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400 text-lg">Vui lòng đăng nhập để xem cài đặt</p>
          </div>
        </div>
      </div>
    );
  }

  const sections = [
    { id: "notifications" as SettingSection, label: "Thông Báo", icon: Bell },
    { id: "security" as SettingSection, label: "Bảo Mật", icon: Shield },
    { id: "appearance" as SettingSection, label: "Giao Diện", icon: Moon },
    { id: "language" as SettingSection, label: "Ngôn Ngữ", icon: Globe },
  ];

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      <Header />
      
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Cài Đặt</h1>
            <p className="text-gray-400">Tùy chỉnh trải nghiệm của bạn</p>
          </div>
          
          {/* Save indicator */}
          {(saving || saved) && (
            <div className="flex items-center gap-2 text-sm">
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin text-yellow-500" />
                  <span className="text-gray-400">Đang lưu...</span>
                </>
              ) : (
                <>
                  <Check size={16} className="text-green-500" />
                  <span className="text-green-500">Đã lưu</span>
                </>
              )}
            </div>
          )}
        </div>
        
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-56 shrink-0">
            <nav className="space-y-1 bg-[#181a20] rounded-lg p-2">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      activeSection === section.id
                        ? "bg-yellow-500/10 text-yellow-500"
                        : "text-gray-400 hover:bg-[#2b3139] hover:text-white"
                    }`}
                  >
                    <Icon size={20} />
                    <span className="text-sm">{section.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 bg-[#181a20] rounded-lg p-6">
            {/* Notifications */}
            {activeSection === "notifications" && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold mb-4">Cài Đặt Thông Báo</h2>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-[#2b3139]">
                    <div className="flex items-center gap-3">
                      <Mail size={20} className="text-gray-400" />
                      <div>
                        <p className="font-medium">Thông báo Email</p>
                        <p className="text-sm text-gray-400">Nhận email về hoạt động tài khoản</p>
                      </div>
                    </div>
                    <ToggleSwitch 
                      enabled={settings.emailNotifications} 
                      onChange={() => handleToggle("emailNotifications")} 
                    />
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-[#2b3139]">
                    <div className="flex items-center gap-3">
                      <Smartphone size={20} className="text-gray-400" />
                      <div>
                        <p className="font-medium">Thông báo Push</p>
                        <p className="text-sm text-gray-400">Nhận thông báo trên trình duyệt</p>
                      </div>
                    </div>
                    <ToggleSwitch 
                      enabled={settings.pushNotifications} 
                      onChange={() => handleToggle("pushNotifications")} 
                    />
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-[#2b3139]">
                    <div className="flex items-center gap-3">
                      <Bell size={20} className="text-gray-400" />
                      <div>
                        <p className="font-medium">Cảnh báo giá</p>
                        <p className="text-sm text-gray-400">Thông báo khi giá đạt mức cài đặt</p>
                      </div>
                    </div>
                    <ToggleSwitch 
                      enabled={settings.priceAlerts} 
                      onChange={() => handleToggle("priceAlerts")} 
                    />
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-[#2b3139]">
                    <div className="flex items-center gap-3">
                      <Check size={20} className="text-gray-400" />
                      <div>
                        <p className="font-medium">Xác nhận giao dịch</p>
                        <p className="text-sm text-gray-400">Thông báo khi giao dịch hoàn tất</p>
                      </div>
                    </div>
                    <ToggleSwitch 
                      enabled={settings.tradeConfirmations} 
                      onChange={() => handleToggle("tradeConfirmations")} 
                    />
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <Globe size={20} className="text-gray-400" />
                      <div>
                        <p className="font-medium">Tin tức & Cập nhật</p>
                        <p className="text-sm text-gray-400">Nhận tin tức về thị trường crypto</p>
                      </div>
                    </div>
                    <ToggleSwitch 
                      enabled={settings.newsUpdates} 
                      onChange={() => handleToggle("newsUpdates")} 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Security */}
            {activeSection === "security" && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold mb-4">Cài Đặt Bảo Mật</h2>
                
                <div className="bg-[#2b3139] rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Shield size={24} className="text-yellow-500" />
                      <div>
                        <p className="font-medium">Xác thực 2 bước (2FA)</p>
                        <p className="text-sm text-gray-400">Bảo vệ tài khoản với Google Authenticator</p>
                      </div>
                    </div>
                    <Link 
                      href="/profile"
                      className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-medium rounded transition-colors"
                    >
                      Thiết lập
                    </Link>
                  </div>
                </div>

                <div className="bg-[#2b3139] rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Đổi mật khẩu</p>
                      <p className="text-sm text-gray-400">Cập nhật mật khẩu đăng nhập</p>
                    </div>
                    <Link 
                      href="/profile"
                      className="px-4 py-2 border border-[#2b3139] hover:bg-[#3b4149] rounded transition-colors"
                    >
                      Thay đổi
                    </Link>
                  </div>
                </div>

                <div className="bg-[#2b3139] rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Lịch sử đăng nhập</p>
                      <p className="text-sm text-gray-400">Xem các phiên đăng nhập gần đây</p>
                    </div>
                    <Link 
                      href="/profile"
                      className="px-4 py-2 border border-[#2b3139] hover:bg-[#3b4149] rounded transition-colors"
                    >
                      Xem
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Appearance */}
            {activeSection === "appearance" && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold mb-4">Giao Diện</h2>
                
                {/* Theme Mode */}
                <div className="bg-[#2b3139] rounded-lg p-4">
                  <p className="font-medium mb-3">Chế độ giao diện</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleThemeChange('dark')}
                      className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-lg transition-colors ${
                        settings.theme === 'dark'
                          ? "bg-yellow-500/10 border border-yellow-500 text-yellow-500"
                          : "bg-[#1e2329] hover:bg-[#3b4149]"
                      }`}
                    >
                      <Moon size={20} />
                      <span>Tối</span>
                    </button>
                    <button
                      onClick={() => handleThemeChange('light')}
                      className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-lg transition-colors ${
                        settings.theme === 'light'
                          ? "bg-yellow-500/10 border border-yellow-500 text-yellow-500"
                          : "bg-[#1e2329] hover:bg-[#3b4149]"
                      }`}
                    >
                      <Sun size={20} />
                      <span>Sáng</span>
                    </button>
                  </div>
                </div>

                {/* Theme Color */}
                <div className="bg-[#2b3139] rounded-lg p-4">
                  <p className="font-medium mb-3">Màu chủ đề</p>
                  <div className="flex gap-3">
                    {THEME_COLORS.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => handleThemeColorChange(color.value)}
                        title={color.name}
                        className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${
                          settings.themeColor === color.value ? "border-white scale-110" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color.value }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Language */}
            {activeSection === "language" && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold mb-4">Ngôn Ngữ</h2>
                
                <div className="space-y-2">
                  {[
                    { code: "vi", name: "Tiếng Việt", flag: "🇻🇳" },
                    { code: "en", name: "English", flag: "🇺🇸" },
                    { code: "zh", name: "中文", flag: "🇨🇳" },
                    { code: "ja", name: "日本語", flag: "🇯🇵" },
                    { code: "ko", name: "한국어", flag: "🇰🇷" },
                  ].map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      className={`w-full flex items-center justify-between p-4 rounded-lg transition-colors ${
                        settings.language === lang.code
                          ? "bg-yellow-500/10 border border-yellow-500"
                          : "bg-[#2b3139] hover:bg-[#3b4149]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{lang.flag}</span>
                        <span className="font-medium">{lang.name}</span>
                      </div>
                      {settings.language === lang.code && (
                        <Check size={20} className="text-yellow-500" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
