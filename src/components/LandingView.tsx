"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AppShell from "./AppShell";
import SnowballGraphic from "./SnowballGraphic";
import InAppBrowserGuard from "./InAppBrowserGuard";
import {
  Snowball,
  clearAllInviteStorage,
  clearPendingInviteSlug,
  getCurrentAuthAndSnowball,
  getSnowballBySlug,
  saveInvitedByNickname,
  setFlashToast,
} from "@/lib/supabase";

/**
 * S01 첫 화면 (기본 루트 `/` & 친구 초대 링크 `/?sb=[slug]`)
 * - 순수 기본 루트(`/`) 접속 시:
 *   ① 스토리지/쿠키에 남아있는 이전 초대/방문 슬러그를 즉시 모두 초기화
 *   ② 로그인 상태면 무조건 현재 로그인한 본인의 스노우볼(`/snowball/[내_slug]`)로 이동
 *   ③ 비로그인 상태면 초대 카드 없는 순수 기본 홈 랜딩 화면 노출 (로그인 시 무조건 본인 스노우볼로 이동)
 * - 친구 공유 링크(`/?sb=[slug]`) 접속 시:
 *   ① 이미 로그인된 유저: 내 스노우볼과 다르면 친구 스노우볼(S05)로, 내 스노우볼이면 내 스노우볼(S04)로 이동하며 임시 슬러그 즉시 삭제
 *   ② 비로그인 유저: 단순 조회만으로는 영구 스토리지에 저장하지 않으며, 직접 [로그인하고 시작하기] 버튼을 누를 때만 `?sb=[slug]`를 1회용으로 전달
 */
export default function LandingView() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawSb = searchParams.get("sb");
  const sbParam = rawSb && rawSb.trim() !== "" ? rawSb.trim() : null;

  const [checking, setChecking] = useState<boolean>(true);
  const [friendSnowball, setFriendSnowball] = useState<Snowball | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function initS01() {
      // 현재 URL에 실제로 존재하는 ?sb 파라미터만 인정 (이전 방문 스토리지 참조 절대 금지)
      let targetSlug = sbParam;
      if (!targetSlug && typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        const fromWindow = urlParams.get("sb");
        if (fromWindow && fromWindow.trim() !== "") {
          targetSlug = fromWindow.trim();
        }
      }

      // [핵심 원칙 1] 슬러그가 없는 순수 기본 루트(/) 접속 시:
      // 남아있는 모든 초대/방문 슬러그 스토리지·쿠키를 즉시 삭제하고,
      // 로그인 상태면 무조건 본인 스노우볼로, 비로그인 상태면 순수 기본 홈 랜딩 화면 표시!
      if (!targetSlug) {
        clearAllInviteStorage();
        const authState = await getCurrentAuthAndSnowball();
        if (!isMounted) return;

        if (authState.isAuthenticated && authState.snowball) {
          router.replace(
            `/snowball/${encodeURIComponent(authState.snowball.slug)}`
          );
          return;
        }

        setFriendSnowball(null);
        setChecking(false);
        return;
      }

      // [핵심 원칙 2] 친구 공유 링크(?sb=[targetSlug]) 접속 시 검증 (단순 진입 시에는 스토리지에 슬러그 영구 저장 안 함)
      clearPendingInviteSlug();
      const [authState, friendData] = await Promise.all([
        getCurrentAuthAndSnowball(),
        getSnowballBySlug(targetSlug),
      ]);

      if (!friendData) {
        clearAllInviteStorage();
        setFlashToast("존재하지 않는 스노우볼입니다.");
        if (isMounted) {
          setFriendSnowball(null);
          setChecking(false);
          router.replace("/");
        }
        return;
      }

      if (!isMounted) return;

      // 이미 로그인된 유저인 경우: 스토리지 저장 없이 즉시 분기 이동
      if (authState.isAuthenticated && authState.snowball) {
        const mySlug = authState.snowball.slug;
        clearPendingInviteSlug();

        if (friendData.slug !== mySlug) {
          saveInvitedByNickname(friendData.nickname);
          router.replace(
            `/snowball/${encodeURIComponent(friendData.slug)}`
          );
          return;
        }

        clearAllInviteStorage();
        router.replace(`/snowball/${encodeURIComponent(mySlug)}`);
        return;
      }

      setFriendSnowball(friendData);
      setChecking(false);
    }

    initS01();

    return () => {
      isMounted = false;
    };
  }, [sbParam, router]);

  const handleGoToS02 = () => {
    // 오직 현재 친구 초대 링크(?sb=...) 화면에서 직접 로그인 시작 버튼을 눌렀을 때만 friend_slug 전달
    if (sbParam && friendSnowball) {
      saveInvitedByNickname(friendSnowball.nickname);
      router.push(`/login?sb=${encodeURIComponent(friendSnowball.slug)}`);
    } else {
      clearAllInviteStorage();
      router.push("/login");
    }
  };

  if (checking) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          <p className="text-xs text-white/70">스노우볼 우체국을 여는 중...</p>
        </div>
      </AppShell>
    );
  }

  const isFriendInvite = Boolean(friendSnowball);

  return (
    <AppShell useStageBackground>
      {/* S00 인앱 브라우저 자동 감지 모달 */}
      <InAppBrowserGuard />

      <div className="flex flex-col w-full text-center break-keep">
        {/* 친구 공유 링크 진입 시 상단 초대 안내 배너 (Stage 비율에 영향을 주지 않도록 상단 밤하늘 연장 영역에 분리) */}
        {isFriendInvite && friendSnowball && (
          <div className="w-full bg-[#1B1F4A] px-5 pt-4 pb-1">
            <section
              aria-label="친구 초대 배너"
              className="w-full p-4 rounded-2xl bg-white/95 border border-[#2C2F63]/15 text-[#2C2F63] shadow-[0_6px_18px_rgba(26,30,67,0.18)] text-left break-keep"
            >
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-7 h-7 rounded-full bg-[#E8ECFA] flex items-center justify-center text-sm shrink-0">
                  ⛄
                </div>
                <p className="text-[13px] font-extrabold text-[#2C2F63] leading-snug break-keep">
                  {friendSnowball.nickname}님이 스노우볼에 초대했어요
                </p>
              </div>
              <p className="text-xs text-[#2C2F63]/80 pl-0.5 leading-relaxed break-keep">
                로그인하면 {friendSnowball.nickname}의 스노우볼에 편지를 넣을 수 있어요
              </p>
            </section>
          </div>
        )}

        {/* 배경(bg-night-snow.png)과 스노우볼이 동일한 원본 비율(941:1672 ≈ 9:16) 좌표계를 공유하는 기준 Stage */}
        <div className="relative w-full aspect-[941/1672] select-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/bg-night-snow.png?v=2"
            alt=""
            aria-hidden="true"
            className="w-full h-auto block pointer-events-none select-none"
          />

          {/* 상단 메인 타이틀 영역: 산타 썰매(11%~15.6%) 아래 ~ 스노우볼 유리구(36%) 위 정중앙 빈 밤하늘 영역(26%)에 정확히 배치 */}
          <div className="absolute inset-x-0 top-[26%] -translate-y-1/2 z-20 px-5 flex flex-col items-center text-center pointer-events-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="차곡차곡 크리스마스"
              className="h-9 w-auto object-contain mb-2.5"
            />
            <p className="text-sm font-medium text-[#FAF0DC]/95">
              산타보다 빠른 우편함
            </p>
          </div>

          {/* 중앙 스노우볼 앵커: 상단 배지/편지 수 유무나 기기 화면 비율과 무관하게 눈언덕 지면(bottom 4.8%)에 100% 고정 착지 */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[4.8%] z-10 w-[92%] pointer-events-none">
            <SnowballGraphic
              level={3}
              overrideImageSrc="/lv3_snowball.png?v=2"
              size="lg"
              inStage
            />
          </div>
        </div>

        {/* 눈언덕 아래 단색(#FCEED8) 연장 영역에 이어지는 액션 및 경품 안내 */}
        <div className="relative z-20 flex flex-col items-center px-5 -mt-6 pb-12">
          {/* 하단 로그인 시작하기 버튼 */}
          <div className="w-full">
            <p className="text-xs font-extrabold text-[#2C2F63] bg-white/85 border border-[#2C2F63]/15 rounded-full py-1.5 px-4 inline-block shadow-2xs mb-3">
              크리스마스의 설렘을 담아, 친구에게 편지를 남겨보세요
            </p>

            <button
              type="button"
              onClick={handleGoToS02}
              className="w-full py-3.5 rounded-xl bg-[#2C2F63] hover:bg-[#222552] active:scale-[0.99] text-white text-sm font-extrabold border border-white/15 shadow-[0_6px_16px_rgba(44,47,99,0.3)] transition-all"
            >
              로그인하고 시작하기
            </button>
          </div>

          {/* 경품 안내 박스 (하단 눈밭 위 선명한 대비 확보) */}
          <section className="w-full mt-4 p-4 rounded-2xl bg-white/95 border border-[#2C2F63]/15 text-[#2C2F63] shadow-[0_6px_18px_rgba(44,47,99,0.12)]">
            <h2 className="text-xs font-extrabold text-[#2C2F63] mb-1">경품</h2>
            <p className="text-[11px] font-bold text-[#2C2F63]/80 leading-relaxed">
              무신사 20만 원 · 신세계 10만 원 · 배민 3만 원
              <br />
              행운의 선물 - 투썸 1만 원 (총 23명)
            </p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
