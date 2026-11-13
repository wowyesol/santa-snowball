import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://santa-snowball.vercel.app";
const DEFAULT_TITLE = "차곡차곡 크리스마스 | 산타보다 빠른 우편함";
const DEFAULT_DESCRIPTION =
  "친구들과 따뜻한 연말 편지를 나누고 크리스마스 선물에도 응모해 보세요!";
const DEFAULT_OG_IMAGE = `${SITE_URL}/api/og?v=4`;

// 루트 페이지 기본 메타데이터(Metadata) 및 Open Graph 설정
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  openGraph: {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    siteName: "차곡차곡 크리스마스",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: DEFAULT_TITLE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased min-h-screen bg-[#121530]">
        {children}
      </body>
    </html>
  );
}
