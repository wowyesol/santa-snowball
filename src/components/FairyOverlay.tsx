"use client";

import React, { useEffect, useRef } from "react";

interface FairyOverlayProps {
  active: boolean;
  onWandSparkle: () => void;
  onHideTopUiChange: (hidden: boolean) => void;
  onComplete: () => void;
}

/**
 * 편지 도착(S04) 및 편지 전송 직후(S05) 등장하는 요술봉 요정(fairy.mp4) 투명 캔버스 오버레이
 * - 숨겨진 <video src="/fairy.mp4" muted playsInline> 프레임을 <canvas>에 실시간 렌더링하며
 *   어두운 검은 배경 픽셀(r < 18 && g < 18 && b < 18)은 alpha = 0으로 제거하고,
 *   밝기 18 ~ 45 가장자리 구간은 부드럽게 알파 블렌딩하여 밤하늘 위에 요정과 반짝이만 깨끗하게 표현합니다.
 * - 0초 ~ 3.8초 동안 상단 UI(타이틀, 인증 배지, 받은 편지/레벨 줄)를 숨기고 3.8초 시점에 다시 복구합니다.
 * - 1.65초 지점(요술봉 반짝이 타이밍)에 맞춰 스노우볼 눈보라(Shake) 효과를 자동으로 발동시킵니다.
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

    let rafId = 0;
    let isCancelled = false;
    let sparkleTriggered = false;
    let uiRestored = false;
    let completed = false;

    const finish = () => {
      if (completed || isCancelled) return;
      completed = true;
      if (!uiRestored) {
        uiRestored = true;
        onHideTopUiChangeRef.current(false);
      }
      onCompleteRef.current();
    };

    // 시작 즉시 상단 UI 부드럽게 숨김 (0초 ~ 3.8초)
    onHideTopUiChangeRef.current(true);

    // 영상 재생이 지연되거나 막힐 경우를 대비한 안전 타이머
    const sparkleFallbackTimer = window.setTimeout(() => {
      if (!sparkleTriggered && !isCancelled) {
        sparkleTriggered = true;
        onWandSparkleRef.current();
      }
    }, 1750);

    const restoreUiFallbackTimer = window.setTimeout(() => {
      if (!uiRestored && !isCancelled) {
        uiRestored = true;
        onHideTopUiChangeRef.current(false);
      }
    }, 3850);

    const endFallbackTimer = window.setTimeout(() => {
      finish();
    }, 5400);

    const renderFrame = () => {
      if (isCancelled) return;

      if (video.readyState >= 2) {
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
        if (currentTime >= 1.65 && !sparkleTriggered) {
          sparkleTriggered = true;
          onWandSparkleRef.current();
        }
        if (currentTime >= 3.8 && !uiRestored) {
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
          // 자동 재생이 제한된 환경에서도 타이머 기반으로 눈보라 및 UI 복구가 정상 동작하도록 보장
        });
    } else {
      rafId = window.requestAnimationFrame(renderFrame);
    }

    return () => {
      isCancelled = true;
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
      className="pointer-events-none absolute -top-[120px] sm:-top-[135px] left-1/2 -translate-x-1/2 w-[225px] sm:w-[250px] z-30 flex items-center justify-center select-none"
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        src="/fairy.mp4"
        muted
        playsInline
        preload="auto"
        className="hidden"
      />
      <canvas
        ref={canvasRef}
        className="w-full h-auto object-contain pointer-events-none"
      />
    </div>
  );
}
