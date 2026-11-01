"use client";

import React from "react";

// 팝업 컴포넌트 Props 인터페이스(Interface) 정의
interface MusinsaPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
}

/**
 * S01 첫 화면 - P00 무신사 상품권 응모 팝업(Popup Modal) 컴포넌트
 * 비로그인 상태로 첫 진입 시 화면을 덮도록 노출되며,
 * '닫기' 또는 '응모하러 가기' 버튼 클릭 시 닫히고 기본 화면(또는 로그인 플로우)으로 전환됩니다.
 */
export default function MusinsaPopup({
  isOpen,
  onClose,
  onApply,
}: MusinsaPopupProps) {
  // 팝업이 닫혀있는 상태(State)라면 렌더링하지 않음
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="popup-title"
    >
      {/* 팝업 카드 컨테이너 (모바일 웹 폭에 맞춘 최대 너비 제한) */}
      <div className="w-full max-w-[340px] rounded-2xl bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* 상단 닫기 버튼 영역 */}
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800 transition-colors py-1 px-1.5 rounded"
            aria-label="팝업 닫기"
          >
            <span>닫기</span>
            <span className="text-sm leading-none">✕</span>
          </button>
        </div>

        {/* 무신사 상품권 이미지 플레이스홀더(Placeholder) 영역 */}
        <div className="w-full h-36 rounded-xl border border-dashed border-neutral-300 bg-neutral-100 flex items-center justify-center mb-5">
          <span className="text-xs text-neutral-500 font-medium">
            [무신사 상품권 이미지]
          </span>
        </div>

        {/* 팝업 타이틀 및 서브 안내 문구 */}
        <div className="text-center mb-5">
          <h2
            id="popup-title"
            className="text-lg font-bold text-neutral-900 tracking-tight mb-1.5"
          >
            무신사 20만 원 응모하기
          </h2>
          <p className="text-xs text-neutral-500 leading-relaxed">
            로그인하고 친구 스노우볼에 선물 채우고, 나도 선물 받자
          </p>
        </div>

        {/* 하단 CTA 버튼 ('응모하러 가기') */}
        <button
          type="button"
          onClick={onApply}
          className="w-full py-3.5 rounded-xl bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800 active:scale-[0.99] transition-all"
        >
          응모하러 가기
        </button>
      </div>
    </div>
  );
}
