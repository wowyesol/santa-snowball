"use client";

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import {
  GeminiVerification,
  Snowball,
  getCurrentAuthAndSnowball,
  getGeminiVerification,
  getInvitedByNickname,
  getSnowballByNickname,
  recordTrackingClick,
  submitGeminiVerification,
  uploadVerificationImage,
} from "@/lib/supabase";

const GEMINI_STUDENT_SIGNUP_URL =
  "https://gemini.google/students/?utm_source=student&utm_mediu";

/**
 * S08 Gemini 가입 인증 제출 (/verify) — ★주문 영수증 캡처 1장 실제 업로드 + 추천인 입력 및 실시간 DB 검증★
 * - 상태 분기: 미제출(ready) / 심사 중(pending) / 승인 완료(approved) / 반려됨(rejected, 재제출 허용)
 * - 1. Gemini 대학생 플랜 가입하기 ([Gemini 가입 바로가기] 클릭 시 tracking_clicked_at 기록 + [가입 링크 복사하기] 보조 버튼)
 * - 2. 주문 영수증 제출하기 (Gemini 대학생 플랜 가입 주문 영수증 캡처 1장 업로드 + [캡처 예시 보기] 클릭 시 /captureexample.png 모달 노출)
 * - 3. 추천인 친구 닉네임 입력 (선택, 친구 링크 유입 시 자동 입력, 실시간 DB 검증)
 * - 4. 허위 인증 회수 안내 + 유의사항 체크박스 + [제출하기]
 */
export default function VerifyPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [mySnowball, setMySnowball] = useState<Snowball | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [existingVerif, setExistingVerif] = useState<GeminiVerification | null>(
    null
  );

  // 1. 가입 링크 클릭 기록 시각 & 링크 복사 토스트
  const [clickedAt, setClickedAt] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // 2. Gemini 대학생 플랜 가입 주문 영수증 캡처 1장 업로드 상태
  const [imageUrl1, setImageUrl1] = useState<string>("");
  const [preview1, setPreview1] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [isExampleModalOpen, setIsExampleModalOpen] = useState<boolean>(false);

  // 3. 추천인 친구 닉네임 실시간 DB 검증 상태
  const [referrerNickname, setReferrerNickname] = useState<string>("");
  const [refStatus, setRefStatus] = useState<
    "empty" | "checking" | "self" | "valid" | "not_found"
  >("empty");

  // 4. 유의사항 동의 체크 및 제출 상태
  const [noticeAgreed, setNoticeAgreed] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadVerifyState = useCallback(async () => {
    setLoading(true);
    const auth = await getCurrentAuthAndSnowball();
    const sb = auth.snowball;
    setMySnowball(sb);
    setUserEmail(auth.email || "");

    if (sb) {
      setClickedAt(sb.tracking_clicked_at);
      const verif = await getGeminiVerification(sb.id);
      setExistingVerif(verif);

      // 친구 공유 링크(?sb=...)로 방문했던 기록이 있으면 추천인 칸에 자동 채움 (본인이 아닐 때)
      const invitedNick = getInvitedByNickname();
      if (invitedNick && invitedNick !== sb.nickname) {
        setReferrerNickname((prev) => (prev === "" ? invitedNick : prev));
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadVerifyState();

    window.addEventListener("santa-auth-changed", loadVerifyState);
    return () => {
      window.removeEventListener("santa-auth-changed", loadVerifyState);
    };
  }, [loadVerifyState]);

  // 추천인 닉네임 입력 시 실시간 DB 검증
  useEffect(() => {
    if (!mySnowball) return;
    const trimmed = referrerNickname.trim();

    if (!trimmed) {
      setRefStatus("empty");
      return;
    }

    if (trimmed === mySnowball.nickname) {
      setRefStatus("self");
      return;
    }

    let cancelled = false;
    setRefStatus("checking");

    const timer = setTimeout(async () => {
      const found = await getSnowballByNickname(trimmed);
      if (cancelled) return;
      setRefStatus(found ? "valid" : "not_found");
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [referrerNickname, mySnowball]);

  // 1. [Gemini 가입 바로가기] 클릭 핸들러 (새 탭 열기 + tracking_clicked_at 기록)
  const handleSignupLinkClick = () => {
    if (!mySnowball) return;
    const optimisticIso = new Date().toISOString();
    setClickedAt(optimisticIso);
    recordTrackingClick(mySnowball.id).then((savedIso) => {
      setClickedAt(savedIso);
    });
  };

  // 1-2. [가입 링크 복사하기] 보조 버튼 클릭 핸들러 (인앱 브라우저/모바일 환경 대응)
  const handleCopySignupLink = async () => {
    if (mySnowball) {
      const optimisticIso = new Date().toISOString();
      setClickedAt((prev) => prev || optimisticIso);
      recordTrackingClick(mySnowball.id).then((savedIso) => {
        setClickedAt(savedIso);
      });
    }

    try {
      await navigator.clipboard.writeText(GEMINI_STUDENT_SIGNUP_URL);
      const msg =
        "가입 링크가 복사되었어요! 크롬이나 사파리 주소창에 붙여넣어 주세요.";
      setCopyToast(msg);
      setTimeout(() => {
        setCopyToast((prev) => (prev === msg ? null : prev));
      }, 3200);
    } catch {
      window.prompt(
        "아래 가입 링크를 복사해 크롬이나 사파리 주소창에 붙여넣어 주세요:",
        GEMINI_STUDENT_SIGNUP_URL
      );
    }
  };

  // 2. 가입 주문 영수증 캡처 이미지 1장 실제 업로드 핸들러 (Supabase Storage 또는 Data URL 변환 저장)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !mySnowball) return;

    setErrorMsg(null);
    setUploadingImage(true);

    try {
      const uploadedUrl = await uploadVerificationImage(file, mySnowball.id);
      setPreview1(uploadedUrl);
      setImageUrl1(uploadedUrl);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "이미지 파일을 처리하는 중 오류가 발생했습니다."
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const handleClearImage = () => {
    setPreview1(null);
    setImageUrl1("");
  };

  // 추천인 유효 여부 (비어있거나, 실존하는 타인 닉네임이어야 통과)
  const isReferrerValid = refStatus === "empty" || refStatus === "valid";

  // 전체 제출 가능 조건: 가입링크 클릭 완료 + 주문 영수증 캡처 1장 업로드 + 추천인 검증 통과 + 유의사항 체크
  const canSubmit =
    Boolean(clickedAt) &&
    Boolean(imageUrl1.trim()) &&
    !uploadingImage &&
    isReferrerValid &&
    noticeAgreed &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mySnowball || !canSubmit) return;

    setErrorMsg(null);
    setSubmitting(true);

    try {
      const created = await submitGeminiVerification({
        snowball: mySnowball,
        geminiEmail: userEmail,
        imageUrl1,
        imageUrl2: null,
        referrerNickname: referrerNickname.trim() || null,
      });

      setExistingVerif(created);
      await loadVerifyState();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "인증 제출 중 오류가 발생했습니다."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24 text-xs text-white/70">
          인증 상태를 확인하고 있어요...
        </div>
      </AppShell>
    );
  }

  if (!mySnowball) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-base font-extrabold text-white mb-4">
            로그인 후 Gemini 가입 인증을 진행할 수 있어요!
          </p>
          <Link
            href="/login"
            className="w-full py-3.5 rounded-xl bg-[#3898FF] text-white text-sm font-extrabold"
          >
            로그인하고 내 스노우볼 만들기
          </Link>
        </div>
      </AppShell>
    );
  }

  const isApproved =
    mySnowball.gemini_verified ||
    mySnowball.gemini_status === "승인" ||
    existingVerif?.status === "승인";
  const isPending =
    !isApproved &&
    (mySnowball.gemini_status === "심사중" ||
      existingVerif?.status === "대기중");
  const isRejected =
    !isApproved &&
    !isPending &&
    (mySnowball.gemini_status === "반려" || existingVerif?.status === "반려");

  const statusBadgeText = isApproved
    ? "Gemini 승인"
    : isPending
    ? "Gemini 심사 중"
    : isRejected
    ? "Gemini 반려"
    : "Gemini 미인증";

  return (
    <AppShell>
      {copyToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[90] w-[92%] max-w-[360px] px-4 py-3 rounded-2xl bg-emerald-600 text-white text-xs font-extrabold text-center shadow-2xl break-keep leading-relaxed">
          ✓ {copyToast}
        </div>
      )}

      <div className="flex flex-col px-5 pt-6 pb-12 break-keep">
        {/* 상단 타이틀 및 상태 뱃지 */}
        <div className="text-center mb-5">
          <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1.5">
            Gemini 가입 인증
          </h1>
          <p className="text-xs text-sky-100/90 leading-relaxed mb-2.5 break-keep">
            {isPending || isApproved
              ? "이 링크로 Gemini에 새로 가입하고 인증하면 응모권 +100 · 사인업 레벨 +1"
              : "Gemini 대학생 플랜 가입 주문 영수증 캡처 1장이 승인되면 응모권 100장을 받을 수 있어요."}
          </p>

          <span
            className={`inline-block px-3 py-0.5 rounded-full text-[11px] font-bold border ${
              isApproved
                ? "bg-[#3898FF] border-[#66B2FF] text-white"
                : "bg-white/10 border-white/25 text-sky-100"
            }`}
          >
            {statusBadgeText}
          </span>
        </div>

        {/* ================================================================
            상태 1: 승인 완료 (S08 · approved)
           ================================================================ */}
        {isApproved ? (
          <div className="space-y-3 text-left">
            <div className="w-full p-5 rounded-2xl bg-[#52A7FF] text-white shadow-lg">
              <h2 className="text-lg font-extrabold mb-1.5">승인됐어요!</h2>
              <p className="text-xs text-white/95 leading-relaxed font-medium">
                응모권 +100 · 사인업 LV +1 반영 완료
                {existingVerif?.referrer_slug && (
                  <>
                    <br />
                    추천인 {existingVerif.referrer_slug}에게 +50 · 레벨 +1
                  </>
                )}
              </p>
            </div>

            <Link
              href="/raffle"
              className="block w-full py-3.5 rounded-xl bg-[#3898FF] hover:bg-[#2589F5] text-white text-sm font-extrabold text-center shadow-md"
            >
              응모하러 가기
            </Link>

            <Link
              href={`/snowball/${encodeURIComponent(mySnowball.slug)}`}
              className="block w-full py-3.5 rounded-xl bg-white hover:bg-sky-50 text-[#102A4E] text-sm font-extrabold text-center shadow-md"
            >
              내 스노우볼 보기
            </Link>
          </div>
        ) : isPending && existingVerif ? (
          /* ================================================================
              상태 2: 심사 중 (S08 · pending)
             ================================================================ */
          <div className="space-y-3 text-left">
            <div className="w-full p-4 rounded-2xl bg-[#F4F9FF] text-[#0B1528] shadow-md">
              <h2 className="text-base font-extrabold text-[#102A4E] mb-1">
                심사 중이에요
              </h2>
              <p className="text-[11px] text-[#5B7493] leading-relaxed mb-4">
                {existingVerif.created_at
                  ? new Date(existingVerif.created_at).toLocaleString("ko-KR", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "방금"}{" "}
                제출 · 결과는 이 화면과 내 스노우볼에서 확인할 수 있어요 · 보통 1~2일 소요
              </p>

              {existingVerif.image_url_1 &&
              (existingVerif.image_url_1.startsWith("http") ||
                existingVerif.image_url_1.startsWith("data:image")) ? (
                <div className="min-h-[160px] h-auto w-full rounded-xl border border-[#BFD8F5] bg-white overflow-hidden flex items-center justify-center p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={existingVerif.image_url_1}
                    alt="제출한 주문 영수증 캡처"
                    className="max-h-52 w-full h-auto object-contain"
                  />
                </div>
              ) : (
                <div className="min-h-[112px] h-auto rounded-xl border border-[#BFD8F5] bg-[#E8F2FF] flex items-center justify-center text-xs font-bold text-[#102A4E] p-3 text-center">
                  제출된 주문 영수증 캡처 확인 중
                </div>
              )}

              {existingVerif.referrer_slug && (
                <p className="text-[11px] font-bold text-[#1E88E5] mt-2.5">
                  · 등록한 추천인 친구: {existingVerif.referrer_slug}
                </p>
              )}
            </div>

            <div className="w-full p-3.5 rounded-2xl bg-[#F4F9FF] text-[#0B1528] flex items-start gap-2.5 shadow-md">
              <span className="w-5 h-5 rounded-full bg-[#1E88E5] text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">
                !
              </span>
              <div>
                <p className="text-xs font-extrabold text-[#102A4E]">
                  허위 인증 시 응모권 회수 · 당첨 취소
                </p>
                <p className="text-[11px] text-[#5B7493]">
                  추첨 전 최종 검수에서 확인되면 지급된 응모권도 회수돼요.
                </p>
              </div>
            </div>

            <Link
              href={`/snowball/${encodeURIComponent(mySnowball.slug)}`}
              className="block w-full py-3.5 rounded-xl bg-white hover:bg-sky-50 text-[#102A4E] text-sm font-extrabold text-center shadow-md"
            >
              내 스노우볼 보기
            </Link>
          </div>
        ) : (
          /* ================================================================
              상태 3 & 4: 미제출(ready) 또는 반려됨(rejected -> 재제출 허용)
             ================================================================ */
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            {/* 반려됨 안내 카드 (S08 · rejected) */}
            {isRejected && (
              <div className="w-full p-4 rounded-2xl bg-[#F4F9FF] text-[#0B1528] shadow-md border-l-4 border-red-500">
                <h2 className="text-base font-extrabold text-[#102A4E] mb-1">
                  반려됐어요
                </h2>
                <p className="text-xs font-bold text-[#0D2B52] mb-1">
                  사유:{" "}
                  {existingVerif?.reject_reason ||
                    "주문 영수증 캡처에 계정 이메일 또는 주문 날짜가 보이지 않아요"}
                </p>
                <p className="text-[11px] text-[#5B7493]">
                  아래에서 Gemini 대학생 플랜 가입 주문 영수증 캡처 1장을 확인하고 다시 제출할 수 있어요.
                </p>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/20 border border-red-300/50 text-xs text-red-100">
                ⚠️ {errorMsg}
              </div>
            )}

            {/* 1. Gemini 대학생 플랜 가입하기 */}
            <section className="w-full p-4 rounded-2xl bg-[#F4F9FF] text-[#0B1528] shadow-md">
              <h2 className="text-xs font-extrabold text-[#102A4E] mb-1">
                1. Gemini 대학생 플랜 가입하기
              </h2>
              <p className="text-[11px] text-[#5B7493] mb-3 break-all">
                로그인한 계정: {userEmail}
              </p>

              <a
                href={GEMINI_STUDENT_SIGNUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleSignupLinkClick}
                className="block w-full py-3.5 px-3 rounded-xl bg-[#3898FF] hover:bg-[#2589F5] text-white text-xs font-extrabold text-center transition-colors shadow-xs"
              >
                {clickedAt
                  ? "Gemini 가입 바로가기 (다시 열기)"
                  : "Gemini 가입 바로가기"}
              </a>

              <button
                type="button"
                onClick={handleCopySignupLink}
                className="mt-2 w-full py-2.5 px-3 rounded-xl border border-[#BFD8F5] bg-white hover:bg-[#EBF4FF] text-[#102A4E] text-xs font-extrabold text-center transition-colors"
              >
                가입 링크 복사하기
              </button>

              {clickedAt && (
                <p className="mt-2 text-[11px] font-semibold text-[#5B7493]">
                  클릭함 ·{" "}
                  {new Date(clickedAt).toLocaleString("ko-KR", {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}

              <div className="mt-3 p-3 rounded-xl bg-[#E6F1FC] flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[#1E88E5] text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                  !
                </span>
                <div>
                  <p className="text-[11px] font-extrabold text-[#102A4E] break-keep">
                    반드시 해당 링크로 가입해야 인정돼요
                  </p>
                  <p className="text-[10px] text-[#5B7493] leading-relaxed mt-0.5 break-keep">
                    지금 로그인한 구글 계정으로 대학생 혜택 최초로 가입해야 인정됩니다.
                  </p>
                </div>
              </div>
            </section>

            {/* 2. 주문 영수증 제출하기 (Gemini 대학생 플랜 가입 주문 영수증 캡처 1장 + [캡처 예시 보기] 모달 연결) */}
            <section className="w-full p-4 rounded-2xl bg-[#F4F9FF] text-[#0B1528] shadow-md">
              <h2 className="text-xs font-extrabold text-[#102A4E] mb-2">
                2. 주문 영수증 제출하기
              </h2>

              <p className="text-[11px] font-semibold text-[#5B7493] mb-2">
                Gemini 대학생 플랜 가입 주문 영수증 캡처 1장
              </p>

              {uploadingImage ? (
                <div className="min-h-[150px] h-auto py-6 px-4 w-full rounded-2xl border border-[#90B8E8] bg-[#E8F2FF] flex flex-col items-center justify-center gap-2 text-center">
                  <div className="w-6 h-6 rounded-full border-2 border-[#1E88E5]/30 border-t-[#1E88E5] animate-spin" />
                  <span className="text-xs font-bold text-[#102A4E]">
                    이미지를 준비하고 있어요...
                  </span>
                </div>
              ) : imageUrl1 ? (
                <div>
                  <div className="relative min-h-[168px] h-auto w-full rounded-2xl bg-[#DCEBFA] border border-[#90B8E8] overflow-hidden flex items-center justify-center p-1">
                    {preview1 ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={preview1}
                        alt="Gemini 대학생 플랜 가입 주문 영수증 캡처 1장"
                        className="max-h-56 w-full h-auto object-contain bg-white rounded-xl"
                      />
                    ) : (
                      <span className="text-xs font-bold text-[#102A4E]">
                        업로드 완료
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center justify-end gap-2 text-[11px] text-[#5B7493]">
                    <label className="cursor-pointer hover:underline font-bold text-[#1E88E5]">
                      다시 올리기
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={handleClearImage}
                      className="hover:underline font-semibold text-rose-600"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ) : (
                <label className="min-h-[150px] h-auto py-5 px-4 w-full rounded-2xl border-2 border-dashed border-[#90B8E8] bg-[#E8F2FF] hover:bg-[#DCEBFA] flex flex-col items-center justify-center text-center cursor-pointer transition-colors">
                  <span className="text-xs font-extrabold text-[#102A4E] break-keep">
                    + 가입 주문 영수증 캡처 업로드
                  </span>
                  <span className="text-[11px] text-[#5B7493] mt-1 leading-relaxed break-keep">
                    Gemini 대학생 플랜 가입 주문 영수증 캡처 1장 (JPG/PNG)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}

              {/* [캡처 예시 보기] 버튼 -> /captureexample.png 팝업 모달 오픈 */}
              <div className="text-center my-3">
                <button
                  type="button"
                  onClick={() => setIsExampleModalOpen(true)}
                  className="text-xs font-extrabold text-[#1E88E5] hover:underline"
                >
                  캡처 예시 보기 · 실제 영수증 화면 확인
                </button>
              </div>

              <div className="p-3 rounded-xl bg-[#E6F1FC] flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[#1E88E5] text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                  !
                </span>
                <div>
                  <p className="text-[11px] font-extrabold text-[#102A4E]">
                    로그인 계정 = Gemini 가입 계정
                  </p>
                  <p className="text-[10px] text-[#5B7493] leading-relaxed">
                    주문 영수증 캡처 1장에 구글 이메일과 주문 날짜가 보여야 해요. 주문 영수증은 가입한 메일로 자동 발송됩니다.
                  </p>
                </div>
              </div>
            </section>

            {/* 3. ★추천인 친구 닉네임 입력 (선택 · 실시간 DB 검증 필수 포함)★ */}
            <section className="w-full p-4 rounded-2xl bg-[#F4F9FF] text-[#0B1528] shadow-md">
              <h2 className="text-xs font-extrabold text-[#102A4E] mb-1">
                3. 추천인 친구 닉네임 입력 (선택)
              </h2>
              <p className="text-[11px] text-[#5B7493] mb-2.5">
                나를 초대한 친구의 닉네임을 입력하면 승인 시 친구에게도 응모권 +50장 · LV+1이 지급돼요.
              </p>

              <input
                type="text"
                value={referrerNickname}
                onChange={(e) => setReferrerNickname(e.target.value.slice(0, 8))}
                maxLength={8}
                placeholder="초대한 친구 닉네임 입력 (선택)"
                className="w-full px-3.5 py-3 rounded-xl bg-white border border-[#BFD8F5] text-xs font-bold text-[#0B1528] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E88E5]"
              />

              {/* 실시간 DB 검증 결과 메시지 */}
              {refStatus === "self" && (
                <p className="mt-2 text-[11px] font-extrabold text-red-600">
                  ❌ 본인은 추천인으로 입력할 수 없어요
                </p>
              )}
              {refStatus === "valid" && (
                <p className="mt-2 text-[11px] font-extrabold text-emerald-600">
                  ✅ 확인된 친구 닉네임이에요 (승인 시 친구에게도 응모권 +50장 · LV+1)
                </p>
              )}
              {refStatus === "not_found" && (
                <p className="mt-2 text-[11px] font-extrabold text-red-600">
                  ❌ 존재하지 않는 닉네임이에요. 다시 확인해 주세요.
                </p>
              )}
              {refStatus === "checking" && (
                <p className="mt-2 text-[11px] font-semibold text-[#5B7493]">
                  친구 닉네임을 확인하고 있어요...
                </p>
              )}
            </section>

            {/* 4. 허위 인증 회수 안내 박스 + 유의사항 동의 체크 + [제출하기] */}
            <div className="w-full p-3.5 rounded-2xl bg-[#F4F9FF] text-[#0B1528] flex items-start gap-2.5 shadow-md">
              <span className="w-5 h-5 rounded-full bg-[#1E88E5] text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">
                !
              </span>
              <div>
                <p className="text-xs font-extrabold text-[#102A4E]">
                  허위 인증 시 응모권 회수 · 당첨 취소
                </p>
                <p className="text-[11px] text-[#5B7493]">
                  추첨 전 최종 검수에서 확인되면 지급된 응모권도 회수돼요.
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none px-1">
              <input
                type="checkbox"
                checked={noticeAgreed}
                onChange={(e) => setNoticeAgreed(e.target.checked)}
                className="w-4 h-4 rounded accent-[#3898FF]"
              />
              <span className="text-xs font-extrabold text-white">
                위 유의사항을 확인했어요.
              </span>
            </label>

            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-full py-3.5 rounded-xl text-sm font-extrabold shadow-lg transition-all ${
                canSubmit
                  ? "bg-[#3898FF] hover:bg-[#2589F5] text-white cursor-pointer"
                  : "bg-[#5B87B8]/70 text-white/60 cursor-not-allowed"
              }`}
            >
              {submitting
                ? "제출 중..."
                : isRejected
                ? "다시 제출하기"
                : "제출하기"}
            </button>

            {!clickedAt && (
              <p className="text-center text-[11px] font-bold text-white/90">
                가입 링크를 먼저 클릭해야 인증을 제출할 수 있어요.
              </p>
            )}
          </form>
        )}
      </div>

      {/* ====================================================================
          캡처 예시 보기 팝업 모달 (/captureexample.png 표시, createPortal 최상위 렌더링)
         ==================================================================== */}
      {isExampleModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={() => setIsExampleModalOpen(false)}
          >
            <div
              className="w-full max-w-[360px] max-h-[88vh] rounded-3xl bg-white text-[#0B1528] p-4 shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-sm font-extrabold text-[#102A4E]">
                  주문 영수증 캡처 예시
                </h3>
                <button
                  type="button"
                  onClick={() => setIsExampleModalOpen(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1"
                >
                  닫기 ✕
                </button>
              </div>

              <p className="text-[11px] text-[#5B7493] mb-3 text-left">
                <strong>Gemini 대학생 플랜 가입 주문 영수증 캡처 1장</strong>에 빨간색 박스로 표시된 <strong>주문 번호, 주문 날짜, 내 계정(이메일)</strong>이 선명하게 보이도록 캡처해 주세요.
              </p>

              <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/captureexample.png"
                  alt="Gemini 대학생 플랜 가입 주문 영수증 캡처 1장 예시"
                  className="w-full h-auto object-contain rounded-xl"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsExampleModalOpen(false)}
                className="mt-3 w-full py-3 rounded-xl bg-[#3898FF] text-white text-xs font-extrabold"
              >
                확인했어요
              </button>
            </div>
          </div>,
          document.body
        )}
    </AppShell>
  );
}
