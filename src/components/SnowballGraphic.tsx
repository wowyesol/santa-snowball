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
  widthPx: number;
  heightPx: number;
  borderRadius: string;
  durationSec: number;
  delaySec: number;
  swayPx: number;
  rotStart: number;
  rotEnd: number;
}

interface SwirlFlake {
  id: number;
  left: string;
  top: string;
  widthPx: number;
  heightPx: number;
  borderRadius: string;
  dx1: number;
  dy1: number;
  dx2: number;
  dy2: number;
  dx3: number;
  dy3: number;
  dx4: number;
  dy4: number;
  dxEnd: number;
  dyEnd: number;
}

// 손그림 크레용/조약돌 느낌의 비정형 테두리(border-radius) 패턴 목록
const PEBBLE_RADII = [
  "58% 42% 63% 37% / 45% 55% 45% 55%",
  "44% 56% 39% 61% / 57% 41% 59% 43%",
  "64% 36% 52% 48% / 42% 62% 38% 58%",
  "49% 51% 62% 38% / 63% 44% 56% 37%",
  "37% 63% 55% 45% / 48% 54% 46% 52%",
  "61% 39% 44% 56% / 53% 38% 62% 47%",
];

// [1단계: 평상시 기본 상태 (Idle)]
// 빛 번짐(glow)이나 투명도 변화 없이 100% 불투명한 순백색(#FFFFFF) 작은 크레용 눈송이 조각(3.5~5.5px)이
// 유리구슬 안에서 잔잔하고 포근하게 살랑거리며 내려오는 데이터
const IDLE_FLAKES: IdleFlake[] = Array.from({ length: 18 }, (_, i) => {
  const baseW = 3.5 + (i % 3) * 0.9; // 3.5px ~ 5.3px
  const baseH = 3.2 + ((i + 1) % 3) * 0.85; // 살짝 비대칭 조약돌 비율
  return {
    id: i,
    left: `${9 + ((i * 17) % 80)}%`,
    widthPx: Number(baseW.toFixed(1)),
    heightPx: Number(baseH.toFixed(1)),
    borderRadius: PEBBLE_RADII[i % PEBBLE_RADII.length],
    durationSec: 5.8 + ((i * 7) % 36) / 10, // 5.8s ~ 9.3s
    delaySec: -((i * 1.15) % 8.2), // 진입 즉시 구슬 전체에 고르게 분포
    swayPx: (i % 2 === 0 ? 1 : -1) * (5 + (i % 6)),
    rotStart: (i * 23) % 90 - 45,
    rotEnd: ((i * 23) % 90 - 45) + (i % 2 === 0 ? 40 : -40),
  };
});

// [2단계: 흔들었을 때 (Shake)]
// 평소의 작은 불투명 눈송이 크기(3.5~5.3px)와 조약돌 모양을 그대로 유지한 채,
// 개수가 풍성해지며 상하좌우·대각선으로 자유롭게 소용돌이치듯 흩날리다가 서서히 가라앉는 데이터
const SWIRL_FLAKES: SwirlFlake[] = Array.from({ length: 40 }, (_, i) => {
  const baseW = 3.5 + (i % 3) * 0.9;
  const baseH = 3.2 + ((i + 2) % 3) * 0.85;
  const dirX = i % 2 === 0 ? 1 : -1;
  const dirY = i % 3 === 0 ? -1 : 1;
  return {
    id: i,
    left: `${12 + ((i * 19) % 76)}%`,
    top: `${12 + ((i * 23) % 68)}%`,
    widthPx: Number(baseW.toFixed(1)),
    heightPx: Number(baseH.toFixed(1)),
    borderRadius: PEBBLE_RADII[(i + 2) % PEBBLE_RADII.length],
    dx1: dirX * (22 + ((i * 11) % 32)),
    dy1: -1 * (18 + ((i * 13) % 34)), // 흔드는 순간 위로 솟구치며 확산
    dx2: -dirX * (20 + ((i * 17) % 36)),
    dy2: dirY * (16 + ((i * 7) % 28)),
    dx3: dirX * (16 + ((i * 13) % 28)),
    dy3: -dirY * (14 + ((i * 9) % 24)),
    dx4: -dirX * (10 + ((i * 7) % 18)),
    dy4: 12 + (i % 16),
    dxEnd: dirX * (4 + (i % 8)),
    dyEnd: 36 + ((i * 5) % 28), // 마지막에 잔잔하게 아래로 가라앉음
  };
});

/**
 * 스노우볼 중앙 그래픽 컴포넌트 (S01, S04, S05, S10 공통 적용)
 * - public/ 폴더에 저장된 새 크레용 동화 스노우볼 일러스트(lv0, lv1, lv3)를 렌더링합니다.
 * - 선물 상자 아이콘 중첩 표시를 완전히 제거하여 일러스트 본연의 감성을 깔끔하게 유지합니다.
 * - 유리구슬 내부 원형 마스크 영역 안에서 100% 불투명(#FFFFFF) 비정형 조약돌 모양 눈송이가
 *   평소에는 잔잔하게 내리고, 흔들었을 때는 같은 크기의 작은 눈송이들이 사방으로 휘날리다 가라앉습니다.
 */
export default function SnowballGraphic({
  level = 0,
  overrideImageSrc,
  isShaking = false,
  showShakeBadge = false,
  size = "lg",
}: SnowballGraphicProps) {
  const levelInfo = getSnowballLevelInfo(level);
  const imgSrc = overrideImageSrc || levelInfo.imageSrc;

  const widthClass = size === "lg" ? "w-[254px]" : "w-[196px]";

  return (
    <div className="relative flex flex-col items-center justify-center my-2 select-none">
      {showShakeBadge && (
        <div className="mb-1.5 px-3 py-0.5 rounded-full bg-[#2C2F63] border border-white/25 text-white text-[10px] font-extrabold shadow-sm">
          흔들림 모션
        </div>
      )}

      <div
        className={`relative ${widthClass} ${
          isShaking ? "animate-snowball-shake" : "transition-transform duration-300"
        }`}
      >
        {/* 실제 스노우볼 일러스트 이미지 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={levelInfo.tierLabel}
          className="w-full h-auto object-contain drop-shadow-[0_12px_24px_rgba(26,30,67,0.35)]"
        />

        {/* ================================================================
            동그란 유리구슬 영역 내부 원형 마스크 레이어
            하단 우체통 받침대(POST) 밖으로는 눈이 절대 삐져나가지 않도록 마스킹
           ================================================================ */}
        <div
          className="absolute top-[4%] left-[11%] w-[78%] aspect-square rounded-full overflow-hidden pointer-events-none z-10"
          aria-hidden="true"
        >
          {/* 1단계: 평상시(Idle) 상시 살랑살랑 내리는 100% 불투명 손그림 눈송이 조각 */}
          {IDLE_FLAKES.map((flake) => (
            <span
              key={`idle-${flake.id}`}
              style={
                {
                  left: flake.left,
                  top: "-6%",
                  width: `${flake.widthPx}px`,
                  height: `${flake.heightPx}px`,
                  borderRadius: flake.borderRadius,
                  backgroundColor: "#FFFFFF",
                  "--snow-sway": `${flake.swayPx}px`,
                  "--snow-rot-start": `${flake.rotStart}deg`,
                  "--snow-rot-end": `${flake.rotEnd}deg`,
                  animation: `snowballIdleFall ${flake.durationSec}s linear ${flake.delaySec}s infinite`,
                } as React.CSSProperties
              }
              className="absolute block"
            />
          ))}

          {/* 2단계: 흔들기 클릭 상태(isShaking)일 때 동일한 작은 불투명 눈송이들이 사방으로 휘날리다 가라앉음 */}
          {isShaking &&
            SWIRL_FLAKES.map((flake) => (
              <span
                key={`swirl-${flake.id}`}
                style={
                  {
                    left: flake.left,
                    top: flake.top,
                    width: `${flake.widthPx}px`,
                    height: `${flake.heightPx}px`,
                    borderRadius: flake.borderRadius,
                    backgroundColor: "#FFFFFF",
                    "--dx1": `${flake.dx1}px`,
                    "--dy1": `${flake.dy1}px`,
                    "--dx2": `${flake.dx2}px`,
                    "--dy2": `${flake.dy2}px`,
                    "--dx3": `${flake.dx3}px`,
                    "--dy3": `${flake.dy3}px`,
                    "--dx4": `${flake.dx4}px`,
                    "--dy4": `${flake.dy4}px`,
                    "--dx-end": `${flake.dxEnd}px`,
                    "--dy-end": `${flake.dyEnd}px`,
                    animation:
                      "snowballShakeSwirl 1.8s cubic-bezier(0.22, 0.61, 0.36, 1) forwards",
                  } as React.CSSProperties
                }
                className="absolute block"
              />
            ))}
        </div>
      </div>
    </div>
  );
}
