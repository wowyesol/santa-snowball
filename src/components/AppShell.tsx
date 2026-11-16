"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AuthSnowballState,
  clearPendingInviteSlug,
  consumeFlashToast,
  getCurrentAuthAndSnowball,
  getSnowballLevelInfo,
  isSigningOut,
  logPageViewOncePerSession,
  runSelfHealingSlugCleanup,
  signOutAll,
  supabase,
} from "@/lib/supabase";

interface AppShellProps {
  children: React.ReactNode;
  hideDeadlineBanner?: boolean;
  hideFooter?: boolean;
  useStageBackground?: boolean;
}

// 페이지 이동 간에도 배경음악(/bgm.mp3)이 절대 끊기거나 처음부터 다시 시작되지 않도록 유지하는 전역 오디오 싱글톤
let globalBgmAudio: HTMLAudioElement | null = null;
let globalBgmMuted = false;

function getOrCreateGlobalBgm(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!globalBgmAudio) {
    const existing = document.getElementById(
      "santa-global-bgm"
    ) as HTMLAudioElement | null;
    if (existing) {
      globalBgmAudio = existing;
    } else {
      const audio = document.createElement("audio");
      audio.id = "santa-global-bgm";
      audio.src = "/bgm.mp3";
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = 0.35;
      audio.style.display = "none";
      document.body.appendChild(audio);
      globalBgmAudio = audio;
    }
  }
  globalBgmAudio.volume = 0.35;
  return globalBgmAudio;
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
  useStageBackground = false,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [auth, setAuth] = useState<AuthSnowballState | null>(null);
  const [isSavingPhoto, setIsSavingPhoto] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(globalBgmMuted);
  const [isOwnLinkMode, setIsOwnLinkMode] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const syncHeader = useCallback(async () => {
    if (isSigningOut()) return;
    if (typeof window !== "undefined") {
      runSelfHealingSlugCleanup(pathname);
      const params = new URLSearchParams(window.location.search);
      setIsOwnLinkMode(params.get("mode") === "own-link");
    }
    const current = await getCurrentAuthAndSnowball();
    if (isSigningOut()) return;
    setAuth(current);
    // 메인 사이트 최초 진입 시 세션당 1회 'page_view' 기록 (/admin 제외, sessionStorage 중복 방지)
    if (pathname !== "/admin") {
      logPageViewOncePerSession(current.snowball?.slug ?? null);
    }
  }, [pathname]);

  // 배경음악(/bgm.mp3) 마운트 시 자동 재생 시도 & 브라우저 정책 대기 시 첫 터치/클릭 즉시 재생
  // + 크롬 앱 이탈/탭 전환/화면 잠금(visibilitychange, pagehide, blur, unmount) 시 즉시 일시정지 처리
  useEffect(() => {
    if (typeof window === "undefined" || pathname === "/admin") return;

    const audio = getOrCreateGlobalBgm();
    if (!audio) return;

    setIsMuted(globalBgmMuted);
    audio.muted = globalBgmMuted;

    // 백그라운드 미디어 컨트롤(잠금화면/알림창 재생바)이 남지 않도록 MediaSession 정리 헬퍼
    const clearMediaSession = () => {
      if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
        try {
          navigator.mediaSession.metadata = null;
          navigator.mediaSession.playbackState = "none";
          navigator.mediaSession.setActionHandler("play", null);
          navigator.mediaSession.setActionHandler("pause", null);
          navigator.mediaSession.setActionHandler("stop", null);
        } catch {
          // 일부 브라우저 미지원 액션 무시
        }
      }
    };

    const pauseBgmImmediately = () => {
      audio.pause();
      clearMediaSession();
    };

    const tryPlayBgm = () => {
      if (globalBgmMuted) return;
      if (
        typeof document !== "undefined" &&
        (document.hidden || document.visibilityState !== "visible")
      ) {
        return;
      }
      audio.volume = 0.35;
      audio.muted = false;
      if (audio.paused) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              clearMediaSession();
            })
            .catch(() => {
              // 첫 사용자 인터랙션 대기
            });
        }
      }
    };

    // 1) 마운트 즉시 재생 시도
    tryPlayBgm();

    // 2) 화면 아무 곳이나 처음 한 번 터치/클릭하는 즉시 음악 재생 (사용자가 수동 음소거한 경우는 제외)
    const handleFirstInteraction = () => {
      if (globalBgmMuted) return;
      tryPlayBgm();
      if (!audio.paused) {
        window.removeEventListener("pointerdown", handleFirstInteraction);
        window.removeEventListener("touchstart", handleFirstInteraction);
        window.removeEventListener("click", handleFirstInteraction);
      }
    };

    // 3) 탭 전환 / 홈 화면 이동 / 화면 잠금 / 창 포커스 이탈 시 즉시 정지, 복귀 시(수동 음소거가 아니면) 재개
    const handleVisibilityChange = () => {
      if (document.hidden || document.visibilityState !== "visible") {
        pauseBgmImmediately();
      } else if (!globalBgmMuted) {
        tryPlayBgm();
      }
    };

    const handleWindowBlur = () => {
      pauseBgmImmediately();
    };

    const handleWindowFocus = () => {
      if (
        !globalBgmMuted &&
        !document.hidden &&
        document.visibilityState === "visible"
      ) {
        tryPlayBgm();
      }
    };

    const handlePageHide = () => {
      pauseBgmImmediately();
    };

    window.addEventListener("pointerdown", handleFirstInteraction, {
      passive: true,
    });
    window.addEventListener("touchstart", handleFirstInteraction, {
      passive: true,
    });
    window.addEventListener("click", handleFirstInteraction, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);

    return () => {
      window.removeEventListener("pointerdown", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
      window.removeEventListener("click", handleFirstInteraction);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
      pauseBgmImmediately();
    };
  }, [pathname]);

  // 우측 상단 초소형 음소거 버튼 토글 핸들러
  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = getOrCreateGlobalBgm();
    const nextMuted = !globalBgmMuted;
    globalBgmMuted = nextMuted;
    setIsMuted(nextMuted);

    if (!audio) return;
    if (nextMuted) {
      audio.muted = true;
      audio.pause();
    } else {
      audio.volume = 0.35;
      audio.muted = false;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    }
  };

  // 상단 헤더 [📷 사진 저장] 클릭 시: 원본 배경 이미지(bgImg.naturalWidth x bgImg.naturalHeight) 비율 그대로
  // 상단 타이틀([닉네임]의\n스노우볼) + 스노우볼(가로 폭의 88%, 하단 5% 지점 착지) + 눈송이를 그려 PNG로 즉시 저장
  const handleSaveSnowballPhoto = async () => {
    const sb = auth?.snowball;
    if (!sb || isSavingPhoto) return;
    setIsSavingPhoto(true);

    try {
      if (typeof document !== "undefined" && document.fonts?.ready) {
        await document.fonts.ready;
      }

      const levelInfo = getSnowballLevelInfo(sb.level);
      const loadImage = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new window.Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = (err) => reject(err);
          img.src = src;
        });

      const [bgImg, snowballImg] = await Promise.all([
        loadImage("/bg-night-snow.png?v=2"),
        loadImage(levelInfo.imageSrc),
      ]);

      // 1) 원본 배경 이미지(/bg-night-snow.png)의 실제 원본 가로·세로 크기 그대로 캔버스 생성
      const canvasW = bgImg.naturalWidth || 941;
      const canvasH = bgImg.naturalHeight || 1672;
      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context를 생성할 수 없습니다.");

      ctx.drawImage(bgImg, 0, 0, canvasW, canvasH);

      // 2) 상단 타이틀: 웹 화면과 동일한 위치 비율(상단에서 약 13% 지점)에 '[닉네임]의\n스노우볼' 그리기
      ctx.save();
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(26, 30, 67, 0.38)";
      ctx.shadowBlur = Math.round(canvasW * 0.015);
      ctx.shadowOffsetY = Math.round(canvasW * 0.004);

      const titleFontSize1 = Math.round(canvasW * 0.08);
      const titleFontSize2 = Math.round(canvasW * 0.058);
      const titleY1 = Math.round(canvasH * 0.13);
      const titleY2 = titleY1 + Math.round(canvasW * 0.086);

      ctx.font = `800 ${titleFontSize1}px "HakgyoansimDunggeunmisoTTF-B", "Gowun Dodum", sans-serif`;
      ctx.fillText(`${sb.nickname}의`, canvasW * 0.5, titleY1);

      ctx.font = `700 ${titleFontSize2}px "HakgyoansimDunggeunmisoTTF-B", "Gowun Dodum", sans-serif`;
      ctx.fillText("스노우볼", canvasW * 0.5, titleY2);
      ctx.restore();

      // 3) 스노우볼 크기 및 위치: 웹 화면처럼 큼직하게 캔버스 가로 폭의 88% 크기로 그리고,
      //    받침대 하단이 원본 배경 이미지의 흰 눈언덕 바닥(캔버스 맨 아래에서 약 5% 위 지점)에 착지하도록 배치
      const snowballW = Math.round(canvasW * 0.88);
      const aspect =
        snowballImg.naturalWidth > 0
          ? snowballImg.naturalHeight / snowballImg.naturalWidth
          : 1375 / 1144;
      const snowballH = Math.round(snowballW * aspect);
      const snowballX = Math.round((canvasW - snowballW) / 2);
      const bottomMargin = Math.round(canvasH * 0.048);
      const snowballY = canvasH - bottomMargin - snowballH;

      ctx.drawImage(snowballImg, snowballX, snowballY, snowballW, snowballH);

      // 4) 유리구 내부 눈가루 입자(SnowballGraphic과 동일한 top 4%, left 11%, width 78% 원형 영역) 그리기
      const globeLeft = snowballX + snowballW * 0.11;
      const globeTop = snowballY + snowballH * 0.04;
      const globeDiameter = snowballW * 0.78;
      const globeRadius = globeDiameter * 0.5 - 4;
      const globeCenterX = globeLeft + globeDiameter * 0.5;
      const globeCenterY = globeTop + globeDiameter * 0.5;

      ctx.save();
      ctx.beginPath();
      ctx.arc(globeCenterX, globeCenterY, globeRadius, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = "#FFFFFF";

      const scaleFactor = globeDiameter / 300;
      const totalFlakes = 120;
      for (let i = 0; i < totalFlakes; i++) {
        const ratio = (i + 0.5) / totalFlakes;
        const r = Math.sqrt(ratio) * (globeRadius - 6);
        const theta = i * 2.399963229728653 + ((i % 7) - 3) * 0.09;
        const fx = globeCenterX + Math.cos(theta) * r;
        const fy = globeCenterY + Math.sin(theta) * r;

        const isAccent = i < 18;
        const baseR =
          (isAccent ? 1.2 + (i % 5) * 0.11 : 0.5 + (i % 4) * 0.1) * scaleFactor;
        const stretch = 0.8 + (i % 5) * 0.08;
        const rx = baseR * stretch;
        const ry = baseR * (2 - stretch);
        const rot = (i * 1.17) % (Math.PI * 2);

        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      // 5) PNG 파일 다운로드
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `santa-snowball-${sb.nickname || "my"}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("[사진 저장 오류]", err);
    } finally {
      setIsSavingPhoto(false);
    }
  };

  useEffect(() => {
    syncHeader();

    // 이미 로그인된 유저가 현재 URL에 명시적인 ?sb=[targetSlug] 파라미터를 달고 접속한 경우에만 1회 이동 처리 (스토리지 영구 저장 금지)
    async function enforceInviteRedirect() {
      if (
        typeof window === "undefined" ||
        isSigningOut() ||
        pathname === "/" ||
        pathname === "/login" ||
        pathname === "/auth/callback"
      ) {
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const sbFromUrl = params.get("sb")?.trim() || null;
      if (!sbFromUrl) return;

      const current = await getCurrentAuthAndSnowball();
      if (isSigningOut()) return;
      if (current.isAuthenticated && current.snowball) {
        clearPendingInviteSlug();
        if (sbFromUrl !== current.snowball.slug) {
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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      if (!isSigningOut()) {
        syncHeader();
      }
    });

    window.addEventListener("santa-auth-changed", syncHeader);
    window.addEventListener("santa-toast", checkToast);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener("santa-auth-changed", syncHeader);
      window.removeEventListener("santa-toast", checkToast);
    };
  }, [syncHeader, router, pathname]);

  const homeHref = auth?.snowball
    ? `/snowball/${encodeURIComponent(auth.snowball.slug)}`
    : "/";

  const showBackButton = Boolean(pathname && SUB_ROUTES.has(pathname));

  // 상단 경품 응모 띠배너 노출 조건: 서브 페이지에서는 숨기고 오직 메인 스노우볼 화면(기본 홈 '/' 및 '/snowball/[slug]')에서만 노출
  const isMainSnowballRoute = Boolean(
    pathname === "/" || (pathname && pathname.startsWith("/snowball/"))
  );
  const shouldShowTopRaffleBanner = !hideDeadlineBanner && isMainSnowballRoute;

  // [📷 사진 저장] 버튼 노출 조건: 오직 로그인한 본인의 '내 스노우볼 메인 화면(S04)'에서만 노출
  const decodedPathname = pathname ? decodeURIComponent(pathname) : "";
  const isMySnowballMainPage = Boolean(
    auth?.isAuthenticated &&
      auth?.snowball &&
      decodedPathname === `/snowball/${auth.snowball.slug}` &&
      !isOwnLinkMode
  );

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
                className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-[11px] font-extrabold text-center leading-none transition-colors shrink-0"
                aria-label="이전 화면으로 이동"
              >
                이전
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

          <div className="flex items-center gap-2 shrink-0">
            {/* 오직 로그인한 본인의 '내 스노우볼 메인 화면(S04)'에서만 [📷 사진 저장] 버튼 노출 */}
            {isMySnowballMainPage && (
              <button
                type="button"
                onClick={handleSaveSnowballPhoto}
                disabled={isSavingPhoto}
                className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-[#FCEED8] text-[#2C2F63] text-[11px] font-extrabold shadow-xs hover:bg-white active:scale-95 transition-all shrink-0 disabled:opacity-60"
              >
                {isSavingPhoto ? "저장 중..." : "📷 사진 저장"}
              </button>
            )}

            {/* 초소형 원형 음소거 토글 버튼 (28px, #2C2F63 남색 배경 + 흰색 선형 스피커 SVG 아이콘) */}
            <button
              type="button"
              onClick={handleToggleMute}
              aria-label={isMuted ? "배경음악 켜기" : "배경음악 끄기"}
              title={isMuted ? "배경음악 켜기" : "배경음악 끄기"}
              className="w-7 h-7 rounded-full bg-[#2C2F63] border border-white/20 text-white/85 hover:text-white flex items-center justify-center shadow-2xs active:scale-95 transition-all shrink-0"
            >
              {isMuted ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              )}
            </button>
          </div>
        </header>

        {/* 2) 상단 경품 응모 띠배너: 오직 메인 스노우볼 화면('/', '/snowball/[slug]') 상단에만 노출 -> 클릭 시 /raffle 이동 */}
        {shouldShowTopRaffleBanner && (
          <Link
            href="/raffle"
            aria-label="친구랑 편지 주고받고 상품권 응모하기"
            className="w-full bg-[#FCEDD7] hover:bg-[#F7E3C6] active:opacity-95 px-3 py-2 flex items-center justify-between gap-2 transition-colors select-none"
          >
            {/* 좌측 브랜드 앱 아이콘 3종 (배달의민족 · MUSINSA · 신세계) */}
            <div className="flex items-center gap-[5px] shrink-0">
              <span className="w-[clamp(27px,7.5vw,32px)] h-[clamp(27px,7.5vw,32px)] rounded-[8px] bg-[#62E6DC] overflow-hidden flex items-center justify-center shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={encodeURI("/배민로고.png")}
                  alt="배달의민족"
                  className="w-full h-full object-cover scale-[1.12]"
                />
              </span>
              <span className="w-[clamp(27px,7.5vw,32px)] h-[clamp(27px,7.5vw,32px)] rounded-[8px] bg-black overflow-hidden flex items-center justify-center shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={encodeURI("/무신사로고.png")}
                  alt="MUSINSA"
                  className="w-full h-full object-cover"
                />
              </span>
              <span className="w-[clamp(27px,7.5vw,32px)] h-[clamp(27px,7.5vw,32px)] rounded-[8px] bg-white overflow-hidden flex items-center justify-center shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={encodeURI("/신세계로고.png")}
                  alt="신세계"
                  className="w-full h-full object-contain"
                />
              </span>
            </div>

            {/* 중앙 문구 (프로젝트 메인 타이틀 동글 디스플레이 폰트 + 진한 밤하늘 남색 #1B224B) */}
            <span
              style={{
                fontFamily:
                  '"HakgyoansimDunggeunmisoTTF-B", "Cafe24Ssurround", "Gowun Dodum", sans-serif',
              }}
              className="flex-1 text-center font-display font-extrabold text-[clamp(11.5px,3.35vw,14px)] tracking-[-0.02em] text-[#1B224B] leading-none whitespace-nowrap"
            >
              친구랑 편지 주고받고 상품권 응모하기
            </span>

            {/* 우측 원형 화살표 아이콘 (#1B224B 원형 배경 + #FCEDD7 굵은 오른쪽 화살표) */}
            <span
              aria-hidden="true"
              className="w-[clamp(20px,5.4vw,24px)] h-[clamp(20px,5.4vw,24px)] rounded-full bg-[#1B224B] inline-flex items-center justify-center shrink-0"
            >
              <svg
                className="w-[48%] h-[48%] translate-x-[0.5px]"
                viewBox="0 0 12 12"
                fill="none"
              >
                <path
                  d="M4.25 2.25L8 6L4.25 9.75"
                  stroke="#FCEDD7"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </Link>
        )}

        {/* 3) 본문 컨텐츠 영역:
            /bg-night-snow.png?v=2 이미지를 화면 최상단에 원본 비율 그대로 고정(bg-top bg-no-repeat bg-[length:100%_auto])하고,
            이미지 아래로 이어지는 하단 영역은 #FCEED8 단색으로 경계선 없이 자연스럽게 연장 */}
        <main
          className={
            useStageBackground
              ? "relative flex flex-col bg-[#FCEED8]"
              : "relative flex flex-col min-h-[700px] bg-[#FCEED8] bg-top bg-no-repeat bg-[length:100%_auto]"
          }
          style={
            useStageBackground
              ? undefined
              : {
                  backgroundImage: "url('/bg-night-snow.png?v=2')",
                }
          }
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
