"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import SnowballGraphic from "./SnowballGraphic";
import MusinsaPopup from "./MusinsaPopup";

/**
 * S01 첫 화면 (메인 랜딩 페이지 클라이언트 컴포넌트)
 *
 * 포함하는 3가지 핵심 상태(State):
 * 1. S01-landing--general (기본 랜딩 화면)
 * 2. S01-landing--friend-invite (URL에 ?sb=id 파라미터 존재 시 상단 친구 초대 배너 및 친구 스노우볼 미리보기 노출)
 * 3. S01-landing--popup (비로그인 상태로 페이지 첫 진입 시 무신사 상품권 응모 팝업 노출, 닫기/응모하기 클릭 시 닫힘)
 */
export default function LandingView() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL 쿼리 파라미터(Query Parameter)에서 '?sb=id' 값을 읽어옴
  const sbParam = searchParams.get("sb");
  const isFriendInvite = Boolean(sbParam && sbParam.trim() !== "");

  // 초대한 친구 이름 (필요시 파라미터나 API 연동으로 확장 가능, 기본값 '수룡이')
  const inviterName = "수룡이";

  // 비로그인 여부 상태 (기본값: 비로그인 false)
  const [isLoggedIn] = useState<boolean>(false);

  // 무신사 상품권 응모 팝업 노출 상태(State) 관리
  // 비로그인 상태로 페이지 첫 진입 시 화면을 덮도록 true로 초기화
  const [isPopupOpen, setIsPopupOpen] = useState<boolean>(false);

  useEffect(() => {
    // 비로그인 상태로 첫 진입 시 팝업 자동 노출
    if (!isLoggedIn) {
      setIsPopupOpen(true);
    }
  }, [isLoggedIn]);

  // 팝업 '닫기' 또는 '응모하러 가기' 버튼 클릭 핸들러(Handler)
  const handleClosePopup = () => {
    setIsPopupOpen(false);
  };

  // 로그인/시작하기 액션 핸들러
  const handleStartClick = () => {
    // 실제 서비스에서는 S02 로그인 화면으로 라우팅(Routing) 처리
    alert(
      isFriendInvite
        ? `[S02 로그인 이동] 로그인 완료 후 ${inviterName}님의 스노우볼(sb=${sbParam})로 복귀합니다.`
        : "[S02 로그인 이동] 로그인 화면으로 이동합니다."
    );
  };

  // 데모/테스트 편의성을 위한 상태 전환 헬퍼 함수 (상단/하단에서 쉽게 세 가지 상태를 검증 가능하도록 지원)
  const toggleInviteMode = () => {
    if (isFriendInvite) {
      router.push("/");
    } else {
      router.push("/?sb=suryong123");
    }
  };

  return (
    <div className="relative w-full max-w-[390px] min-h-screen bg-white flex flex-col justify-between shadow-sm border-x border-neutral-200/80">
      {/* 개발/검수용 빠른 상태 테스트 바 (화면 최상단에 작게 배치하여 3가지 상태를 즉시 테스트 가능) */}
      <div className="bg-neutral-800 text-neutral-200 px-3 py-1.5 text-[11px] flex items-center justify-between gap-1">
        <span className="font-medium text-neutral-300">S01 상태 테스트:</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleInviteMode}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              isFriendInvite
                ? "bg-emerald-500 text-white"
                : "bg-neutral-700 text-neutral-200 hover:bg-neutral-600"
            }`}
          >
            {isFriendInvite ? "초대링크 ON (?sb=id)" : "초대링크 OFF (기본)"}
          </button>
          <button
            type="button"
            onClick={() => setIsPopupOpen(true)}
            className="px-2 py-0.5 rounded bg-neutral-700 hover:bg-neutral-600 text-[10px] font-medium text-neutral-200 transition-colors"
          >
            팝업 다시 열기
          </button>
        </div>
      </div>

      {/* 상단 영역: 네비게이션 헤더(Header) + 본문 콘텐츠 */}
      <div className="flex-1 flex flex-col">
        {/* 1. 상단 네비게이션 바 */}
        <header className="w-full px-4 py-3 flex items-center justify-between border-b border-neutral-100">
          {/* 좌측 로고(Logo) 플레이스홀더 */}
          <div className="px-2.5 py-1 rounded bg-neutral-200 text-neutral-800 text-[11px] font-bold tracking-tight">
            LOGO 산타보다 빠른 우체국
          </div>

          {/* 우측 버튼 그룹 (이벤트 안내 / 로그인) */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("event-info-section");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="px-2.5 py-1 rounded-full border border-neutral-300 bg-white text-neutral-700 text-[11px] font-medium hover:bg-neutral-50 transition-colors"
            >
              이벤트 안내
            </button>
            <button
              type="button"
              onClick={handleStartClick}
              className="px-3 py-1 rounded-full bg-neutral-900 text-white text-[11px] font-semibold hover:bg-neutral-800 transition-colors"
            >
              로그인
            </button>
          </div>
        </header>

        {/* 메인 컨텐츠 컨테이너 */}
        <main className="flex-1 flex flex-col items-center px-5 pt-4 pb-6">
          {/* 2. 친구 초대 분기 배너: URL에 ?sb=id 파라미터가 존재할 경우 조건부 렌더링 */}
          {isFriendInvite && (
            <section
              aria-label="친구 초대 안내 배너"
              className="w-full mb-5 p-3.5 rounded-2xl bg-neutral-100 border border-neutral-200/80 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2.5">
                {/* 프로필 아이콘 원형 플레이스홀더 */}
                <div
                  className="w-7 h-7 rounded-full bg-neutral-300 shrink-0"
                  aria-hidden="true"
                />
                <p className="text-xs font-bold text-neutral-900">
                  {inviterName}님이 스노우볼에 초대했어요
                </p>
              </div>
              <p className="text-[11px] text-neutral-500 pl-0.5">
                로그인하면 {inviterName} 스노우볼에 선물을 넣을 수 있어요 (무료)
              </p>
            </section>
          )}

          {/* 3. 일정 안내 뱃지 및 메인 타이틀 */}
          <div className="flex flex-col items-center text-center mt-1 mb-2">
            <span className="inline-block px-3 py-1 rounded-full bg-neutral-100 border border-neutral-200 text-[10px] font-medium text-neutral-600 mb-2.5">
              11/9 ~ 11/27 선물 모으기 · 12월 열어보기
            </span>
            <h1 className="text-[22px] leading-[1.3] font-extrabold text-neutral-900 tracking-tight">
              차곡차곡 크리스마스
              <br />
              산타보다 빠른 우체국
            </h1>
          </div>

          {/* 4. 중앙 스노우볼 그래픽 (회색 플레이스홀더) */}
          <SnowballGraphic
            isFriendInvite={isFriendInvite}
            friendName={inviterName}
          />

          {/* 5. 하단 CTA 영역 ('로그인하고 시작하기' 버튼 및 안내 문구) */}
          <div className="w-full mt-4 flex flex-col items-center">
            <p className="text-xs font-semibold text-neutral-700 mb-2.5 text-center">
              로그인하고 친구 스노우볼에 선물 채우고, 나도 선물 받자
            </p>
            <button
              type="button"
              onClick={handleStartClick}
              className="w-full py-3.5 rounded-xl bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800 active:scale-[0.99] transition-all shadow-sm"
            >
              로그인하고 시작하기
            </button>

            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("event-info-section");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="mt-4 text-[11px] text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              이벤트 안내 · 유의사항 보기
            </button>
          </div>

          {/* 6. 경품 안내 카드 영역 */}
          <section
            id="event-info-section"
            className="w-full mt-5 p-4 rounded-xl border border-neutral-200 bg-white text-left"
          >
            <h2 className="text-xs font-bold text-neutral-800 mb-1.5">경품</h2>
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              1등 무신사 20만 원 · 2등 신세계 10만 원 · 3등 배민 3만 원 · 추첨 투썸
              1만 원 (총 25명)
            </p>
          </section>
        </main>
      </div>

      {/* 7. 하단 푸터(Footer) 영역 */}
      <footer className="w-full bg-neutral-100 border-t border-neutral-200/80 py-6 px-4 flex flex-col items-center text-center gap-2.5">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-neutral-300 bg-white text-[11px] font-semibold text-neutral-700 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-neutral-500" />
          <span>Built with Gemini</span>
        </div>
        <div className="text-[10px] text-neutral-400 space-x-1">
          <a href="#event-info-section" className="hover:underline">
            이벤트 안내 · 유의사항
          </a>
          <span>|</span>
          <a href="#privacy" className="hover:underline">
            개인정보 처리방침
          </a>
        </div>
        <p className="text-[10px] text-neutral-400">
          2026 Google Student Ambassador · 성신여대
        </p>
      </footer>

      {/* 8. 비로그인 첫 진입 시 노출되는 무신사 상품권 응모 팝업 */}
      <MusinsaPopup
        isOpen={isPopupOpen}
        onClose={handleClosePopup}
        onApply={handleClosePopup}
      />
    </div>
  );
}
