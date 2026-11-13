"use client";

import React, { useEffect, useRef } from "react";
import { Letter, getSnowballLevelInfo } from "@/lib/supabase";

interface SnowballGraphicProps {
  level?: number;
  overrideImageSrc?: string;
  letters?: Letter[];
  isShaking?: boolean;
  showShakeBadge?: boolean;
  size?: "md" | "lg";
}

interface SnowParticle {
  isReserve: boolean; // 평소 바닥 대기 입자 여부 (흔들 때 바닥에서 솟구치며 합류)
  alpha: number; // 상시 입자는 항상 1, 바닥 대기 입자는 평소 0 -> 흔들 때 1 -> 가라앉을 때 0
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseVy: number;
  rx: number; // 초소형 미세 눈가루 반지름 (0.45px ~ 0.9px, 지름 기준 약 0.9px ~ 1.8px)
  ry: number;
  rot: number;
  rotSpeed: number;
  phase: number;
  freq: number;
  amp: number;
  lobeFactor: number;
}

const IDLE_PARTICLE_COUNT = 120;
const RESERVE_PARTICLE_COUNT = 135;

/**
 * 스노우볼 중앙 그래픽 컴포넌트 (S01, S04, S05, S10 공통 적용)
 * - 모바일 화면(360px~430px)에서 좌우 여백을 최소화하고 화면 중심에 시원하게 꽉 차도록
 *   w-[92vw] max-w-[385px] sm:max-w-[420px] 크기로 대폭 확대했습니다.
 * - ResizeObserver를 통해 스노우볼 이미지 크기가 커진 비율에 맞춰 <canvas> 크기와 원형 반경이 1:1로 정확히 동기화됩니다.
 * - 기본 초소형 미세 눈가루(반지름 0.45px ~ 0.9px)를 유지하면서, 눈송이 개수를 120개로 늘리고
 *   약간 더 큰 포인트 눈송이(반지름 1.15px ~ 1.7px)를 일부 섞어 입체감을 살렸습니다.
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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isShakingRef = useRef<boolean>(isShaking);
  const shakeEnergyRef = useRef<number>(0);
  const triggerBurstRef = useRef<boolean>(false);

  useEffect(() => {
    if (isShaking && !isShakingRef.current) {
      triggerBurstRef.current = true;
      shakeEnergyRef.current = 1.0;
    }
    isShakingRef.current = isShaking;
  }, [isShaking]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId = 0;
    let width = 310;
    let height = 310;
    let centerX = 155;
    let centerY = 155;
    let globeRadius = 152;

    // 유리구 바닥(눈언덕 경계선 부근) 좌표 생성 헬퍼
    const getFloorPosition = () => {
      const spreadX = (Math.random() * 2 - 1) * (globeRadius * 0.78);
      const x = centerX + spreadX;
      const maxBottomY =
        centerY +
        Math.sqrt(Math.max(0, globeRadius * globeRadius - spreadX * spreadX));
      // 유리구 하단 눈언덕 영역(바닥 원호에서 4~24px 위쪽)에 대기
      const y = maxBottomY - (4 + Math.random() * 20);
      return { x, y };
    };

    const createParticle = (
      isReserve: boolean,
      randomY = true,
      isAccent = false
    ): SnowParticle => {
      // 기본 초소형 미세 눈가루(반지름 0.45px ~ 0.9px) + 일부 약간 더 큰 포인트 눈송이(반지름 1.15px ~ 1.7px)
      const radius = isAccent
        ? 1.15 + Math.random() * 0.55
        : 0.45 + Math.random() * 0.45;
      const stretch = 0.78 + Math.random() * 0.44;
      const rx = radius * stretch;
      const ry = radius * (2 - stretch);

      let x = centerX;
      let y = centerY;

      if (isReserve) {
        const floorPos = getFloorPosition();
        x = floorPos.x;
        y = floorPos.y;
      } else if (randomY) {
        const r = Math.sqrt(Math.random()) * (globeRadius - 4);
        const theta = Math.random() * Math.PI * 2;
        x = centerX + Math.cos(theta) * r;
        y = centerY + Math.sin(theta) * r;
      } else {
        const spreadX = (Math.random() * 2 - 1) * (globeRadius * 0.88);
        x = centerX + spreadX;
        const maxTopY =
          centerY -
          Math.sqrt(Math.max(0, globeRadius * globeRadius - spreadX * spreadX));
        y = maxTopY + 2 + Math.random() * 8;
      }

      return {
        isReserve,
        alpha: isReserve ? 0 : 1,
        x,
        y,
        vx: (Math.random() - 0.5) * 0.22,
        vy: 0.2 + Math.random() * 0.34,
        baseVy: 0.2 + Math.random() * 0.34,
        rx,
        ry,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.03,
        phase: Math.random() * Math.PI * 2,
        freq: 0.015 + Math.random() * 0.025,
        amp: 0.1 + Math.random() * 0.2,
        lobeFactor: (Math.random() - 0.5) * 0.25,
      };
    };

    const particles: SnowParticle[] = [];

    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const prevWidth = width;
        const prevHeight = height;
        width = rect.width;
        height = rect.height;

        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        centerX = width * 0.5;
        centerY = height * 0.5;
        globeRadius = Math.min(width, height) * 0.5 - 2;

        // 캔버스 크기가 변경될 때 기존 입자들의 좌표도 새 원형 반경 비율에 맞게 1:1 스케일링
        if (particles.length > 0 && prevWidth > 0 && prevHeight > 0) {
          const scaleX = width / prevWidth;
          const scaleY = height / prevHeight;
          for (let i = 0; i < particles.length; i++) {
            particles[i].x *= scaleX;
            particles[i].y *= scaleY;
          }
        }
      }
    };

    updateCanvasSize();
    // 1) 상시 내리는 눈송이 (120개: 기본 미세 눈가루 + 약 18개의 조금 더 큰 포인트 눈송이 혼합)
    for (let i = 0; i < IDLE_PARTICLE_COUNT; i++) {
      const isAccent = i < 18;
      particles.push(createParticle(false, true, isAccent));
    }
    // 2) 바닥에 대기하다가 흔들 때 바닥에서 솟구쳐 오르는 추가 눈송이 (135개: 기본 미세 눈가루 + 약 20개의 포인트 눈송이 혼합)
    for (let i = 0; i < RESERVE_PARTICLE_COUNT; i++) {
      const isAccent = i < 20;
      particles.push(createParticle(true, false, isAccent));
    }

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        updateCanvasSize();
      });
      resizeObserver.observe(canvas);
    }
    window.addEventListener("resize", updateCanvasSize);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      if (triggerBurstRef.current) {
        triggerBurstRef.current = false;
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          if (p.isReserve) {
            const floorPos = getFloorPosition();
            p.x = floorPos.x;
            p.y = floorPos.y;
            const upAngle = -Math.PI * (0.12 + Math.random() * 0.76);
            const speed = 4.2 + Math.random() * 7.4;
            p.vx = Math.cos(upAngle) * speed + (Math.random() - 0.5) * 2.8;
            p.vy = Math.sin(upAngle) * speed;
            p.rotSpeed = (Math.random() - 0.5) * 0.14;
          } else {
            const angle = Math.random() * Math.PI * 2;
            const speed = 3.2 + Math.random() * 6.8;
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed - Math.random() * 1.6;
            p.rotSpeed = (Math.random() - 0.5) * 0.14;
          }
        }
      }

      const energy = shakeEnergyRef.current;
      if (energy > 0.004) {
        shakeEnergyRef.current *= 0.968;
      } else {
        shakeEnergyRef.current = 0;
      }

      ctx.fillStyle = "#FFFFFF";

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (p.isReserve) {
          if (energy > 0.14) {
            p.alpha = Math.min(1, p.alpha + 0.12);
          } else {
            p.alpha = Math.max(0, p.alpha - 0.025);
          }
          if (p.alpha <= 0.01) {
            continue;
          }
        }

        p.phase += p.freq;

        if (energy > 0.02) {
          p.vx += (Math.random() - 0.5) * 1.45 * energy;
          p.vy += (Math.random() - 0.5) * 1.45 * energy;
          p.vx *= 0.945;
          p.vy = p.vy * 0.945 + p.baseVy * (1 - energy) * 0.06;
        } else {
          const targetVx =
            Math.sin(p.phase) * p.amp + (Math.random() - 0.5) * 0.07;
          p.vx += (targetVx - p.vx) * 0.08;
          p.vy += (p.baseVy - p.vy) * 0.06 + (Math.random() - 0.5) * 0.02;
          p.rotSpeed *= 0.98;
        }

        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.rotSpeed;

        // 유리구 원형 경계 충돌 및 순환 처리
        const dx = p.x - centerX;
        const dy = p.y - centerY;
        const distSq = dx * dx + dy * dy;
        const maxR = globeRadius - 2;

        if (distSq > maxR * maxR) {
          if (energy > 0.06 || p.isReserve) {
            const dist = Math.sqrt(distSq) || 1;
            const nx = dx / dist;
            const ny = dy / dist;
            p.x = centerX + nx * (maxR - 1.5);
            p.y = centerY + ny * (maxR - 1.5);

            const dot = p.vx * nx + p.vy * ny;
            const scatter = (Math.random() - 0.5) * 0.9;
            const rvx = (p.vx - 1.75 * dot * nx) * 0.7;
            const rvy = (p.vy - 1.75 * dot * ny) * 0.7;
            p.vx = rvx * Math.cos(scatter) - rvy * Math.sin(scatter);
            p.vy = rvx * Math.sin(scatter) + rvy * Math.cos(scatter);
          } else {
            const respawned = createParticle(false, false);
            p.x = respawned.x;
            p.y = respawned.y;
            p.vx = respawned.vx;
            p.vy = respawned.baseVy;
          }
        }

        ctx.save();
        if (p.isReserve && p.alpha < 1) {
          ctx.globalAlpha = p.alpha;
        }
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.rx, p.ry, 0, 0, Math.PI * 2);
        ctx.ellipse(
          p.rx * p.lobeFactor,
          p.ry * p.lobeFactor,
          p.rx * 0.85,
          p.ry * 0.88,
          0.4,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
      }

      animationFrameId = window.requestAnimationFrame(render);
    };

    animationFrameId = window.requestAnimationFrame(render);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener("resize", updateCanvasSize);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // 모바일 화면(360px~430px)에서 좌우 패딩 제한을 넘어 화면에 꽉 차도록 최대 크기 확대
  const widthClass =
    size === "lg"
      ? "w-[92vw] max-w-[385px] sm:w-[400px] sm:max-w-[420px]"
      : "w-[78vw] max-w-[290px] sm:w-[300px]";

  return (
    <div className="relative flex flex-col items-center justify-center -mx-4 select-none">
      {showShakeBadge && (
        <div className="mb-1 px-3 py-1 rounded-full bg-[#2C2F63] border border-white/25 text-white text-[10px] font-extrabold leading-none shadow-sm">
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
          className="w-full h-auto object-contain drop-shadow-[0_14px_28px_rgba(26,30,67,0.36)]"
        />

        {/* 스노우볼 이미지 크기에 1:1 비율로 정확히 동기화되는 원형 유리구 눈가루 캔버스 */}
        <div
          className="absolute top-[4%] left-[11%] w-[78%] aspect-square rounded-full overflow-hidden pointer-events-none z-10"
          aria-hidden="true"
        >
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>
      </div>
    </div>
  );
}
