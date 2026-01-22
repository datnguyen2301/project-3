"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { 
  getDepositStatus, 
  formatVND, 
  type DepositTransaction 
} from "@/services/depositApi";
import { useAuth } from "@/contexts/AuthContext";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Wallet,
  ArrowLeft,
  RefreshCw,
  Clock,
} from "lucide-react";

function PaymentReturnContent() {
  const searchParams = useSearchParams();
  const { refreshBalances } = useAuth();
  const [status, setStatus] = useState<"checking" | "success" | "failed" | "pending">("checking");
  const [depositInfo, setDepositInfo] = useState<DepositTransaction | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 15; // Maximum 30 seconds (15 * 2s)

  const orderId = searchParams.get("orderId") || searchParams.get("vnp_TxnRef");

  useEffect(() => {
    if (!orderId) {
      return;
    }

    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const checkStatus = async () => {
      try {
        const data = await getDepositStatus(orderId);
        
        if (!isMounted) return;

        if (data) {
          setDepositInfo(data);
          
          if (data.status === "COMPLETED") {
            setStatus("success");
            // Refresh wallet balance
            await refreshBalances();
          } else if (data.status === "FAILED" || data.status === "CANCELLED") {
            setStatus("failed");
          } else if (data.status === "PENDING" || data.status === "PROCESSING") {
            setRetryCount(prev => prev + 1);
            if (retryCount < maxRetries) {
              // Still pending, check again after 2s
              timeoutId = setTimeout(checkStatus, 2000);
            } else {
              // Timeout - show pending status
              setStatus("pending");
            }
          }
        } else {
          // No data found
          setRetryCount(prev => prev + 1);
          if (retryCount < maxRetries) {
            timeoutId = setTimeout(checkStatus, 2000);
          } else {
            setStatus("failed");
          }
        }
      } catch (error) {
        console.error("Error checking payment status:", error);
        setRetryCount(prev => prev + 1);
        if (retryCount < maxRetries && isMounted) {
          timeoutId = setTimeout(checkStatus, 2000);
        } else {
          setStatus("failed");
        }
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [orderId, refreshBalances, retryCount]);

  // No orderId - show failed
  if (!orderId) {
    return (
      <div className="min-h-screen bg-[#0b0e11]">
        <Header />
        <div className="flex flex-col items-center justify-center py-20">
          <div className="bg-[#1e2329] rounded-lg p-8 border border-[#2b3139] text-center max-w-md mx-4">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle size={48} className="text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Không tìm thấy giao dịch</h1>
            <p className="text-gray-400 mb-6">
              Không có thông tin giao dịch. Vui lòng thử lại.
            </p>
            <Link
              href="/deposit"
              className="bg-yellow-500 text-black font-semibold py-3 px-6 rounded-lg hover:bg-yellow-400 transition-colors inline-flex items-center gap-2"
            >
              <ArrowLeft size={20} />
              Quay lại nạp tiền
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Checking status
  if (status === "checking") {
    return (
      <div className="min-h-screen bg-[#0b0e11]">
        <Header />
        <div className="flex flex-col items-center justify-center py-20">
          <div className="bg-[#1e2329] rounded-lg p-8 border border-[#2b3139] text-center max-w-md mx-4">
            <Loader2 size={64} className="animate-spin text-yellow-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-2">Đang xác nhận thanh toán</h1>
            <p className="text-gray-400 mb-4">
              Vui lòng đợi trong giây lát...
            </p>
            <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
              <RefreshCw size={14} className="animate-spin" />
              Đang kiểm tra ({retryCount}/{maxRetries})
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success status
  if (status === "success") {
    return (
      <div className="min-h-screen bg-[#0b0e11]">
        <Header />
        <div className="flex flex-col items-center justify-center py-20">
          <div className="bg-[#1e2329] rounded-lg p-8 border border-[#2b3139] text-center max-w-md mx-4">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={48} className="text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Nạp tiền thành công!</h1>
            <p className="text-gray-400 mb-6">
              Số tiền <span className="text-yellow-500 font-semibold">
                {depositInfo ? formatVND(depositInfo.amount) : "---"}
              </span> đã được cộng vào ví của bạn
            </p>
            
            {depositInfo && (
              <div className="bg-[#2b3139] rounded-lg p-4 mb-6 text-left">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">Mã giao dịch</span>
                  <span className="text-white font-mono text-sm">{depositInfo.id}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">Phương thức</span>
                  <span className="text-white">{depositInfo.method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Thời gian</span>
                  <span className="text-white">
                    {new Date(depositInfo.completedAt || depositInfo.createdAt).toLocaleString("vi-VN")}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Link
                href="/wallet"
                className="flex-1 bg-yellow-500 text-black font-semibold py-3 rounded-lg hover:bg-yellow-400 transition-colors flex items-center justify-center gap-2"
              >
                <Wallet size={20} />
                Xem ví của tôi
              </Link>
              <Link
                href="/deposit"
                className="flex-1 bg-[#2b3139] text-white font-semibold py-3 rounded-lg hover:bg-[#363d47] transition-colors flex items-center justify-center gap-2"
              >
                Nạp thêm
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pending status (timeout)
  if (status === "pending") {
    return (
      <div className="min-h-screen bg-[#0b0e11]">
        <Header />
        <div className="flex flex-col items-center justify-center py-20">
          <div className="bg-[#1e2329] rounded-lg p-8 border border-[#2b3139] text-center max-w-md mx-4">
            <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock size={48} className="text-yellow-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Đang xử lý</h1>
            <p className="text-gray-400 mb-6">
              Giao dịch của bạn đang được xử lý. Vui lòng kiểm tra lại sau vài phút.
            </p>
            
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
              <p className="text-yellow-400 text-sm">
                Nếu bạn đã thanh toán thành công, số tiền sẽ được cộng vào ví trong vòng vài phút.
              </p>
            </div>

            <div className="flex gap-3">
              <Link
                href="/wallet"
                className="flex-1 bg-yellow-500 text-black font-semibold py-3 rounded-lg hover:bg-yellow-400 transition-colors flex items-center justify-center gap-2"
              >
                <Wallet size={20} />
                Xem ví
              </Link>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-[#2b3139] text-white font-semibold py-3 rounded-lg hover:bg-[#363d47] transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw size={20} />
                Kiểm tra lại
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Failed status
  return (
    <div className="min-h-screen bg-[#0b0e11]">
      <Header />
      <div className="flex flex-col items-center justify-center py-20">
        <div className="bg-[#1e2329] rounded-lg p-8 border border-[#2b3139] text-center max-w-md mx-4">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle size={48} className="text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Thanh toán thất bại</h1>
          <p className="text-gray-400 mb-6">
            Giao dịch không thành công. Vui lòng thử lại hoặc chọn phương thức thanh toán khác.
          </p>
          
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <p className="text-red-400 text-sm">
              Nếu tiền đã bị trừ nhưng chưa được cộng vào ví, vui lòng liên hệ hỗ trợ.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/deposit"
              className="flex-1 bg-yellow-500 text-black font-semibold py-3 rounded-lg hover:bg-yellow-400 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft size={20} />
              Thử lại
            </Link>
            <Link
              href="/"
              className="flex-1 bg-[#2b3139] text-white font-semibold py-3 rounded-lg hover:bg-[#363d47] transition-colors"
            >
              Trang chủ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center">
        <Loader2 className="animate-spin text-yellow-500" size={48} />
      </div>
    }>
      <PaymentReturnContent />
    </Suspense>
  );
}
