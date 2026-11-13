"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import SnowballGraphic from "@/components/SnowballGraphic";
import GeminiHighlightBanner from "@/components/GeminiHighlightBanner";
import {
  AuthSnowballState,
  Letter,
  Snowball,
  TicketSummary,
  computeAndSyncSnowballLevel,
  findMyExistingLetter,
  getCurrentAuthAndSnowball,
  getSnowballBySlug,
  getSnowballLevelInfo,
  getTicketSummary,
  getVisibleLettersBySnowballId,
  isCampaignOpenDateReached,
  logEventAsync,
  saveInvitedByNickname,
  savePendingInviteSlug,
  sendGiftLetter,
  setFlashToast,
} from "@/lib/supabase";

/**
 * S04(내 스노우볼 홈) & S05(친구 스노우볼) 클라이언트 컴포넌트
 * - 비로그인(또는 스노우볼 미생성) 상태로 /snowball/[slug]에 직접 접속 시:
 *   절대 바로 스노우볼 화면(S05)을 노출하지 않고 즉시 /?sb=[slug]&utm_source=friend (S01 친구 초대 화면)로 강제 리다이렉트!
 * - 모든 공유 링크 복사 URL은 반드시 /?sb=[내slug]&utm_source=friend 형태로 통일하며,
 *   클립보드 복사 시에는 깔끔하게 URL만 복사되도록 유지합니다.
 */
function SnowballDetailContent() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = decodeURIComponent(params.slug || "");
  const viewModeParam = searchParams.get("mode"); // 'own-link' 테스트 지원

  const [loading, setLoading] = useState<boolean>(true);
  const [targetSnowball, setTargetSnowball] = useState<Snowball | null>(null);
  const [authState, setAuthState] = useState<AuthSnowballState | null>(null);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [ticketSummary, setTicketSummary] = useState<TicketSummary | null>(null);

  // S04 상태: 공유 복사 토스트, 흔들기 애니메이션, P04 모달
  const [copiedToast, setCopiedToast] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [isP04Open, setIsP04Open] = useState<boolean>(false);

  // S05 상태: 편지(최대 200자) 작성 및 완료/중복 상태
  const [myExistingLetter, setMyExistingLetter] = useState<Letter | null>(null);
  const [justSent, setJustSent] = useState<boolean>(false);
  const [justSentRewardMsg, setJustSentRewardMsg] =
    useState<string>("응모권 +1장");
  const [letterContent, setLetterContent] = useState<string>("");
  const [sendingLetter, setSendingLetter] = useState<boolean>(false);
  const [letterError, setLetterError] = useState<string | null>(null);

  const showCopyNotice = (msg: string) => {
    setCopiedToast(msg);
    setTimeout(() => {
      setCopiedToast((prev) => (prev === msg ? null : prev));
    }, 2600);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const [sbData, currentAuth] = await Promise.all([
      getSnowballBySlug(slug),
      getCurrentAuthAndSnowball(),
    ]);

    // 1) 존재하지 않거나 삭제된 스노우볼 주소로 접속 시: 에러 화면 없이 토스트 알림 후 S01(/)로 이동
    if (!sbData) {
      setFlashToast("존재하지 않는 스노우볼입니다.");
      router.replace("/");
      return;
    }

    // 2) 비로그인 상태(또는 아직 내 스노우볼을 만들지 않은 상태)로 /snowball/[slug]에 직접 접속한 경우:
    //    절대 바로 스노우볼 화면을 보여주지 않고 즉시 /?sb=[slug]&utm_source=friend (S01 친구 초대 화면)로 강제 리다이렉트!
    if (!currentAuth.isAuthenticated || !currentAuth.snowball) {
      savePendingInviteSlug(sbData.slug);
      saveInvitedByNickname(sbData.nickname);
      router.replace(
        `/?sb=${encodeURIComponent(sbData.slug)}&utm_source=friend`
      );
      return;
    }

    // 최신 사인업 레벨 계산/동기화
    const syncedLevel = await computeAndSyncSnowballLevel(sbData);
    const updatedSb: Snowball = { ...sbData, level: syncedLevel };

    setTargetSnowball(updatedSb);
    setAuthState(currentAuth);

    const visibleLetters = await getVisibleLettersBySnowballId(updatedSb.id);
    setLetters(visibleLetters);

    const mySb = currentAuth.snowball;
    if (mySb && mySb.id === updatedSb.id) {
      const summary = await getTicketSummary(updatedSb.id);
      setTicketSummary(summary);
      setMyExistingLetter(null);
    } else {
      // 친구의 스노우볼 방문 시 친구 닉네임 기억 (추후 S08 추천인 자동 입력용)
      saveInvitedByNickname(updatedSb.nickname);
      savePendingInviteSlug(updatedSb.slug);

      const effectiveSenderUid =
        mySb.user_id || currentAuth.userId || mySb.id;
      const existing = await findMyExistingLetter(
        updatedSb.id,
        effectiveSenderUid,
        mySb.nickname
      );
      setMyExistingLetter(existing);
    }

    setLoading(false);
  }, [slug, router]);

  useEffect(() => {
    loadData();

    const handleAuthChange = () => {
      loadData();
    };
    window.addEventListener("santa-auth-changed", handleAuthChange);
    return () => {
      window.removeEventListener("santa-auth-changed", handleAuthChange);
    };
  }, [loadData]);

  const mySnowball = authState?.snowball ?? null;
  const isOwner = Boolean(
    targetSnowball && mySnowball && targetSnowball.id === mySnowball.id
  );
  const isOwnLinkView = isOwner && viewModeParam === "own-link";

  // 모든 [내 스노우볼 공유하기] / [공유 링크 보내기] 버튼 클릭 시:
  // event_logs에 'share_click'을 비동기 기록하고, 클립보드에는 깔끔하게 URL만 복사
  const handleCopyMyLink = async () => {
    const ownerToShare = mySnowball || targetSnowball;
    if (!ownerToShare || typeof window === "undefined") return;
    logEventAsync("share_click", ownerToShare.slug);
    const shareUrl = `${window.location.origin}/?sb=${encodeURIComponent(
      ownerToShare.slug
    )}&utm_source=friend`;
    const shareTitle = `${ownerToShare.nickname}님에게 편지를 보내주세요 | 차곡차곡 크리스마스`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      showCopyNotice("✓ 내 스노우볼 초대 링크가 복사되었어요!");
    } catch {
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({
            title: shareTitle,
            url: shareUrl,
          });
          return;
        } catch {
          // 사용자가 공유 시트를 닫은 경우 무시
        }
      }
      window.prompt("아래 공유 링크를 복사해 친구에게 보내주세요:", shareUrl);
    }
  };

  // [흔들어서 편지 확인하기] 클릭 핸들러 -> 약 1.8초간 경쾌한 흔들림 & 함박눈 폭풍 연출을 보여준 직후 P04 팝업 오픈!
  const handleShakeSnowball = () => {
    if (isShaking) return;
    setIsShaking(true);
    setTimeout(() => {
      setIsShaking(false);
      setIsP04Open(true);
    }, 1800);
  };

  // [S05] 친구 스노우볼에 편지 넣기 제출 핸들러
  const handleSendLetterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSnowball || !mySnowball) return;

    setLetterError(null);
    setSendingLetter(true);

    try {
      const result = await sendGiftLetter({
        targetSnowball,
        senderSnowball: mySnowball,
        senderUserId: authState?.userId ?? null,
        content: letterContent,
      });

      setMyExistingLetter(result.letter);
      setJustSent(true);
      setLetterContent("");

      if (result.senderRewarded) {
        setJustSentRewardMsg("응모권 +1장");
      } else {
        setJustSentRewardMsg("응모권은 10장까지 쌓여요 (친구에게 +1장 전달 완료)");
      }

      const refreshed = await getVisibleLettersBySnowballId(targetSnowball.id);
      setLetters(refreshed);
    } catch (err) {
      setLetterError(
        err instanceof Error ? err.message : "편지 전송 중 오류가 발생했습니다."
      );
    } finally {
      setSendingLetter(false);
    }
  };

  if (loading || !targetSnowball) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          <p className="text-xs text-white/70">스노우볼을 불러오는 중...</p>
        </div>
      </AppShell>
    );
  }

  const levelInfo = getSnowballLevelInfo(targetSnowball.level);

  const isGeminiApproved =
    targetSnowball.gemini_verified || targetSnowball.gemini_status === "승인";
  const isGeminiPending =
    targetSnowball.gemini_status === "심사중" ||
    targetSnowball.gemini_status === "대기중";
  const isGeminiRejected = targetSnowball.gemini_status === "반려";

  const statusBadgeText = isGeminiApproved
    ? "Gemini 승인"
    : isGeminiPending
    ? "Gemini 심사 중"
    : isGeminiRejected
    ? "Gemini 반려 · 재인증하기"
    : "Gemini 미인증";

  const statusBadgeColorClass = isGeminiApproved
    ? "bg-amber-400/25 border-amber-300 text-amber-200 hover:bg-amber-400/35 shadow-[0_0_12px_rgba(251,191,36,0.3)]"
    : isGeminiPending
    ? "bg-sky-400/25 border-sky-300 text-sky-100 hover:bg-sky-400/35"
    : "bg-rose-500/25 border-rose-400 text-rose-100 hover:bg-rose-500/35 shadow-[0_0_12px_rgba(244,63,94,0.3)]";

  return (
    <AppShell>
      {copiedToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[75] px-4 py-2.5 rounded-full bg-emerald-500 text-white text-xs font-extrabold shadow-xl">
          {copiedToast}
        </div>
      )}

      <div className="flex flex-col px-5 pt-8 pb-12 break-keep">
        {isOwner && !isOwnLinkView ? (
          /* ================================================================
              [S04] 내 스노우볼 홈 (/snowball/[내slug])
             ================================================================ */
          <>
            {/* 상단 타이틀 및 제미나이 인증 상태 배지 (수평·수직 정중앙 정렬 & 여유 간격 확대) */}
            <div className="w-full flex flex-col items-center justify-center text-center">
              <h1 className="tracking-tight text-center">
                <span className="block text-3xl sm:text-4xl font-black text-white leading-tight break-keep">
                  {targetSnowball.nickname}의
                </span>
                <span className="block text-2xl font-extrabold text-white leading-tight mt-1">
                  스노우볼
                </span>
              </h1>

              {/* ① 제미나이 인증 상태 배지 (타이틀과 mt-4 간격, 아래 받은 편지 줄과 mt-12~14 대폭 간격 확보) */}
              <Link
                href="/verify"
                className={`mt-4 inline-flex items-center justify-center px-4 py-1.5 rounded-full text-xs font-extrabold leading-none text-center border transition-all active:scale-95 ${statusBadgeColorClass}`}
              >
                <span className="inline-flex items-center justify-center leading-none">
                  {statusBadgeText}
                </span>
              </Link>
            </div>

            {/* 받은 편지 N개 (좌측) & 현재 스노우볼 레벨 Lv.n (우측) - 인증 배지와의 간격을 좁혀 위로 올림 */}
            <div className="mt-3.5 sm:mt-4 w-full flex items-center justify-between gap-2 px-1">
              <span className="text-base sm:text-lg font-extrabold text-white drop-shadow-[0_1px_2px_rgba(26,30,67,0.45)] leading-none">
                받은 편지 {letters.length}개
              </span>
              <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-[#2C2F63]/80 border border-white/25 text-sm sm:text-base font-extrabold text-white leading-none shadow-2xs">
                {levelInfo.stageLabel}
              </span>
            </div>

            {/* ② 스노우볼 이미지 영역 (위쪽 줄이 올라간 만큼 상단 마진을 확보해 스노우볼 하단 받침대가 눈언덕 바닥에 놓인 위치는 그대로 유지) */}
            <div className="mt-8 sm:mt-9 mb-2 flex justify-center">
              <SnowballGraphic
                level={targetSnowball.level}
                letters={letters}
                isShaking={isShaking}
              />
            </div>

            {/* ③ 스노우볼 이미지와 [우편함 열어보기] 버튼 */}
            <button
              type="button"
              onClick={handleShakeSnowball}
              className="mt-2 w-full py-3.5 rounded-xl bg-[#2C2F63] hover:bg-[#222552] active:scale-[0.99] text-white text-sm font-extrabold border border-white/15 shadow-[0_6px_16px_rgba(44,47,99,0.28)] transition-all mb-4"
            >
              우편함 열어보기
            </button>

            {/* 내 스노우볼 공유 유도 카드 (단일 [스노우볼 공유하기] 버튼) */}
            <div className="w-full p-4 rounded-2xl bg-white/95 border border-[#2C2F63]/15 text-[#2C2F63] text-left mb-3 shadow-[0_6px_18px_rgba(44,47,99,0.12)]">
              <h2 className="text-xs font-extrabold text-[#2C2F63] mb-1">
                친구와 편지를 나눠봐요!
              </h2>
              <p className="text-[11px] font-semibold text-[#2C2F63]/75 mb-3">
                친구들이 내 스노우볼에 편지를 남기면 응모권이 쌓여요
              </p>
              <button
                type="button"
                onClick={handleCopyMyLink}
                className="w-full py-3 rounded-xl bg-[#2C2F63] hover:bg-[#222552] text-white text-xs font-extrabold transition-colors shadow-xs"
              >
                스노우볼 공유하기
              </button>
            </div>

            {/* 하단 액션 영역 */}
            <div className="w-full space-y-2.5">
              {/* 1) 내 응모권 N장 (사용 X장 / 잔여 Y장) 요약 카드 */}
              <div className="w-full p-4 rounded-2xl bg-white/95 border border-[#2C2F63]/15 text-[#2C2F63] shadow-[0_6px_18px_rgba(44,47,99,0.12)]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-[#2C2F63]/80">
                    내 응모권
                  </span>
                  <span className="text-xl font-black text-[#2C2F63]">
                    {ticketSummary?.totalTickets ?? targetSnowball.ticket_count}장
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-[#2C2F63]/75 text-left">
                  사용 {ticketSummary?.allocatedTickets ?? 0}장 / 잔여{" "}
                  {ticketSummary?.availableTickets ?? targetSnowball.ticket_count}장
                </p>
              </div>

              {/* 2) [강조 배너] Gemini 가입 인증 시 응모권 +100장 · 레벨 +1 */}
              {!isGeminiApproved && (
                <GeminiHighlightBanner
                  snowball={targetSnowball}
                  subtitle="스노우볼 업그레이드 해보세요 · 레벨 +1"
                />
              )}

              {/* 3) [응모하러 가기] 남색(#2C2F63) 버튼 (S06 이동) */}
              <Link
                href="/raffle"
                className="block w-full py-3.5 rounded-xl bg-[#2C2F63] hover:bg-[#222552] text-white text-sm font-extrabold text-center shadow-[0_6px_16px_rgba(44,47,99,0.28)] transition-colors"
              >
                응모하러 가기
              </Link>

              {/* 4) 추천 현황 보기 -> 하단 눈밭(#FAF0DC) 위에서도 선명한 남색(#2C2F63) 링크 */}
              <div className="pt-2 text-center">
                <Link
                  href="/referral"
                  className="inline-block px-4 py-1.5 rounded-full bg-white/85 border border-[#2C2F63]/20 text-xs font-extrabold text-[#2C2F63] hover:bg-white shadow-2xs transition-colors"
                >
                  추천 현황 보기 →
                </Link>
              </div>
            </div>
          </>
        ) : (
          /* ================================================================
              [S05] 친구 스노우볼 (/snowball/[친구slug] 또는 own-link)
             ================================================================ */
          <>
            <div className="w-full flex flex-col items-center justify-center text-center">
              <h1 className="tracking-tight text-center">
                <span className="block text-3xl sm:text-4xl font-black text-white leading-tight break-keep">
                  {targetSnowball.nickname}의
                </span>
                <span className="block text-2xl font-extrabold text-white leading-tight mt-1">
                  스노우볼
                </span>
              </h1>

              {isOwnLinkView && (
                <span className="mt-4 inline-flex items-center justify-center px-3.5 py-1 rounded-full bg-[#2C2F63] border border-white/20 text-white text-[11px] font-bold leading-none">
                  내 스노우볼
                </span>
              )}
            </div>

            {/* 받은 편지 N개 & Lv.n 줄을 위로 올리고, 아래 스노우볼과의 간격을 확보해 스노우볼 눈언덕 착지 위치 유지 */}
            <div className="mt-3.5 sm:mt-4 w-full flex items-center justify-between gap-2 px-1">
              <span className="text-base sm:text-lg font-extrabold text-white drop-shadow-[0_1px_2px_rgba(26,30,67,0.45)] leading-none">
                받은 편지 {letters.length}개
              </span>
              <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-[#2C2F63]/80 border border-white/25 text-sm sm:text-base font-extrabold text-white leading-none shadow-2xs">
                {levelInfo.stageLabel}
              </span>
            </div>

            {/* 친구의 현재 레벨(0/1/3)에 맞는 스노우볼 이미지 (하단 흰 눈언덕 바닥에 받침대가 안정적으로 안착하도록 위치 유지) */}
            <div className="mt-8 sm:mt-9 mb-2 flex justify-center">
              <SnowballGraphic
                level={targetSnowball.level}
                letters={letters}
              />
            </div>

            {/* 상태 1: 내 스노우볼에 내가 공유 링크로 접속한 경우 (own-link) */}
            {isOwner ? (
              <div className="w-full mt-4 space-y-3 text-left">
                <div className="p-4 rounded-2xl bg-white/95 border border-[#2C2F63]/15 text-[#2C2F63] shadow-[0_6px_18px_rgba(44,47,99,0.12)]">
                  <p className="text-sm font-extrabold text-[#2C2F63] mb-1">
                    내 스노우볼에는 편지를 넣을 수 없어요
                  </p>
                  <p className="text-xs font-semibold text-[#2C2F63]/75">
                    친구에게 링크를 보내 편지를 받아보세요
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCopyMyLink}
                  className="w-full py-3.5 rounded-xl bg-[#2C2F63] hover:bg-[#222552] text-white text-sm font-extrabold shadow-md transition-colors"
                >
                  내 스노우볼 공유하기
                </button>
              </div>
            ) : justSent ? (
              /* 상태 2: 방금 편지 전송 완료 (S05 · sent) */
              <div className="w-full mt-4 space-y-2.5 text-left">
                <div className="p-4 rounded-2xl bg-[#2C2F63] border border-white/20 text-white shadow-md">
                  <p className="text-base font-extrabold mb-0.5">
                    편지를 넣었어요!
                  </p>
                  <p className="text-xs text-white/95 font-medium">
                    {justSentRewardMsg}
                  </p>
                </div>

                {mySnowball && (
                  <Link
                    href={`/snowball/${encodeURIComponent(mySnowball.slug)}`}
                    className="block w-full py-3.5 rounded-xl bg-[#2C2F63] hover:bg-[#222552] text-white text-sm font-extrabold text-center shadow-md transition-colors"
                  >
                    내 스노우볼 보러 가기
                  </Link>
                )}

                <button
                  type="button"
                  onClick={handleCopyMyLink}
                  className="w-full py-3.5 rounded-xl bg-white hover:bg-slate-50 border border-[#2C2F63]/20 text-[#2C2F63] text-sm font-extrabold shadow-md transition-colors"
                >
                  내 스노우볼도 공유하기
                </button>
              </div>
            ) : myExistingLetter ? (
              /* 상태 3: 이미 이 스노우볼에 편지를 보낸 경우 (S05 · already-sent) */
              <div className="w-full mt-4 space-y-2.5 text-left">
                <div className="p-4 rounded-2xl bg-white/95 border border-[#2C2F63]/15 text-[#2C2F63] shadow-[0_6px_18px_rgba(44,47,99,0.12)]">
                  <p className="text-sm font-extrabold text-[#2C2F63] mb-1">
                    이미 편지를 보냈어요
                  </p>
                  <p className="text-xs font-semibold text-[#2C2F63]/75">
                    같은 스노우볼에는 1번만 보낼 수 있어요 ·{" "}
                    {myExistingLetter.created_at
                      ? new Date(myExistingLetter.created_at).toLocaleDateString(
                          "ko-KR",
                          { month: "numeric", day: "numeric" }
                        )
                      : "오늘"}{" "}
                    보냄
                  </p>
                </div>

                <button
                  type="button"
                  disabled
                  className="w-full py-3.5 rounded-xl bg-[#2C2F63]/45 text-white/85 text-sm font-extrabold cursor-not-allowed"
                >
                  이미 편지를 보냈어요
                </button>

                {mySnowball && (
                  <Link
                    href={`/snowball/${encodeURIComponent(mySnowball.slug)}`}
                    className="block w-full py-3.5 rounded-xl bg-[#2C2F63] hover:bg-[#222552] text-white text-sm font-extrabold text-center shadow-md transition-colors"
                  >
                    내 스노우볼 보러 가기
                  </Link>
                )}
              </div>
            ) : (
              /* 상태 4: 편지 작성 가능 (하단 눈밭 위에서도 선명하게 보이도록 화이트 카드 & #2C2F63 대비 적용) */
              <form
                onSubmit={handleSendLetterSubmit}
                className="w-full mt-3 p-4 rounded-2xl bg-white/95 border border-[#2C2F63]/15 shadow-[0_8px_22px_rgba(44,47,99,0.14)] text-left text-[#2C2F63]"
              >
                <h2 className="text-sm font-extrabold text-[#2C2F63] mb-2">
                  {targetSnowball.nickname}의 스노우볼에 편지 넣기
                </h2>

                {letterError && (
                  <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-700">
                    ⚠️ {letterError}
                  </div>
                )}

                <label className="block text-[11px] font-bold text-[#2C2F63]/80 mb-1.5">
                  메시지
                </label>

                <textarea
                  rows={4}
                  minLength={15}
                  maxLength={200}
                  value={letterContent}
                  onChange={(e) =>
                    setLetterContent(e.target.value.slice(0, 200))
                  }
                  placeholder={`${targetSnowball.nickname}아 메리 크리스마스! 시험 끝나면 같이 맛있는 거 먹으러 가자! (최소 15자)`}
                  required
                  className="w-full p-3.5 rounded-2xl bg-[#F8F9FE] border border-[#2C2F63]/20 text-xs font-semibold text-[#2C2F63] placeholder:text-[#2C2F63]/45 focus:outline-none focus:ring-2 focus:ring-[#2C2F63] shadow-inner resize-none"
                />

                <div className="mt-1.5 mb-3 flex flex-wrap items-center justify-between gap-1 text-[10px] font-bold text-[#2C2F63]/75 break-keep">
                  <span className="leading-snug">
                    12월 1일에 {targetSnowball.nickname}가 열어볼 수 있어요 · 보낸 사람 닉네임은 공개돼요
                  </span>
                  <span className="font-mono font-extrabold text-[#2C2F63] shrink-0">
                    {letterContent.trim().length} / 200자 (최소 15자)
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={sendingLetter || letterContent.trim().length < 15}
                  className="w-full py-3.5 rounded-xl bg-[#2C2F63] hover:bg-[#222552] disabled:bg-[#2C2F63]/40 disabled:text-white/75 text-white text-sm font-extrabold shadow-md transition-all"
                >
                  {sendingLetter ? "편지 넣는 중..." : "편지 넣기"}
                </button>

                <p className="mt-2 text-center text-[11px] text-[#2C2F63] font-extrabold">
                  보내면 나도 응모권 +1 · {targetSnowball.nickname}님도 +1
                </p>
              </form>
            )}
          </>
        )}
      </div>

      {/* ====================================================================
          P04 팝업: 우편함 열어보기
          - 바탕색을 스노우볼 단계별 받침대 상징색과 1:1 연동:
            Lv.0 민트(#C0EEE8) / Lv.1 핑크(#FBD0D8) / Lv.3 골드(#FAEBBF)
          - 내부 각 편지지 카드는 단계별 따뜻한 크림/골드 단색과 짙은 남색(#2C2F63) 텍스트로 구성:
            Lv.0: #F3D183 / Lv.1: #FDF9EB / Lv.3: #FFFBF9
         ==================================================================== */}
      {isP04Open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={() => setIsP04Open(false)}
          >
            <div
              style={{ backgroundColor: levelInfo.mailboxBgHex }}
              className="w-full max-w-[350px] max-h-[85vh] rounded-3xl border-2 border-white/70 text-[#2C2F63] p-5 shadow-2xl flex flex-col break-keep"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-base font-extrabold text-[#2C2F63]">
                  받은 편지 {letters.length}개
                </h2>
                <button
                  type="button"
                  onClick={() => setIsP04Open(false)}
                  className="text-xs font-extrabold text-[#2C2F63]/75 hover:text-[#2C2F63] px-2 py-1"
                >
                  닫기 ✕
                </button>
              </div>

              {letters.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <p className="text-3xl">💌</p>
                  <p className="text-sm font-extrabold text-[#2C2F63]">
                    아직 도착한 편지가 없어요
                  </p>
                  <p className="text-xs font-bold text-[#2C2F63]/80">
                    내 스노우볼 링크를 공유하고 친구들에게 편지를 받아보세요!
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsP04Open(false);
                      handleCopyMyLink();
                    }}
                    className="w-full py-3 rounded-xl bg-[#2C2F63] hover:bg-[#222552] text-white text-xs font-extrabold shadow-md"
                  >
                    공유 링크 보내기
                  </button>
                </div>
              ) : (
                <>
                  <p
                    style={{ fontFamily: '"Gowun Dodum", sans-serif' }}
                    className="mb-3 text-left text-xs font-medium text-[#2C2F63]"
                  >
                    편지는 12월 1일에 공개 돼요
                  </p>

                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                    {letters.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          backgroundColor: levelInfo.letterCardBgHex,
                          fontFamily: '"Gowun Dodum", sans-serif',
                        }}
                        className="p-3.5 rounded-2xl border border-[#2C2F63]/15 text-[#2C2F63] text-left shadow-sm"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span
                            style={{ fontFamily: '"Gowun Dodum", sans-serif' }}
                            className="text-xs font-medium text-[#2C2F63]"
                          >
                            from.{item.sender_name}
                          </span>
                          <span
                            style={{ fontFamily: '"Gowun Dodum", sans-serif' }}
                            className="text-[10px] font-normal text-[#2C2F63]/70"
                          >
                            {item.created_at
                              ? new Date(item.created_at).toLocaleDateString(
                                  "ko-KR",
                                  { month: "numeric", day: "numeric" }
                                )
                              : ""}
                          </span>
                        </div>
                        {/* 12월 1일 공개 전까지 편지 원문 스포일러 원천 차단 (고정 마스킹 + 짙은 남색 #2C2F63 블러 처리) */}
                        <p
                          style={{ fontFamily: '"Gowun Dodum", sans-serif' }}
                          className="text-xs font-normal text-[#2C2F63]/75 leading-relaxed blur-[6px] select-none pointer-events-none"
                          aria-hidden="true"
                        >
                          12월 1일에 공개되는 비밀 크리스마스 메시지입니다. 조금만 기다려 주세요!
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#2C2F63]/15 flex flex-col gap-2">
                    {isCampaignOpenDateReached() && (
                      <Link
                        href="/open"
                        onClick={() => setIsP04Open(false)}
                        className="w-full py-2.5 rounded-xl bg-white/90 text-[#2C2F63] text-xs font-extrabold text-center shadow-xs"
                      >
                        편지 전문 열람 화면으로 이동 →
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsP04Open(false)}
                      className="w-full py-3 rounded-xl bg-[#2C2F63] hover:bg-[#222552] text-white text-xs font-extrabold shadow-md"
                    >
                      확인
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </AppShell>
  );
}

export default function SnowballDetailClient() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="flex items-center justify-center py-24 text-xs text-white/70">
            로딩 중...
          </div>
        </AppShell>
      }
    >
      <SnowballDetailContent />
    </Suspense>
  );
}
