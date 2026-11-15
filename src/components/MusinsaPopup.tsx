"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { detectInAppBrowser } from "@/components/InAppBrowserGuard";

const MUSINSA_POPUP_GLOBAL_KEY = "musinsa_popup_shown";

export function hasShownMusinsaPopup(userId?: string | null): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (userId) {
      return (
        window.localStorage.getItem(`musinsa_popup_shown_${userId}`) === "true"
      );
    }
    return window.localStorage.getItem(MUSINSA_POPUP_GLOBAL_KEY) === "true";
  } catch {
    return false;
  }
}

export function markMusinsaPopupShown(userId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (userId) {
      window.localStorage.setItem(`musinsa_popup_shown_${userId}`, "true");
    } else {
      window.localStorage.setItem(MUSINSA_POPUP_GLOBAL_KEY, "true");
    }
  } catch {
    // 스토리지 접근 제한 환경 무시
  }
}

interface MusinsaPopupProps {
  isOpen: boolean;
  userId?: string | null;
  onClose: () => void;
  onApply: () => void;
}

/**
 * P00: 무신사 팝업 (/popup.png 통이미지 + 하단 '편지쓰러 가기' 버튼)
 * - 인앱 브라우저나 비로그인 상태에서는 절대 노출하지 않으며,
 *   일반 브라우저에서 로그인 완료 후 스노우볼 화면 최초 진입 시 딱 1회만 노출합니다.
 * - 한 번이라도 화면에 노출되거나 닫기/버튼 클릭 시 즉시 localStorage에 영구 기록합니다.
 */
export default function MusinsaPopup({
  isOpen,
  userId,
  onClose,
  onApply,
}: MusinsaPopupProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isInApp =
    typeof window !== "undefined"
      ? detectInAppBrowser(window.navigator.userAgent).isInApp
      : false;

  const canDisplay = Boolean(isOpen && mounted && userId && !isInApp);

  // 팝업이 화면에 한 번이라도 노출되는 즉시 localStorage에 영구 기록하여 새로고침/재접속 시 재노출 차단
  useEffect(() => {
    if (canDisplay) {
      markMusinsaPopupShown(userId);
    }
  }, [canDisplay, userId]);

  if (!canDisplay) return null;

  const handleCloseClick = () => {
    markMusinsaPopupShown(userId);
    onClose();
  };

  const handleApplyClick = () => {
    markMusinsaPopupShown(userId);
    onApply();
  };

  const modalNode = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="이벤트 안내 팝업"
      onClick={handleCloseClick}
    >
      <div
        className="relative w-full max-w-[350px] max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-3.5 shadow-2xl text-[#0B1528] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 우측 상단 닫기 버튼 (이미지 위에 겹치거나 상단에 깔끔하게 배치) */}
        <button
          type="button"
          onClick={handleCloseClick}
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

        {/* 하단 남색(#2C2F63) CTA 버튼: '편지쓰러 가기' */}
        <button
          type="button"
          onClick={handleApplyClick}
          className="w-full py-3.5 rounded-xl bg-[#2C2F63] hover:bg-[#222552] active:scale-[0.99] text-white text-sm font-extrabold transition-all shadow-md"
        >
          편지쓰러 가기
        </button>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
}
