import type { Metadata } from "next";
import "./globals.css";

// 페이지 메타데이터(Metadata) 설정
export const metadata: Metadata = {
  title: "산타보다 빠른 우체국 | 차곡차곡 크리스마스",
  description: "로그인하고 친구 스노우볼에 선물 채우고, 나도 선물 받자!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased min-h-screen bg-[#070E1C]">
        {children}
      </body>
    </html>
  );
}
