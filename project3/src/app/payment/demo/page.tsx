"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2, CreditCard, ArrowLeft } from "lucide-react";

function DemoPaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const orderId = searchParams.get("orderId");
  const amount = searchParams.get("amount");
  const method = searchParams.get("method") || "VNPAY";
  const orderInfo = searchParams.get("orderInfo") || "Nạp tiền";
  
  const [status, setStatus] = useState<"pending" | "processing" | "success" | "failed">("pending");
  const [countdown, setCountdown] = useState(5);

  const formatAmount = (value: string | null) => {
    if (!value) return "0 ₫";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(Number(value));
  };

  const handlePayment = async (success: boolean) => {
    setStatus("processing");
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (success) {
      setStatus("success");
      // Call backend to confirm payment
      try {
        const token = localStorage.getItem("accessToken");
        await fetch(`/api/fiat/deposit/demo-confirm`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({
            orderId,
            success: true,
          }),
        });
      } catch (error) {
        console.error("Confirm payment error:", error);
      }
    } else {
      setStatus("failed");
    }
  };

  useEffect(() => {
    if (status === "success" || status === "failed") {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            router.push("/deposit");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [status, router]);

  const getMethodIcon = () => {
    switch (method) {
      case "VNPAY":
        return "🏦";
      case "MOMO":
        return "📱";
      default:
        return "💳";
    }
  };

  const getMethodName = () => {
    switch (method) {
      case "VNPAY":
        return "VNPay";
      case "MOMO":
        return "MoMo";
      default:
        return method;
    }
  };

  if (!orderId) {
    return (
      <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center">
        <div className="text-center text-white">
          <XCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h1 className="text-xl font-semibold mb-2">Lỗi thanh toán</h1>
          <p className="text-gray-400">Không tìm thấy thông tin giao dịch</p>
          <button
            onClick={() => router.push("/deposit")}
            className="mt-4 px-6 py-2 bg-[#f0b90b] text-black rounded-lg font-medium"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">{getMethodIcon()}</div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Thanh toán {getMethodName()}
          </h1>
          <p className="text-gray-400 text-sm">
            Chế độ Demo - Thanh toán giả lập
          </p>
        </div>

        {/* Payment Card */}
        <div className="bg-[#1e2329] rounded-xl p-6 shadow-xl">
          {status === "pending" && (
            <>
              {/* Order Info */}
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Mã giao dịch</span>
                  <span className="text-white font-mono text-xs">{orderId?.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Nội dung</span>
                  <span className="text-white">{decodeURIComponent(orderInfo)}</span>
                </div>
                <div className="border-t border-[#2b3139] pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Số tiền</span>
                    <span className="text-2xl font-bold text-[#f0b90b]">
                      {formatAmount(amount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => handlePayment(true)}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <CheckCircle size={20} />
                  Thanh toán thành công
                </button>
                <button
                  onClick={() => handlePayment(false)}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <XCircle size={20} />
                  Thanh toán thất bại
                </button>
                <button
                  onClick={() => router.push("/deposit")}
                  className="w-full py-3 bg-[#2b3139] hover:bg-[#363d47] text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <ArrowLeft size={20} />
                  Hủy thanh toán
                </button>
              </div>
            </>
          )}

          {status === "processing" && (
            <div className="text-center py-8">
              <Loader2 className="w-16 h-16 animate-spin text-[#f0b90b] mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Đang xử lý thanh toán...
              </h2>
              <p className="text-gray-400">Vui lòng chờ trong giây lát</p>
            </div>
          )}

          {status === "success" && (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Thanh toán thành công!
              </h2>
              <p className="text-gray-400 mb-4">
                Số tiền {formatAmount(amount)} đã được cộng vào ví của bạn
              </p>
              <p className="text-sm text-gray-500">
                Tự động chuyển hướng sau {countdown} giây...
              </p>
            </div>
          )}

          {status === "failed" && (
            <div className="text-center py-8">
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Thanh toán thất bại
              </h2>
              <p className="text-gray-400 mb-4">
                Giao dịch không thể hoàn thành. Vui lòng thử lại.
              </p>
              <p className="text-sm text-gray-500">
                Tự động chuyển hướng sau {countdown} giây...
              </p>
            </div>
          )}
        </div>

        {/* Demo Notice */}
        <div className="mt-6 p-4 bg-yellow-900/30 border border-yellow-600/50 rounded-lg">
          <p className="text-yellow-500 text-sm text-center">
            ⚠️ Đây là trang thanh toán giả lập cho mục đích demo.
            <br />
            Trong môi trường production, bạn sẽ được chuyển đến cổng thanh toán thật.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DemoPaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#f0b90b]" />
      </div>
    }>
      <DemoPaymentContent />
    </Suspense>
  );
}
