import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "@fontsource-variable/vazirmatn/wght.css";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "والت سوشال · مرکز مدیریت شبکه اجتماعی",
  description: "داشبورد فارسی مدیریت محتوا و پاسخ‌گویی هوشمند Wallet Tracker",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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
