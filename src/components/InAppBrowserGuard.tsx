"use client";

import React, { useEffect, useState } from "react";

interface InAppBrowserGuardProps {
  // /inapp 전용 페이지에서 렌더링할 때 true
  standalonePage?: boolean;
  // 모달 형태로 강제 미리보기할 때 true
  forcePreview?: boolean;
  onClosePreview?: () => void;
}

interface DetectedInAppInfo {
  isInApp: boolean;
  appName: string;
  isIOS: boolean;
  isAndroid: boolean;
}

function detectInAppBrowser(ua: string): DetectedInAppInfo {
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  const rules: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /Instagram/i, name: "Instagram 인앱" },
    { pattern: /KAKAOTALK/i, name: "카카오톡 인앱" },
    { pattern: /Barcelona/i, name: "Threads 인앱" },
    { pattern: /FBAN|FBAV/i, name: "Facebook 인앱" },
    { pattern: /Line\//i, name: "LINE 인앱" },
    { pattern: /NAVER\(/i, name: "네이버 인앱" },
    { pattern: /everytimeApp/i, name: "에브리타임 인앱" },
  ];

  for (const rule of rules) {
    if (rule.pattern.test(ua)) {
      return {
        isInApp: true,
        appName: rule.name,
        isIOS,
        isAndroid,
      };
    }
  }

  return {
    isInApp: false,
    appName: "Instagram 인앱",
    isIOS,
    isAndroid,
  };
}

/**
 * S00 외부 브라우저 안내 컴포넌트 (iOS / Android 시안 완벽 반영)
 * 인스타그램·카카오톡 등 인앱 브라우저 감지 시 노출되며, 원래 URL(?sb=... 및 UTM)을 그대로 유지합니다.
 */
export default function InAppBrowserGuard({
  standalonePage = false,
  forcePreview = false,
  onClosePreview,
}: InAppBrowserGuardProps) {
  const [info, setInfo] = useState<DetectedInAppInfo>({
    isInApp: false,
    appName: "Instagram 인앱",
    isIOS: true,
    isAndroid: false,
  });
  const [osTab, setOsTab] = useState<"ios" | "android">("ios");
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const detected = detectInAppBrowser(window.navigator.userAgent);
    setInfo(detected);
    setOsTab(detected.isAndroid ? "android" : "ios");
    setCurrentUrl(window.location.href);
  }, []);

  const isActive = standalonePage || forcePreview || (info.isInApp && !dismissed);
  if (!isActive) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("아래 주소를 복사해 외부 브라우저에 붙여넣어 주세요:", currentUrl);
    }
  };

  const handleOpenChromeAndroid = () => {
    if (typeof window === "undefined") return;
    const target = window.location.href;
    if (/KAKAOTALK/i.test(window.navigator.userAgent)) {
      window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(
        target
      )}`;
      return;
    }
    const withoutProtocol = target.replace(/^https?:\/\//i, "");
    const scheme = target.startsWith("https") ? "https" : "http";
    window.location.href = `intent://${withoutProtocol}#Intent;scheme=${scheme};package=com.android.chrome;end`;
  };

  const cardContent = (
    <div className="w-full max-w-[358px] mx-auto">
      {/* iOS / Android 시안 전환 탭 (테스트 및 기기 전환 확인용) */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="inline-flex rounded-full bg-white/10 p-0.5 border border-white/20">
          <button
            type="button"
            onClick={() => setOsTab("ios")}
            className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${
              osTab === "ios"
                ? "bg-white text-[#0B1528]"
                : "text-white/70 hover:text-white"
            }`}
          >
            iOS 안내
          </button>
          <button
            type="button"
            onClick={() => setOsTab("android")}
            className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${
              osTab === "android"
                ? "bg-white text-[#0B1528]"
                : "text-white/70 hover:text-white"
            }`}
          >
            Android 안내
          </button>
        </div>

        {!standalonePage && (
          <button
            type="button"
            onClick={() => {
              if (onClosePreview) onClosePreview();
              setDismissed(true);
            }}
            className="text-xs text-white/80 hover:text-white font-semibold"
          >
            닫기 ✕
          </button>
        )}
      </div>

      {osTab === "ios" ? (
        /* S00 · iOS 카드 */
        <div className="w-full rounded-3xl bg-[#F4F9FF] text-[#0B1528] p-5 shadow-2xl border border-white/60 text-left">
          <span className="inline-block px-3 py-1 rounded-full bg-[#DCEBFA] text-[#102A4E] text-[11px] font-bold mb-3">
            iPhone · {info.appName}
          </span>

          <h2 className="text-lg font-extrabold text-[#0D2B52] mb-1">
            외부 브라우저로 열어주세요
          </h2>
          <p className="text-xs text-[#5B7493] mb-4">
            인스타그램 안에서는 구글 로그인이 막혀 있어요.
          </p>

          <ol className="text-xs font-bold text-[#102A4E] space-y-1 mb-4">
            <li>1. 아래 링크를 복사해요</li>
            <li>2. Safari를 열어요</li>
            <li>3. 주소창에 붙여넣어요</li>
          </ol>

          <div className="w-full px-3.5 py-2.5 rounded-xl bg-[#E5F0FC] text-[11px] text-[#5B7493] font-mono truncate mb-3">
            {currentUrl}
          </div>

          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full py-3.5 rounded-xl bg-[#3898FF] hover:bg-[#2589F5] text-white text-sm font-extrabold transition-all mb-4 shadow-xs"
          >
            {copied ? "✓ 링크가 복사되었어요!" : "링크 복사"}
          </button>

          <div className="w-full rounded-2xl border border-[#BFD8F5] bg-[#E8F2FF] flex flex-col items-center justify-center text-center p-4 mb-3">
            <span className="text-xs font-extrabold text-[#102A4E]">
              🧭 Safari에서 여는 방법
            </span>
            <span className="text-[11px] text-[#5B7493] mt-1 leading-relaxed">
              Safari 앱 실행 → 상단 또는 하단 주소창 터치 → 복사한 링크 붙여넣기 후 이동
            </span>
          </div>

          <p className="text-[10px] text-[#5B7493]">
            복사되는 링크 = 원래 URL 그대로 (친구 스노우볼 정보 포함)
          </p>
        </div>
      ) : (
        /* S00 · Android 카드 */
        <div className="w-full rounded-3xl bg-[#F4F9FF] text-[#0B1528] p-5 shadow-2xl border border-white/60 text-left">
          <span className="inline-block px-3 py-1 rounded-full bg-[#DCEBFA] text-[#102A4E] text-[11px] font-bold mb-3">
            Android · {info.appName}
          </span>

          <h2 className="text-lg font-extrabold text-[#0D2B52] mb-1">
            외부 브라우저로 열어주세요
          </h2>
          <p className="text-xs text-[#5B7493] mb-4">
            인스타그램 안에서는 구글 로그인이 막혀 있어요.
          </p>

          <button
            type="button"
            onClick={handleOpenChromeAndroid}
            className="w-full py-3.5 rounded-xl bg-[#3898FF] hover:bg-[#2589F5] text-white text-sm font-extrabold transition-all mb-3 shadow-xs"
          >
            Chrome으로 열기
          </button>

          <p className="text-[11px] text-[#5B7493] mb-2">
            버튼이 안 되면 링크를 복사해 Chrome 주소창에 붙여넣어요
          </p>

          <div className="w-full px-3 py-2 rounded-xl bg-[#E5F0FC] flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] text-[#5B7493] font-mono truncate">
              {currentUrl}
            </span>
            <button
              type="button"
              onClick={handleCopyLink}
              className="shrink-0 px-3 py-1 rounded-full bg-white text-[#0B1528] text-[11px] font-extrabold shadow-2xs"
            >
              {copied ? "완료" : "복사"}
            </button>
          </div>

          <p className="text-[10px] text-[#5B7493]">
            복사되는 링크 = 원래 URL 그대로 (친구 스노우볼 정보 포함)
          </p>
        </div>
      )}
    </div>
  );

  if (standalonePage) {
    return <div className="px-4 py-6">{cardContent}</div>;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      {cardContent}
    </div>
  );
}
