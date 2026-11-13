"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AuthSnowballState,
  consumeFlashToast,
  getCurrentAuthAndSnowball,
  getSnowballLevelInfo,
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
  const [isSavingPhoto, setIsSavingPhoto] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const syncHeader = useCallback(async () => {
    const current = await getCurrentAuthAndSnowball();
    setAuth(current);
    // 메인 사이트 최초 진입 시 세션당 1회 'page_view' 기록 (/admin 제외, sessionStorage 중복 방지)
    if (pathname !== "/admin") {
      logPageViewOncePerSession(current.snowball?.slug ?? null);
    }
  }, [pathname]);

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

          {auth?.snowball ? (
            <button
              type="button"
              onClick={handleSaveSnowballPhoto}
              disabled={isSavingPhoto}
              className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-[#FCEED8] text-[#2C2F63] text-[11px] font-extrabold shadow-xs hover:bg-white active:scale-95 transition-all shrink-0 disabled:opacity-60"
            >
              {isSavingPhoto ? "저장 중..." : "📷 사진 저장"}
            </button>
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
