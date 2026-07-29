import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "@fontsource-variable/vazirmatn/wght.css";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_DASHBOARD_URL || "https://agent.wallettracker.app"),
  title: "والت سوشال · مرکز مدیریت شبکه اجتماعی",
  description: "داشبورد فارسی مدیریت محتوا و پاسخ‌گویی هوشمند Wallet Tracker",
  icons: {
    icon: [{ url: "/brand/wallet-tracker-browser-icon.png", type: "image/png", sizes: "64x64" }],
    shortcut: "/brand/wallet-tracker-browser-icon.png",
    apple: "/brand/wallet-tracker-x-avatar-400.png",
  },
  openGraph: {
    title: "Wallet Tracker · Post. Reply. Done.",
    description: "مسیر ساده و مرحله‌به‌مرحله اپراتور برای انتشار پست و پاسخ‌گویی.",
    url: "/",
    siteName: "Wallet Tracker Social Operations",
    locale: "fa_IR",
    type: "website",
    images: [{ url: "/og-operator-v1.png", width: 1731, height: 909, alt: "Wallet Tracker operator workflow" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Wallet Tracker · Post. Reply. Done.",
    description: "مسیر ساده و مرحله‌به‌مرحله اپراتور برای انتشار پست و پاسخ‌گویی.",
    images: ["/og-operator-v1.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body
        className={`${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
