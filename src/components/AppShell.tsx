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
 * - 새 배경 이미지 (/bg-night-snow.png?v=2)는 무조건 화면 최상단에 원본 비율 그대로 고정 (bg-top bg-no-repeat bg-[length:100%_auto])
 * - 스크롤이 길어지거나 이미지 아래쪽으로 이어지는 모든 하단 배경 영역은 #FCEED8 단색으로 채워 경계선 없이 자연스럽게 연장
 * - 하단 #FCEED8 밝은 눈밭 영역 위의 텍스트 및 푸터는 짙은 남색(#2C2F63) 계열로 선명한 가독성 확보
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

    // 이미 로그인된 유저가 공유 링크(/?sb=[targetSlug])로 접속한 경우 즉시 친구 스노우볼(S05)로 이동
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

    // 플래시 토스트 확인
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
  }, [syncHeader, router]);

  const homeHref = auth?.snowball
    ? `/snowball/${encodeURIComponent(auth.snowball.slug)}`
    : "/";

  const showBackButton = Boolean(pathname && SUB_ROUTES.has(pathname));

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
    <div className="relative w-full max-w-[430px] mx-auto flex flex-col bg-[#FCEED8] text-white shadow-2xl overflow-x-hidden">
      {/* 전역 토스트 알림 */}
      {toastMsg && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[80] w-[90%] max-w-[360px] px-4 py-3 rounded-2xl bg-[#2C2F63] border border-[#FCEED8]/60 text-white text-xs font-extrabold text-center shadow-2xl animate-bounce">
          ⚠️ {toastMsg}
        </div>
      )}

      {/* 상단 고정 헤더 + 마감 안내 배너 + 크레용 밤하늘·눈언덕 배경 본문 */}
      <div className="relative z-10 flex flex-col">
        {/* 1) 최상단 헤더 */}
        <header className="sticky top-0 z-40 w-full bg-[#1A1E43]/95 backdrop-blur border-b border-white/10 px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {showBackButton && (
              <button
                type="button"
                onClick={handleBackNavigation}
                className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white text-[11px] font-extrabold transition-colors shrink-0"
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
              className="px-3 py-1 rounded-full bg-[#FCEED8] text-[#2C2F63] text-[11px] font-extrabold shadow-xs hover:bg-white transition-colors shrink-0"
            >
              응모권 {ticketBadgeCount}장
            </Link>
          ) : (
            <Link
              href="/guide"
              className="px-3 py-1 rounded-full bg-[#FCEED8] text-[#2C2F63] text-[11px] font-extrabold shadow-xs hover:bg-white transition-colors shrink-0"
            >
              이벤트 안내
            </Link>
          )}
        </header>

        {/* 2) 마감 안내 띠 배너 (#2C2F63 크레용 남색 톤) */}
        {!hideDeadlineBanner && (
          <div className="w-full bg-[#2C2F63] text-[#FCEED8] text-center py-2 px-3 text-[11px] font-extrabold tracking-tight border-b border-white/10 shadow-xs">
            11.28 당첨자 공개 · 12.1 편지 공개
          </div>
        )}

        {/* 3) 본문 컨텐츠 영역:
            /bg-night-snow.png?v=2 이미지를 화면 최상단에 원본 비율 그대로 고정(bg-top bg-no-repeat bg-[length:100%_auto])하고,
            이미지 아래로 이어지는 하단 영역은 #FCEED8 단색으로 경계선 없이 자연스럽게 연장 */}
        <main
          className="relative flex flex-col min-h-[700px] bg-[#FCEED8] bg-top bg-no-repeat bg-[length:100%_auto]"
          style={{
            backgroundImage: "url('/bg-night-snow.png?v=2')",
          }}
        >
          <div className="relative z-10 flex flex-col flex-1">{children}</div>
        </main>
      </div>

      {/* 하단 공통 푸터: 눈밭 단색(#FCEED8)과 경계선 없이 이어지며 짙은 남색(#2C2F63) 텍스트로 가독성 확보 */}
      {!hideFooter && (
        <footer className="relative z-10 w-full bg-[#FCEED8] text-[#2C2F63] pt-3 pb-7 px-4 flex flex-col items-center text-center gap-2">
          <div className="inline-flex items-center gap-1 px-4 py-1 rounded-full bg-white/90 border border-[#2C2F63]/20 text-[11px] font-extrabold text-[#2C2F63] shadow-2xs">
            <span>Built with</span>
            <span className="text-[#2C2F63] underline decoration-[#2C2F63]/40">
              Gemini
            </span>
          </div>

          <div className="text-[11px] font-extrabold text-[#2C2F63] space-x-1.5">
            <Link href="/guide" className="hover:underline">
              이벤트 안내 · 유의사항
            </Link>
            <span className="opacity-40">|</span>
            <Link href="/guide#privacy" className="hover:underline">
              개인정보 처리방침
            </Link>
            {auth?.isAuthenticated && (
              <>
                <span className="opacity-40">|</span>
                <button
                  type="button"
                  onClick={async () => {
                    await signOutAll();
                    router.push("/");
                  }}
                  className="hover:underline text-[#2C2F63]/80"
                >
                  로그아웃
                </button>
              </>
            )}
          </div>

          <p className="text-[10px] font-bold text-[#2C2F63]/70">
            2026 Google Student Ambassador · 성신여대
          </p>
        </footer>
      )}
    </div>
  );
}
