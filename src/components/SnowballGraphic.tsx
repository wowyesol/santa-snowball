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
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseVy: number;
  rx: number; // 가로 반지름 (지름 1.5px ~ 3.2px -> 반지름 0.75px ~ 1.6px)
  ry: number; // 세로 반지름 (살짝 찌그러진 비대칭 손그림 점 비율)
  rot: number; // 회전 각도 (rad)
  rotSpeed: number;
  phase: number;
  freq: number;
  amp: number;
  lobeFactor: number; // 조약돌 형태의 미세 비대칭 계수
}

const PARTICLE_COUNT = 105;

/**
 * 스노우볼 중앙 그래픽 컴포넌트 (S01, S04, S05, S10 공통 적용)
 * 1) 스노우볼 크기 대폭 확대: 모바일(360~430px)에서 중심 오브젝트로 꽉 차게 보이도록 w-[82vw] max-w-[320px] 적용
 * 2) <canvas> + requestAnimationFrame 기반 무작위(Random) 물리 눈송이 엔진:
 *    - 지름 1.5px ~ 3.2px 수준의 아주 작은 100% 불투명 순백색(#FFFFFF) 비정형 손그림 점 105개
 *    - 평소: 미세한 좌우 랜덤 노이즈와 함께 잔잔하게 낙하
 *    - 흔들었을 때(isShaking): 모든 입자에 각각 완전히 다른 무작위 각도·속도의 초기 가속도(vx, vy) 및
 *      프레임별 미세 난류(random jitter)를 부여해 사방으로 흩날리다가 서서히 감속하며 잔잔한 낙하로 복귀
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

  // isShaking 상태가 true로 바뀔 때마다 각 입자에 무작위 폭발 가속도 트리거 신호 전달
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
    let width = 260;
    let height = 260;
    let centerX = 130;
    let centerY = 130;
    let globeRadius = 126;

    const createParticle = (randomY = true): SnowParticle => {
      // 지름 1.5px ~ 3.2px -> 반지름 0.75px ~ 1.6px
      const diameter = 1.5 + Math.random() * 1.7;
      const baseRadius = diameter * 0.5;
      // 정원이 아닌 살짝 찌그러진 손그림 점 형태 (비대칭 rx, ry)
      const stretch = 0.76 + Math.random() * 0.48;
      const rx = baseRadius * stretch;
      const ry = baseRadius * (2 - stretch);

      // 원형 유리구 내부에 고르게 분포하도록 극좌표/직교좌표 생성
      let x = centerX;
      let y = centerY;
      if (randomY) {
        const r = Math.sqrt(Math.random()) * (globeRadius - 4);
        const theta = Math.random() * Math.PI * 2;
        x = centerX + Math.cos(theta) * r;
        y = centerY + Math.sin(theta) * r;
      } else {
        // 상단에서 새로 내려오는 입자
        const spreadX = (Math.random() * 2 - 1) * (globeRadius * 0.88);
        x = centerX + spreadX;
        const maxTopY =
          centerY -
          Math.sqrt(Math.max(0, globeRadius * globeRadius - spreadX * spreadX));
        y = maxTopY + 2 + Math.random() * 10;
      }

      return {
        x,
        y,
        vx: (Math.random() - 0.5) * 0.25,
        vy: 0.22 + Math.random() * 0.36,
        baseVy: 0.22 + Math.random() * 0.36,
        rx,
        ry,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.03,
        phase: Math.random() * Math.PI * 2,
        freq: 0.015 + Math.random() * 0.025,
        amp: 0.12 + Math.random() * 0.22,
        lobeFactor: (Math.random() - 0.5) * 0.28,
      };
    };

    const particles: SnowParticle[] = [];

    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        width = rect.width;
        height = rect.height;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      centerX = width * 0.5;
      centerY = height * 0.5;
      globeRadius = Math.min(width, height) * 0.5 - 2;
    };

    updateCanvasSize();
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(createParticle(true));
    }

    const handleResize = () => {
      updateCanvasSize();
    };
    window.addEventListener("resize", handleResize);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 흔들기 시작 순간: 모든 입자에 완전히 다른 무작위 각도와 속도의 초기 가속도 부여
      if (triggerBurstRef.current) {
        triggerBurstRef.current = false;
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const angle = Math.random() * Math.PI * 2;
          const speed = 3.2 + Math.random() * 6.8;
          p.vx = Math.cos(angle) * speed;
          p.vy = Math.sin(angle) * speed - Math.random() * 1.8;
          p.rotSpeed = (Math.random() - 0.5) * 0.14;
        }
      }

      const energy = shakeEnergyRef.current;
      if (energy > 0.005) {
        // 흔들리는 동안 서서히 에너지가 감쇠 (약 1.8초 동안 활발히 흩날린 뒤 안착)
        shakeEnergyRef.current *= 0.968;
      } else {
        shakeEnergyRef.current = 0;
      }

      // 블러·빛번짐·투명도 없이 100% 불투명한 순백색(#FFFFFF) 고정
      ctx.fillStyle = "#FFFFFF";

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.phase += p.freq;

        if (energy > 0.02) {
          // 흔들리는 상태: 프레임별 무작위 난류(random jitter) + 공기 저항 감속
          p.vx += (Math.random() - 0.5) * 1.45 * energy;
          p.vy += (Math.random() - 0.5) * 1.45 * energy;
          p.vx *= 0.945;
          p.vy = p.vy * 0.945 + p.baseVy * (1 - energy) * 0.06;
        } else {
          // 평소 상태: 미세한 좌우 랜덤 노이즈 + 잔잔한 낙하 속도로 자연스럽게 수렴
          const targetVx =
            Math.sin(p.phase) * p.amp + (Math.random() - 0.5) * 0.08;
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
          if (energy > 0.08) {
            // 흔들리는 중에는 유리구 벽면을 타고 안쪽으로 무작위 각도로 튕겨 들어옴
            const dist = Math.sqrt(distSq) || 1;
            const nx = dx / dist;
            const ny = dy / dist;
            p.x = centerX + nx * (maxR - 1.5);
            p.y = centerY + ny * (maxR - 1.5);

            const dot = p.vx * nx + p.vy * ny;
            const scatter = (Math.random() - 0.5) * 0.9;
            const rvx = (p.vx - 1.75 * dot * nx) * 0.72;
            const rvy = (p.vy - 1.75 * dot * ny) * 0.72;
            p.vx = rvx * Math.cos(scatter) - rvy * Math.sin(scatter);
            p.vy = rvx * Math.sin(scatter) + rvy * Math.cos(scatter);
          } else {
            // 평소 상태에서는 바닥에 닿은 눈송이를 유리구 상단 랜덤 위치로 재배치
            const respawned = createParticle(false);
            p.x = respawned.x;
            p.y = respawned.y;
            p.vx = respawned.vx;
            p.vy = respawned.baseVy;
          }
        }

        // 살짝 찌그러진 비정형 손그림 조약돌 점 그리기 (100% 불투명 #FFFFFF)
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.rx, p.ry, 0, 0, Math.PI * 2);
        // 미세한 비대칭 보조 원을 살짝 겹쳐 정원이 아닌 손그림 크레용 점 질감 구현
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
      window.removeEventListener("resize", handleResize);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const widthClass =
    size === "lg"
      ? "w-[82vw] max-w-[320px] sm:w-[320px]"
      : "w-[68vw] max-w-[240px] sm:w-[240px]";

  return (
    <div className="relative flex flex-col items-center justify-center my-1 select-none">
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
          className="w-full h-auto object-contain drop-shadow-[0_14px_28px_rgba(26,30,67,0.36)]"
        />

        {/* 유리구슬 내부 원형 마스크 영역에만 작동하는 무작위 물리 눈송이 캔버스 */}
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
