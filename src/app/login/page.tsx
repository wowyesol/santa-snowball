"use client";

import React, { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import InAppBrowserGuard from "@/components/InAppBrowserGuard";
import {
  AuthSnowballState,
  Snowball,
  checkNicknameAvailable,
  clearPendingInviteSlug,
  createSnowball,
  getCurrentAuthAndSnowball,
  getPendingInviteSlug,
  getSnowballBySlug,
  saveInvitedByNickname,
  savePendingInviteSlug,
  signInWithGoogle,
  signOutAll,
  supabase,
} from "@/lib/supabase";

/**
 * S02 로그인 + 동의 + 닉네임 (/login)
 * 1. 구글 로그인 (실제 Supabase Google OAuth 로그인 전용)
 * 2. 개인정보 수집·이용 동의 필수 체크박스 2개
 * 3. 닉네임 (2~8자 제한, 추천인 칸 없음, 입력 즉시 Supabase 중복 확인 -> 중복 시 "이미 사용 중인 닉네임이에요" 표시 및 버튼 비활성화)
 * -> 완료 시 ticket_count = 1, level = 0 스노우볼 생성 후 일반 진입은 S04, 친구 링크 진입은 S05로 자동 이동
 */
function LoginS02Content() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlSb = searchParams.get("sb")?.trim() || null;

  const [inviteSlug, setInviteSlug] = useState<string | null>(urlSb);
  const [friendSnowball, setFriendSnowball] = useState<Snowball | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authState, setAuthState] = useState<AuthSnowballState>({
    isAuthenticated: false,
    userId: null,
    email: null,
    displayName: null,
    snowball: null,
  });

  // 필수 동의 체크박스 2개 상태
  const [agreePrivacy, setAgreePrivacy] = useState<boolean>(true);
  const [agreeContact, setAgreeContact] = useState<boolean>(true);
  const [modalDetail, setModalDetail] = useState<"privacy" | "contact" | null>(
    null
  );

  // 닉네임(2~8자) 및 실시간 중복 검사 상태
  const [nickname, setNickname] = useState<string>("");
  const [nickStatus, setNickStatus] = useState<
    "idle" | "checking" | "available" | "duplicate" | "invalid"
  >("idle");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [oauthLoading, setOauthLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const redirectExistingUser = useCallback(
    (mySlug: string, targetInviteSlug: string | null) => {
      if (targetInviteSlug && targetInviteSlug !== mySlug) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("pending_friend_slug");
        }
        clearPendingInviteSlug();
        router.replace(`/snowball/${encodeURIComponent(targetInviteSlug)}`);
        return;
      }
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("pending_friend_slug");
      }
      clearPendingInviteSlug();
      router.replace(`/snowball/${encodeURIComponent(mySlug)}`);
    },
    [router]
  );

  const syncState = useCallback(async () => {
    let fromWindow: string | null = null;
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      fromWindow = sp.get("sb")?.trim() || null;
    }
    const activeUrlSb = urlSb || fromWindow;
    if (activeUrlSb) {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("pending_friend_slug", activeUrlSb);
      }
      savePendingInviteSlug(activeUrlSb);
    }
    const savedSb =
      activeUrlSb ||
      (typeof window !== "undefined"
        ? window.localStorage.getItem("pending_friend_slug")
        : null) ||
      getPendingInviteSlug();
    setInviteSlug(savedSb);

    const [friendData, currentAuth] = await Promise.all([
      savedSb ? getSnowballBySlug(savedSb) : Promise.resolve(null),
      getCurrentAuthAndSnowball(),
    ]);

    if (friendData) {
      setFriendSnowball(friendData);
      saveInvitedByNickname(friendData.nickname);
    } else {
      setFriendSnowball(null);
    }

    setAuthState(currentAuth);

    if (currentAuth.isAuthenticated && currentAuth.snowball) {
      redirectExistingUser(currentAuth.snowball.slug, savedSb);
      return;
    }

    setLoading(false);
  }, [urlSb, redirectExistingUser]);

  useEffect(() => {
    syncState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      syncState();
    });

    window.addEventListener("santa-auth-changed", syncState);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener("santa-auth-changed", syncState);
    };
  }, [syncState]);

  // 닉네임 입력 즉시(디바운스 200ms) Supabase snowballs 테이블에서 실시간 중복 확인
  useEffect(() => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setNickStatus("idle");
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 8) {
      setNickStatus("invalid");
      return;
    }

    let cancelled = false;
    setNickStatus("checking");

    const timer = setTimeout(async () => {
      const res = await checkNicknameAvailable(trimmed);
      if (cancelled) return;
      setNickStatus(res.available ? "available" : "duplicate");
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [nickname]);

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setOauthLoading(true);
    try {
      const { error } = await signInWithGoogle(inviteSlug);
      if (error) {
        setErrorMsg(`구글 로그인 안내: ${error.message}`);
        setOauthLoading(false);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "구글 로그인 중 오류가 발생했습니다."
      );
      setOauthLoading(false);
    }
  };

  const handleChangeAccount = async () => {
    await signOutAll();
    setAuthState({
      isAuthenticated: false,
      userId: null,
      email: null,
      displayName: null,
      snowball: null,
    });
    setNickname("");
    setNickStatus("idle");
    setErrorMsg(null);
  };

  const isFormValid =
    authState.isAuthenticated &&
    Boolean(authState.userId) &&
    agreePrivacy &&
    agreeContact &&
    nickname.trim().length >= 2 &&
    nickname.trim().length <= 8 &&
    nickStatus === "available" &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !authState.userId) return;

    setErrorMsg(null);
    setSubmitting(true);
    try {
      const created = await createSnowball({
        userId: authState.userId,
        nickname: nickname.trim(),
        termsAgreed: agreePrivacy && agreeContact,
      });

      const pendingFromStorage =
        typeof window !== "undefined"
          ? window.localStorage.getItem("pending_friend_slug")
          : null;
      const targetFriendSlug =
        pendingFromStorage?.trim() ||
        friendSnowball?.slug ||
        inviteSlug?.trim() ||
        getPendingInviteSlug() ||
        null;

      if (typeof window !== "undefined") {
        window.localStorage.removeItem("pending_friend_slug");
      }
      clearPendingInviteSlug();

      // 친구 공유 링크로 진입한 경우 친구의 S05로 무조건 자동 이동, 일반 진입은 내 S04로 이동
      if (targetFriendSlug && targetFriendSlug !== created.slug) {
        router.replace(`/snowball/${encodeURIComponent(targetFriendSlug)}`);
      } else {
        router.replace(`/snowball/${encodeURIComponent(created.slug)}`);
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "스노우볼 생성 중 오류가 발생했습니다.";
      if (msg.includes("이미 사용 중인")) {
        setNickStatus("duplicate");
      } else {
        setErrorMsg(msg);
      }
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24 text-xs text-white/70">
          로그인 정보를 확인하고 있어요...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <InAppBrowserGuard />

      <form
        onSubmit={handleSubmit}
        className="flex flex-col px-5 pt-7 pb-12 text-left break-keep"
      >
        {/* 상단 타이틀 */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1.5">
            내 스노우볼 만들기
          </h1>
          <p className="text-xs text-sky-100/85">
            구글 계정으로 간편하게 로그인할 수 있어요.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-300/50 text-xs text-red-100">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* 1. 구글 로그인 카드 */}
        <section className="w-full rounded-2xl bg-[#F4F9FF] text-[#0B1528] p-4 mb-4 shadow-md">
          <h2 className="text-xs font-extrabold text-[#102A4E] mb-2.5">
            1. 구글 로그인
          </h2>

          {authState.isAuthenticated ? (
            <div className="w-full px-3.5 py-2.5 rounded-xl bg-[#E6F1FC] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="w-6 h-6 rounded-full border border-dashed border-[#3898FF] text-[#1E88E5] text-[11px] font-black flex items-center justify-center shrink-0">
                  G
                </span>
                <span className="text-xs font-bold text-[#102A4E] break-all leading-snug">
                  {authState.email} 로 로그인됨
                </span>
              </div>
              <button
                type="button"
                onClick={handleChangeAccount}
                className="shrink-0 text-[11px] font-semibold text-[#5B7493] hover:text-[#0B1528]"
              >
                변경
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={oauthLoading}
              className="w-full py-3.5 px-4 rounded-xl bg-white border border-[#BFD8F5] hover:bg-[#EBF4FF] text-xs font-extrabold text-[#102A4E] flex items-center justify-center gap-2 shadow-2xs transition-colors"
            >
              <span className="w-5 h-5 rounded-full bg-[#E6F1FC] text-[#1E88E5] font-black flex items-center justify-center text-[11px]">
                G
              </span>
              <span>
                {oauthLoading ? "구글 로그인 연결 중..." : "구글 계정으로 로그인"}
              </span>
            </button>
          )}
        </section>

        {/* 2. 개인정보 수집·이용 동의 카드 */}
        <section className="w-full rounded-2xl bg-[#F4F9FF] text-[#0B1528] p-4 mb-5 shadow-md">
          <h2 className="text-xs font-extrabold text-[#102A4E] mb-3">
            2. 개인정보 수집 · 이용 동의
          </h2>

          <div className="space-y-2.5 mb-3">
            <div className="flex items-start justify-between gap-2">
              <label className="flex items-start gap-2 cursor-pointer select-none min-w-0 flex-1">
                <input
                  type="checkbox"
                  checked={agreePrivacy}
                  onChange={(e) => setAgreePrivacy(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded accent-[#1E88E5] shrink-0"
                />
                <span className="text-xs font-bold text-[#102A4E] leading-snug break-keep">
                  [필수] 구글 이메일 · 닉네임 수집 · 이용 동의
                </span>
              </label>
              <button
                type="button"
                onClick={() =>
                  setModalDetail((prev) =>
                    prev === "privacy" ? null : "privacy"
                  )
                }
                className="text-[11px] font-semibold text-[#5B7493] hover:underline shrink-0 pt-0.5"
              >
                보기
              </button>
            </div>

            <div className="flex items-start justify-between gap-2">
              <label className="flex items-start gap-2 cursor-pointer select-none min-w-0 flex-1">
                <input
                  type="checkbox"
                  checked={agreeContact}
                  onChange={(e) => setAgreeContact(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded accent-[#1E88E5] shrink-0"
                />
                <span className="text-xs font-bold text-[#102A4E] leading-snug break-keep">
                  [필수] 당첨 시 이 이메일로 연락받는 것에 동의
                </span>
              </label>
              <button
                type="button"
                onClick={() =>
                  setModalDetail((prev) =>
                    prev === "contact" ? null : "contact"
                  )
                }
                className="text-[11px] font-semibold text-[#5B7493] hover:underline shrink-0 pt-0.5"
              >
                보기
              </button>
            </div>
          </div>

          {modalDetail && (
            <div className="mb-2.5 p-2.5 rounded-xl bg-white border border-[#DCEBFA] text-[11px] text-[#4A6583] leading-relaxed">
              {modalDetail === "privacy"
                ? "스노우볼 생성, 편지 발신자 표기, 중복 참여 방지를 위해 구글 이메일과 닉네임을 수집하며 이벤트 종료 후 즉시 파기합니다."
                : "경품 추첨 당첨 시 로그인하신 구글 이메일 주소로 당첨 안내 및 경품 수령 절차를 안내해 드립니다."}
            </div>
          )}

          <p className="text-[11px] text-[#5B7493]">
            수집 항목: 이메일, 닉네임 · 이용 기간: 이벤트 종료 후 파기
          </p>
        </section>

        {/* 3. 닉네임 (2~8자 제한, 추천인 입력칸 없음, 실시간 중복 확인) */}
        <section className="w-full mb-5">
          <label className="block text-xs font-bold text-white mb-2">
            3. 닉네임
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 8))}
            maxLength={8}
            placeholder="닉네임 입력 (2~8자)"
            className="w-full px-4 py-3.5 rounded-xl bg-white text-sm font-bold text-[#0B1528] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3898FF] shadow-md"
          />

          {/* 실시간 중복 확인 상태 문구 */}
          {nickStatus === "duplicate" ? (
            <p className="mt-2 text-xs font-extrabold text-white">
              ! 이미 사용 중인 닉네임이에요
            </p>
          ) : nickStatus === "invalid" ? (
            <p className="mt-2 text-xs font-semibold text-amber-200">
              닉네임은 2~8자로 입력해 주세요
            </p>
          ) : nickStatus === "available" ? (
            <p className="mt-2 text-[11px] font-semibold text-sky-200">
              ✓ 사용 가능한 닉네임이에요 ({nickname.trim().length}/8자)
            </p>
          ) : (
            <p className="mt-2 text-[11px] text-sky-200/80">
              트리 · 편지 · 보낸 사람 표시에 쓰여요 · 2~8자
            </p>
          )}
        </section>

        {/* 하단 스노우볼 만들기 제출 버튼 */}
        <button
          type="submit"
          disabled={!isFormValid}
          className={`w-full py-3.5 rounded-xl text-sm font-extrabold transition-all shadow-lg ${
            isFormValid
              ? "bg-[#3898FF] hover:bg-[#2589F5] text-white cursor-pointer"
              : "bg-[#5B87B8]/70 text-white/60 cursor-not-allowed"
          }`}
        >
          {submitting ? "스노우볼 만드는 중..." : "스노우볼 만들기"}
        </button>
      </form>
    </AppShell>
  );
}

export default function LoginPage() {
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
      <LoginS02Content />
    </Suspense>
  );
}
