"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface MusinsaPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
}

/**
 * P00: 무신사 20만 원 응모하기 팝업 (S01 비로그인 첫 진입 시 자동 노출)
 * - 최상위 뷰포트(document.body) 기준 fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm 구조 적용
 * - 어떤 화면 길이나 스크롤 위치에서도 푸터에 가려지거나 잘리지 않고 정중앙에 온전히 노출됩니다.
 */
export default function MusinsaPopup({
  isOpen,
  onClose,
  onApply,
}: MusinsaPopupProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const modalNode = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="p00-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[345px] max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl text-[#0B1528]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 우측 상단 닫기 버튼 */}
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 py-1 px-1.5"
          >
            <span>닫기</span>
            <span className="text-sm leading-none">✕</span>
          </button>
        </div>

        {/* 무신사 상품권 일러스트 영역 */}
        <div className="w-full h-36 rounded-2xl bg-gradient-to-br from-[#0B1528] via-[#13315C] to-[#1E88E5] text-white flex flex-col items-center justify-center mb-5 shadow-inner">
          <span className="px-2.5 py-0.5 rounded-full bg-amber-300 text-[#0B1528] text-[10px] font-black tracking-tight mb-1.5">
            1등 경품 · 1명
          </span>
          <p className="text-base font-black tracking-tight">
            MUSINSA 200,000원
          </p>
          <p className="text-[11px] text-sky-100/90 mt-0.5">
            무신사 모바일 상품권
          </p>
        </div>

        {/* 타이틀 & 서브 문구 */}
        <div className="text-center mb-5">
          <h2
            id="p00-title"
            className="text-lg font-extrabold text-[#102A4E] tracking-tight mb-1"
          >
            무신사 20만 원 응모하기
          </h2>
          <p className="text-xs text-[#5B7493]">
            친구 스노우볼에 편지 채우고, 나도 편지 받자
          </p>
        </div>

        {/* 하단 파란색 CTA 버튼 */}
        <button
          type="button"
          onClick={onApply}
          className="w-full py-3.5 rounded-xl bg-[#3898FF] hover:bg-[#2589F5] active:scale-[0.99] text-white text-sm font-extrabold transition-all shadow-sm"
        >
          응모하러 가기
        </button>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
}
