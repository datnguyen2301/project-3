"use client";

import Header from "@/components/Header";
import WalletManagement from "@/components/WalletManagement";
import { useAuth } from "@/contexts/AuthContext";
import { Wallet, Loader2 } from "lucide-react";

export default function WalletPage() {
  const { isAuthenticated, isLoading } = useAuth();

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
            <Wallet size={64} className="mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400 text-lg">Vui lòng đăng nhập để xem ví của bạn</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Ví Của Tôi</h1>
          <p className="text-gray-400">Quản lý tài sản, nạp và rút tiền</p>
        </div>
        
        <WalletManagement />
      </div>
    </div>
  );
}
