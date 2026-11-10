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
  saveInvitedByNickname,
  savePendingInviteSlug,
  sendGiftLetter,
  setFlashToast,
} from "@/lib/supabase";

/**
 * S04(내 스노우볼 홈) & S05(친구 스노우볼) 통합 페이지
 * - 비로그인(또는 스노우볼 미생성) 상태로 /snowball/[slug]에 직접 접속 시:
 *   절대 바로 스노우볼 화면(S05)을 노출하지 않고 즉시 /?sb=[slug]&utm_source=friend (S01 친구 초대 화면)로 강제 리다이렉트!
 * - 모든 공유 링크 복사 URL은 반드시 /?sb=[내slug]&utm_source=friend 형태로 통일!
 * - S04 상단 요소 간격 여유 있게 확대 및 하단 불필요한 빈 여백 제거(pb-12)
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
  const [justSentRewardMsg, setJustSentRewardMsg] = useState<string>("응모권 +1장");
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

    // 2) [핵심 해결책 ②] 비로그인 상태(또는 아직 내 스노우볼을 만들지 않은 상태)로 /snowball/[slug]에 직접 접속한 경우:
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

  // [핵심 해결책 ①] 모든 [내 스노우볼 공유하기] / [공유 링크 보내기] 버튼 클릭 시 반드시 /?sb=[내slug]&utm_source=friend 복사
  const handleCopyMyLink = async () => {
    const ownerToShare = mySnowball || targetSnowball;
    if (!ownerToShare || typeof window === "undefined") return;
    const shareUrl = `${window.location.origin}/?sb=${encodeURIComponent(
      ownerToShare.slug
    )}&utm_source=friend`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      showCopyNotice("✓ 내 스노우볼 초대 링크가 복사되었어요!");
    } catch {
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

  const statusBadgeText = isGeminiApproved
    ? "Gemini 승인"
    : isGeminiPending
    ? "Gemini 심사 중"
    : "Gemini 미인증";

  return (
    <AppShell>
      {copiedToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[75] px-4 py-2.5 rounded-full bg-emerald-500 text-white text-xs font-extrabold shadow-xl">
          {copiedToast}
        </div>
      )}

      <div className="flex flex-col px-5 pt-7 pb-12">
        {isOwner && !isOwnLinkView ? (
          /* ================================================================
              [S04] 내 스노우볼 홈 (/snowball/[내slug])
              - 상단 요소 간격 여유 있게 확대:
                ① [Gemini 미인증] 뱃지 아래 mb-6
                ② 받은 편지 N개 및 사인업 레벨바와 스노우볼 이미지 사이 my-7
                ③ 스노우볼 이미지와 [흔들어서 편지 확인하기] 버튼 사이 mt-7
             ================================================================ */
          <>
            {/* 상단 타이틀 (닉네임 길이에 따른 clamp 자동 조절 + word-break: keep-all) */}
            <div className="text-center mb-6">
              <h1
                style={{
                  fontSize: "clamp(1.25rem, 5vw, 1.75rem)",
                  wordBreak: "keep-all",
                }}
                className="font-extrabold text-white tracking-tight leading-tight mb-3"
              >
                {targetSnowball.nickname}의 스노우볼
              </h1>

              {/* ① [Gemini 미인증] 상태 마크 뱃지 */}
              <span
                className={`inline-block px-3.5 py-1 rounded-full text-[11px] font-bold border ${
                  isGeminiApproved
                    ? "bg-[#3898FF] border-[#66B2FF] text-white"
                    : "bg-white/10 border-white/25 text-sky-100"
                }`}
              >
                {statusBadgeText}
              </span>
            </div>

            {/* 받은 편지 N개 & 사인업 레벨 진행바 (LV0 -> LV1 -> LV3 -> LV10) */}
            <div className="w-full">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-white">
                    받은 편지 {letters.length}개
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      levelInfo.tier > 0
                        ? "bg-[#3898FF] text-white"
                        : "bg-white/15 text-sky-100"
                    }`}
                  >
                    {levelInfo.tierLabel}
                  </span>
                </div>
              </div>

              <div className="px-1">
                <div className="flex items-center justify-between text-[11px] text-sky-200/90 mb-1.5">
                  <span className="font-bold">사인업 LV{levelInfo.rawLevel}</span>
                  <span>
                    {levelInfo.nextTierTarget !== null
                      ? `LV${levelInfo.nextTierTarget}까지 ${levelInfo.remainingToNext}명`
                      : "최고 단계 달성"}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#3898FF] transition-all duration-500"
                    style={{ width: `${levelInfo.progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* ② 사인업 레벨바와 스노우볼 이미지 사이 여유 간격 확대 (my-7) */}
            <div className="my-7 flex justify-center">
              <SnowballGraphic
                level={targetSnowball.level}
                letters={letters}
                isShaking={isShaking}
              />
            </div>

            {/* ③ 스노우볼 이미지와 [흔들어서 편지 확인하기] 버튼 사이 간격 (mt-2 + 상단 my-7로 총 여유 확보) */}
            <button
              type="button"
              onClick={handleShakeSnowball}
              className="mt-2 w-full py-3.5 rounded-xl bg-[#3898FF] hover:bg-[#2589F5] active:scale-[0.99] text-white text-sm font-extrabold shadow-md transition-all mb-4"
            >
              흔들어서 편지 확인하기
            </button>

            {/* 내 스노우볼 공유 유도 유리 카드 (단일 [스노우볼 공유하기] 버튼) */}
            <div className="w-full p-4 rounded-2xl bg-[#F4F9FF] text-[#0B1528] text-left mb-3 shadow-md">
              <h2 className="text-xs font-extrabold text-[#102A4E] mb-1">
                친구와 편지를 나눠봐요!
              </h2>
              <p className="text-[11px] text-[#5B7493] mb-3">
                친구들이 내 스노우볼에 편지를 남기면 응모권이 쌓여요
              </p>
              <button
                type="button"
                onClick={handleCopyMyLink}
                className="w-full py-3 rounded-xl bg-[#3898FF] hover:bg-[#2589F5] text-white text-xs font-extrabold transition-colors"
              >
                스노우볼 공유하기
              </button>
            </div>

            {/* 하단 액션 영역 */}
            <div className="w-full space-y-2.5">
              {/* 1) 내 응모권 N장 (건 X · 남은 Y) 요약 카드 */}
              <div className="w-full p-4 rounded-2xl bg-[#F4F9FF] text-[#0B1528] shadow-md">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-[#5B7493]">
                    내 응모권
                  </span>
                  <span className="text-xl font-black text-[#102A4E]">
                    {ticketSummary?.totalTickets ?? targetSnowball.ticket_count}장
                  </span>
                </div>
                <p className="text-[11px] font-medium text-[#5B7493] text-left">
                  건 {ticketSummary?.allocatedTickets ?? 0} · 남은{" "}
                  {ticketSummary?.availableTickets ?? targetSnowball.ticket_count}
                </p>
              </div>

              {/* 2) [강조 배너] Gemini 가입 인증 시 응모권 +100장 · 레벨 +1 (클릭 시 즉시 /verify 이동) */}
              {!isGeminiApproved && (
                <GeminiHighlightBanner
                  snowball={targetSnowball}
                  subtitle="스노우볼 업그레이드 해보세요 · 레벨 +1"
                />
              )}

              {/* 3) [응모하러 가기] 하늘색 버튼 (S06 이동) — 중복 공유 버튼 삭제 완료 */}
              <Link
                href="/raffle"
                className="block w-full py-3.5 rounded-xl bg-[#3898FF] hover:bg-[#2589F5] text-white text-sm font-extrabold text-center shadow-md transition-colors"
              >
                응모하러 가기
              </Link>

              {/* 4) 추천 현황 보기 -> 링크 (S07 이동) */}
              <div className="pt-2 text-center">
                <Link
                  href="/referral"
                  className="inline-block py-1.5 text-xs font-bold text-sky-200 hover:text-white transition-colors"
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
            <div className="text-center mb-4">
              <h1
                style={{
                  fontSize: "clamp(1.25rem, 5vw, 1.75rem)",
                  wordBreak: "keep-all",
                }}
                className="font-extrabold text-white tracking-tight leading-tight mb-2.5"
              >
                {targetSnowball.nickname}의 스노우볼
              </h1>

              {isOwnLinkView ? (
                <span className="inline-block px-3 py-0.5 rounded-full bg-[#3898FF] text-white text-[11px] font-bold">
                  내 스노우볼
                </span>
              ) : (
                <span className="inline-block px-3 py-0.5 rounded-full bg-white/15 text-sky-100 text-[11px] font-bold">
                  {levelInfo.tierLabel}
                </span>
              )}
            </div>

            <div className="w-full text-left mb-2">
              <span className="text-xs font-extrabold text-white">
                받은 편지 {letters.length}개
              </span>
            </div>

            {/* 친구의 현재 레벨(0/1/3/10)에 맞는 스노우볼 이미지 */}
            <div className="my-4 flex justify-center">
              <SnowballGraphic
                level={targetSnowball.level}
                letters={letters}
              />
            </div>

            {/* 상태 1: 내 스노우볼에 내가 공유 링크로 접속한 경우 (own-link) */}
            {isOwner ? (
              <div className="w-full mt-4 space-y-3 text-left">
                <div className="p-4 rounded-2xl bg-[#F4F9FF] text-[#0B1528] shadow-md">
                  <p className="text-sm font-extrabold text-[#102A4E] mb-1">
                    내 스노우볼에는 편지를 넣을 수 없어요
                  </p>
                  <p className="text-xs text-[#5B7493]">
                    친구에게 링크를 보내 편지를 받아보세요
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCopyMyLink}
                  className="w-full py-3.5 rounded-xl bg-[#3898FF] hover:bg-[#2589F5] text-white text-sm font-extrabold shadow-md transition-colors"
                >
                  내 스노우볼 공유하기
                </button>
              </div>
            ) : justSent ? (
              /* 상태 2: 방금 편지 전송 완료 (S05 · sent) */
              <div className="w-full mt-4 space-y-2.5 text-left">
                <div className="p-4 rounded-2xl bg-[#52A7FF] text-white shadow-md">
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
                    className="block w-full py-3.5 rounded-xl bg-[#3898FF] hover:bg-[#2589F5] text-white text-sm font-extrabold text-center shadow-md transition-colors"
                  >
                    내 스노우볼 보러 가기
                  </Link>
                )}

                <button
                  type="button"
                  onClick={handleCopyMyLink}
                  className="w-full py-3.5 rounded-xl bg-white hover:bg-sky-50 text-[#102A4E] text-sm font-extrabold shadow-md transition-colors"
                >
                  내 스노우볼도 공유하기
                </button>
              </div>
            ) : myExistingLetter ? (
              /* 상태 3: 이미 이 스노우볼에 편지를 보낸 경우 (S05 · already-sent) */
              <div className="w-full mt-4 space-y-2.5 text-left">
                <div className="p-4 rounded-2xl bg-[#F4F9FF] text-[#0B1528] shadow-md">
                  <p className="text-sm font-extrabold text-[#102A4E] mb-1">
                    이미 편지를 보냈어요
                  </p>
                  <p className="text-xs text-[#5B7493]">
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
                  className="w-full py-3.5 rounded-xl bg-[#5B87B8]/70 text-white/60 text-sm font-extrabold cursor-not-allowed"
                >
                  이미 편지를 보냈어요
                </button>

                {mySnowball && (
                  <Link
                    href={`/snowball/${encodeURIComponent(mySnowball.slug)}`}
                    className="block w-full py-3.5 rounded-xl bg-white hover:bg-sky-50 text-[#102A4E] text-sm font-extrabold text-center shadow-md transition-colors"
                  >
                    내 스노우볼 보러 가기
                  </Link>
                )}
              </div>
            ) : (
              /* 상태 4: 편지 작성 가능 (S05 · ready, 최소 15자 ~ 최대 200자 제한 & 실시간 카운터) */
              <form
                onSubmit={handleSendLetterSubmit}
                className="w-full mt-3 text-left"
              >
                <h2 className="text-sm font-extrabold text-white mb-2">
                  {targetSnowball.nickname}의 스노우볼에 편지 넣기
                </h2>

                {letterError && (
                  <div className="mb-3 p-3 rounded-xl bg-red-500/20 border border-red-300/50 text-xs text-red-100">
                    ⚠️ {letterError}
                  </div>
                )}

                <label className="block text-[11px] font-semibold text-sky-100 mb-1.5">
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
                  className="w-full p-3.5 rounded-2xl bg-white text-xs font-medium text-[#0B1528] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3898FF] shadow-md resize-none"
                />

                <div className="mt-1.5 mb-3 flex items-center justify-between text-[10px] text-sky-200/85">
                  <span>
                    12월에 {targetSnowball.nickname}가 열어볼 수 있어요 · 보낸 사람 닉네임은 공개돼요
                  </span>
                  <span className="font-mono font-bold shrink-0 ml-2">
                    {letterContent.trim().length} / 200자 (최소 15자)
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={sendingLetter || letterContent.trim().length < 15}
                  className="w-full py-3.5 rounded-xl bg-[#3898FF] hover:bg-[#2589F5] disabled:bg-[#5B87B8]/70 disabled:text-white/60 text-white text-sm font-extrabold shadow-lg transition-all"
                >
                  {sendingLetter ? "편지 넣는 중..." : "편지 넣기"}
                </button>

                <p className="mt-2 text-center text-[11px] text-sky-200/90 font-medium">
                  보내면 나도 응모권 +1 · {targetSnowball.nickname}님도 +1
                </p>
              </form>
            )}
          </>
        )}
      </div>

      {/* ====================================================================
          P04 팝업: 흔들어서 편지 확인하기 (최상위 뷰포트 createPortal 렌더링으로 잘림 원천 방지)
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
              className="w-full max-w-[350px] max-h-[85vh] rounded-3xl bg-white text-[#0B1528] p-5 shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#EBF4FF] text-[#1E88E5] text-[10px] font-extrabold mb-1">
                    P04 · 스노우볼 편지함
                  </span>
                  <h2 className="text-base font-extrabold text-[#102A4E]">
                    받은 편지 {letters.length}개
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsP04Open(false)}
                  className="text-xs text-slate-400 hover:text-slate-700 px-2 py-1"
                >
                  닫기 ✕
                </button>
              </div>

              {letters.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <p className="text-3xl">⛄</p>
                  <p className="text-sm font-extrabold text-[#102A4E]">
                    아직 도착한 편지가 없어요
                  </p>
                  <p className="text-xs text-[#5B7493]">
                    내 스노우볼 링크를 공유하고 친구들에게 편지를 받아보세요!
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsP04Open(false);
                      handleCopyMyLink();
                    }}
                    className="w-full py-3 rounded-xl bg-[#3898FF] text-white text-xs font-extrabold"
                  >
                    공유 링크 보내기
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-3 p-3 rounded-xl bg-[#F4F9FF] border border-[#DCEBFA] text-left">
                    <p className="text-[11px] font-bold text-[#102A4E]">
                      🔒 11월 30일 메시지 공개 전이에요
                    </p>
                    <p className="text-[10px] text-[#5B7493] mt-0.5">
                      누가 편지를 보냈는지만 먼저 확인하고, 편지 원문은 11월 30일에 열려요!
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                    {letters.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-2xl bg-[#F8FBFF] border border-[#E2EEFC] text-left"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-extrabold text-[#102A4E]">
                            💌 {item.sender_name}
                          </span>
                          <span className="text-[10px] text-[#7A93B2]">
                            {item.created_at
                              ? new Date(item.created_at).toLocaleDateString(
                                  "ko-KR",
                                  { month: "numeric", day: "numeric" }
                                )
                              : ""}
                          </span>
                        </div>
                        {/* 11월 30일 공개 전까지 편지 원문 스포일러 원천 차단 (고정 마스킹 + 블러 처리) */}
                        <p
                          className="text-xs text-[#4A6583] leading-relaxed blur-[6px] select-none pointer-events-none"
                          aria-hidden="true"
                        >
                          11월 30일에 공개되는 비밀 크리스마스 메시지입니다. 조금만 기다려 주세요!
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
                    {isCampaignOpenDateReached() && (
                      <Link
                        href="/open"
                        onClick={() => setIsP04Open(false)}
                        className="w-full py-2.5 rounded-xl bg-[#EBF4FF] text-[#1E88E5] text-xs font-extrabold text-center"
                      >
                        편지 전문 열람 화면으로 이동 →
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsP04Open(false)}
                      className="w-full py-3 rounded-xl bg-[#3898FF] text-white text-xs font-extrabold"
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

export default function SnowballDetailPage() {
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
