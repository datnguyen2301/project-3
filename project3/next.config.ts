import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Proxy configuration for backend API
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
