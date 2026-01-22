"use client";

import { useState } from "react";
import { Mail, ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import Link from "next/link";
import { forgotPassword } from "@/services/authApi";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!email) {
      setError("Vui lòng nhập email");
      return;
    }

    setLoading(true);
    
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center p-4">
        <div className="bg-[#1e2329] rounded-lg p-8 max-w-md w-full text-center">
          <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Email Đã Gửi!</h1>
          <p className="text-gray-400 mb-6">
            Chúng tôi đã gửi hướng dẫn đặt lại mật khẩu đến <strong className="text-white">{email}</strong>.
            Vui lòng kiểm tra hộp thư đến của bạn.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Không nhận được email? Kiểm tra thư mục spam hoặc thử lại sau vài phút.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-yellow-500 hover:text-yellow-400"
          >
            <ArrowLeft size={18} />
            Quay lại trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center p-4">
      <div className="bg-[#1e2329] rounded-lg p-8 max-w-md w-full">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6"
        >
          <ArrowLeft size={18} />
          Quay lại
        </Link>

        <h1 className="text-2xl font-bold text-white mb-2">Quên Mật Khẩu</h1>
        <p className="text-gray-400 mb-6">
          Nhập email đã đăng ký để nhận hướng dẫn đặt lại mật khẩu.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Email</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                className={`w-full bg-[#2b3139] text-white pl-10 pr-4 py-3 rounded border ${
                  error ? "border-red-500" : "border-[#2b3139]"
                } focus:outline-none focus:border-yellow-500`}
                placeholder="your@email.com"
              />
            </div>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black font-bold py-3 rounded transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            {loading ? "Đang gửi..." : "Gửi Hướng Dẫn"}
          </button>
        </form>

        <p className="text-center text-gray-400 text-sm mt-6">
          Nhớ mật khẩu?{" "}
          <Link href="/" className="text-yellow-500 hover:underline">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
