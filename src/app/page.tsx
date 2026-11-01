import React, { Suspense } from "react";
import LandingView from "@/components/LandingView";

/**
 * S01 메인 랜딩 페이지 (Next.js App Router 엔트리 페이지)
 * useSearchParams()를 사용하는 클라이언트 컴포넌트를 Suspense 경계(Boundary)로 감싸 렌더링합니다.
 */
export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-[390px] min-h-screen bg-white flex items-center justify-center text-xs text-neutral-400">
          로딩 중...
        </div>
      }
    >
      <LandingView />
    </Suspense>
  );
}
