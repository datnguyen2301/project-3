import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { BalanceProvider } from "@/contexts/BalanceContext";
import ClientOnly from "@/components/ClientOnly";
import GlobalAlerts from "@/components/GlobalAlerts";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CryptoTrade - Sàn Giao Dịch Crypto",
  description: "Nền tảng giao dịch tiền điện tử an toàn và nhanh chóng",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ClientOnly
          fallback={
            <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          }
        >
          <AuthProvider>
            <BalanceProvider>
              <SettingsProvider>
                <GlobalAlerts>
                  {children}
                </GlobalAlerts>
              </SettingsProvider>
            </BalanceProvider>
          </AuthProvider>
        </ClientOnly>
      </body>
    </html>
  );
}
