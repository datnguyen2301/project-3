"use client";

import { useState } from "react";
import { Lock, Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";
import { changePassword } from "@/services/userApi";

export default function ChangePassword() {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: "" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = "Vui lòng nhập mật khẩu hiện tại";
    }

    if (!formData.newPassword) {
      newErrors.newPassword = "Vui lòng nhập mật khẩu mới";
    } else if (formData.newPassword.length < 6) {
      newErrors.newPassword = "Mật khẩu phải có ít nhất 6 ký tự";
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/.test(formData.newPassword)) {
      newErrors.newPassword = "Mật khẩu phải có chữ HOA, chữ thường, số và ký tự đặc biệt";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Vui lòng xác nhận mật khẩu mới";
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = "Mật khẩu không khớp";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await changePassword(formData.currentPassword, formData.newPassword);
      
      if (response.success) {
        setSuccess(true);
        setFormData({ currentPassword: "", newPassword: "", confirmPassword: "" });
        
        setTimeout(() => {
          setSuccess(false);
        }, 3000);
      } else {
        setErrors({
          currentPassword: response.error?.message || "Không thể đổi mật khẩu",
        });
      }
    } catch {
      setErrors({
        currentPassword: "Có lỗi xảy ra. Vui lòng thử lại.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Đổi Mật Khẩu</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Mật Khẩu Hiện Tại</label>
          <div className="relative">
            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type={showCurrentPassword ? "text" : "password"}
              value={formData.currentPassword}
              onChange={(e) => handleChange("currentPassword", e.target.value)}
              className={`w-full bg-[#2b3139] text-white pl-10 pr-12 py-3 rounded border ${
                errors.currentPassword ? "border-red-500" : "border-[#2b3139]"
              } focus:outline-none focus:border-yellow-500`}
              placeholder="Nhập mật khẩu hiện tại"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.currentPassword && (
            <p className="text-red-500 text-xs mt-1">{errors.currentPassword}</p>
          )}
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Mật Khẩu Mới</label>
          <div className="relative">
            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type={showNewPassword ? "text" : "password"}
              value={formData.newPassword}
              onChange={(e) => handleChange("newPassword", e.target.value)}
              className={`w-full bg-[#2b3139] text-white pl-10 pr-12 py-3 rounded border ${
                errors.newPassword ? "border-red-500" : "border-[#2b3139]"
              } focus:outline-none focus:border-yellow-500`}
              placeholder="Nhập mật khẩu mới"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.newPassword && (
            <p className="text-red-500 text-xs mt-1">{errors.newPassword}</p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            Mật khẩu phải có ít nhất 6 ký tự, bao gồm chữ HOA, chữ thường, số và ký tự đặc biệt (@$!%*?&#)
          </p>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Xác Nhận Mật Khẩu Mới</label>
          <div className="relative">
            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type={showConfirmPassword ? "text" : "password"}
              value={formData.confirmPassword}
              onChange={(e) => handleChange("confirmPassword", e.target.value)}
              className={`w-full bg-[#2b3139] text-white pl-10 pr-12 py-3 rounded border ${
                errors.confirmPassword ? "border-red-500" : "border-[#2b3139]"
              } focus:outline-none focus:border-yellow-500`}
              placeholder="Nhập lại mật khẩu mới"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
          )}
        </div>

        {success && (
          <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded flex items-center gap-2">
            <CheckCircle size={20} />
            <span>Đổi mật khẩu thành công!</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium px-6 py-3 rounded transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isLoading && <Loader2 size={18} className="animate-spin" />}
          {isLoading ? "Đang xử lý..." : "Đổi Mật Khẩu"}
        </button>
      </form>
    </div>
  );
}
