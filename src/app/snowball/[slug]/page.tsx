import React from "react";
import type { Metadata } from "next";
import SnowballDetailClient from "@/components/SnowballDetailClient";
import { getSnowballBySlug } from "@/lib/supabase";

const SITE_URL = "https://santa-snowball.vercel.app";
const DEFAULT_TITLE = "차곡차곡 크리스마스 | 산타보다 빠른 우편함";
const DEFAULT_DESCRIPTION =
  "친구들과 따뜻한 연말 편지를 나누고 크리스마스 선물에도 응모해 보세요!";
const DEFAULT_OG_IMAGE = `${SITE_URL}/api/og?v=3`;

interface SnowballDetailPageProps {
  params?: Promise<{ slug: string }> | { slug: string };
}

/**
 * 스노우볼 상세 페이지(/snowball/[slug]) 동적 Open Graph 메타데이터 생성
 * - slug 파라미터로 Supabase snowballs 테이블에서 유저의 nickname과 level을 조회하여
 *   카카오톡 · 인스타그램 DM 미리보기 제목/설명/썸네일을 동적으로 설정합니다.
 */
export async function generateMetadata({
  params,
}: SnowballDetailPageProps): Promise<Metadata> {
  const resolvedParams = await Promise.resolve(params);
  const slug = decodeURIComponent(resolvedParams?.slug || "").trim();

  if (slug) {
    const snowball = await getSnowballBySlug(slug);
    if (snowball) {
      const shareTitle = `${snowball.nickname}님에게 편지를 보내주세요 | 차곡차곡 크리스마스`;
      const shareDescription = `${snowball.nickname}님의 스노우볼에 따뜻한 연말 편지를 남기면 응모권이 차곡차곡 쌓여요!`;
      const ogImageUrl = `${SITE_URL}/api/og?level=${encodeURIComponent(
        String(snowball.level ?? 0)
      )}&v=3`;

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

export default function SnowballDetailPage() {
  return <SnowballDetailClient />;
}
