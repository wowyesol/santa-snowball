"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AuthSnowballState,
  consumeFlashToast,
  getCurrentAuthAndSnowball,
  getTicketSummary,
  logPageViewOncePerSession,
  signOutAll,
} from "@/lib/supabase";

interface AppShellProps {
  children: React.ReactNode;
  hideDeadlineBanner?: boolean;
  hideFooter?: boolean;
}

// 상단 좌측에 '< 이전' 버튼을 노출할 서브 화면 경로 목록
const SUB_ROUTES = new Set([
  "/inapp",
  "/login",
  "/raffle",
  "/referral",
  "/referrals",
  "/verify",
  "/gemini-verify",
  "/open",
  "/result",
  "/guide",
]);

/**
 * 공통 모바일 웹 프레임 (390px 표준, 최대 430px 중앙 정렬)
 * - 밤하늘 네이비~블루 수직 그라데이션 배경 (from-[#0B1528] via-[#13315C] to-[#2B6CB0]) + 별빛/눈송이 효과
 * - 최상단 고정 헤더:
 *   · 서브 화면(S02, S06, S07, S08, S10, S11, S12)에서는 좌측에 [< 이전] 버튼 표시 (히스토리 없어도 안전하게 S04 또는 S01로 복귀)
 *   · 좌측 logo.png (클릭 시 내 스노우볼/홈 이동), 우측 비로그인 시 [이벤트 안내] / 로그인 시 [응모권 N장]
 * - 헤더 아래 밝은 파란색(#1E88E5) 마감 안내 띠 배너 고정 표시
 * - 페이지별 콘텐츠 길이에 맞춰 자연스러운 높이를 유지하고(과도한 빈 여백 제거), 본문 바로 아래 하단 공통 푸터가 이어지도록 구성
 */
export default function AppShell({
  children,
  hideDeadlineBanner = false,
  hideFooter = false,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [auth, setAuth] = useState<AuthSnowballState | null>(null);
  const [ticketBadgeCount, setTicketBadgeCount] = useState<number>(0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const syncHeader = useCallback(async () => {
    const current = await getCurrentAuthAndSnowball();
    setAuth(current);
    // 메인 사이트 최초 진입 시 세션당 1회 'page_view' 기록 (/admin 제외, sessionStorage 중복 방지)
    if (pathname !== "/admin") {
      logPageViewOncePerSession(current.snowball?.slug ?? null);
    }
    if (current.snowball) {
      const summary = await getTicketSummary(current.snowball.id);
      setTicketBadgeCount(summary.availableTickets);
    } else {
      setTicketBadgeCount(0);
    }
  }, [pathname]);

  useEffect(() => {
    syncHeader();

    // [핵심 버그 방지] 이미 로그인된 유저가 공유 링크(/?sb=[targetSlug])로 접속했거나,
    // 내 스노우볼 페이지로 잘못 진입했지만 URL에 다른 친구의 sb 파라미터가 남아있는 경우 즉시 친구 스노우볼(S05)로 이동!
    async function enforceInviteRedirect() {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const sbFromUrl = params.get("sb")?.trim() || null;
      if (!sbFromUrl) return;

      window.localStorage.setItem("pending_friend_slug", sbFromUrl);
      const current = await getCurrentAuthAndSnowball();
      if (current.isAuthenticated && current.snowball) {
        if (sbFromUrl !== current.snowball.slug) {
          window.localStorage.removeItem("pending_friend_slug");
          router.replace(`/snowball/${encodeURIComponent(sbFromUrl)}`);
        }
      }
    }
    enforceInviteRedirect();

    // 플래시 토스트(예: "존재하지 않는 스노우볼입니다.") 확인
    const checkToast = () => {
      const msg = consumeFlashToast();
      if (msg) {
        setToastMsg(msg);
        setTimeout(() => {
          setToastMsg((prev) => (prev === msg ? null : prev));
        }, 3500);
      }
    };
    checkToast();

    window.addEventListener("santa-auth-changed", syncHeader);
    window.addEventListener("santa-toast", checkToast);
    return () => {
      window.removeEventListener("santa-auth-changed", syncHeader);
      window.removeEventListener("santa-toast", checkToast);
    };
  }, [syncHeader]);

  const homeHref = auth?.snowball
    ? `/snowball/${encodeURIComponent(auth.snowball.slug)}`
    : "/";

  const showBackButton = Boolean(pathname && SUB_ROUTES.has(pathname));

  /**
   * 상단 [< 이전] 버튼 클릭 핸들러:
   * - S02(/login): S01(/)로 이동 (초대 슬러그가 있으면 보존)
   * - S12(/guide): 로그인 시 내 스노우볼 홈(S04), 비로그인 시 S01(/)로 이동
   * - 그 외 서브 화면(S06, S07, S08, S10, S11): 히스토리가 없더라도 무조건 내 스노우볼 홈(S04)으로 안전하게 이동
   */
  const handleBackNavigation = () => {
    if (pathname === "/login") {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const sb = params.get("sb");
        if (sb) {
          router.push(`/?sb=${encodeURIComponent(sb)}&utm_source=friend`);
          return;
        }
      }
      router.push("/");
      return;
    }

    if (auth?.snowball) {
      router.push(`/snowball/${encodeURIComponent(auth.snowball.slug)}`);
      return;
    }

    router.push("/");
  };

  return (
    <div className="relative w-full max-w-[430px] mx-auto flex flex-col bg-gradient-to-b from-[#0B1528] via-[#13315C] to-[#2B6CB0] text-white shadow-2xl">
      {/* 밤하늘 은은한 눈송이/별빛 파티클 장식 */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden opacity-60"
        aria-hidden="true"
      >
        <span className="absolute top-24 left-8 w-1 h-1 rounded-full bg-white/80 animate-pulse" />
        <span className="absolute top-36 right-10 w-1.5 h-1.5 rounded-full bg-sky-200/70" />
        <span className="absolute top-64 left-6 w-1 h-1 rounded-full bg-white/60" />
        <span className="absolute top-80 right-7 w-1 h-1 rounded-full bg-amber-200/70 animate-pulse" />
        <span className="absolute top-[420px] left-12 w-1.5 h-1.5 rounded-full bg-white/40" />
        <span className="absolute top-[520px] right-12 w-1 h-1 rounded-full bg-white/50" />
      </div>

      {/* 전역 토스트 알림 */}
      {toastMsg && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[80] w-[90%] max-w-[360px] px-4 py-3 rounded-2xl bg-[#0B1528]/95 border border-amber-300/60 text-white text-xs font-bold text-center shadow-2xl animate-bounce">
          ⚠️ {toastMsg}
        </div>
      )}

      {/* 상단 고정 영역 + 본문 (불필요한 빈 여백 밀어내기 없이 콘텐츠 길이에 맞춤) */}
      <div className="relative z-10 flex flex-col">
        {/* 1) 최상단 헤더 */}
        <header className="sticky top-0 z-40 w-full bg-[#152238]/95 backdrop-blur border-b border-white/10 px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {showBackButton && (
              <button
                type="button"
                onClick={handleBackNavigation}
                className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white text-[11px] font-extrabold transition-colors shrink-0"
                aria-label="이전 화면으로 이동"
              >
                <span>‹</span>
                <span>이전</span>
              </button>
            )}

            <Link href={homeHref} className="flex items-center gap-1.5 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="차곡차곡 크리스마스"
                className="h-5 w-auto object-contain"
              />
            </Link>
          </div>

          {auth?.snowball ? (
            <Link
              href="/raffle"
              className="px-3 py-1 rounded-full bg-white text-[#0B1528] text-[11px] font-extrabold shadow-xs hover:bg-sky-50 transition-colors shrink-0"
            >
              응모권 {ticketBadgeCount}장
            </Link>
          ) : (
            <Link
              href="/guide"
              className="px-3 py-1 rounded-full bg-white text-[#0B1528] text-[11px] font-extrabold shadow-xs hover:bg-sky-50 transition-colors shrink-0"
            >
              이벤트 안내
            </Link>
          )}
        </header>

        {/* 2) 마감 안내 띠 배너 (#1E88E5) */}
        {!hideDeadlineBanner && (
          <div className="w-full bg-[#1E88E5] text-white text-center py-2 px-3 text-[11px] font-bold tracking-tight shadow-xs">
            11.28 당첨자 공개 · 12.1 편지 공개
          </div>
        )}

        {/* 본문 컨텐츠 영역 */}
        <main className="flex flex-col">{children}</main>
      </div>

      {/* 하단 공통 푸터 */}
      {!hideFooter && (
        <footer className="relative z-10 w-full bg-[#E8F2FF] text-[#5B7493] py-6 px-4 flex flex-col items-center text-center gap-2 border-t border-white/40">
          <div className="inline-flex items-center gap-1 px-4 py-1 rounded-full bg-white border border-[#90B8E8] text-[11px] font-extrabold text-[#0B1528] shadow-2xs">
            <span>Built with</span>
            <span className="text-[#1E88E5]">Gemini</span>
          </div>

          <div className="text-[11px] font-medium text-[#5B7493] space-x-1.5">
            <Link href="/guide" className="hover:underline">
              이벤트 안내 · 유의사항
            </Link>
            <span>|</span>
            <Link href="/guide#privacy" className="hover:underline">
              개인정보 처리방침
            </Link>
            {auth?.isAuthenticated && (
              <>
                <span>|</span>
                <button
                  type="button"
                  onClick={async () => {
                    await signOutAll();
                    router.push("/");
                  }}
                  className="hover:underline text-[#7A93B2]"
                >
                  로그아웃
                </button>
              </>
            )}
          </div>

          <p className="text-[10px] text-[#7A93B2]">
            2026 Google Student Ambassador · 성신여대
          </p>
        </footer>
      )}
    </div>
  );
}
