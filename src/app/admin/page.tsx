"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import AppShell from "@/components/AppShell";
import {
  AdminDashboardData,
  GeminiVerification,
  SAMPLE_PRIZES,
  getAdminDashboardData,
  getCurrentAuthAndSnowball,
  updateGeminiVerificationStatusForAdmin,
} from "@/lib/supabase";

// 허용된 관리자 이메일 목록 (구글 로그인 상태면 암호 없이 즉시 오픈)
const ADMIN_EMAILS = ["ann871565@gmail.com"];

// 마스터 비밀번호 (비로그인 또는 타 계정 접속 시 사용)
const MASTER_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_PIN || "SantaSungshin2026!";
const ADMIN_AUTH_STORAGE_KEY = "santa_admin_authenticated_v2";
const TARGET_SIGNUP_GOAL = 570;

type MainTab = "verifications" | "raffle";
type FilterStatus = "대기중" | "승인" | "반려" | "전체";

/**
 * [/admin] 관리자 통합 대시보드 (클릭/방문 KPI + 영수증 검수 + 상품별 응모 랭킹)
 * - 보안: ADMIN_EMAILS('ann871565@gmail.com')로 구글 로그인된 경우 암호 입력 없이 즉시 오픈,
 *   그 외에는 마스터 비밀번호('SantaSungshin2026!' 또는 NEXT_PUBLIC_ADMIN_PIN) 검증
 * - 상단 대시보드:
 *   · Gemini Sign-up 인증 승인 진행률 바 (현재 승인 수 / 목표 570명, %)
 *   · 방문 및 클릭 지표 (event_logs: 사이트 방문 수, Gemini 가입링크 클릭 수 합산 및 상세, 공유하기 클릭 수)
 *   · 참여 및 인증 지표 (총 가입 스노우볼 수, 총 보낸 편지 수, 인증 대기·승인·반려 건수, 추천인 입력 건수)
 * - 하단 탭:
 *   · 탭 1: 인증 심사 (대기중/승인/반려/전체 필터, 영수증 미리보기 & 확대 모달, 즉시 승인/반려 및 대시보드 갱신)
 *   · 탭 2: 상품별 응모 현황 & 참여자 내림차순 랭킹 (상품별 SUM/COUNT/MAX 요약 표 + 상품별 내림차순 랭킹 테이블)
 */
export default function AdminDashboardPage() {
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [loggedAdminEmail, setLoggedAdminEmail] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState<string>("");
  const [pinError, setPinError] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // 하단 메인 탭 및 서브 필터 상태
  const [activeTab, setActiveTab] = useState<MainTab>("verifications");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("대기중");
  const [selectedPrizeId, setSelectedPrizeId] = useState<string>(
    SAMPLE_PRIZES[0]?.id || "prize-1"
  );

  // 승인/반려 처리 중인 항목 ID 및 원본 이미지 확대 모달 상태
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [zoomItem, setZoomItem] = useState<GeminiVerification | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getAdminDashboardData();
      setDashboard(data);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "관리자 대시보드 데이터를 불러오는 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // 초기 진입 시 관리자 구글 이메일(ADMIN_EMAILS) 또는 세션 마스터 암호 확인
  useEffect(() => {
    let mounted = true;
    async function checkAdminAccess() {
      setAuthChecking(true);
      try {
        const auth = await getCurrentAuthAndSnowball();
        const emailLower = auth.email?.trim().toLowerCase() || "";
        const isAllowedEmail =
          auth.isAuthenticated &&
          Boolean(emailLower) &&
          ADMIN_EMAILS.some((allowed) => allowed.toLowerCase() === emailLower);

        if (!mounted) return;

        if (isAllowedEmail) {
          setLoggedAdminEmail(auth.email);
          setUnlocked(true);
          setAuthChecking(false);
          return;
        }

        if (typeof window !== "undefined") {
          const saved = window.sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
          if (saved === "true") {
            setUnlocked(true);
          }
        }
      } finally {
        if (mounted) {
          setAuthChecking(false);
        }
      }
    }

    checkAdminAccess();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (unlocked) {
      fetchDashboard();
    }
  }, [unlocked, fetchDashboard]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === MASTER_PASSWORD) {
      setPinError(null);
      setUnlocked(true);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(ADMIN_AUTH_STORAGE_KEY, "true");
      }
    } else {
      setPinError("마스터 비밀번호가 일치하지 않습니다. 다시 확인해 주세요.");
    }
  };

  const handleStatusChange = async (
    item: GeminiVerification,
    nextStatus: "승인" | "반려"
  ) => {
    let rejectReason: string | null = null;
    if (nextStatus === "반려") {
      const promptReason = window.prompt(
        `'${item.nickname}'님의 인증을 반려합니다.\n반려 사유를 입력해 주세요 (취소 시 진행 안 함):`,
        item.reject_reason ||
          "주문 영수증 캡처에 계정 이메일 또는 주문 날짜가 보이지 않아요"
      );
      if (promptReason === null) return;
      rejectReason = promptReason.trim();
    }

    setProcessingId(item.id);
    setErrorMsg(null);
    try {
      const updated = await updateGeminiVerificationStatusForAdmin(
        item,
        nextStatus,
        rejectReason
      );
      if (zoomItem?.id === updated.id) {
        setZoomItem(updated);
      }
      showToast(
        `✓ '${item.nickname}'님의 인증 상태가 '${nextStatus}'(으)로 변경되었습니다.`
      );
      // 승인/반려 즉시 대시보드 수치 및 응모권 현황 전체 재조회
      await fetchDashboard();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "상태 업데이트 중 오류가 발생했습니다."
      );
    } finally {
      setProcessingId(null);
    }
  };

  if (authChecking) {
    return (
      <AppShell>
        <div className="py-24 text-center text-xs text-white/80">
          관리자 권한을 확인하는 중입니다...
        </div>
      </AppShell>
    );
  }

  // 1) 마스터 비밀번호 잠금 화면 (비로그인 또는 비허용 이메일 계정)
  if (!unlocked) {
    return (
      <AppShell>
        <div className="flex flex-col px-5 pt-10 pb-14 text-left break-keep">
          <div className="w-full rounded-3xl bg-[#F4F9FF] text-[#0B1528] p-6 shadow-xl">
            <span className="inline-block px-3 py-1 rounded-full bg-[#1E88E5] text-white text-[11px] font-extrabold mb-3">
              ADMIN ONLY
            </span>
            <h1 className="text-xl font-extrabold text-[#102A4E] mb-1.5">
              관리자 통합 대시보드
            </h1>
            <p className="text-xs text-[#5B7493] leading-relaxed mb-5">
              지정된 관리자 구글 계정으로 로그인하거나 마스터 비밀번호를 입력해 접속할 수 있습니다.
            </p>

            <form onSubmit={handlePinSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-extrabold text-[#102A4E] mb-1.5">
                  마스터 비밀번호
                </label>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="마스터 비밀번호 입력"
                  autoFocus
                  className="w-full px-4 py-3.5 rounded-xl bg-white border border-[#BFD8F5] text-sm font-extrabold text-[#0B1528] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E88E5]"
                />
              </div>

              {pinError && (
                <p className="text-xs font-bold text-rose-600">⚠️ {pinError}</p>
              )}

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-[#3898FF] hover:bg-[#2589F5] text-white text-sm font-extrabold shadow-md transition-colors"
              >
                대시보드 열기
              </button>
            </form>
          </div>
        </div>
      </AppShell>
    );
  }

  const verifications = dashboard?.verifications ?? [];
  const countAll = verifications.length;
  const countWaiting = dashboard?.waitingVerifCount ?? 0;
  const countApproved = dashboard?.approvedVerifCount ?? 0;
  const countRejected = dashboard?.rejectedVerifCount ?? 0;

  const goalPercentage = Math.min(
    100,
    Number(((countApproved / TARGET_SIGNUP_GOAL) * 100).toFixed(1))
  );
  const rawGoalPercentage = ((countApproved / TARGET_SIGNUP_GOAL) * 100).toFixed(
    1
  );

  const filteredVerifications = verifications.filter((item) => {
    if (filterStatus === "전체") return true;
    return item.status === filterStatus;
  });

  const prizeStats = dashboard?.prizeStats ?? [];
  const activePrizeStat =
    prizeStats.find((p) => p.prizeId === selectedPrizeId) || prizeStats[0];

  return (
    <AppShell>
      {toastMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[90] w-[92%] max-w-[380px] px-4 py-3 rounded-2xl bg-emerald-600 text-white text-xs font-extrabold text-center shadow-2xl break-keep">
          {toastMsg}
        </div>
      )}

      <div className="flex flex-col px-4 pt-5 pb-14 text-left break-keep">
        {/* ================================================================
            상단 헤더 & [🔄 데이터 새로고침] 버튼
           ================================================================ */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-300 text-[#0B1528] text-[10px] font-black">
                ADMIN DASHBOARD
              </span>
              {loggedAdminEmail && (
                <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-emerald-200 text-[10px] font-bold">
                  {loggedAdminEmail}
                </span>
              )}
            </div>
            <h1 className="text-xl font-extrabold text-white">
              캠페인 운영 & 검수 대시보드
            </h1>
          </div>

          <button
            type="button"
            onClick={fetchDashboard}
            disabled={loading}
            className="shrink-0 px-3 py-2 rounded-xl bg-[#3898FF] hover:bg-[#2589F5] disabled:opacity-60 text-white text-xs font-extrabold shadow-md transition-colors"
          >
            {loading ? "갱신 중..." : "🔄 데이터 새로고침"}
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/20 border border-rose-300/50 text-xs text-rose-100">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* ================================================================
            1. 최상단: Gemini Sign-up 인증 승인 진행률 바 (목표 570명)
           ================================================================ */}
        <section className="w-full rounded-2xl bg-gradient-to-r from-[#0F2442] via-[#163862] to-[#1A4977] border border-amber-300/60 p-4 shadow-lg mb-3.5">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-extrabold text-amber-300">
              ✦ Gemini Sign-up 인증 승인 진행률
            </span>
            <span className="text-sm font-black text-white">
              {countApproved} / {TARGET_SIGNUP_GOAL}명 ({rawGoalPercentage}%)
            </span>
          </div>

          <div className="w-full h-3 rounded-full bg-black/35 overflow-hidden p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-300 via-emerald-300 to-sky-400 transition-all duration-500"
              style={{ width: `${Math.max(2, goalPercentage)}%` }}
            />
          </div>

          <div className="mt-1.5 flex items-center justify-between text-[10px] text-sky-200/85">
            <span>심사 대기 중: {countWaiting}건</span>
            <span>
              목표까지 남은 승인:{" "}
              {Math.max(0, TARGET_SIGNUP_GOAL - countApproved)}명
            </span>
          </div>
        </section>

        {/* ================================================================
            2. 요약 KPI 카드: 방문/클릭 지표(event_logs) + 참여/인증 지표
           ================================================================ */}
        <section className="w-full rounded-2xl bg-[#F4F9FF] text-[#0B1528] p-4 shadow-md mb-5 space-y-3.5">
          {/* 2-1) 방문 및 클릭 지표 (event_logs 집계) */}
          <div>
            <h2 className="text-[11px] font-extrabold text-[#1E88E5] uppercase tracking-wider mb-2">
              📊 방문 및 클릭 지표 (event_logs 실시간 집계)
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {/* ① 사이트 방문 수 */}
              <div className="rounded-xl bg-white border border-[#DCEBFA] p-2.5">
                <p className="text-[10px] font-bold text-[#5B7493]">
                  ① 사이트 방문 수
                </p>
                <p className="text-lg font-black text-[#102A4E] mt-0.5">
                  {dashboard?.pageViewCount ?? 0}
                  <span className="text-[11px] font-bold ml-0.5">회</span>
                </p>
                <p className="text-[9px] text-[#7A93B2]">page_view</p>
              </div>

              {/* ② Gemini 가입링크 클릭 수 (합산 및 상세) */}
              <div className="rounded-xl bg-[#EBF4FF] border border-[#90B8E8] p-2.5">
                <p className="text-[10px] font-extrabold text-[#102A4E]">
                  ② 가입링크 클릭 합산
                </p>
                <p className="text-lg font-black text-[#1E88E5] mt-0.5">
                  {dashboard?.geminiTotalClickCount ?? 0}
                  <span className="text-[11px] font-bold ml-0.5">회</span>
                </p>
                <p className="text-[9px] font-bold text-[#4A6583] leading-tight mt-0.5">
                  바로가기 {dashboard?.geminiLinkClickCount ?? 0} · 복사{" "}
                  {dashboard?.geminiLinkCopyCount ?? 0}
                </p>
              </div>

              {/* ③ 공유하기 클릭 수 */}
              <div className="rounded-xl bg-white border border-[#DCEBFA] p-2.5">
                <p className="text-[10px] font-bold text-[#5B7493]">
                  ③ 공유하기 클릭
                </p>
                <p className="text-lg font-black text-[#102A4E] mt-0.5">
                  {dashboard?.shareClickCount ?? 0}
                  <span className="text-[11px] font-bold ml-0.5">회</span>
                </p>
                <p className="text-[9px] text-[#7A93B2]">share_click</p>
              </div>
            </div>
          </div>

          {/* 2-2) 참여 및 인증 지표 */}
          <div className="pt-2.5 border-t border-[#DCEBFA]">
            <h2 className="text-[11px] font-extrabold text-[#102A4E] uppercase tracking-wider mb-2">
              🎄 참여 및 인증 지표
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {/* ④ 총 가입 스노우볼 수 */}
              <div className="rounded-xl bg-white border border-[#DCEBFA] p-2.5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[#5B7493]">
                    ④ 총 가입 스노우볼
                  </p>
                  <p className="text-[9px] text-[#7A93B2]">snowballs</p>
                </div>
                <p className="text-base font-black text-[#102A4E]">
                  {dashboard?.totalSnowballsCount ?? 0}개
                </p>
              </div>

              {/* ⑤ 총 보낸 편지 수 */}
              <div className="rounded-xl bg-white border border-[#DCEBFA] p-2.5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[#5B7493]">
                    ⑤ 총 보낸 편지 수
                  </p>
                  <p className="text-[9px] text-[#7A93B2]">letters</p>
                </div>
                <p className="text-base font-black text-[#102A4E]">
                  {dashboard?.totalLettersCount ?? 0}통
                </p>
              </div>

              {/* ⑥ 인증 대기·승인·반려 건수 */}
              <div className="rounded-xl bg-white border border-[#DCEBFA] p-2.5">
                <p className="text-[10px] font-bold text-[#5B7493] mb-1">
                  ⑥ 인증 심사 현황 (총 {countAll}건)
                </p>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold">
                  <span className="text-amber-600">대기 {countWaiting}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-emerald-600">승인 {countApproved}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-rose-600">반려 {countRejected}</span>
                </div>
              </div>

              {/* ⑦ 추천인 입력 건수 */}
              <div className="rounded-xl bg-white border border-[#DCEBFA] p-2.5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[#5B7493]">
                    ⑦ 추천인 입력 건수
                  </p>
                  <p className="text-[9px] text-[#7A93B2]">referrer_slug</p>
                </div>
                <p className="text-base font-black text-[#1E88E5]">
                  {dashboard?.referralInputCount ?? 0}건
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            3. 하단 메인 탭 전환 (탭 1: 인증 심사 / 탭 2: 상품별 응모 현황 & 랭킹)
           ================================================================ */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={() => setActiveTab("verifications")}
            className={`py-3 px-3 rounded-2xl text-xs font-extrabold transition-all ${
              activeTab === "verifications"
                ? "bg-white text-[#0B1528] shadow-lg"
                : "bg-white/10 text-sky-100 hover:bg-white/20"
            }`}
          >
            🧾 탭 1: 인증 심사 ({countWaiting}건 대기)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("raffle")}
            className={`py-3 px-3 rounded-2xl text-xs font-extrabold transition-all ${
              activeTab === "raffle"
                ? "bg-white text-[#0B1528] shadow-lg"
                : "bg-white/10 text-sky-100 hover:bg-white/20"
            }`}
          >
            🏆 탭 2: 상품별 응모 랭킹
          </button>
        </div>

        {/* ================================================================
            [탭 1: 인증 심사 (영수증 검수)]
           ================================================================ */}
        {activeTab === "verifications" ? (
          <div>
            {/* 상태별 필터 탭: 대기중 / 승인 / 반려 / 전체 */}
            <div className="grid grid-cols-4 gap-1.5 mb-4">
              {(
                [
                  { key: "대기중", count: countWaiting },
                  { key: "승인", count: countApproved },
                  { key: "반려", count: countRejected },
                  { key: "전체", count: countAll },
                ] as const
              ).map((tab) => {
                const active = filterStatus === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setFilterStatus(tab.key)}
                    className={`py-2 px-1.5 rounded-xl text-xs font-extrabold transition-all ${
                      active
                        ? "bg-[#3898FF] text-white shadow-md"
                        : "bg-white/10 text-sky-100 hover:bg-white/20"
                    }`}
                  >
                    {tab.key} ({tab.count})
                  </button>
                );
              })}
            </div>

            {loading && verifications.length === 0 ? (
              <div className="py-16 text-center text-xs text-white/80">
                인증 제출 목록을 불러오는 중입니다...
              </div>
            ) : filteredVerifications.length === 0 ? (
              <div className="rounded-2xl bg-white/10 border border-white/20 p-10 text-center">
                <p className="text-sm font-extrabold text-white mb-1">
                  &apos;{filterStatus}&apos; 상태의 인증 내역이 없습니다
                </p>
                <p className="text-xs text-sky-100/75">
                  유저가 S08에서 영수증을 제출하면 이곳에 실시간으로 표시됩니다.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredVerifications.map((item) => {
                  const imgUrl = item.image_url_1 || "";
                  const isValidImg =
                    imgUrl.startsWith("http") ||
                    imgUrl.startsWith("data:image");
                  const isProcessing = processingId === item.id;

                  const badgeStyle =
                    item.status === "승인"
                      ? "bg-emerald-500 text-white"
                      : item.status === "반려"
                      ? "bg-rose-500 text-white"
                      : "bg-amber-400 text-[#0B1528]";

                  const submittedDateStr = item.created_at
                    ? new Date(item.created_at).toLocaleString("ko-KR", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "-";

                  return (
                    <div
                      key={item.id}
                      className="w-full rounded-2xl bg-[#F4F9FF] text-[#0B1528] p-4 shadow-md"
                    >
                      {/* 상단: 상태 뱃지 + 닉네임 + 제출일시 */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-[#DCEBFA]">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${badgeStyle}`}
                          >
                            {item.status}
                          </span>
                          <span className="text-sm font-extrabold text-[#102A4E]">
                            {item.nickname}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-[#5B7493]">
                          {submittedDateStr}
                        </span>
                      </div>

                      {/* 상세 정보: 이메일, 추천인, 반려사유 */}
                      <div className="space-y-1 text-xs mb-3">
                        <p className="text-[#102A4E] break-all">
                          <span className="font-bold text-[#5B7493]">
                            이메일:{" "}
                          </span>
                          <span className="font-semibold">
                            {item.gemini_email}
                          </span>
                        </p>
                        <p className="text-[#102A4E]">
                          <span className="font-bold text-[#5B7493]">
                            추천인:{" "}
                          </span>
                          <span className="font-extrabold text-[#1E88E5]">
                            {item.referrer_slug || "없음"}
                          </span>
                        </p>
                        {item.status === "반려" && item.reject_reason && (
                          <p className="text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 text-[11px] font-bold mt-1">
                            반려 사유: {item.reject_reason}
                          </p>
                        )}
                      </div>

                      {/* 영수증 이미지 미리보기 (클릭 시 원본 확대 모달) */}
                      {isValidImg ? (
                        <div className="mb-3">
                          <button
                            type="button"
                            onClick={() => setZoomItem(item)}
                            className="group relative w-full min-h-[180px] max-h-[260px] rounded-xl border border-[#BFD8F5] bg-white overflow-hidden flex items-center justify-center p-1.5"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imgUrl}
                              alt={`${item.nickname} 영수증 캡처`}
                              className="max-h-[240px] w-auto object-contain rounded-lg"
                            />
                            <span className="absolute bottom-2 right-2 px-2.5 py-1 rounded-full bg-[#0B1528]/80 text-white text-[10px] font-bold">
                              🔍 눌러서 크게 보기
                            </span>
                          </button>
                        </div>
                      ) : (
                        <div className="mb-3 p-4 rounded-xl border border-dashed border-[#BFD8F5] bg-[#E8F2FF] text-center text-xs text-[#5B7493] break-all">
                          이미지 URL: {imgUrl || "없음"}
                        </div>
                      )}

                      {/* 하단 액션 버튼: [승인] / [반려] */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleStatusChange(item, "승인")}
                          className={`py-3 rounded-xl text-xs font-extrabold transition-all shadow-xs ${
                            item.status === "승인"
                              ? "bg-emerald-600 text-white ring-2 ring-emerald-300"
                              : "bg-[#3898FF] hover:bg-[#2589F5] text-white"
                          } disabled:opacity-50`}
                        >
                          {isProcessing
                            ? "처리 중..."
                            : item.status === "승인"
                            ? "✓ 승인됨 (다시 승인)"
                            : "승인 (+100장)"}
                        </button>

                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleStatusChange(item, "반려")}
                          className={`py-3 rounded-xl text-xs font-extrabold transition-all ${
                            item.status === "반려"
                              ? "bg-rose-600 text-white"
                              : "bg-white border border-rose-300 text-rose-600 hover:bg-rose-50"
                          } disabled:opacity-50`}
                        >
                          {isProcessing
                            ? "처리 중..."
                            : item.status === "반려"
                            ? "반려됨 (사유 수정)"
                            : "반려"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ================================================================
              [탭 2: 상품별 응모 현황 & 참여자 내림차순 랭킹]
             ================================================================ */
          <div className="space-y-4">
            {/* 상단: 상품별 응모권 총합(SUM), 참여자 수(COUNT), 최고 응모권 수(MAX) 요약 표 */}
            <div className="w-full rounded-2xl bg-[#F4F9FF] text-[#0B1528] p-4 shadow-md">
              <h2 className="text-xs font-extrabold text-[#102A4E] mb-2.5">
                🎁 상품별 응모 현황 요약 (SUM · COUNT · MAX)
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#BFD8F5] text-[10px] font-extrabold text-[#5B7493]">
                      <th className="py-2 pr-2">상품명</th>
                      <th className="py-2 px-2 text-right">총합(SUM)</th>
                      <th className="py-2 px-2 text-right">참여자(COUNT)</th>
                      <th className="py-2 pl-2 text-right">최고(MAX)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2EEFC]">
                    {prizeStats.map((stat) => (
                      <tr key={stat.prizeId} className="hover:bg-white/60">
                        <td className="py-2.5 pr-2 font-extrabold text-[#102A4E]">
                          <span className="mr-1">{stat.emoji}</span>
                          {stat.shortTitle}
                        </td>
                        <td className="py-2.5 px-2 text-right font-black text-[#1E88E5]">
                          {stat.totalTicketsSum.toLocaleString()}장
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-[#102A4E]">
                          {stat.participantCount}명
                        </td>
                        <td className="py-2.5 pl-2 text-right font-extrabold text-amber-600">
                          {stat.maxTickets.toLocaleString()}장
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 하단: 상품 필터 탭 */}
            <div className="grid grid-cols-3 gap-1.5">
              {prizeStats.map((stat) => {
                const isSelected = stat.prizeId === activePrizeStat?.prizeId;
                return (
                  <button
                    key={stat.prizeId}
                    type="button"
                    onClick={() => setSelectedPrizeId(stat.prizeId)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-extrabold transition-all ${
                      isSelected
                        ? "bg-[#3898FF] text-white shadow-md"
                        : "bg-white/10 text-sky-100 hover:bg-white/20"
                    }`}
                  >
                    {stat.emoji} {stat.shortTitle} ({stat.participantCount}명)
                  </button>
                );
              })}
            </div>

            {/* 선택된 상품의 참여자 내림차순 랭킹 테이블 */}
            {activePrizeStat && (
              <div className="w-full rounded-2xl bg-[#F4F9FF] text-[#0B1528] p-4 shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded-full bg-[#1E88E5] text-white text-[10px] font-extrabold mb-1">
                      {activePrizeStat.rankBadge}
                    </span>
                    <h3 className="text-sm font-extrabold text-[#102A4E]">
                      {activePrizeStat.name} · 응모권 내림차순 랭킹
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-[#5B7493]">
                    총 {activePrizeStat.participantCount}명 참여 · 합계{" "}
                    {activePrizeStat.totalTicketsSum}장
                  </span>
                </div>

                {activePrizeStat.rankings.length === 0 ? (
                  <div className="py-10 text-center text-xs text-[#5B7493] bg-white rounded-xl border border-[#DCEBFA]">
                    아직 이 상품에 응모권을 건 참여자가 없습니다.
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-1 px-1">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="border-b border-[#BFD8F5] text-[10px] font-extrabold text-[#5B7493]">
                          <th className="py-2 pr-1.5">순위</th>
                          <th className="py-2 px-1.5">닉네임</th>
                          <th className="py-2 px-1.5">이메일(슬러그)</th>
                          <th className="py-2 px-1.5 text-right">건 응모권</th>
                          <th className="py-2 px-1.5 text-right">보유 총합</th>
                          <th className="py-2 pl-1.5 text-right">응모 일시</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2EEFC]">
                        {activePrizeStat.rankings.map((row) => {
                          const dateStr = row.createdAt
                            ? new Date(row.createdAt).toLocaleString("ko-KR", {
                                month: "numeric",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-";

                          return (
                            <tr
                              key={row.snowballId}
                              className="hover:bg-white/70"
                            >
                              <td className="py-2.5 pr-1.5 font-black text-[#102A4E]">
                                {row.rank === 1
                                  ? "🥇 1위"
                                  : row.rank === 2
                                  ? "🥈 2위"
                                  : row.rank === 3
                                  ? "🥉 3위"
                                  : `${row.rank}위`}
                              </td>
                              <td className="py-2.5 px-1.5 font-extrabold text-[#102A4E]">
                                {row.nickname}
                              </td>
                              <td className="py-2.5 px-1.5 text-[10px] text-[#5B7493] break-all">
                                {row.email ? (
                                  <>
                                    <span className="font-semibold text-[#102A4E]">
                                      {row.email}
                                    </span>
                                    <br />
                                    <span className="font-mono text-[9px] text-[#7A93B2]">
                                      ({row.slug})
                                    </span>
                                  </>
                                ) : (
                                  <span className="font-mono">{row.slug}</span>
                                )}
                              </td>
                              <td className="py-2.5 px-1.5 text-right font-black text-[#1E88E5]">
                                {row.allocatedTickets}장
                              </td>
                              <td className="py-2.5 px-1.5 text-right font-bold text-[#102A4E]">
                                {row.totalTickets}장
                              </td>
                              <td className="py-2.5 pl-1.5 text-right text-[10px] text-[#5B7493]">
                                {dateStr}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ====================================================================
          영수증 원본 확대 모달 (createPortal 최상위 렌더링)
         ==================================================================== */}
      {zoomItem &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={() => setZoomItem(null)}
          >
            <div
              className="w-full max-w-[410px] max-h-[92vh] rounded-3xl bg-white text-[#0B1528] p-4 shadow-2xl flex flex-col break-keep"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 pb-2.5 mb-2 border-b border-slate-200">
                <div className="text-left">
                  <p className="text-sm font-extrabold text-[#102A4E]">
                    {zoomItem.nickname}님의 영수증 원본
                  </p>
                  <p className="text-[11px] text-[#5B7493] break-all">
                    {zoomItem.gemini_email} · 추천인:{" "}
                    {zoomItem.referrer_slug || "없음"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setZoomItem(null)}
                  className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-extrabold text-slate-700 hover:bg-slate-200"
                >
                  닫기 ✕
                </button>
              </div>

              <div className="flex-1 overflow-auto rounded-2xl border border-slate-200 bg-slate-900 p-1.5 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={zoomItem.image_url_1 || ""}
                  alt={`${zoomItem.nickname} 영수증 원본`}
                  className="max-w-full h-auto object-contain rounded-lg"
                />
              </div>

              {(zoomItem.image_url_1 || "").startsWith("http") && (
                <a
                  href={zoomItem.image_url_1 || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 text-center text-[11px] font-bold text-[#1E88E5] hover:underline"
                >
                  새 탭에서 원본 이미지 열기 ↗
                </a>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={processingId === zoomItem.id}
                  onClick={() => handleStatusChange(zoomItem, "승인")}
                  className="py-3 rounded-xl bg-[#3898FF] hover:bg-[#2589F5] text-white text-xs font-extrabold"
                >
                  승인 (+100장)
                </button>
                <button
                  type="button"
                  disabled={processingId === zoomItem.id}
                  onClick={() => handleStatusChange(zoomItem, "반려")}
                  className="py-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-600 text-xs font-extrabold"
                >
                  반려
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </AppShell>
  );
}
