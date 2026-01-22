"use client";

import { useState } from "react";
import { X, Mail, Lock, User, Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { login, register } from "@/services/authApi";
import { useAuth } from "@/contexts/AuthContext";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "login" | "register";
}

export default function AuthModal({ isOpen, onClose, initialMode = "login" }: AuthModalProps) {
  const { login: authLogin } = useAuth();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [apiError, setApiError] = useState<string>("");

  if (!isOpen) return null;

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError("");
    const newErrors: { [key: string]: string } = {};

    // Validation
    if (mode === "register" && !formData.name.trim()) {
      newErrors.name = "Vui lòng nhập họ tên";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Vui lòng nhập email";
    } else if (!validateEmail(formData.email)) {
      newErrors.email = "Email không hợp lệ";
    }

    if (!formData.password) {
      newErrors.password = "Vui lòng nhập mật khẩu";
    } else if (formData.password.length < 6) {
      newErrors.password = "Mật khẩu phải có ít nhất 6 ký tự";
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/.test(formData.password)) {
      newErrors.password = "Mật khẩu phải có chữ HOA, chữ thường, số và ký tự đặc biệt (@$!%*?&#)";
    }

    if (mode === "register") {
      if (!formData.confirmPassword) {
        newErrors.confirmPassword = "Vui lòng xác nhận mật khẩu";
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Mật khẩu không khớp";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Call API
    setIsLoading(true);
    try {
      let response;
      if (mode === "login") {
        response = await login(formData.email, formData.password);
      } else {
        response = await register(formData.email, formData.password, formData.name, formData.confirmPassword);
      }

      if (response.success && response.data) {
        console.log('[AuthModal] Full response.data:', JSON.stringify(response.data, null, 2));
        console.log('[AuthModal] response.data keys:', Object.keys(response.data));
        
        // Backend có thể trả về accessToken hoặc token - kiểm tra cả nested objects
        const data = response.data as Record<string, unknown>;
        let token = (data.token || data.accessToken || data.access_token) as string;
        let refreshToken = (data.refreshToken || data.refresh_token) as string;
        
        // Nếu token nằm trong tokens object
        if (!token && data.tokens) {
          const tokens = data.tokens as Record<string, string>;
          token = tokens.accessToken || tokens.token || tokens.access_token;
          refreshToken = tokens.refreshToken || tokens.refresh_token || refreshToken;
        }
        
        console.log('[AuthModal] Extracted token:', token);
        
        if (!token) {
          console.error('[AuthModal] No token in response! Keys:', Object.keys(response.data));
          setApiError("Lỗi xác thực: Không nhận được token");
          return;
        }
        
        // Use AuthContext to login
        authLogin(response.data.user, token, refreshToken || '');
        onClose();
        
        // Reset form
        setFormData({ name: "", email: "", password: "", confirmPassword: "" });
        setErrors({});
      } else {
        // Display detailed validation errors if available
        if (response.error?.details && Array.isArray(response.error.details)) {
          const errorMessages = response.error.details.map((err: { field: string; message: string }) => err.message).join('. ');
          setApiError(errorMessages);
        } else {
          setApiError(response.error?.message || "Đã xảy ra lỗi, vui lòng thử lại");
        }
      }
    } catch {
      setApiError("Không thể kết nối đến máy chủ");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors({ ...errors, [field]: "" });
    }
  };

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setErrors({});
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1e2329] rounded-lg w-full max-w-md border border-[#2b3139] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2b3139]">
          <h2 className="text-xl font-semibold text-white">
            {mode === "login" ? "Đăng Nhập" : "Đăng Ký Tài Khoản"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-[#2b3139]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Họ và Tên
              </label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className={`w-full bg-[#2b3139] text-white pl-10 pr-4 py-2.5 rounded border ${
                    errors.name ? "border-red-500" : "border-[#2b3139]"
                  } focus:outline-none focus:border-yellow-500 transition-colors`}
                  placeholder="Nhập họ tên của bạn"
                />
              </div>
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className={`w-full bg-[#2b3139] text-white pl-10 pr-4 py-2.5 rounded border ${
                  errors.email ? "border-red-500" : "border-[#2b3139]"
                } focus:outline-none focus:border-yellow-500 transition-colors`}
                placeholder="example@email.com"
              />
            </div>
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Mật Khẩu
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                className={`w-full bg-[#2b3139] text-white pl-10 pr-12 py-2.5 rounded border ${
                  errors.password ? "border-red-500" : "border-[#2b3139]"
                } focus:outline-none focus:border-yellow-500 transition-colors`}
                placeholder="Nhập mật khẩu"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>

          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Xác Nhận Mật Khẩu
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange("confirmPassword", e.target.value)}
                  className={`w-full bg-[#2b3139] text-white pl-10 pr-4 py-2.5 rounded border ${
                    errors.confirmPassword ? "border-red-500" : "border-[#2b3139]"
                  } focus:outline-none focus:border-yellow-500 transition-colors`}
                  placeholder="Nhập lại mật khẩu"
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
              )}
            </div>
          )}

          {mode === "login" && (
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center text-gray-400">
                <input type="checkbox" className="mr-2 rounded" />
                Ghi nhớ đăng nhập
              </label>
              <Link 
                href="/forgot-password" 
                onClick={onClose}
                className="text-yellow-500 hover:text-yellow-400 transition-colors"
              >
                Quên mật khẩu?
              </Link>
            </div>
          )}

          {apiError && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-2 rounded text-sm">
              {apiError}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-3 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 size={18} className="animate-spin" />}
            {isLoading ? "Đang xử lý..." : mode === "login" ? "Đăng Nhập" : "Đăng Ký"}
          </button>

          <div className="text-center text-sm text-gray-400">
            {mode === "login" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
            <button
              type="button"
              onClick={switchMode}
              className="text-yellow-500 hover:text-yellow-400 transition-colors font-medium"
            >
              {mode === "login" ? "Đăng ký ngay" : "Đăng nhập"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
