"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import AppShell from "@/components/AppShell";
import {
  GeminiVerification,
  getAllGeminiVerificationsForAdmin,
  updateGeminiVerificationStatusForAdmin,
} from "@/lib/supabase";

const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || "1225";
const ADMIN_AUTH_STORAGE_KEY = "santa_admin_authenticated_v1";

type FilterStatus = "전체" | "대기중" | "승인" | "반려";

/**
 * [/admin] 관리자 제미나이 가입 영수증 검수 페이지
 * - 접속 시 관리자 비밀번호 입력창 표시 (process.env.NEXT_PUBLIC_ADMIN_PIN || '1225')
 * - gemini_verifications 전체 목록(닉네임, 이메일, 추천인, 상태, 제출일시) 및 영수증 이미지(https://... 또는 data:image/...) 렌더링
 * - 영수증 이미지 클릭 시 원본 확대 모달(createPortal) 제공
 * - [승인] / [반려] 버튼 클릭 시 DB의 status 컬럼을 즉시 '승인' 또는 '반려'로 업데이트
 */
export default function AdminVerificationPage() {
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>("");
  const [pinError, setPinError] = useState<string | null>(null);

  const [items, setItems] = useState<GeminiVerification[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("전체");

  // 처리 중인 항목 ID
  const [processingId, setProcessingId] = useState<string | null>(null);

  // 원본 이미지 확대 모달 상태
  const [zoomItem, setZoomItem] = useState<GeminiVerification | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const fetchList = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const rows = await getAllGeminiVerificationsForAdmin();
      setItems(rows);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "인증 목록을 불러오는 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = window.sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
      if (saved === "true") {
        setUnlocked(true);
      }
    }
  }, []);

  useEffect(() => {
    if (unlocked) {
      fetchList();
    }
  }, [unlocked, fetchList]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === ADMIN_PIN) {
      setPinError(null);
      setUnlocked(true);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(ADMIN_AUTH_STORAGE_KEY, "true");
      }
    } else {
      setPinError("비밀번호가 일치하지 않습니다. 다시 확인해 주세요.");
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
      setItems((prev) =>
        prev.map((row) => (row.id === updated.id ? updated : row))
      );
      if (zoomItem?.id === updated.id) {
        setZoomItem(updated);
      }
      showToast(
        `✓ '${item.nickname}'님의 인증 상태가 '${nextStatus}'(으)로 변경되었습니다.`
      );
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

  const countAll = items.length;
  const countWaiting = items.filter((i) => i.status === "대기중").length;
  const countApproved = items.filter((i) => i.status === "승인").length;
  const countRejected = items.filter((i) => i.status === "반려").length;

  const filteredItems = items.filter((item) => {
    if (filterStatus === "전체") return true;
    return item.status === filterStatus;
  });

  // 1) 비밀번호 잠금 화면
  if (!unlocked) {
    return (
      <AppShell>
        <div className="flex flex-col px-5 pt-10 pb-14 text-left break-keep">
          <div className="w-full rounded-3xl bg-[#F4F9FF] text-[#0B1528] p-6 shadow-xl">
            <span className="inline-block px-3 py-1 rounded-full bg-[#1E88E5] text-white text-[11px] font-extrabold mb-3">
              ADMIN ONLY
            </span>
            <h1 className="text-xl font-extrabold text-[#102A4E] mb-1.5">
              관리자 영수증 검수 센터
            </h1>
            <p className="text-xs text-[#5B7493] leading-relaxed mb-5">
              Gemini 대학생 플랜 가입 영수증 인증 내역을 확인하고 승인·반려할 수 있는 관리자 전용 페이지입니다.
            </p>

            <form onSubmit={handlePinSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-extrabold text-[#102A4E] mb-1.5">
                  관리자 비밀번호 (PIN)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="비밀번호 입력"
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
                검수 페이지 열기
              </button>
            </form>
          </div>
        </div>
      </AppShell>
    );
  }

  // 2) 잠금 해제 후 관리자 검수 목록 화면
  return (
    <AppShell>
      {toastMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[90] w-[92%] max-w-[380px] px-4 py-3 rounded-2xl bg-emerald-600 text-white text-xs font-extrabold text-center shadow-2xl break-keep">
          {toastMsg}
        </div>
      )}

      <div className="flex flex-col px-4 pt-6 pb-14 text-left break-keep">
        {/* 상단 헤더 & 새로고침 */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-300 text-[#0B1528] text-[10px] font-black mb-1">
              ADMIN · 영수증 검수
            </span>
            <h1 className="text-xl font-extrabold text-white">
              Gemini 가입 인증 관리
            </h1>
            <p className="text-[11px] text-sky-100/85 mt-0.5">
              영수증 사진을 눌러 크게 확인하고 [승인] 또는 [반려]를 눌러주세요.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchList}
            disabled={loading}
            className="shrink-0 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-extrabold transition-colors"
          >
            {loading ? "로딩..." : "↻ 새로고침"}
          </button>
        </div>

        {/* 상태별 필터 탭 */}
        <div className="grid grid-cols-4 gap-1.5 mb-4">
          {(
            [
              { key: "전체", count: countAll },
              { key: "대기중", count: countWaiting },
              { key: "승인", count: countApproved },
              { key: "반려", count: countRejected },
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

        {errorMsg && (
          <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/20 border border-rose-300/50 text-xs text-rose-100">
            ⚠️ {errorMsg}
          </div>
        )}

        {loading && items.length === 0 ? (
          <div className="py-20 text-center text-xs text-white/80">
            인증 제출 목록을 불러오는 중입니다...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl bg-white/10 border border-white/20 p-10 text-center">
            <p className="text-sm font-extrabold text-white mb-1">
              해당 상태의 인증 내역이 없습니다
            </p>
            <p className="text-xs text-sky-100/75">
              유저가 S08에서 영수증을 제출하면 이곳에 실시간으로 표시됩니다.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredItems.map((item) => {
              const imgUrl = item.image_url_1 || "";
              const isValidImg =
                imgUrl.startsWith("http") || imgUrl.startsWith("data:image");
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
                  {/* 상단: 닉네임 + 상태 뱃지 + 제출일시 */}
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

                  {/* 상세 메타 정보: 이메일, 추천인, 반려사유 */}
                  <div className="space-y-1 text-xs mb-3">
                    <p className="text-[#102A4E] break-all">
                      <span className="font-bold text-[#5B7493]">이메일: </span>
                      <span className="font-semibold">{item.gemini_email}</span>
                    </p>
                    <p className="text-[#102A4E]">
                      <span className="font-bold text-[#5B7493]">추천인: </span>
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

                  {/* 영수증 이미지 미리보기 (클릭 시 확대 모달) */}
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
