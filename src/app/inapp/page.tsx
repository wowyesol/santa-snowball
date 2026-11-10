"use client";

import React, { Suspense } from "react";
import AppShell from "@/components/AppShell";
import InAppBrowserGuard from "@/components/InAppBrowserGuard";

/**
 * S00 외부 브라우저 안내 전용 페이지 (/inapp)
 */
export default function InAppPage() {
  return (
    <AppShell hideDeadlineBanner={true}>
      <Suspense fallback={null}>
        <InAppBrowserGuard standalonePage={true} />
      </Suspense>
    </AppShell>
  );
}
