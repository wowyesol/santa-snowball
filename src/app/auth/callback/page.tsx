"use client";

import React, { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  clearAllInviteStorage,
  clearPendingInviteSlug,
  consumeOneTimeOAuthInviteSlug,
  getCurrentAuthAndSnowball,
} from "@/lib/supabase";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let isMounted = true;

    async function handleOAuthCallback() {
      // 1회용으로 전달된 친구 초대 슬러그를 읽어옴과 동시에 모든 저장소(localStorage, sessionStorage, cookie)에서 즉시 영구 삭제
      const querySb = searchParams.get("sb")?.trim() || null;
      const storedOneTimeSb = consumeOneTimeOAuthInviteSlug();
      clearPendingInviteSlug();

      const effectiveSb = querySb || storedOneTimeSb || null;

      // Supabase 클라이언트가 URL 해시/코드를 세션으로 교환한 뒤 현재 계정 및 스노우볼 조회
      const authState = await getCurrentAuthAndSnowball();
      if (!isMounted) return;

      // 1) 이미 스노우볼이 있는 기존 회원인 경우 -> 1회 이동 처리 후 저장소에는 아무 흔적도 남기지 않음
      if (authState.isAuthenticated && authState.snowball) {
        const mySlug = authState.snowball.slug;
        clearPendingInviteSlug();

        if (effectiveSb && effectiveSb !== mySlug) {
          router.replace(`/snowball/${encodeURIComponent(effectiveSb)}`);
          return;
        }

        if (effectiveSb === mySlug) {
          clearAllInviteStorage();
        }
        router.replace(`/snowball/${encodeURIComponent(mySlug)}`);
        return;
      }

      // 2) 신규 회원(스노우볼 미생성)이거나 인증 실패 시 -> S02(/login)로 이동하여 약관 동의 및 닉네임 설정 진행 (URL 쿼리로만 1회 전달)
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
