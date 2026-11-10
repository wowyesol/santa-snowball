"use client";

import React, { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  clearPendingInviteSlug,
  getCurrentAuthAndSnowball,
  getPendingInviteSlug,
  savePendingInviteSlug,
} from "@/lib/supabase";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let isMounted = true;

    async function handleOAuthCallback() {
      // URL 쿼리 또는 로컬 스토리지(pending_friend_slug)에 보존된 친구 초대 코드(sb) 확인
      const querySb = searchParams.get("sb")?.trim() || null;
      if (querySb) {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("pending_friend_slug", querySb);
        }
        savePendingInviteSlug(querySb);
      }
      const effectiveSb =
        querySb ||
        (typeof window !== "undefined"
          ? window.localStorage.getItem("pending_friend_slug")
          : null) ||
        getPendingInviteSlug();

      // Supabase 클라이언트가 URL 해시/코드를 세션으로 교환할 시간을 짧게 확보 후 조회
      const authState = await getCurrentAuthAndSnowball();
      if (!isMounted) return;

      // 1) 이미 스노우볼이 있는 기존 회원인 경우 -> 바로 S04(내 스노우볼) 또는 S05(친구 스노우볼)로 이동
      if (authState.isAuthenticated && authState.snowball) {
        const mySlug = authState.snowball.slug;
        if (effectiveSb && effectiveSb !== mySlug) {
          clearPendingInviteSlug();
          router.replace(`/snowball/${encodeURIComponent(effectiveSb)}`);
          return;
        }
        clearPendingInviteSlug();
        router.replace(`/snowball/${encodeURIComponent(mySlug)}`);
        return;
      }

      // 2) 신규 회원(스노우볼 미생성)이거나 인증 실패 시 -> S02(/login)로 이동하여 약관 동의 및 닉네임 설정 진행
      const nextUrl = effectiveSb
        ? `/login?sb=${encodeURIComponent(effectiveSb)}`
        : "/login";
      router.replace(nextUrl);
    }

    handleOAuthCallback();

    return () => {
      isMounted = false;
    };
  }, [router, searchParams]);

  return (
    <div className="w-full max-w-[390px] min-h-screen bg-white flex flex-col items-center justify-center gap-3 px-6 text-center border-x border-neutral-200/80">
      <div className="w-9 h-9 rounded-full border-2 border-neutral-200 border-t-neutral-900 animate-spin" />
      <p className="text-sm font-bold text-neutral-900">
        구글 로그인 정보를 확인하고 있어요...
      </p>
      <p className="text-xs text-neutral-500">
        잠시만 기다려 주시면 스노우볼 우체국으로 이동합니다.
      </p>
    </div>
  );
}

/**
 * Google OAuth 인증 완료 후 리다이렉트 콜백 페이지 (/auth/callback)
 */
export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-[390px] min-h-screen bg-white flex items-center justify-center text-xs text-neutral-400">
          인증 처리 중...
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
