"use client";

import React, { useEffect, useRef } from "react";

interface FairyOverlayProps {
  active: boolean;
  onWandSparkle: () => void;
  onHideTopUiChange: (hidden: boolean) => void;
  onComplete: () => void;
}

/**
 * 편지 도착(S04) 및 편지 전송 직후(S05) 등장하는 요술봉 요정(fairy.mp4?v=2, 길이 약 2.26초) 투명 캔버스 오버레이
 * - 숨겨진 <video src="/fairy.mp4?v=2" muted playsInline> 프레임을 videoWidth x videoHeight 원본 비율 그대로 <canvas>에 렌더링하며
 *   어두운 검은 배경 픽셀(r < 18 && g < 18 && b < 18)은 alpha = 0으로 제거하고,
 *   밝기 18 ~ 45 가장자리 구간은 부드럽게 알파 블렌딩하여 밤하늘 위에 요정과 반짝이만 깨끗하게 표현합니다.
 * - 연출 시작 즉시 화면 최상단(top: 0)으로 이동하고 약 2.26초 동안 스크롤을 일시 잠금(overflow: hidden, touch-action: none)했다가 종료 즉시 해제합니다.
 * - 0.75초 지점(요정이 요술봉을 내려 반짝이를 뿌리는 순간)에 맞춰 스노우볼 눈보라(Shake) 효과를 자동으로 발동시킵니다.
 * - 영상 종료(약 2.2초 / onEnded) 즉시 숨겨두었던 상단 UI를 부드럽게 복구합니다.
 */
export default function FairyOverlay({
  active,
  onWandSparkle,
  onHideTopUiChange,
  onComplete,
}: FairyOverlayProps) {
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

    // 1) 연출 시작 즉시 화면 최상단으로 이동 및 스크롤 일시 고정(Scroll Lock)
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
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch {
      window.scrollTo(0, 0);
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

    // 시작 즉시 상단 UI 부드럽게 숨김 (0초 ~ 약 2.2초)
    onHideTopUiChangeRef.current(true);

    // 0.75초 눈보라 싱크 및 2.26초 종료/스크롤 해제 안전 타이머
    const sparkleFallbackTimer = window.setTimeout(() => {
      if (!sparkleTriggered && !isCancelled) {
        sparkleTriggered = true;
        onWandSparkleRef.current();
      }
    }, 780);

    const restoreUiFallbackTimer = window.setTimeout(() => {
      if (!uiRestored && !isCancelled) {
        uiRestored = true;
        onHideTopUiChangeRef.current(false);
      }
    }, 2220);

    const endFallbackTimer = window.setTimeout(() => {
      finish();
    }, 2400);

    const renderFrame = () => {
      if (isCancelled) return;

      if (video.readyState >= 2) {
        // 비디오 원본 가로·세로 비율 그대로 캔버스 해상도 동기화
        const vw = video.videoWidth || 480;
        const vh = video.videoHeight || 480;
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
        // 0.75초 지점: 요정이 요술봉을 내려 반짝이를 뿌리는 순간 스노우볼 눈보라 발동
        if (currentTime >= 0.75 && !sparkleTriggered) {
          sparkleTriggered = true;
          onWandSparkleRef.current();
        }
        // 영상 종료 직전(약 2.18초) 상단 UI 복귀
        if (currentTime >= 2.18 && !uiRestored) {
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
          // 자동 재생이 제한된 환경에서도 타이머 기반으로 눈보라, UI 복구 및 스크롤 해제가 정상 동작하도록 보장
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
      className="pointer-events-none absolute -top-[115px] sm:-top-[128px] left-1/2 -translate-x-1/2 w-[195px] sm:w-[215px] z-30 flex items-center justify-center select-none"
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        src="/fairy.mp4?v=2"
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
