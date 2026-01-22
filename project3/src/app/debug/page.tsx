"use client";

import { useState } from "react";
import Link from "next/link";
import { getAuthToken } from "@/services/authApi";

export default function DebugPage() {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return getAuthToken();
    }
    return null;
  });
  const [apiResponse, setApiResponse] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const refreshToken = () => {
    const t = getAuthToken();
    setToken(t);
  };

  const testAPI = async () => {
    setLoading(true);
    setApiResponse("Loading...");
    refreshToken();
    
    const currentToken = getAuthToken();
    console.log("Current token:", currentToken);
    
    if (!currentToken) {
      setApiResponse("ERROR: No token found! Please login first.");
      setLoading(false);
      return;
    }

    try {
      // Test direct API call to backend
      const response = await fetch("/api/wallet/balances", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentToken}`,
        },
      });

      const status = response.status;
      const text = await response.text();
      
      let result = `Status: ${status}\n\nResponse:\n${text}`;
      
      try {
        const json = JSON.parse(text);
        result = `Status: ${status}\n\nParsed JSON:\n${JSON.stringify(json, null, 2)}`;
      } catch {
        // Keep text response
      }
      
      setApiResponse(result);
    } catch (error) {
      setApiResponse(`Error: ${error}`);
    }
    
    setLoading(false);
  };

  const testOrderAPI = async () => {
    setLoading(true);
    setApiResponse("Testing order API...");
    
    const currentToken = getAuthToken();
    if (!currentToken) {
      setApiResponse("ERROR: No token found!");
      setLoading(false);
      return;
    }

    try {
      const orderData = {
        symbol: "BTCUSDT",
        side: "BUY",
        type: "LIMIT",
        amount: 0.01,  // Backend expects 'amount' not 'quantity'
        price: 43250.00
      };
      
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentToken}`,
        },
        body: JSON.stringify(orderData),
      });

      const status = response.status;
      const text = await response.text();
      
      let parsedError = "";
      try {
        const json = JSON.parse(text);
        // Hiển thị chi tiết lỗi validation
        if (json.error?.details) {
          parsedError = `\n\nValidation Details:\n${JSON.stringify(json.error.details, null, 2)}`;
        }
      } catch {
        // ignore
      }
      
      const result = `Order Request:\n${JSON.stringify(orderData, null, 2)}\n\nStatus: ${status}\n\nResponse:\n${text}${parsedError}`;
      
      setApiResponse(result);
    } catch (error) {
      setApiResponse(`Error: ${error}`);
    }
    
    setLoading(false);
  };

  const clearStorage = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    alert("Cleared! Please refresh and login again.");
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-8">🔧 Debug API</h1>
      
      <div className="mb-6 p-4 bg-gray-800 rounded">
        <h2 className="text-xl mb-2">Token Status:</h2>
        <p className={token ? "text-green-400" : "text-red-400"}>
          {token ? `✅ Token exists: ${token.substring(0, 50)}...` : "❌ No token found"}
        </p>
      </div>

      <div className="flex gap-4 mb-6 flex-wrap">
        <button
          onClick={testAPI}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded font-bold disabled:opacity-50"
        >
          {loading ? "Testing..." : "🧪 Test Wallet API"}
        </button>
        
        <button
          onClick={testOrderAPI}
          disabled={loading}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded font-bold disabled:opacity-50"
        >
          {loading ? "Testing..." : "📦 Test Order API"}
        </button>
        
        <button
          onClick={clearStorage}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded font-bold"
        >
          🗑️ Clear Storage & Logout
        </button>
        
        <Link
          href="/"
          className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded font-bold"
        >
          🏠 Go Home to Login
        </Link>
      </div>

      <div className="p-4 bg-gray-800 rounded">
        <h2 className="text-xl mb-2">API Response:</h2>
        <pre className="whitespace-pre-wrap text-sm bg-black p-4 rounded overflow-auto max-h-96">
          {apiResponse || "Click 'Test Wallet API' to see response"}
        </pre>
      </div>
      
      <div className="mt-6 p-4 bg-yellow-900 rounded">
        <h2 className="text-xl mb-2">📋 Instructions:</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>If no token found → Click Clear Storage → Go Home → Login</li>
          <li>After login, come back here and click Test Wallet API</li>
          <li>Check if API returns your balance data</li>
        </ol>
      </div>
    </div>
  );
}
