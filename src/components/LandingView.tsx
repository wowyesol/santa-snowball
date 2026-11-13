"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AppShell from "./AppShell";
import SnowballGraphic from "./SnowballGraphic";
import MusinsaPopup from "./MusinsaPopup";
import InAppBrowserGuard from "./InAppBrowserGuard";
import {
  Snowball,
  clearPendingInviteSlug,
  getCurrentAuthAndSnowball,
  getPendingInviteSlug,
  getSnowballBySlug,
  saveInvitedByNickname,
  savePendingInviteSlug,
  setFlashToast,
} from "@/lib/supabase";

/**
 * S01 첫 화면 & P00 무신사 팝업
 * - 비로그인 첫 진입 시 P00 무신사 20만 원 응모하기 팝업 자동 노출
 * - 일반 진입: 타이틀 + 중앙 스노우볼 + [로그인하고 시작하기] + 경품 안내 박스
 * - 친구 공유 링크 진입 (?sb=[slug]):
 *   ① 이미 로그인된 유저: targetSlug가 내 스노우볼 slug와 다르면 절대 내 스노우볼로 보내지 않고 즉시 친구 스노우볼 페이지(/snowball/[targetSlug], S05)로 이동!
 *   ② 비로그인 유저: S01 진입 즉시 localStorage.setItem('pending_friend_slug', targetSlug) 저장 -> 추후 OAuth 및 S02 완료 시 그 친구의 스노우볼(S05)로 이동!
 * - 존재하지 않는 스노우볼 주소 접속 시: "존재하지 않는 스노우볼입니다." 토스트 알림 후 S01(/)로 자동 이동
 */
export default function LandingView() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawSb = searchParams.get("sb");
  const sbParam = rawSb && rawSb.trim() !== "" ? rawSb.trim() : null;

  const [checking, setChecking] = useState<boolean>(true);
  const [friendSnowball, setFriendSnowball] = useState<Snowball | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    async function initS01() {
      // 최우선으로 URL의 sb 파라미터 확인 (React searchParams + window.location.search 이중 체크로 누락 원천 차단)
      let targetSlug = sbParam;
      if (!targetSlug && typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        const fromWindow = urlParams.get("sb");
        if (fromWindow && fromWindow.trim() !== "") {
          targetSlug = fromWindow.trim();
        }
      }

      // URL에 sb 파라미터가 있으면 진입 즉시 localStorage에 pending_friend_slug 저장!
      if (targetSlug && typeof window !== "undefined") {
        window.localStorage.setItem("pending_friend_slug", targetSlug);
        savePendingInviteSlug(targetSlug);
      }

      const authState = await getCurrentAuthAndSnowball();

      // 1) 친구 공유 링크(?sb=[targetSlug]) 검증
      let friendData: Snowball | null = null;
      if (targetSlug) {
        friendData = await getSnowballBySlug(targetSlug);
        if (!friendData) {
          // 존재하지 않거나 삭제된 스노우볼 주소로 접속 시: 토스트 알림 후 기본 S01로 이동
          clearPendingInviteSlug();
          setFlashToast("존재하지 않는 스노우볼입니다.");
          if (isMounted) {
            setFriendSnowball(null);
            setChecking(false);
            router.replace("/");
          }
          return;
        }
        // 존재하는 친구 스노우볼이면 초대 코드(pending_friend_slug)와 초대자 닉네임을 스토리지에 확정 저장
        if (typeof window !== "undefined") {
          window.localStorage.setItem("pending_friend_slug", friendData.slug);
        }
        savePendingInviteSlug(friendData.slug);
        saveInvitedByNickname(friendData.nickname);
      }

      if (!isMounted) return;

      // 2) [핵심 수정 ①] 이미 로그인되어 있고 내 스노우볼이 있는 유저인 경우:
      //    URL의 targetSlug(또는 저장된 pending_friend_slug)를 최우선 확인하여 내 스노우볼 slug와 다르면
      //    절대 내 스노우볼(S04)로 보내지 않고 즉시 친구 스노우볼 페이지(/snowball/[targetSlug], S05)로 이동!
      if (authState.isAuthenticated && authState.snowball) {
        const mySlug = authState.snowball.slug;
        const effectiveTargetSlug =
          friendData?.slug || targetSlug || getPendingInviteSlug();

        if (effectiveTargetSlug && effectiveTargetSlug !== mySlug) {
          clearPendingInviteSlug();
          router.replace(
            `/snowball/${encodeURIComponent(effectiveTargetSlug)}`
          );
          return;
        }

        clearPendingInviteSlug();
        router.replace(`/snowball/${encodeURIComponent(mySlug)}`);
        return;
      }

      setFriendSnowball(friendData);
      setIsPopupOpen(true); // 비로그인 진입 시 P00 무신사 팝업 자동 노출
      setChecking(false);
    }

    initS01();

    return () => {
      isMounted = false;
    };
  }, [sbParam, router]);

  const handleGoToS02 = () => {
    setIsPopupOpen(false);
    const targetSlug = friendSnowball?.slug || sbParam || getPendingInviteSlug();
    if (targetSlug) {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("pending_friend_slug", targetSlug);
      }
      savePendingInviteSlug(targetSlug);
      if (friendSnowball) {
        saveInvitedByNickname(friendSnowball.nickname);
      }
      router.push(`/login?sb=${encodeURIComponent(targetSlug)}`);
    } else {
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
    <AppShell>
      {/* S00 인앱 브라우저 자동 감지 모달 */}
      <InAppBrowserGuard />

      <div className="flex flex-col items-center px-5 pt-5 pb-12 text-center break-keep">
        {/* 친구 공유 링크 진입 시 상단 초대 안내 배너 */}
        {isFriendInvite && friendSnowball && (
          <section
            aria-label="친구 초대 배너"
            className="w-full mb-6 p-4 rounded-2xl bg-white/95 border border-[#2C2F63]/15 text-[#2C2F63] shadow-[0_6px_18px_rgba(26,30,67,0.18)] text-left break-keep"
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
        )}

        {/* 메인 타이틀 영역 */}
        <div className="mt-2 mb-3 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="차곡차곡 크리스마스"
            className="h-9 w-auto object-contain mb-2"
          />
          <p className="text-sm font-medium text-[#FAF0DC]/95">
            산타보다 빠른 우편함
          </p>
        </div>

        {/* 중앙 스노우볼 이미지 (친구 초대 시 친구의 현재 레벨 0/1/3 스노우볼 미리보기, 일반 진입 시 기본 대표 스노우볼) */}
        <SnowballGraphic
          level={isFriendInvite && friendSnowball ? friendSnowball.level : 3}
          overrideImageSrc={
            isFriendInvite && friendSnowball ? undefined : "/lv3_snowball.png"
          }
          size="lg"
        />

        {/* 하단 로그인 시작하기 버튼 */}
        <div className="w-full mt-3">
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

      {/* P00: 무신사 20만 원 응모하기 팝업 */}
      <MusinsaPopup
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        onApply={handleGoToS02}
      />
    </AppShell>
  );
}
