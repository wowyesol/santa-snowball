"use client";

import React from "react";
import { Letter, getSnowballLevelInfo } from "@/lib/supabase";

interface SnowballGraphicProps {
  level?: number;
  overrideImageSrc?: string;
  letters?: Letter[];
  isShaking?: boolean;
  showShakeBadge?: boolean;
  size?: "md" | "lg";
}

interface IdleFlake {
  id: number;
  left: string;
  sizePx: number;
  durationSec: number;
  delaySec: number;
  opacity: number;
  swayPx: number;
}

interface BurstFlake {
  id: number;
  left: string;
  top: string;
  sizePx: number;
  durationSec: number;
  delaySec: number;
  swayPx: number;
}

// [1단계: 평상시 기본 상태 (Idle)]
// 동그란 유리구슬 영역 안에서 2px~4px 크기, 투명도 50~80%의 작은 흰색 눈송이 14개가
// 6~10초 주기로 천천히 살랑살랑 흔들리며 내려가는 상시 애니메이션 데이터
const IDLE_FLAKES: IdleFlake[] = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  left: `${8 + ((i * 19) % 82)}%`,
  sizePx: 2 + (i % 3), // 2px ~ 4px
  durationSec: 6.2 + ((i * 7) % 38) / 10, // 6.2s ~ 9.9s
  delaySec: -((i * 1.3) % 8.5), // 음수 딜레이로 진입 즉시 자연스럽게 분포
  opacity: 0.52 + ((i * 5) % 29) / 100, // 0.52 ~ 0.80
  swayPx: (i % 2 === 0 ? 1 : -1) * (5 + (i % 6)),
}));

// [2단계: 흔들기 클릭 상태 (Shaking)]
// 크고 선명한 흰색 동그란 함박눈 입자(4px~9px 크기) 56개가 빠르고 역동적으로 쏟아지며 휘날리는 연출 데이터
const BURST_FLAKES: BurstFlake[] = Array.from({ length: 56 }, (_, i) => ({
  id: i,
  left: `${4 + ((i * 17) % 90)}%`,
  top: `${-12 + ((i * 13) % 35)}%`,
  sizePx: 4 + (i % 6), // 4px ~ 9px
  durationSec: 0.85 + ((i * 11) % 85) / 100, // 0.85s ~ 1.69s
  delaySec: -((i * 0.19) % 1.1),
  swayPx: (i % 2 === 0 ? 1 : -1) * (12 + (i % 15)),
}));

/**
 * 스노우볼 중앙 그래픽 컴포넌트 (S01, S04, S05, S10 공통 적용)
 * - public/ 폴더에 저장된 실제 스노우볼 PNG 이미지를 레벨(LV 0 -> 1 -> 3 -> 10)에 맞춰 렌더링
 * - 상단 동그란 유리구슬 영역에만 정확히 겹치는 원형 마스크 레이어
 *   (`absolute top-[2%] left-[8%] w-[84%] aspect-square rounded-full overflow-hidden pointer-events-none`)를 통해
 *   1단계(평상시 잔잔한 눈) ↔ 2단계(흔들기 시 함박눈 폭풍) 연출을 수행합니다.
 */
export default function SnowballGraphic({
  level = 0,
  overrideImageSrc,
  letters = [],
  isShaking = false,
  showShakeBadge = false,
  size = "lg",
}: SnowballGraphicProps) {
  const levelInfo = getSnowballLevelInfo(level);
  const imgSrc = overrideImageSrc || levelInfo.imageSrc;

  // 받은 편지 최대 30개까지 미니 선물 점 표시, 30개 초과 시 +N 뱃지
  const visibleGiftCount = Math.min(letters.length, 30);
  const overflowCount = Math.max(0, letters.length - 30);

  const widthClass = size === "lg" ? "w-[248px]" : "w-[190px]";

  return (
    <div className="relative flex flex-col items-center justify-center my-2 select-none">
      {showShakeBadge && (
        <div className="mb-1.5 px-3 py-0.5 rounded-full bg-[#3898FF] text-white text-[10px] font-bold shadow-sm">
          흔들림 모션
        </div>
      )}

      <div
        className={`relative ${widthClass} ${
          isShaking ? "animate-snowball-shake" : "transition-transform duration-300"
        }`}
      >
        {/* 실제 스노우볼 이미지 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={levelInfo.tierLabel}
          className="w-full h-auto object-contain drop-shadow-[0_14px_28px_rgba(0,0,0,0.4)]"
        />

        {/* ================================================================
            동그란 유리구슬 영역 내부 원형 마스크 레이어
            하단 우체통 받침대(POST) 밖으로는 눈이 절대 삐져나가지 않도록 마스킹
           ================================================================ */}
        <div
          className="absolute top-[2%] left-[8%] w-[84%] aspect-square rounded-full overflow-hidden pointer-events-none z-10"
          aria-hidden="true"
        >
          {/* 1단계: 평상시(Idle) 상시 살랑살랑 내리는 잔잔한 눈송이 (14개, 2~4px, 6~10초) */}
          {IDLE_FLAKES.map((flake) => (
            <span
              key={`idle-${flake.id}`}
              style={
                {
                  left: flake.left,
                  top: "-6%",
                  width: `${flake.sizePx}px`,
                  height: `${flake.sizePx}px`,
                  "--snow-opacity": flake.opacity,
                  "--snow-sway": `${flake.swayPx}px`,
                  animation: `snowballIdleFall ${flake.durationSec}s ease-in-out ${flake.delaySec}s infinite`,
                } as React.CSSProperties
              }
              className="absolute rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)]"
            />
          ))}

          {/* 2단계: 흔들기 클릭 상태(isShaking)일 때 펑펑 쏟아지는 함박눈 입자 (56개, 4~9px) */}
          {isShaking &&
            BURST_FLAKES.map((flake) => (
              <span
                key={`burst-${flake.id}`}
                style={
                  {
                    left: flake.left,
                    top: flake.top,
                    width: `${flake.sizePx}px`,
                    height: `${flake.sizePx}px`,
                    "--snow-sway": `${flake.swayPx}px`,
                    animation: `snowballBurstFall ${flake.durationSec}s ease-in-out ${flake.delaySec}s infinite`,
                  } as React.CSSProperties
                }
                className="absolute rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.95)]"
              />
            ))}
        </div>

        {/* 받은 편지가 있을 때 트리 하단 눈밭에 작은 선물 상자 아이콘 중첩 표시 */}
        {visibleGiftCount > 0 && (
          <div className="absolute bottom-[33%] inset-x-[18%] flex flex-wrap items-center justify-center gap-1 pointer-events-none z-20">
            {Array.from({ length: Math.min(visibleGiftCount, 8) }).map((_, i) => (
              <span
                key={i}
                className="w-4 h-4 rounded-[3px] bg-amber-300/95 border border-red-500 text-[9px] flex items-center justify-center shadow-xs"
              >
                🎁
              </span>
            ))}
            {(visibleGiftCount > 8 || overflowCount > 0) && (
              <span className="px-1.5 py-0.5 rounded-full bg-[#0B1528]/85 border border-white/40 text-white text-[9px] font-extrabold">
                +{letters.length - Math.min(visibleGiftCount, 8)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
