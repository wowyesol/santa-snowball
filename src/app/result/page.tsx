"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import {
  Snowball,
  getCurrentAuthAndSnowball,
  isResultOpenDateReached,
  setFlashToast,
} from "@/lib/supabase";

type ResultState = "win-top" | "win-other" | "lose";

/**
 * [S11] 당첨 발표 페이지 콘텐츠 컴포넌트(Component)
 * - 접근 보호:
 *   1) 비로그인 또는 스노우볼이 없는 유저가 임의로 접근 시 -> /login으로 이동
 *   2) 11월 28일 당첨 발표일 이전 접속 시 -> 안내 문구와 함께 내 스노우볼 홈(S04)으로 이동!
 */
function ResultPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stateParam = searchParams.get("state") as ResultState | null;

  const [loading, setLoading] = useState(true);
  const [snowball, setSnowball] = useState<Snowball | null>(null);
  const [resultState, setResultState] = useState<ResultState>("lose");

  // 당첨자 정보 입력 폼 상태(State)
  const [winnerName, setWinnerName] = useState("");
  const [winnerPhone, setWinnerPhone] = useState("");
  const [winnerEmail, setWinnerEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const auth = await getCurrentAuthAndSnowball();
    const mySb = auth.snowball;

    // 1) 비로그인 또는 내 스노우볼이 없는 경우 로그인 화면으로 이동
    if (!auth.isAuthenticated || !mySb) {
      setFlashToast("로그인 후 당첨 결과를 확인할 수 있어요.");
      router.replace("/login");
      return;
    }

    // 2) 11월 28일 당첨 발표일 이전 접속 시 안내 문구와 함께 내 스노우볼(S04)로 이동
    if (!isResultOpenDateReached()) {
      setFlashToast("당첨 결과는 11월 28일 발표일에 공개됩니다!");
      router.replace(`/snowball/${encodeURIComponent(mySb.slug)}`);
      return;
    }

    setSnowball(mySb);
    if (auth.email) {
      setWinnerEmail(auth.email);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadData();
    window.addEventListener("santa-auth-changed", loadData);
    return () => window.removeEventListener("santa-auth-changed", loadData);
  }, [loadData]);

  useEffect(() => {
    if (
      stateParam === "win-top" ||
      stateParam === "win-other" ||
      stateParam === "lose"
    ) {
      setResultState(stateParam);
      setSubmitted(false);
    }
  }, [stateParam]);

  // 당첨자 수령 정보 제출 핸들러
  const handleSubmitWinnerInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!winnerName.trim() || !winnerPhone.trim() || !winnerEmail.trim()) {
      alert("이름, 연락처, 이메일을 모두 입력해 주세요.");
      return;
    }
    setSubmitted(true);
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
        {/* 페이지 타이틀 */}
        <h1 className="mb-4 text-center text-2xl font-extrabold tracking-tight text-white drop-shadow">
          당첨 발표
        </h1>

        {/* 상태 1: 1·2등 당첨 (win-top) */}
        {resultState === "win-top" && (
          <div className="w-full space-y-3.5">
            {/* 당첨 축하 카드 */}
            <div className="rounded-2xl border-2 border-slate-900 bg-white p-6 text-center text-slate-900 shadow-lg">
              <p className="text-xs font-bold text-slate-500">축하합니다</p>
              <h2 className="mt-1 text-xl font-extrabold text-slate-900">
                1등 무신사 20만 원 당첨
              </h2>
              <p className="mt-1.5 text-xs font-medium text-slate-500">
                {snowball.nickname}님 축하드려요!
              </p>
            </div>

            {/* 당첨 정보 입력 카드 */}
            <form
              onSubmit={handleSubmitWinnerInfo}
              className="rounded-2xl bg-white/95 p-5 text-slate-900 shadow-lg"
            >
              <h3 className="text-sm font-extrabold text-slate-900">
                당첨 정보 입력
              </h3>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                경품 발송을 위해 12/7까지 입력해 주세요. 미입력 시 당첨이 취소돼요.
              </p>

              {submitted ? (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                  <p className="text-xs font-extrabold text-emerald-800">
                    ✅ 당첨자 정보가 정상 제출되었습니다!
                  </p>
                  <p className="mt-1 text-[11px] text-emerald-700">
                    입력하신 이메일({winnerEmail})로 개별 안내가 발송됩니다.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mt-3.5 space-y-2.5">
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-700">
                        이름 (실명)
                      </label>
                      <input
                        type="text"
                        value={winnerName}
                        onChange={(e) => setWinnerName(e.target.value)}
                        placeholder="홍길동"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-slate-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-700">
                        휴대폰 번호 (기프티콘 수령)
                      </label>
                      <input
                        type="tel"
                        value={winnerPhone}
                        onChange={(e) => setWinnerPhone(e.target.value)}
                        placeholder="010-0000-0000"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-slate-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-700">
                        이메일 (제세공과금 서류 안내 수령)
                      </label>
                      <input
                        type="email"
                        value={winnerEmail}
                        onChange={(e) => setWinnerEmail(e.target.value)}
                        placeholder="이메일 입력"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="mt-4 w-full rounded-xl bg-slate-900 py-3.5 text-xs font-extrabold text-white shadow transition hover:bg-slate-800"
                  >
                    당첨 정보 제출하기
                  </button>
                </>
              )}
            </form>

            {/* 1·2등 제세공과금 안내 카드 */}
            <div className="rounded-2xl border border-slate-300 bg-white/95 p-4 text-slate-800 shadow-md">
              <p className="text-xs font-extrabold text-slate-900">
                1 · 2등 제세공과금 안내
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">
                5만 원 초과 경품은 소득세법에 따라 제세공과금(22%) 신고를 위해 신분증 사본 등이 필요하며, 제출하신 이메일로 개별 안내드려요.
              </p>
            </div>
          </div>
        )}

        {/* 상태 2: 3등 당첨 (win-other) */}
        {resultState === "win-other" && (
          <div className="w-full space-y-3.5">
            <div className="rounded-2xl border-2 border-slate-900 bg-white p-6 text-center text-slate-900 shadow-lg">
              <p className="text-xs font-bold text-slate-500">축하합니다</p>
              <h2 className="mt-1 text-xl font-extrabold text-slate-900">
                3등 배민 3만 원 당첨
              </h2>
              <p className="mt-1.5 text-xs font-medium text-slate-500">
                {snowball.nickname}님 축하드려요!
              </p>
            </div>

            <form
              onSubmit={handleSubmitWinnerInfo}
              className="rounded-2xl bg-white/95 p-5 text-slate-900 shadow-lg"
            >
              <h3 className="text-sm font-extrabold text-slate-900">
                당첨 정보 입력
              </h3>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                기프티콘 발송을 위해 12/7까지 입력해 주세요.
              </p>

              {submitted ? (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                  <p className="text-xs font-extrabold text-emerald-800">
                    ✅ 기프티콘 수령 정보가 제출되었습니다!
                  </p>
                </div>
              ) : (
                <>
                  <div className="mt-3.5 space-y-2.5">
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-700">
                        이름 (실명)
                      </label>
                      <input
                        type="text"
                        value={winnerName}
                        onChange={(e) => setWinnerName(e.target.value)}
                        placeholder="홍길동"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-slate-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-700">
                        휴대폰 번호 (기프티콘 수령)
                      </label>
                      <input
                        type="tel"
                        value={winnerPhone}
                        onChange={(e) => setWinnerPhone(e.target.value)}
                        placeholder="010-0000-0000"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-slate-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-700">
                        이메일
                      </label>
                      <input
                        type="email"
                        value={winnerEmail}
                        onChange={(e) => setWinnerEmail(e.target.value)}
                        placeholder="이메일 입력"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="mt-4 w-full rounded-xl bg-slate-900 py-3.5 text-xs font-extrabold text-white shadow transition hover:bg-slate-800"
                  >
                    당첨 정보 제출하기
                  </button>
                </>
              )}
            </form>
          </div>
        )}

        {/* 상태 3: 미당첨 (lose) */}
        {resultState === "lose" && (
          <div className="w-full">
            <div className="rounded-2xl bg-white/95 p-7 text-center text-slate-900 shadow-lg">
              <h2 className="text-base font-extrabold text-slate-900">
                아쉽지만 이번엔 당첨되지 않았어요
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                함께해 주셔서 고맙습니다. 따뜻한 연말 보내세요!
              </p>

              <Link
                href="/open"
                className="mt-5 inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-xs font-extrabold text-slate-800 shadow-xs transition hover:bg-slate-50"
              >
                내 스노우볼 다시 보기
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0B1528] text-white">
          당첨 결과를 불러오는 중...
        </div>
      }
    >
      <ResultPageContent />
    </Suspense>
  );
}
