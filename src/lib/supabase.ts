import { createClient } from "@supabase/supabase-js";

// 환경 변수(Environment Variable)에서 Supabase 설정값 불러오기
const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * @supabase/supabase-js의 createClient는 프로젝트 기본 도메인(Base URL) 뒤에
 * 자동으로 '/rest/v1', '/auth/v1' 경로를 붙입니다.
 * 따라서 환경 변수 URL 끝에 '/rest/v1/'이 포함되어 있을 경우 중복 경로('/rest/v1/rest/v1')
 * 오류(PGRST125)가 발생하지 않도록 기본 URL 형태로 정규화(Normalization)합니다.
 */
export const supabaseUrl = rawSupabaseUrl
  .trim()
  .replace(/\/rest\/v1\/?$/i, "")
  .replace(/\/+$/, "");

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[Supabase] NEXT_PUBLIC_SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY 환경 변수가 설정되지 않았습니다."
  );
}

// 애플리케이션 전역에서 사용할 Supabase 클라이언트(Client) 인스턴스 생성 및 내보내기
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
