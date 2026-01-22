"use client";

import { useState, useEffect, useCallback } from "react";
import { Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { getKYCStatus, submitKYC, uploadKYCDocuments } from "@/services/kycApi";
import { getSocket, connectWebSocket } from "@/services/websocket";

type KYCStatus = 'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'REJECTED';

export default function KYCVerification() {
  const [status, setStatus] = useState<KYCStatus>("NOT_STARTED");
  const [step, setStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    nationality: "",
    address: "",
    city: "",
    country: "",
    postalCode: "",
    phoneNumber: "",
    idType: "PASSPORT",
    idNumber: "",
  });
  const [documents, setDocuments] = useState({
    frontDocument: null as File | null,
    backDocument: null as File | null,
    selfie: null as File | null,
  });

  useEffect(() => {
    checkKYCStatus();
  }, []);

  // Listen for realtime KYC status updates via WebSocket
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleKYCUpdate = (data: any) => {
      console.log('KYC_UPDATE received:', data);
      if (data.kycStatus === 'APPROVED') {
        setStatus('APPROVED');
        // Show toast notification
        alert(data.message || 'Hồ sơ KYC của bạn đã được duyệt!');
      } else if (data.kycStatus === 'REJECTED') {
        setStatus('REJECTED');
        alert(data.message || 'Hồ sơ KYC của bạn bị từ chối.');
      }
    };

    socket.on('KYC_UPDATE', handleKYCUpdate);

    return () => {
      socket.off('KYC_UPDATE', handleKYCUpdate);
    };
  }, []);

  const checkKYCStatus = async () => {
    setLoadingStatus(true);
    try {
      const response = await getKYCStatus();
      if (response.success && response.data) {
        // Backend returns kycStatus field
        const kycStatus = response.data.kycStatus || response.data.status;
        // Map backend status to frontend status
        if (kycStatus === 'NOT_SUBMITTED') {
          setStatus('NOT_STARTED');
        } else if (kycStatus === 'PENDING') {
          setStatus('PENDING');
        } else if (kycStatus === 'APPROVED' || kycStatus === 'VERIFIED') {
          setStatus('APPROVED');
        } else if (kycStatus === 'REJECTED') {
          setStatus('REJECTED');
        } else {
          setStatus('NOT_STARTED');
        }
      }
    } catch (error) {
      console.error('Error checking KYC status:', error);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleFileChange = (type: keyof typeof documents, file: File | null) => {
    setDocuments({ ...documents, [type]: file });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!documents.frontDocument || !documents.backDocument || !documents.selfie) {
      alert('Vui lòng tải lên đầy đủ các tài liệu');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // First submit KYC data
      const kycResponse = await submitKYC(formData);
      
      if (!kycResponse.success) {
        alert(kycResponse.error?.message || 'Không thể gửi thông tin KYC');
        setIsLoading(false);
        return;
      }

      // Then upload documents
      const uploadResponse = await uploadKYCDocuments({
        frontDocument: documents.frontDocument,
        backDocument: documents.backDocument,
        selfie: documents.selfie,
      });
      
      if (uploadResponse.success) {
        setStatus('PENDING');
      } else {
        alert(uploadResponse.error?.message || 'Không thể tải lên tài liệu');
      }
    } catch (error) {
      console.error('Error submitting KYC:', error);
      alert('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  if (loadingStatus) {
    return (
      <div className="text-center py-12">
        <Loader2 className="animate-spin mx-auto mb-3 text-yellow-500" size={40} />
        <p className="text-gray-400">Đang tải...</p>
      </div>
    );
  }

  if (status === "PENDING") {
    return (
      <div>
        <h2 className="text-2xl font-semibold mb-6">Xác Minh Danh Tính (KYC)</h2>
        
        <div className="text-center py-12">
          <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-6">
            <Loader2 className="animate-spin text-yellow-500" size={40} />
          </div>
          <h3 className="text-xl font-semibold mb-3">Đang Xem Xét Hồ Sơ</h3>
          <p className="text-gray-400 mb-6">
            Chúng tôi đang xem xét thông tin của bạn. Quá trình này thường mất 1-3 ngày làm việc.
          </p>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-sm text-blue-500">
              Bạn sẽ nhận được email thông báo khi hồ sơ được duyệt.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "APPROVED") {
    return (
      <div>
        <h2 className="text-2xl font-semibold mb-6">Xác Minh Danh Tính (KYC)</h2>
        
        <div className="text-center py-12">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-green-500" size={40} />
          </div>
          <h3 className="text-xl font-semibold mb-3">Xác Minh Thành Công</h3>
          <p className="text-gray-400 mb-6">
            Tài khoản của bạn đã được xác minh đầy đủ. Bạn có thể sử dụng mọi tính năng.
          </p>
        </div>
      </div>
    );
  }

  if (status === "REJECTED") {
    return (
      <div>
        <h2 className="text-2xl font-semibold mb-6">Xác Minh Danh Tính (KYC)</h2>
        
        <div className="text-center py-12">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="text-red-500" size={40} />
          </div>
          <h3 className="text-xl font-semibold mb-3">Hồ Sơ Bị Từ Chối</h3>
          <p className="text-gray-400 mb-6">
            Rất tiếc, hồ sơ của bạn không được chấp nhận. Vui lòng nộp lại với thông tin chính xác.
          </p>
          <button
            onClick={() => setStatus("NOT_STARTED")}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium px-6 py-3 rounded transition-colors"
          >
            Nộp Lại Hồ Sơ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Xác Minh Danh Tính (KYC)</h2>
      
      <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <CheckCircle size={24} className="text-blue-500 shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-blue-500 mb-2">Tại Sao Cần Xác Minh?</h3>
            <p className="text-sm text-gray-300">
              Xác minh danh tính giúp bảo vệ tài khoản và tăng hạn mức giao dịch của bạn.
              Quá trình xác minh tuân thủ các quy định pháp luật về chống rửa tiền.
            </p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-center gap-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            step >= 1 ? "bg-yellow-500 text-black" : "bg-[#2b3139] text-gray-400"
          }`}>
            1
          </div>
          <div className={`h-1 w-16 ${step >= 2 ? "bg-yellow-500" : "bg-[#2b3139]"}`}></div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            step >= 2 ? "bg-yellow-500 text-black" : "bg-[#2b3139] text-gray-400"
          }`}>
            2
          </div>
          <div className={`h-1 w-16 ${step >= 3 ? "bg-yellow-500" : "bg-[#2b3139]"}`}></div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            step >= 3 ? "bg-yellow-500 text-black" : "bg-[#2b3139] text-gray-400"
          }`}>
            3
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
        {step === 1 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Thông Tin Cá Nhân</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Họ</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139] focus:outline-none focus:border-yellow-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Tên</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139] focus:outline-none focus:border-yellow-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Ngày Sinh</label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="w-full bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139] focus:outline-none focus:border-yellow-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Số Điện Thoại</label>
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    className="w-full bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139] focus:outline-none focus:border-yellow-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Quốc Tịch</label>
                <select
                  value={formData.nationality}
                  onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                  className="w-full bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139] focus:outline-none focus:border-yellow-500"
                  required
                >
                  <option value="">Chọn quốc tịch</option>
                  <option value="VN">Việt Nam</option>
                  <option value="US">United States</option>
                  <option value="CN">China</option>
                  <option value="JP">Japan</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Địa Chỉ</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139] focus:outline-none focus:border-yellow-500"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Thành Phố</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139] focus:outline-none focus:border-yellow-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Quốc Gia</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139] focus:outline-none focus:border-yellow-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Mã Bưu Điện</label>
                  <input
                    type="text"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    className="w-full bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139] focus:outline-none focus:border-yellow-500"
                    required
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="mt-6 bg-yellow-500 hover:bg-yellow-600 text-black font-medium px-6 py-3 rounded transition-colors"
            >
              Tiếp Theo
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Giấy Tờ Tùy Thân</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Loại Giấy Tờ</label>
                <select
                  value={formData.idType}
                  onChange={(e) => setFormData({ ...formData, idType: e.target.value })}
                  className="w-full bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139] focus:outline-none focus:border-yellow-500"
                >
                  <option value="NATIONAL_ID">Chứng Minh Nhân Dân / CCCD</option>
                  <option value="PASSPORT">Hộ Chiếu</option>
                  <option value="DRIVERS_LICENSE">Bằng Lái Xe</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Số Giấy Tờ</label>
                <input
                  type="text"
                  value={formData.idNumber}
                  onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                  className="w-full bg-[#2b3139] text-white px-4 py-3 rounded border border-[#2b3139] focus:outline-none focus:border-yellow-500"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium px-6 py-3 rounded transition-colors"
              >
                Tiếp Theo
              </button>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-gray-400 hover:text-white px-6 py-3"
              >
                Quay Lại
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Tải Lên Giấy Tờ</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Mặt Trước Giấy Tờ</label>
                <label className="block border-2 border-dashed border-[#2b3139] rounded-lg p-6 text-center hover:border-yellow-500 transition-colors cursor-pointer">
                  <Upload className="mx-auto text-gray-400 mb-2" size={32} />
                  <p className="text-sm text-gray-400">
                    {documents.frontDocument ? documents.frontDocument.name : 'Nhấp để tải ảnh lên'}
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange("frontDocument", e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Mặt Sau Giấy Tờ</label>
                <label className="block border-2 border-dashed border-[#2b3139] rounded-lg p-6 text-center hover:border-yellow-500 transition-colors cursor-pointer">
                  <Upload className="mx-auto text-gray-400 mb-2" size={32} />
                  <p className="text-sm text-gray-400">
                    {documents.backDocument ? documents.backDocument.name : 'Nhấp để tải ảnh lên'}
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange("backDocument", e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Ảnh Selfie Với Giấy Tờ</label>
                <label className="block border-2 border-dashed border-[#2b3139] rounded-lg p-6 text-center hover:border-yellow-500 transition-colors cursor-pointer">
                  <Upload className="mx-auto text-gray-400 mb-2" size={32} />
                  <p className="text-sm text-gray-400">
                    {documents.selfie ? documents.selfie.name : 'Nhấp để tải ảnh lên'}
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange("selfie", e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-xs text-yellow-500">
                  ⚠️ Đảm bảo hình ảnh rõ nét, không bị mờ hoặc bị che. Chấp nhận JPG, PNG (tối đa 5MB).
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="submit"
                disabled={isLoading}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium px-6 py-3 rounded transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading && <Loader2 size={18} className="animate-spin" />}
                {isLoading ? "Đang gửi..." : "Gửi Hồ Sơ"}
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-gray-400 hover:text-white px-6 py-3"
              >
                Quay Lại
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
