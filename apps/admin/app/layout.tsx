import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/noto-sans-sc";
import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "站点运行台 · TikDD Admin",
  description: "TikDD 个人站长的私有运行与发布控制台",
  robots: { index: false, follow: false, nocache: true }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

