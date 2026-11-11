"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface MusinsaPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
}

/**
 * P00: 무신사 팝업 (/popup.png 통이미지 + 하단 '편지쓰러 가기' 버튼)
 * - 최상위 뷰포트(document.body) 기준 fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm 구조 적용
 * - 기존의 모든 제목/설명 텍스트를 제거하고 /popup.png 이미지를 비율 깨짐 없이 꽉 차게 렌더링한 뒤 하단 버튼만 배치합니다.
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
      aria-label="이벤트 안내 팝업"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[350px] max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-3.5 shadow-2xl text-[#0B1528] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 우측 상단 닫기 버튼 (이미지 위에 겹치거나 상단에 깔끔하게 배치) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="팝업 닫기"
          className="absolute top-5 right-5 z-10 inline-flex items-center gap-1 rounded-full bg-black/55 hover:bg-black/75 text-white text-xs font-bold py-1 px-2.5 backdrop-blur-xs transition-colors"
        >
          <span>닫기</span>
          <span className="text-xs leading-none">✕</span>
        </button>

        {/* 통이미지 영역 (/popup.png) */}
        <div className="w-full rounded-2xl overflow-hidden mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/popup.png"
            alt="차곡차곡 크리스마스 이벤트 안내"
            className="w-full h-auto object-contain block rounded-2xl"
          />
        </div>

        {/* 하단 파란색 CTA 버튼: '편지쓰러 가기' */}
        <button
          type="button"
          onClick={onApply}
          className="w-full py-3.5 rounded-xl bg-[#3898FF] hover:bg-[#2589F5] active:scale-[0.99] text-white text-sm font-extrabold transition-all shadow-sm"
        >
          편지쓰러 가기
        </button>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
}
