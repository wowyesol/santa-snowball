"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Snowball } from "@/lib/supabase";

interface GeminiHighlightBannerProps {
  snowball?: Snowball | null;
  subtitle?: string;
}

/**
 * [강조 수정사항] Gemini 가입 인증 +100장 특별 하이라이트 배너 (S04, S06 공용)
 * - 일반 반투명 흰색 카드와 확연히 구분되도록 골드/민트/네이비 그라데이션 배경과
 *   빛나는 골드 테두리, 강조 뱃지를 적용하여 시선을 집중시킵니다.
 * - 중간 안내 팝업(P01) 없이 배너 클릭 즉시 S08(/verify) Gemini 가입 인증 화면으로 직행합니다.
 */
export default function GeminiHighlightBanner({
  snowball,
  subtitle = "스노우볼 업그레이드 해보세요 · 레벨 +1",
}: GeminiHighlightBannerProps) {
  const router = useRouter();

  const isApproved =
    snowball?.gemini_verified || snowball?.gemini_status === "승인";
  const isPending =
    snowball?.gemini_status === "심사중" || snowball?.gemini_status === "대기중";

  const handleBannerClick = () => {
    // 중간 안내 팝업(P01) 없이 클릭 즉시 S08(/verify) 화면으로 직행
    router.push("/verify");
  };

  return (
    <button
      type="button"
      onClick={handleBannerClick}
      className="group relative w-full p-[2px] rounded-2xl bg-gradient-to-r from-amber-300 via-emerald-300 to-sky-400 shadow-[0_0_20px_rgba(251,191,36,0.35)] hover:shadow-[0_0_26px_rgba(52,211,153,0.5)] active:scale-[0.99] transition-all text-left"
    >
      <div className="w-full h-auto rounded-[14px] bg-gradient-to-r from-[#0F2442] via-[#163862] to-[#1A4977] px-3.5 py-3.5 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* 빛나는 Gemini 아이콘 박스 */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-300 via-teal-200 to-sky-300 text-[#0B1528] flex flex-col items-center justify-center shrink-0 shadow-md">
            <span className="text-sm font-black leading-none">✦</span>
            <span className="text-[9px] font-black tracking-tighter mt-0.5">
              +100
            </span>
          </div>

          <div className="min-w-0 flex-1 break-keep">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="inline-block px-2 py-0.5 rounded-full bg-amber-300 text-[#0B1528] text-[9px] font-black tracking-tight">
                SPECIAL BONUS
              </span>
              {isPending && (
                <span className="inline-block px-2 py-0.5 rounded-full bg-sky-400/20 border border-sky-300/40 text-sky-200 text-[9px] font-bold">
                  심사 중
                </span>
              )}
              {isApproved && (
                <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-emerald-200 text-[9px] font-bold">
                  승인 완료
                </span>
              )}
            </div>
            <p className="text-[13px] font-extrabold text-white leading-snug break-keep">
              Gemini 가입 인증 시 응모권{" "}
              <span className="text-amber-300">+100장</span>
            </p>
            <p className="text-[11px] text-emerald-200/90 leading-snug mt-0.5 break-keep">
              {subtitle}
            </p>
          </div>
        </div>

        <span className="shrink-0 w-7 h-7 rounded-full bg-white/15 group-hover:bg-amber-300 group-hover:text-[#0B1528] text-amber-200 flex items-center justify-center text-xs font-black transition-colors">
          →
        </span>
      </div>
    </button>
  );
}
