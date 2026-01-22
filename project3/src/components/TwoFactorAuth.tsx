"use client";

import { useState, useEffect } from "react";
import { Shield, Smartphone, Key, Copy, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { setup2FA, verify2FA, disable2FA, TwoFASetupResponse } from "@/services/twoFactorApi";
import { getUserProfile } from "@/services/userApi";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthToken } from "@/services/authApi";

export default function TwoFactorAuth() {
  const { isAuthenticated, isLoading: authLoading, user, updateUser } = useAuth();
  const [isEnabled, setIsEnabled] = useState(false);
  const [step, setStep] = useState<"intro" | "password" | "setup" | "verify" | "disable">("intro");
  const [setupData, setSetupData] = useState<TwoFASetupResponse | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitLoading, setIsInitLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  // Check 2FA status on load - luôn gọi API để lấy trạng thái mới nhất
  useEffect(() => {
    // Đợi auth context load xong trước
    if (authLoading) {
      return;
    }
    
    const check2FAStatus = async () => {
      // Kiểm tra cả isAuthenticated VÀ token có tồn tại
      const token = getAuthToken();
      if (!isAuthenticated || !token) {
        setIsInitLoading(false);
        return;
      }
      
      try {
        const profile = await getUserProfile();
        console.log('[TwoFactorAuth] Profile from API:', profile);
        console.log('[TwoFactorAuth] twoFactorEnabled:', profile.twoFactorEnabled);
        const enabled = profile.twoFactorEnabled || false;
        setIsEnabled(enabled);
        
        // Cập nhật AuthContext với dữ liệu mới nhất
        if (user) {
          updateUser({ ...user, twoFactorEnabled: enabled });
        }
      } catch (err) {
        console.log('[TwoFactorAuth] Error fetching profile:', err);
        // Bỏ qua lỗi authentication (AUTH_REQUIRED, 401)
        // Nếu có user trong context, dùng giá trị đó
        if (user && user.twoFactorEnabled !== undefined) {
          console.log('[TwoFactorAuth] Using user from context:', user.twoFactorEnabled);
          setIsEnabled(user.twoFactorEnabled);
        }
      } finally {
        setIsInitLoading(false);
      }
    };
    check2FAStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

  // Sync isEnabled với user.twoFactorEnabled khi user thay đổi
  // Nếu 2FA đã bật, quay về trang intro
  useEffect(() => {
    if (user && user.twoFactorEnabled !== undefined) {
      setIsEnabled(user.twoFactorEnabled);
      // Nếu đang ở step setup mà 2FA đã được bật, quay về intro
      if (user.twoFactorEnabled && (step === "password" || step === "setup" || step === "verify")) {
        setStep("intro");
      }
    }
  }, [user?.twoFactorEnabled, step]);

  const handleEnable2FA = async () => {
    setError("");
    
    // Kiểm tra nếu 2FA đã được bật
    if (isEnabled) {
      setError("2FA đã được bật. Vui lòng tắt trước khi thiết lập lại.");
      return;
    }
    
    // Kiểm tra đăng nhập trước
    const token = getAuthToken();
    if (!isAuthenticated || !token) {
      setError("Vui lòng đăng nhập để thiết lập 2FA");
      return;
    }
    
    if (!setupPassword) {
      setError("Vui lòng nhập mật khẩu để xác thực");
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await setup2FA(setupPassword);
      setSetupData(response);
      setBackupCodes(response.backupCodes);
      setStep("setup");
      setSetupPassword(""); // Clear password after success
      
      // Lưu ý: 2FA chưa hoàn toàn được bật cho đến khi verify xong
      // Nhưng đánh dấu đang trong quá trình setup
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Không thể thiết lập 2FA";
      
      // Nếu backend báo 2FA đã được bật, cập nhật state
      if (errorMessage.toLowerCase().includes('already enabled') || 
          errorMessage.includes('đã được bật')) {
        setIsEnabled(true);
        setStep("intro");
        // Cập nhật AuthContext
        if (user) {
          updateUser({ ...user, twoFactorEnabled: true });
        }
        setError("2FA đã được bật trước đó. Trang đã được cập nhật.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartSetup = () => {
    // Không cho phép setup nếu 2FA đã được bật
    if (isEnabled) {
      setError("2FA đã được bật. Vui lòng tắt trước khi thiết lập lại.");
      return;
    }
    setError("");
    setStep("password");
  };

  const handleCopySecret = () => {
    if (setupData?.secret) {
      navigator.clipboard.writeText(setupData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (verificationCode.length !== 6) {
      setError("Mã xác thực phải có 6 chữ số");
      return;
    }

    setIsLoading(true);
    
    try {
      await verify2FA(verificationCode);
      setIsEnabled(true);
      setShowBackupCodes(true); // Show backup codes after successful verification
      
      // Cập nhật user trong AuthContext để duy trì trạng thái khi chuyển tab
      if (user) {
        updateUser({ ...user, twoFactorEnabled: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mã xác thực không đúng");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!disablePassword) {
      setError("Vui lòng nhập mật khẩu");
      return;
    }

    setIsLoading(true);
    
    try {
      await disable2FA(disablePassword);
      setIsEnabled(false);
      setStep("intro");
      setDisablePassword("");
      
      // Cập nhật user trong AuthContext
      if (user) {
        updateUser({ ...user, twoFactorEnabled: false });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tắt 2FA");
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowDisableForm = () => {
    if (confirm("Bạn có chắc muốn tắt xác thực 2 bước? Điều này có thể làm giảm bảo mật tài khoản.")) {
      setStep("disable");
    }
  };

  if (isInitLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 size={32} className="animate-spin text-yellow-500" />
      </div>
    );
  }

  // Show backup codes after successful 2FA setup
  if (showBackupCodes && backupCodes.length > 0) {
    return (
      <div>
        <h2 className="text-2xl font-semibold mb-6">✅ Thiết Lập 2FA Thành Công!</h2>
        
        <div className="space-y-6 max-w-xl">
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle size={24} className="text-red-500 shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-red-500 mb-2">LƯU MÃ BACKUP NGAY!</h3>
                <p className="text-sm text-gray-300">
                  Lưu các mã backup này ở nơi an toàn. Bạn sẽ cần chúng để khôi phục tài khoản nếu mất điện thoại.
                  Mỗi mã chỉ được sử dụng một lần.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#2b3139] p-6 rounded-lg">
            <h3 className="font-semibold mb-4">Mã Backup Của Bạn:</h3>
            <div className="grid grid-cols-2 gap-2 font-mono text-lg">
              {backupCodes.map((code, index) => (
                <div key={index} className="bg-[#1e2329] px-4 py-2 rounded text-center">
                  {code}
                </div>
              ))}
            </div>
            <button
              onClick={handleCopyBackupCodes}
              className="mt-4 w-full bg-[#3b4149] hover:bg-[#4b5159] text-white font-medium py-2 rounded transition-colors flex items-center justify-center gap-2"
            >
              {copied ? <CheckCircle size={18} /> : <Copy size={18} />}
              {copied ? "Đã sao chép!" : "Sao chép tất cả"}
            </button>
          </div>

          <button
            onClick={() => {
              setShowBackupCodes(false);
              setStep("intro");
              setVerificationCode("");
              setSetupData(null);
            }}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-medium py-3 rounded transition-colors"
          >
            Tôi Đã Lưu Mã Backup
          </button>
        </div>
      </div>
    );
  }

  if (step === "intro") {
    return (
      <div>
        <h2 className="text-2xl font-semibold mb-6">Xác Thực 2 Bước (2FA)</h2>
        
        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <Shield size={24} className="text-blue-500 shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-blue-500 mb-2">Tăng Cường Bảo Mật</h3>
              <p className="text-sm text-gray-300">
                Xác thực 2 bước (2FA) thêm một lớp bảo mật bổ sung cho tài khoản của bạn. 
                Ngoài mật khẩu, bạn sẽ cần nhập mã từ ứng dụng xác thực mỗi khi đăng nhập.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6 max-w-xl">
          <div className={`p-6 rounded-lg border ${
            isEnabled 
              ? "bg-green-500/10 border-green-500" 
              : "bg-[#2b3139] border-[#2b3139]"
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  isEnabled ? "bg-green-500/20" : "bg-gray-500/20"
                }`}>
                  <Smartphone size={24} className={isEnabled ? "text-green-500" : "text-gray-400"} />
                </div>
                <div>
                  <h3 className="font-semibold">Ứng Dụng Xác Thực</h3>
                  <p className="text-sm text-gray-400">Google Authenticator, Authy</p>
                </div>
              </div>
              <div className={`px-4 py-2 rounded text-sm font-medium ${
                isEnabled 
                  ? "bg-green-500 text-black" 
                  : "bg-gray-500/30 text-gray-400"
              }`}>
                {isEnabled ? "Đã bật" : "Chưa bật"}
              </div>
            </div>
            
            {isEnabled ? (
              <button
                onClick={handleShowDisableForm}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 rounded transition-colors"
              >
                Tắt Xác Thực 2 Bước
              </button>
            ) : (
              <button
                onClick={handleStartSetup}
                disabled={isLoading}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-medium py-2 rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 size={18} className="animate-spin" />}
                {isLoading ? "Đang thiết lập..." : "Bật Xác Thực 2 Bước"}
              </button>
            )}
          </div>
          
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}
          
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-sm text-yellow-500">
              <strong>Lưu ý:</strong> Hãy lưu giữ mã backup sau khi thiết lập 2FA. 
              Bạn sẽ cần nó để khôi phục tài khoản nếu mất điện thoại.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step === "password") {
    return (
      <div>
        <h2 className="text-2xl font-semibold mb-6">Xác Thực Mật Khẩu</h2>
        
        <div className="space-y-6 max-w-xl">
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <Key size={24} className="text-blue-500 shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-blue-500 mb-2">Xác Thực Bảo Mật</h3>
                <p className="text-sm text-gray-300">
                  Vui lòng nhập mật khẩu tài khoản để xác thực trước khi bật 2FA.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleEnable2FA(); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Mật khẩu</label>
              <input
                type="password"
                value={setupPassword}
                onChange={(e) => setSetupPassword(e.target.value)}
                placeholder="Nhập mật khẩu của bạn"
                className="w-full bg-[#2b3139] border border-[#3b4149] rounded-lg px-4 py-3 focus:outline-none focus:border-yellow-500"
                autoFocus
              />
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-500">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setStep("intro"); setSetupPassword(""); setError(""); }}
                className="flex-1 bg-[#3b4149] hover:bg-[#4b5159] text-white font-medium py-3 rounded transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black font-medium py-3 rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 size={18} className="animate-spin" />}
                {isLoading ? "Đang xác thực..." : "Tiếp tục"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (step === "setup" && setupData) {
    return (
      <div>
        <h2 className="text-2xl font-semibold mb-6">Thiết Lập Xác Thực 2 Bước</h2>
        
        <div className="space-y-6 max-w-xl">
          <div>
            <h3 className="font-semibold mb-3">Bước 1: Quét mã QR</h3>
            <p className="text-sm text-gray-400 mb-4">
              Mở ứng dụng Google Authenticator hoặc Authy trên điện thoại và quét mã QR bên dưới:
            </p>
            
            <div className="bg-white p-6 rounded-lg inline-block">
              {setupData.qrCode ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={setupData.qrCode} alt="QR Code" width={200} height={200} />
              ) : (
                <QRCodeSVG 
                  value={`otpauth://totp/CryptoExchange:user@example.com?secret=${setupData.secret}&issuer=CryptoExchange`}
                  size={200}
                />
              )}
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold mb-3">Hoặc nhập mã thủ công:</h3>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={setupData.secret}
                readOnly
                className="flex-1 bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139] font-mono"
              />
              <button
                onClick={handleCopySecret}
                className="bg-[#2b3139] hover:bg-[#3b4149] text-white px-4 py-3 rounded transition-colors"
              >
                {copied ? <CheckCircle size={20} /> : <Copy size={20} />}
              </button>
            </div>
          </div>
          
          <div>
            <button
              onClick={() => setStep("verify")}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium px-6 py-3 rounded transition-colors"
            >
              Tiếp Theo
            </button>
            <button
              onClick={() => {
                setStep("intro");
                setSetupData(null);
              }}
              className="ml-3 text-gray-400 hover:text-white px-6 py-3"
            >
              Hủy
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Disable 2FA step
  if (step === "disable") {
    return (
      <div>
        <h2 className="text-2xl font-semibold mb-6">Tắt Xác Thực 2 Bước</h2>
        
        <form onSubmit={handleDisable2FA} className="space-y-6 max-w-xl">
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-500">
              <strong>Cảnh báo:</strong> Tắt 2FA sẽ làm giảm bảo mật tài khoản của bạn.
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Nhập mật khẩu để xác nhận:</label>
            <input
              type="password"
              value={disablePassword}
              onChange={(e) => {
                setDisablePassword(e.target.value);
                setError("");
              }}
              className={`w-full bg-[#2b3139] text-white px-4 py-3 rounded border ${
                error ? "border-red-500" : "border-[#2b3139]"
              } focus:outline-none focus:border-yellow-500`}
              placeholder="Mật khẩu của bạn"
            />
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isLoading}
              className="bg-red-500 hover:bg-red-600 text-white font-medium px-6 py-3 rounded transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading && <Loader2 size={18} className="animate-spin" />}
              {isLoading ? "Đang xử lý..." : "Tắt 2FA"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("intro");
                setDisablePassword("");
                setError("");
              }}
              className="text-gray-400 hover:text-white px-6 py-3"
            >
              Hủy
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Verify step
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Xác Nhận Thiết Lập</h2>
      
      <form onSubmit={handleVerify} className="space-y-6 max-w-xl">
        <div>
          <h3 className="font-semibold mb-3">Bước 2: Nhập mã xác thực</h3>
          <p className="text-sm text-gray-400 mb-4">
            Nhập mã 6 chữ số từ ứng dụng xác thực của bạn:
          </p>
          
          <div className="relative">
            <Key size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => {
                setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                setError("");
              }}
              className={`w-full bg-[#2b3139] text-white pl-10 pr-4 py-3 rounded border ${
                error ? "border-red-500" : "border-[#2b3139]"
              } focus:outline-none focus:border-yellow-500 text-center text-2xl tracking-widest font-mono`}
              placeholder="000000"
              maxLength={6}
            />
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isLoading || verificationCode.length !== 6}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium px-6 py-3 rounded transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading && <Loader2 size={18} className="animate-spin" />}
            {isLoading ? "Đang xác thực..." : "Xác Nhận"}
          </button>
          <button
            type="button"
            onClick={() => setStep("setup")}
            className="text-gray-400 hover:text-white px-6 py-3"
          >
            Quay Lại
          </button>
        </div>
      </form>
    </div>
  );
}
