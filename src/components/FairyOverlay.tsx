"use client";

import React, { useEffect, useRef } from "react";

interface FairyOverlayProps {
  active: boolean;
  onWandSparkle: () => void;
  onHideTopUiChange: (hidden: boolean) => void;
  onComplete: () => void;
}

/**
 * 편지 도착(S04) 및 편지 전송 직후(S05) 등장하는 요술봉 요정(fairy.mp4?v=3, 길이 2.0초) 투명 캔버스 오버레이
 * - 숨겨진 <video src="/fairy.mp4?v=3" muted playsInline> 프레임을 videoWidth x videoHeight 원본 세로형 비율 그대로 <canvas>에 렌더링하며
 *   어두운 검은 배경 픽셀(r < 18 && g < 18 && b < 18)은 alpha = 0으로 제거하고,
 *   밝기 18 ~ 45 가장자리 구간은 부드럽게 알파 블렌딩하여 밤하늘 위에 요정과 반짝이만 깨끗하게 표현합니다.
 * - 연출 시작 시 무조건 top: 0이 아니라 요정 상단부터 스노우볼 하단 받침대까지 한 화면에 잘림 없이 들어오는 위치(약 top: 70~85px 또는 중앙 정렬 계산값)로 스크롤한 뒤
 *   약 2.0초 동안 스크롤을 일시 잠금(overflow: hidden, touch-action: none)했다가 onEnded(안전 타임아웃 2.15초) 즉시 해제합니다.
 * - 0.55초 지점(요정이 요술봉을 내려 반짝이 가루가 쏟아지는 순간)에 맞춰 스노우볼 눈보라(Shake) 효과를 자동으로 발동시킵니다.
 */
export default function FairyOverlay({
  active,
  onWandSparkle,
  onHideTopUiChange,
  onComplete,
}: FairyOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const onWandSparkleRef = useRef(onWandSparkle);
  const onHideTopUiChangeRef = useRef(onHideTopUiChange);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onWandSparkleRef.current = onWandSparkle;
    onHideTopUiChangeRef.current = onHideTopUiChange;
    onCompleteRef.current = onComplete;
  }, [onWandSparkle, onHideTopUiChange, onComplete]);

  useEffect(() => {
    if (!active) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // 1) 요정 상단 ~ 스노우볼 받침대 바닥 끝까지 한 화면에 잘림 없이 들어오는 최적 스크롤 위치 계산 후 스크롤 잠금
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyTouchAction = document.body.style.touchAction;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevHtmlTouchAction = document.documentElement.style.touchAction;
    let scrollUnlocked = false;

    const unlockScroll = () => {
      if (scrollUnlocked) return;
      scrollUnlocked = true;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.touchAction = prevBodyTouchAction;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.documentElement.style.touchAction = prevHtmlTouchAction;
    };

    try {
      const parentEl = containerRef.current?.parentElement;
      let targetTop = 65;
      if (parentEl && typeof window !== "undefined") {
        const rect = parentEl.getBoundingClientRect();
        const pageTop = rect.top + window.scrollY;
        const pageBottom = rect.bottom + window.scrollY;
        // 요정이 스노우볼 컨테이너 상단 위로 32.5% 올라오므로 전체 연출 영역은 [pageTop - fairyOffset .. pageBottom]
        const fairyOffset = rect.height * 0.325;
        const stageTop = pageTop - fairyOffset;
        const stageBottom = pageBottom + 12;
        const stageCenter = (stageTop + stageBottom) * 0.5;
        // 상단 고정 헤더(약 46px)를 제외한 가시 영역 중앙에 맞춤
        const visibleCenterOffset = (window.innerHeight + 46) * 0.5;
        const idealScroll = Math.round(stageCenter - visibleCenterOffset);
        targetTop = Math.max(0, Math.min(160, idealScroll));
      }
      window.scrollTo({ top: targetTop, behavior: "instant" as ScrollBehavior });
      document.documentElement.scrollTop = targetTop;
      document.body.scrollTop = targetTop;
    } catch {
      window.scrollTo(0, 65);
    }

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.touchAction = "none";

    let rafId = 0;
    let isCancelled = false;
    let sparkleTriggered = false;
    let uiRestored = false;
    let completed = false;

    const finish = () => {
      unlockScroll();
      if (completed || isCancelled) return;
      completed = true;
      if (!uiRestored) {
        uiRestored = true;
        onHideTopUiChangeRef.current(false);
      }
      onCompleteRef.current();
    };

    // 시작 즉시 상단 UI 부드럽게 숨김 (0초 ~ 2.0초)
    onHideTopUiChangeRef.current(true);

    // 0.55초 눈보라 싱크 및 2.0초 종료(안전 타임아웃 2.15초) 타이머
    const sparkleFallbackTimer = window.setTimeout(() => {
      if (!sparkleTriggered && !isCancelled) {
        sparkleTriggered = true;
        onWandSparkleRef.current();
      }
    }, 570);

    const restoreUiFallbackTimer = window.setTimeout(() => {
      if (!uiRestored && !isCancelled) {
        uiRestored = true;
        onHideTopUiChangeRef.current(false);
      }
    }, 2000);

    const endFallbackTimer = window.setTimeout(() => {
      finish();
    }, 2150);

    const renderFrame = () => {
      if (isCancelled) return;

      if (video.readyState >= 2) {
        // 비디오 원본 가로·세로 비율(videoWidth x videoHeight) 그대로 캔버스 해상도 동기화
        const vw = video.videoWidth || 480;
        const vh = video.videoHeight || 640;
        if (canvas.width !== vw || canvas.height !== vh) {
          canvas.width = vw;
          canvas.height = vh;
        }

        ctx.clearRect(0, 0, vw, vh);
        ctx.drawImage(video, 0, 0, vw, vh);

        try {
          const frame = ctx.getImageData(0, 0, vw, vh);
          const data = frame.data;
          const len = data.length;

          for (let i = 0; i < len; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            if (r < 18 && g < 18 && b < 18) {
              data[i + 3] = 0;
            } else {
              const maxC = r > g ? (r > b ? r : b) : (g > b ? g : b);
              if (maxC < 45) {
                data[i + 3] = Math.round(((maxC - 18) / 27) * 255);
              }
            }
          }

          ctx.putImageData(frame, 0, 0);
        } catch {
          // 동일 출처 비디오이므로 정상 처리됨
        }

        const currentTime = video.currentTime;
        // 0.55초 지점: 요정이 요술봉을 내려 반짝이 가루가 쏟아지는 순간 스노우볼 눈보라 발동
        if (currentTime >= 0.55 && !sparkleTriggered) {
          sparkleTriggered = true;
          onWandSparkleRef.current();
        }
        // 영상 종료 시점(약 1.95초 ~ 2.0초) 상단 UI 복귀
        if (currentTime >= 1.95 && !uiRestored) {
          uiRestored = true;
          onHideTopUiChangeRef.current(false);
        }
      }

      if (!video.ended && !completed) {
        rafId = window.requestAnimationFrame(renderFrame);
      }
    };

    const handleEnded = () => {
      finish();
    };

    video.addEventListener("ended", handleEnded);
    video.currentTime = 0;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          if (!isCancelled) {
            rafId = window.requestAnimationFrame(renderFrame);
          }
        })
        .catch(() => {
          // 자동 재생 제한 환경에서도 타이머 기반으로 눈보라, UI 복구 및 스크롤 해제가 정상 동작하도록 보장
        });
    } else {
      rafId = window.requestAnimationFrame(renderFrame);
    }

    return () => {
      isCancelled = true;
      unlockScroll();
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(sparkleFallbackTimer);
      window.clearTimeout(restoreUiFallbackTimer);
      window.clearTimeout(endFallbackTimer);
      video.removeEventListener("ended", handleEnded);
      video.pause();
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute -top-[32.5%] left-1/2 -translate-x-1/2 w-[60%] z-30 flex items-center justify-center select-none"
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        src="/fairy.mp4?v=3"
        muted
        playsInline
        preload="auto"
        className="hidden"
      />
      <canvas
        ref={canvasRef}
        className="w-full h-auto block pointer-events-none"
      />
    </div>
  );
}
