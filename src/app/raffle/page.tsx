"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import GeminiHighlightBanner from "@/components/GeminiHighlightBanner";
import {
  SAMPLE_PRIZES,
  Snowball,
  TicketSummary,
  getCurrentAuthAndSnowball,
  getTicketSummary,
  submitRaffleAllocations,
} from "@/lib/supabase";

/**
 * S06 크리스마스 선물 응모 - 위시리스트 (/raffle) & P03 확인 팝업
 * - 내 응모권 N장 (건 X · 남은 Y) 요약 카드
 * - [강조 배너] Gemini 가입 인증 시 응모권 +100장
 * - 경품 카드 3종 (1등 무신사 20만 원 1명 / 2등 신세계 10만 원 2명 / 3등 배민 3만 원 5명):
 *   DB 실시간 '현재 최고 응모권 N장' 및 '내가 건 응모권 N장' 표시, - / + 수량 조절
 * - 하단 투썸플레이스 1만 원권(15명) 자동 응모 안내 박스
 * - [응모권 사용하기] 클릭 시 P03 확인 팝업 -> [이대로 걸기]로 raffle_allocations 저장
 */
export default function RafflePage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [mySnowball, setMySnowball] = useState<Snowball | null>(null);
  const [summary, setSummary] = useState<TicketSummary>({
    totalTickets: 0,
    allocatedTickets: 0,
    availableTickets: 0,
    allocationsByPrize: {},
    totalAllocationsByPrize: {},
  });

  const [draftAlloc, setDraftAlloc] = useState<Record<string, number>>({});
  const [isP03Open, setIsP03Open] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadRaffleData = useCallback(async () => {
    setLoading(true);
    const auth = await getCurrentAuthAndSnowball();
    const sb = auth.snowball;
    setMySnowball(sb);

    if (sb) {
      const ticketData = await getTicketSummary(sb.id);
      setSummary(ticketData);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRaffleData();

    const onAuthChange = () => {
      setDraftAlloc({});
      loadRaffleData();
    };
    window.addEventListener("santa-auth-changed", onAuthChange);
    return () => {
      window.removeEventListener("santa-auth-changed", onAuthChange);
    };
  }, [loadRaffleData]);

  const draftTotal = Object.values(draftAlloc).reduce(
    (sum, n) => sum + (n || 0),
    0
  );
  const remainingSelectable = Math.max(
    0,
    summary.availableTickets - draftTotal
  );

  const adjustCount = (prizeId: string, delta: number) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    setDraftAlloc((prev) => {
      const current = prev[prizeId] || 0;
      if (delta > 0) {
        const allowedAdd = Math.min(delta, remainingSelectable);
        if (allowedAdd <= 0) return prev;
        return { ...prev, [prizeId]: current + allowedAdd };
      } else {
        const nextVal = Math.max(0, current + delta);
        return { ...prev, [prizeId]: nextVal };
      }
    });
  };

  const handleConfirmSubmit = async () => {
    if (!mySnowball) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const updated = await submitRaffleAllocations(mySnowball.id, draftAlloc);
      setSummary(updated);
      setDraftAlloc({});
      setIsP03Open(false);
      setSuccessMsg(
        `✓ 응모권 ${draftTotal}장이 성공적으로 반영되었어요! (남은 응모권 ${updated.availableTickets}장)`
      );
    } catch (err) {
      setIsP03Open(false);
      setErrorMsg(
        err instanceof Error ? err.message : "응모 처리 중 오류가 발생했습니다."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex-1 flex items-center justify-center py-20 text-xs text-white/70">
          응모권 및 경품 현황을 불러오는 중...
        </div>
      </AppShell>
    );
  }

  if (!mySnowball) {
    return (
      <AppShell>
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-base font-extrabold text-white mb-4">
            로그인 후 경품에 응모할 수 있어요!
          </p>
          <Link
            href="/login"
            className="w-full py-3.5 rounded-xl bg-[#2C2F63] hover:bg-[#222552] text-white text-sm font-extrabold"
          >
            로그인하고 내 스노우볼 만들기
          </Link>
        </div>
      </AppShell>
    );
  }

  const isGeminiApproved =
    mySnowball.gemini_verified || mySnowball.gemini_status === "승인";

  return (
    <AppShell>
      <div className="flex flex-col px-5 pt-6 pb-12 break-keep">
        {/* 상단 타이틀 */}
        <div className="text-center mb-5">
          <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1.5">
            크리스마스 선물 응모
          </h1>
          <p className="text-xs text-sky-100/90 leading-relaxed break-keep">
            모든 응모권을 원하는 경품에 나눠 사용해 보세요.
            <br />
            ⓘ 응모권을 많이 사용할수록 당첨 확률이 높아져요.
          </p>
        </div>

        {/* 내 응모권 N장 (사용 X장 / 잔여 Y장) 요약 카드 */}
        <div className="w-full p-4 rounded-2xl bg-[#F4F9FF] text-[#0B1528] shadow-md mb-3 text-left">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-[#5B7493]">내 응모권</span>
            <span className="text-xl font-black text-[#102A4E]">
              {summary.totalTickets}장
            </span>
          </div>
          <p className="text-[11px] font-medium text-[#5B7493]">
            사용 {summary.allocatedTickets}장 / 잔여 {remainingSelectable}장
          </p>
        </div>

        {/* [강조 배너] Gemini 가입 인증 시 응모권 +100장 */}
        {!isGeminiApproved && (
          <div className="mb-3">
            <GeminiHighlightBanner
              snowball={mySnowball}
              subtitle="11/9 이후 Gemini 대학생 플랜 신규 가입자만 인정"
            />
          </div>
        )}

        {/* 응모권이 0장일 때 안내 박스 (S06 · zero 시안 반영) */}
        {summary.availableTickets === 0 && summary.allocatedTickets === 0 && (
          <div className="w-full p-4 rounded-2xl bg-[#F4F9FF] text-[#0B1528] shadow-md mb-3 text-left">
            <p className="text-xs font-extrabold text-[#102A4E] mb-1">
              아직 응모권이 없어요
            </p>
            <p className="text-[11px] text-[#5B7493] leading-relaxed break-keep">
              친구 스노우볼에 편지 보내기 +1 · 편지 받기 +1 · Gemini 가입 인증 +100
            </p>
          </div>
        )}

        {errorMsg && (
          <div className="mb-3 p-3 rounded-xl bg-red-500/20 border border-red-300/50 text-xs text-red-100">
            ⚠️ {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-3 p-3 rounded-xl bg-emerald-500/20 border border-emerald-300/50 text-xs font-bold text-emerald-100">
            {successMsg}
          </div>
        )}

        {/* 경품 카드 3종 (1등 무신사 / 2등 신세계 / 3등 배민) */}
        <div className="space-y-3 mb-4">
          {SAMPLE_PRIZES.map((prize) => {
            const alreadyPut = summary.allocationsByPrize[prize.id] || 0;
            const totalGatheredCount =
              summary.totalAllocationsByPrize[prize.id] || 0;
            const currentDraft = draftAlloc[prize.id] || 0;

            return (
              <div
                key={prize.id}
                className="w-full p-4 rounded-2xl bg-[#F4F9FF] text-[#0B1528] shadow-md text-left"
              >
                {/* 상단 상품 아이콘 & 정보 */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="min-w-[64px] min-h-[64px] h-auto px-2 py-2 rounded-xl border border-[#BFD8F5] bg-[#E8F2FF] flex flex-col items-center justify-center shrink-0 text-center">
                    <span className="text-2xl leading-none">{prize.emoji}</span>
                    <span className="text-[9px] font-bold text-[#102A4E] mt-1 break-keep">
                      {prize.shortTitle}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#2C2F63] text-white text-[10px] font-extrabold mb-1">
                      {prize.rankBadge}
                    </span>
                    <h2 className="text-sm font-extrabold text-[#2C2F63] leading-snug break-keep">
                      {prize.name}
                    </h2>
                  </div>
                </div>

                {/* 총 응모권(해당 경품 전체 SUM) & 나의 응모권 박스 */}
                <div className="w-full p-3 rounded-xl bg-[#E6F1FC] space-y-1.5 mb-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#5B7493] font-medium">
                      총 응모권
                    </span>
                    <strong className="font-extrabold text-[#102A4E]">
                      {totalGatheredCount}장
                    </strong>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#5B7493] font-medium">
                      나의 응모권
                    </span>
                    <strong className="font-extrabold text-[#102A4E]">
                      {alreadyPut}장
                    </strong>
                  </div>
                </div>

                {/* 하단 수량 조절 (- / 수량 / +) — 스테퍼 라벨 '응모하기' 통일 */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#102A4E]">
                    응모하기
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => adjustCount(prize.id, -1)}
                      disabled={currentDraft <= 0}
                      className="w-8 h-8 rounded-lg border border-[#BFD8F5] bg-white text-sm font-extrabold text-[#102A4E] disabled:opacity-40"
                    >
                      −
                    </button>

                    <div className="w-12 h-8 rounded-lg border border-[#BFD8F5] bg-white flex items-center justify-center text-xs font-extrabold text-[#102A4E]">
                      {currentDraft}
                    </div>

                    <button
                      type="button"
                      onClick={() => adjustCount(prize.id, 1)}
                      disabled={remainingSelectable <= 0}
                      className="w-8 h-8 rounded-lg border border-[#BFD8F5] bg-white text-sm font-extrabold text-[#102A4E] disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 하단 투썸플레이스 1만 원권(15명) 자동 응모 안내 박스 — 텍스트 잘림 방지(h-auto, break-keep) */}
        <div className="w-full h-auto p-4 rounded-2xl bg-[#FDE047] border-none text-[#1E1B18] text-left mb-4 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#FEF08A] border-none flex items-center justify-center text-xl shrink-0">
              🎁
            </div>
            <div className="min-w-0 flex-1 break-keep">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <span className="inline-block px-2 py-0.5 rounded-full bg-[#102A4E] text-[#FEF9C3] text-[9px] font-black tracking-tight">
                  LUCKY BONUS · 전원 자동 응모
                </span>
              </div>
              <p className="text-[13px] font-extrabold text-[#102A4E] leading-snug break-keep">
                투썸플레이스 1만원 상품권 15명
              </p>
              <p className="text-[11px] text-[#3F2E1E] font-bold leading-snug mt-0.5 break-keep">
                가입자 전원 자동 응모! 동일한 당첨기회!
              </p>
            </div>
          </div>
        </div>

        {/* [응모하기] 버튼 (#2C2F63 남색 통일, 눈밭 위 선명한 대비) */}
        <button
          type="button"
          disabled={draftTotal <= 0 || submitting}
          onClick={() => setIsP03Open(true)}
          className={`w-full py-3.5 rounded-xl text-sm font-extrabold shadow-lg transition-all ${
            draftTotal > 0
              ? "bg-[#2C2F63] hover:bg-[#222552] text-white cursor-pointer"
              : "bg-[#2C2F63]/45 text-white/80 cursor-not-allowed"
          }`}
        >
          응모하기
        </button>
      </div>

      {/* ====================================================================
          P03 확인 팝업: 최상위 뷰포트 createPortal 렌더링으로 잘림 원천 방지
         ==================================================================== */}
      {isP03Open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={() => !submitting && setIsP03Open(false)}
          >
            <div
              className="w-full max-w-[345px] max-h-[88vh] overflow-y-auto rounded-3xl bg-white text-[#2C2F63] p-5 shadow-2xl text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-base font-extrabold text-[#2C2F63] mb-1">
                응모권을 사용하시겠어요?
              </h2>
              <p className="text-xs text-[#2C2F63]/75 mb-4">
                사용한 응모권은 변경하거나 취소할 수 없어요.
              </p>

              {/* 배분 요약 박스 */}
              <div className="w-full p-3.5 rounded-2xl bg-[#F4F6FC] space-y-1.5 text-xs mb-4">
                {SAMPLE_PRIZES.map((prize) => (
                  <div
                    key={prize.id}
                    className="flex items-center justify-between text-[#2C2F63]"
                  >
                    <span className="font-medium">{prize.shortTitle}</span>
                    <strong className="font-extrabold">
                      {draftAlloc[prize.id] || 0}장
                    </strong>
                  </div>
                ))}
                <div className="pt-1.5 border-t border-[#2C2F63]/15 flex items-center justify-between text-[#2C2F63] font-extrabold">
                  <span>총 사용 응모권</span>
                  <span>{draftTotal}장</span>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmSubmit}
                  className="w-full py-3.5 rounded-xl bg-[#2C2F63] hover:bg-[#222552] text-white text-xs font-extrabold transition-colors disabled:opacity-50"
                >
                  {submitting ? "저장 중..." : "이대로 걸기"}
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setIsP03Open(false)}
                  className="w-full py-3 rounded-xl border border-[#2C2F63]/20 bg-white text-[#2C2F63] text-xs font-extrabold hover:bg-slate-50 transition-colors"
                >
                  다시 고르기
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </AppShell>
  );
}
