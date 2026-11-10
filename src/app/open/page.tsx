"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import SnowballGraphic from "@/components/SnowballGraphic";
import {
  Snowball,
  Letter,
  getCurrentAuthAndSnowball,
  getVisibleLettersBySnowballId,
  isCampaignOpenDateReached,
  reportLetter,
  setFlashToast,
} from "@/lib/supabase";

/**
 * [S10] 스노우볼 편지 열람 페이지 (/open)
 * - 접근 보호:
 *   1) 비로그인 또는 내 스노우볼이 없는 경우 -> /login으로 이동
 *   2) 11월 30일 메시지 공개일 이전 접속 시 -> 안내 문구(토스트)와 함께 내 스노우볼 홈(S04)으로 이동!
 * - 공개일 이후: 받은 편지 카드 리스트 표시 및 클릭 시 크리스마스 편지지 상세 읽기 모달 오픈
 */
function OpenSnowballContent() {
  const router = useRouter();

  const [snowball, setSnowball] = useState<Snowball | null>(null);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);
  const [isShaking, setIsShaking] = useState(false);

  // 상세 읽기 모달(Modal)에 표시할 선택된 편지 상태(State)
  const [selectedLetter, setSelectedLetter] = useState<Letter | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const auth = await getCurrentAuthAndSnowball();
      const mySb = auth.snowball;

      // 1) 비로그인 또는 스노우볼 미생성 시 로그인 화면으로 이동
      if (!auth.isAuthenticated || !mySb) {
        setFlashToast("로그인 후 내 스노우볼을 확인할 수 있어요.");
        router.replace("/login");
        return;
      }

      // 2) 11월 30일 메시지 공개일 이전 접속 시 안내 문구와 함께 내 스노우볼(S04)로 이동
      if (!isCampaignOpenDateReached()) {
        setFlashToast("받은 편지는 11월 30일 메시지 공개일에 열람할 수 있어요!");
        router.replace(`/snowball/${encodeURIComponent(mySb.slug)}`);
        return;
      }

      setSnowball(mySb);
      const visibleLetters = await getVisibleLettersBySnowballId(mySb.id);
      setLetters(visibleLetters);
    } catch (err) {
      console.error("S10 데이터 로드 오류:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener("santa-auth-changed", handleUpdate);
    return () => window.removeEventListener("santa-auth-changed", handleUpdate);
  }, [loadData]);

  // 다시 흔들기 애니메이션(Animation) 실행 핸들러 (약 1.8초간 함박눈 연출)
  const handleShakeAgain = () => {
    if (isShaking) return;
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 1800);
  };

  // 편지 신고하기 핸들러 (카드 또는 상세 모달에서 호출)
  const handleReport = async (letter: Letter, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const confirmed = window.confirm(
      `'${letter.sender_name}'님이 보낸 편지를 부적절한 내용으로 신고하시겠습니까?\n신고 즉시 목록에서 숨김 처리됩니다.`
    );
    if (!confirmed) return;

    await reportLetter(letter.id);
    setLetters((prev) => prev.filter((item) => item.id !== letter.id));
    if (selectedLetter?.id === letter.id) {
      setSelectedLetter(null);
    }
    setActionMsg("신고가 접수되어 편지가 숨김 처리되었습니다.");
    setTimeout(() => setActionMsg(null), 3000);
  };

  // 날짜 포맷터 (MM/DD 형식)
  const formatDate = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  if (loading || !snowball) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-white/25 border-t-white" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col items-center px-4 pt-5 pb-12">
        {actionMsg && (
          <div className="mb-4 w-full rounded-xl bg-amber-500/95 px-4 py-2.5 text-center text-xs font-bold text-white shadow-md">
            {actionMsg}
          </div>
        )}

        {/* 상단 타이틀 */}
        <h1 className="text-center text-2xl font-extrabold tracking-tight text-white drop-shadow">
          스노우볼이 열렸어요
        </h1>
        <p className="mt-1 text-center text-xs font-medium text-blue-100/80">
          흔들면 받은 메시지 원문을 읽을 수 있어요
        </p>

        {/* 스노우볼 그래픽 영역 (흔들기 뱃지 표시) */}
        <div className="my-3 cursor-pointer" onClick={handleShakeAgain}>
          <SnowballGraphic
            level={snowball.level || 0}
            letters={letters}
            isShaking={isShaking}
            showShakeBadge={true}
          />
          <div className="mx-auto mt-1 min-w-[140px] max-w-full px-4 py-1.5 rounded-lg bg-white/90 text-center text-xs font-extrabold text-slate-800 shadow break-keep">
            {snowball.nickname}
          </div>
        </div>

        {/* [다시 흔들기] 버튼 */}
        <button
          type="button"
          onClick={handleShakeAgain}
          className="mt-2 mb-6 rounded-full border border-white/30 bg-white/95 px-6 py-2.5 text-xs font-extrabold text-slate-900 shadow-md transition hover:bg-white active:scale-[0.98]"
        >
          다시 흔들기
        </button>

        {/* 받은 메시지 목록 섹션 */}
        <div className="w-full">
          <div className="mb-2.5 flex items-center justify-between px-1">
            <h2 className="text-sm font-extrabold text-white">
              받은 메시지 ({letters.length}개)
            </h2>
            <span className="text-[11px] font-medium text-blue-200/80">
              카드를 눌러 편지 전문 읽기
            </span>
          </div>

          {letters.length === 0 ? (
            /* 받은 편지가 0개일 때의 빈 상태(Empty State) */
            <div className="rounded-2xl bg-white/95 p-8 text-center text-slate-800 shadow-lg">
              <p className="text-base font-extrabold text-slate-800">
                받은 편지가 없어요
              </p>
              <p className="mt-1 text-xs text-slate-500">
                따뜻한 연말 보내세요!
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {letters.map((letter) => (
                <div
                  key={letter.id}
                  onClick={() => setSelectedLetter(letter)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setSelectedLetter(letter);
                    }
                  }}
                  className="group cursor-pointer rounded-2xl border border-white/80 bg-white/95 p-4 text-left text-slate-900 shadow-md transition hover:-translate-y-0.5 hover:bg-white active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">💌</span>
                      <span className="text-xs font-extrabold text-slate-900">
                        {letter.sender_name}
                      </span>
                      {letter.created_at && (
                        <span className="text-[11px] font-medium text-slate-400">
                          · {formatDate(letter.created_at)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleReport(letter, e)}
                      className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      신고
                    </button>
                  </div>
                  {/* 2줄 미리보기 (클릭 시 전체 읽기 모달 오픈) */}
                  <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed font-medium text-slate-700">
                    {letter.content}
                  </p>
                  <div className="mt-2 flex justify-end">
                    <span className="text-[10px] font-bold text-blue-600 group-hover:underline">
                      전문 읽기 →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 하단 [당첨 발표 보기] 이동 버튼 */}
        <Link
          href="/result"
          className="mt-7 flex w-full items-center justify-center rounded-xl bg-slate-900 py-4 text-sm font-extrabold text-white shadow-lg transition hover:bg-slate-800 active:scale-[0.99]"
        >
          당첨 발표 보기 →
        </Link>

        {/* 크리스마스 편지지 스타일의 편지 전문 상세 읽기 모달(Modal) — 최상위 뷰포트 createPortal 렌더링 */}
        {selectedLetter &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setSelectedLetter(null)}
            >
              <div
                className="relative w-full max-w-[360px] max-h-[88vh] overflow-y-auto rounded-3xl border-2 border-red-200 bg-gradient-to-b from-[#FFFDF9] via-[#FFF9F2] to-[#FDF2E9] p-6 text-slate-900 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 상단 크리스마스 장식 띠 */}
                <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-red-600 via-emerald-600 to-red-600" />

                {/* 모달 헤더: 보낸 사람 + 날짜 */}
                <div className="mt-1 flex items-center justify-between border-b border-amber-200/70 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-lg shadow-xs">
                      💌
                    </span>
                    <div>
                      <p className="text-xs font-extrabold text-slate-900">
                        From. {selectedLetter.sender_name}
                      </p>
                      <p className="text-[11px] font-medium text-slate-400">
                        {formatDate(selectedLetter.created_at)} 도착한 편지
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedLetter(null)}
                    className="rounded-full p-1.5 text-xs font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    ✕
                  </button>
                </div>

                {/* 편지 본문 (최대 200자 전체 텍스트 노출, 줄바꿈 유지) */}
                <div className="my-4 max-h-[260px] min-h-[130px] overflow-y-auto rounded-2xl border border-amber-200/60 bg-white/85 p-4 shadow-inner">
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed font-medium text-slate-800">
                    {selectedLetter.content}
                  </p>
                </div>

                {/* 수신자 표기 */}
                <p className="mb-4 text-right text-xs font-extrabold text-emerald-800">
                  To. {snowball.nickname} 🎄
                </p>

                {/* 모달 하단 액션 버튼 ([신고하기] / [닫기]) */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleReport(selectedLetter)}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
                  >
                    🚨 신고하기
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLetter(null)}
                    className="flex-1 rounded-xl bg-slate-900 py-3 text-xs font-extrabold text-white shadow transition hover:bg-slate-800"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    </AppShell>
  );
}

export default function OpenSnowballPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0B1528] text-white">
          편지함을 여는 중...
        </div>
      }
    >
      <OpenSnowballContent />
    </Suspense>
  );
}
