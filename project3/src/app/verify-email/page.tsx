"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle, AlertCircle, Mail } from "lucide-react";
import Link from "next/link";
import { verifyEmail, resendVerification } from "@/services/authApi";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setError("Link xác thực không hợp lệ hoặc đã hết hạn.");
        setLoading(false);
        return;
      }

      try {
        await verifyEmail(token);
        setSuccess(true);
        // Redirect to home after 3 seconds
        setTimeout(() => {
          router.push("/");
        }, 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Xác thực thất bại");
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token, router]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;

    setResending(true);
    try {
      await resendVerification(resendEmail);
      setResendSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi lại email");
    } finally {
      setResending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center p-4">
        <div className="bg-[#1e2329] rounded-lg p-8 max-w-md w-full text-center">
          <Loader2 size={48} className="mx-auto text-yellow-500 animate-spin mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Đang Xác Thực...</h1>
          <p className="text-gray-400">Vui lòng đợi trong giây lát</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center p-4">
        <div className="bg-[#1e2329] rounded-lg p-8 max-w-md w-full text-center">
          <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Email Đã Xác Thực!</h1>
          <p className="text-gray-400 mb-6">
            Tài khoản của bạn đã được kích hoạt thành công. Bạn sẽ được chuyển hướng đến trang chủ...
          </p>
          <Link
            href="/"
            className="inline-block w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 rounded transition-colors"
          >
            Đi Đến Trang Chủ
          </Link>
        </div>
      </div>
    );
  }

  if (resendSuccess) {
    return (
      <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center p-4">
        <div className="bg-[#1e2329] rounded-lg p-8 max-w-md w-full text-center">
          <Mail size={64} className="mx-auto text-green-500 mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Email Đã Gửi!</h1>
          <p className="text-gray-400 mb-6">
            Chúng tôi đã gửi email xác thực mới đến <strong className="text-white">{resendEmail}</strong>.
            Vui lòng kiểm tra hộp thư đến.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-yellow-500 hover:text-yellow-400"
          >
            Quay lại trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center p-4">
      <div className="bg-[#1e2329] rounded-lg p-8 max-w-md w-full text-center">
        <AlertCircle size={64} className="mx-auto text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Xác Thực Thất Bại</h1>
        <p className="text-gray-400 mb-6">{error}</p>

        <div className="border-t border-[#2b3139] pt-6 mt-6">
          <p className="text-gray-400 mb-4">Gửi lại email xác thực?</p>
          <form onSubmit={handleResend} className="space-y-4">
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                className="w-full bg-[#2b3139] text-white pl-10 pr-4 py-3 rounded border border-[#2b3139] focus:outline-none focus:border-yellow-500"
                placeholder="Nhập email của bạn"
              />
            </div>
            <button
              type="submit"
              disabled={resending || !resendEmail}
              className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black font-bold py-3 rounded transition-colors flex items-center justify-center gap-2"
            >
              {resending && <Loader2 size={18} className="animate-spin" />}
              {resending ? "Đang gửi..." : "Gửi Lại Email"}
            </button>
          </form>
        </div>

        <Link
          href="/"
          className="inline-block mt-6 text-gray-400 hover:text-white"
        >
          Quay lại trang chủ
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-yellow-500" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
