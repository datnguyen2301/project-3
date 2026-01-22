"use client";

import { useState, useEffect } from "react";
import { Monitor, Clock, Shield, AlertTriangle } from "lucide-react";
import { getSecurityLogs, type SecurityLog } from "@/services/securityApi";
import { isAuthenticated } from "@/services/authApi";

export default function SecurityLogs() {
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [filter, setFilter] = useState<"all" | "success" | "failed" | "suspicious">("all");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (isAuthenticated()) {
      loadSecurityLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const loadSecurityLogs = async () => {
    setLoading(true);
    try {
      const response = await getSecurityLogs(page, 10);
      if (response.success && response.data) {
        setLogs(response.data.logs);
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error loading security logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = filter === "all" 
    ? logs 
    : logs.filter(log => log.status === filter);

  const getStatusColor = (status: SecurityLog["status"]) => {
    switch (status) {
      case "success":
        return "text-green-500";
      case "failed":
        return "text-red-500";
      case "suspicious":
        return "text-yellow-500";
    }
  };

  const getStatusText = (status: SecurityLog["status"]) => {
    switch (status) {
      case "success":
        return "Thành công";
      case "failed":
        return "Thất bại";
      case "suspicious":
        return "Đáng ngờ";
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Lịch Sử Bảo Mật</h2>
      
      <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <Shield size={24} className="text-blue-500 shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-blue-500 mb-2">Theo Dõi Hoạt Động</h3>
            <p className="text-sm text-gray-300">
              Kiểm tra tất cả hoạt động liên quan đến tài khoản của bạn. 
              Nếu phát hiện hoạt động đáng ngờ, hãy đổi mật khẩu ngay lập tức.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded transition-colors ${
            filter === "all"
              ? "bg-yellow-500 text-black"
              : "bg-[#2b3139] text-gray-400 hover:bg-[#3b4149]"
          }`}
        >
          Tất Cả ({logs.length})
        </button>
        <button
          onClick={() => setFilter("success")}
          className={`px-4 py-2 rounded transition-colors ${
            filter === "success"
              ? "bg-green-500 text-black"
              : "bg-[#2b3139] text-gray-400 hover:bg-[#3b4149]"
          }`}
        >
          Thành Công ({logs.filter(l => l.status === "success").length})
        </button>
        <button
          onClick={() => setFilter("failed")}
          className={`px-4 py-2 rounded transition-colors ${
            filter === "failed"
              ? "bg-red-500 text-black"
              : "bg-[#2b3139] text-gray-400 hover:bg-[#3b4149]"
          }`}
        >
          Thất Bại ({logs.filter(l => l.status === "failed").length})
        </button>
        <button
          onClick={() => setFilter("suspicious")}
          className={`px-4 py-2 rounded transition-colors ${
            filter === "suspicious"
              ? "bg-yellow-500 text-black"
              : "bg-[#2b3139] text-gray-400 hover:bg-[#3b4149]"
          }`}
        >
          Đáng Ngờ ({logs.filter(l => l.status === "suspicious").length})
        </button>
      </div>

      {/* Logs List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {isAuthenticated() ? 'No security logs found' : 'Please login to view security logs'}
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="bg-[#2b3139] rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4 flex-1">
                <div className={`p-2 rounded ${
                  log.status === "success" ? "bg-green-500/20" :
                  log.status === "failed" ? "bg-red-500/20" :
                  "bg-yellow-500/20"
                }`}>
                  {log.status === "suspicious" ? (
                    <AlertTriangle className={getStatusColor(log.status)} size={20} />
                  ) : (
                    <Shield className={getStatusColor(log.status)} size={20} />
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold">{log.action}</h4>
                    <span className={`text-xs px-2 py-1 rounded ${getStatusColor(log.status)}`}>
                      {getStatusText(log.status)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-400">
                    <div className="flex items-center gap-2">
                      <Shield size={14} />
                      <span>{log.ipAddress}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={14} />
                      <span>{new Date(log.createdAt).toLocaleString("vi-VN")}</span>
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <Monitor size={14} />
                      <span className="text-xs truncate">{log.userAgent}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-[#2b3139] rounded disabled:opacity-50 hover:bg-[#3b4149]"
          >
            Trước
          </button>
          <span className="px-4 py-2 text-gray-400">
            Trang {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-[#2b3139] rounded disabled:opacity-50 hover:bg-[#3b4149]"
          >
            Sau
          </button>
        </div>
      )}

      {filteredLogs.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-400">
          Không có hoạt động nào
        </div>
      )}
    </div>
  );
}
