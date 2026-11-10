import React, { Suspense } from "react";
import type { Metadata } from "next";
import LandingView from "@/components/LandingView";
import { getSnowballBySlug } from "@/lib/supabase";

const SITE_URL = "https://santa-snowball.vercel.app";
const DEFAULT_TITLE = "차곡차곡 크리스마스 | 산타보다 빠른 우편함";
const DEFAULT_DESCRIPTION =
  "친구들과 따뜻한 연말 편지를 나누고 크리스마스 선물에도 응모해 보세요!";
const DEFAULT_OG_IMAGE = `${SITE_URL}/api/og`;

interface HomePageProps {
  searchParams?:
    | Promise<{ [key: string]: string | string[] | undefined }>
    | { [key: string]: string | string[] | undefined };
}

/**
 * 일반 웹사이트 주소(/)와 친구 스노우볼 공유 링크(/?sb=[slug]&utm_source=friend)의
 * 카카오톡 · 인스타그램 DM 미리보기(Open Graph / Twitter Card)를 동적으로 분기합니다.
 */
export async function generateMetadata({
  searchParams,
}: HomePageProps): Promise<Metadata> {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const rawSb = resolvedSearchParams?.sb;
  const sbSlug = (Array.isArray(rawSb) ? rawSb[0] : rawSb)?.trim() || null;

  if (sbSlug) {
    const snowball = await getSnowballBySlug(sbSlug);
    if (snowball) {
      const shareTitle = `${snowball.nickname}님에게 편지를 보내주세요 | 차곡차곡 크리스마스`;
      const shareDescription = `${snowball.nickname}님의 스노우볼에 따뜻한 연말 편지를 남기면 응모권이 차곡차곡 쌓여요!`;
      const ogImageUrl = `${SITE_URL}/api/og?level=${encodeURIComponent(
        String(snowball.level ?? 0)
      )}`;

      return {
        title: shareTitle,
        description: shareDescription,
        openGraph: {
          title: shareTitle,
          description: shareDescription,
          url: `${SITE_URL}/?sb=${encodeURIComponent(
            snowball.slug
          )}&utm_source=friend`,
          siteName: "차곡차곡 크리스마스",
          locale: "ko_KR",
          type: "website",
          images: [
            {
              url: ogImageUrl,
              width: 1200,
              height: 630,
              alt: shareTitle,
            },
          ],
        },
        twitter: {
          card: "summary_large_image",
          title: shareTitle,
          description: shareDescription,
          images: [ogImageUrl],
        },
      };
    }
  }

  return {
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
}

/**
 * S01 메인 랜딩 페이지 (Next.js App Router 엔트리 페이지)
 * useSearchParams()를 사용하는 클라이언트 컴포넌트를 Suspense 경계(Boundary)로 감싸 렌더링합니다.
 */
export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-[390px] min-h-screen bg-white flex items-center justify-center text-xs text-neutral-400">
          로딩 중...
        </div>
      }
    >
      <LandingView />
    </Suspense>
  );
}
