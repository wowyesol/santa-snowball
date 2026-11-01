"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase, supabaseUrl } from "@/lib/supabase";

// 연결 상태(Connection Status) 타입 정의
type ConnectionState = "checking" | "success" | "error";

interface CheckDetail {
  latencyMs: number | null;
  dbMessage: string;
  authMessage: string;
  checkedAt: string;
  errorDetail?: string;
}

/**
 * Supabase 연동 확인용 테스트 페이지 (/supabase-test)
 * 클라이언트가 실제 Supabase 서버(PostgREST 및 Auth)와 정상 통신하는지 검증하고
 * 화면 중앙에 결과를 큼직하게 표시합니다.
 */
export default function SupabaseTestPage() {
  const [status, setStatus] = useState<ConnectionState>("checking");
  const [detail, setDetail] = useState<CheckDetail | null>(null);

  // Supabase 서버 연결 테스트 실행 함수
  const checkConnection = useCallback(async () => {
    setStatus("checking");
    const startTime = performance.now();

    try {
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
      if (!supabaseUrl || !anonKey) {
        throw new Error(
          ".env.local 파일에 NEXT_PUBLIC_SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY가 비어 있습니다."
        );
      }

      // 1. Supabase PostgREST 데이터베이스(Database) 게이트웨이 통신 및 API 키 인증 확인
      // 아직 생성된 테이블이 없더라도 서버 연결 및 키 인증이 성공하면 'PGRST205'(테이블 없음) 응답이 돌아옵니다.
      const { error: dbError } = await supabase
        .from("_supabase_connection_check")
        .select("*")
        .limit(1);

      // PGRST205 / 42P01 코드는 서버 도달 및 인증은 성공했으나 테스트용 임시 테이블만 없다는 뜻이므로 정상 연결로 판정
      const isTableMissingButConnected =
        dbError &&
        (dbError.code === "PGRST205" ||
          dbError.code === "42P01" ||
          dbError.message.includes("schema cache"));

      if (dbError && !isTableMissingButConnected) {
        throw new Error(
          `[${dbError.code || "DB_ERROR"}] ${dbError.message}`
        );
      }

      // 2. Supabase Auth(인증) 서버 상태 확인
      const { error: authError } = await supabase.auth.getSession();
      if (authError) {
        throw new Error(`[AUTH_ERROR] ${authError.message}`);
      }

      const latencyMs = Math.round(performance.now() - startTime);

      setDetail({
        latencyMs,
        dbMessage: isTableMissingButConnected
          ? "PostgREST 서버 응답 및 API Key 인증 정상 (초기 스키마 확인 완료)"
          : "PostgREST 쿼리 응답 정상",
        authMessage: "Supabase Auth 세션 클라이언트 정상 동작",
        checkedAt: new Date().toLocaleTimeString("ko-KR"),
      });
      setStatus("success");
    } catch (err) {
      const latencyMs = Math.round(performance.now() - startTime);
      const message =
        err instanceof Error
          ? err.message
          : "알 수 없는 네트워크 오류가 발생했습니다.";

      setDetail({
        latencyMs,
        dbMessage: "연결 실패",
        authMessage: "확인 불가",
        checkedAt: new Date().toLocaleTimeString("ko-KR"),
        errorDetail: message,
      });
      setStatus("error");
    }
  }, []);

  // 페이지 첫 마운트(Mount) 시 자동으로 연결 테스트 수행
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  return (
    <main className="w-full max-w-[560px] min-h-screen px-5 py-10 flex flex-col items-center justify-center">
      <div className="w-full rounded-3xl bg-white p-8 shadow-lg border border-neutral-200 text-center">
        {/* 상단 카테고리 뱃지 */}
        <span className="inline-block px-3.5 py-1 rounded-full bg-neutral-100 text-neutral-600 text-xs font-semibold mb-6">
          Santa Project · Supabase Health Check
        </span>

        {/* 1. 확인 중(Checking) 상태 */}
        {status === "checking" && (
          <div className="py-8 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full border-4 border-neutral-200 border-t-neutral-900 animate-spin" />
            <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">
              Supabase 연결 확인 중...
            </h1>
            <p className="text-sm text-neutral-500">
              서버 응답과 API 키 유효성을 검증하고 있습니다.
            </p>
          </div>
        )}

        {/* 2. 연결 성공(Success) 상태 */}
        {status === "success" && (
          <div className="py-4 flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-4xl font-bold mb-5 shadow-inner">
              ✓
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-emerald-600 tracking-tight mb-2">
              Supabase 연결 성공!
            </h1>
            <p className="text-sm text-neutral-600 font-medium mb-6">
              Santa 프로젝트가 Supabase 서버와 정상적으로 통신하고 있습니다.
            </p>

            {/* 상세 연결 정보 카드 */}
            {detail && (
              <div className="w-full rounded-2xl bg-neutral-50 border border-neutral-200 p-4 text-left space-y-2.5 text-xs mb-6">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-neutral-500 font-medium">프로젝트 URL</span>
                  <span className="font-mono text-neutral-800 truncate max-w-[300px]">
                    {supabaseUrl}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-neutral-500 font-medium">응답 속도</span>
                  <span className="font-bold text-emerald-600">
                    {detail.latencyMs} ms
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-neutral-500 font-medium shrink-0">DB API 상태</span>
                  <span className="text-neutral-800 text-right">
                    {detail.dbMessage}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-neutral-500 font-medium shrink-0">Auth 상태</span>
                  <span className="text-neutral-800 text-right">
                    {detail.authMessage}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-200/80">
                  <span className="text-neutral-400">마지막 확인 시각</span>
                  <span className="text-neutral-500">{detail.checkedAt}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. 연결 실패(Error) 상태 */}
        {status === "error" && (
          <div className="py-4 flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-4xl font-bold mb-5">
              ✕
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-red-600 tracking-tight mb-2">
              Supabase 연결 실패
            </h1>
            <p className="text-sm text-neutral-600 font-medium mb-5">
              환경 변수(.env.local) 또는 네트워크 설정을 확인해 주세요.
            </p>

            {detail?.errorDetail && (
              <div className="w-full rounded-2xl bg-red-50 border border-red-200 p-4 text-left text-xs text-red-700 font-mono break-all mb-6">
                {detail.errorDetail}
              </div>
            )}
          </div>
        )}

        {/* 하단 액션 버튼 영역 */}
        <div className="flex flex-col sm:flex-row gap-2.5 w-full">
          <button
            type="button"
            onClick={checkConnection}
            disabled={status === "checking"}
            className="flex-1 py-3.5 px-4 rounded-xl bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-all"
          >
            다시 연결 테스트하기
          </button>
          <Link
            href="/"
            className="flex-1 py-3.5 px-4 rounded-xl border border-neutral-300 bg-white text-neutral-700 text-sm font-semibold hover:bg-neutral-50 transition-all flex items-center justify-center"
          >
            메인 화면(S01)으로 이동
          </Link>
        </div>
      </div>
    </main>
  );
}
