import { createClient } from "@supabase/supabase-js";

// 환경 변수(Environment Variable)에서 Supabase 설정값 불러오기
const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * @supabase/supabase-js의 createClient는 기본 도메인 뒤에 '/rest/v1', '/auth/v1'을 자동 부착하므로
 * 환경 변수 끝에 '/rest/v1/'이 포함된 경우 중복 경로 오류(PGRST125)가 발생하지 않도록 정규화(Normalization)합니다.
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

// 애플리케이션 전역에서 사용할 Supabase 클라이언트(Client) 인스턴스
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/* ============================================================================
 * 1. 데이터베이스 테이블 타입(Database Table Types) 및 레벨/경품 상수 정의
 * ========================================================================== */

export type SnowballGeminiStatus =
  | "미제출"
  | "심사중"
  | "대기중"
  | "승인"
  | "반려"
  | string;
export type VerificationStatus = "대기중" | "승인" | "반려" | string;

/**
 * snowballs 테이블: 계정당 1개 생성되는 스노우볼 (nickname Unique 제약 적용됨)
 */
export interface Snowball {
  id: string;
  user_id: string | null;
  nickname: string;
  slug: string; // 공유코드 (?sb=slug)
  ticket_count: number; // 총 누적 획득 응모권 수 (최초 생성 시 1, 편지 수발신 +1, 제미나이 트리거 +100/+50)
  gemini_verified: boolean;
  referrer_code: string | null;
  terms_agreed: boolean;
  level: number; // 사인업 레벨 (최초 0 -> 본인 승인 +1, 추천 친구 승인당 +1)
  gemini_status: SnowballGeminiStatus; // '미제출' | '심사중' | '승인' | '반려'
  tracking_clicked_at: string | null;
  created_at?: string;
}

/**
 * letters 테이블: 친구가 남긴 편지(선물)
 * 실제 컬럼 구조: id, snowball_id, sender_name, content, ornament_type, is_read, created_at, sender_user_id
 */
export interface Letter {
  id: string;
  snowball_id: string;
  sender_user_id: string | null;
  sender_name: string;
  content: string;
  ornament_type: string;
  is_read: boolean;
  is_reported?: boolean;
  is_hidden?: boolean;
  created_at?: string;
}

/**
 * raffle_allocations 테이블: S06 상품별 응모권 배분 내역
 */
export interface RaffleAllocation {
  id: string;
  snowball_id: string;
  prize_id: string;
  allocated_tickets: number;
  created_at?: string;
}

/**
 * gemini_verifications 테이블: S08 제미나이 가입 인증 제출 내역
 * (status가 '승인'으로 변경되면 DB Trigger가 본인 +100장, referrer_slug(닉네임) 추천인에게 +50장 자동 지급)
 */
export interface GeminiVerification {
  id: string;
  snowball_id: string;
  nickname: string;
  gemini_email: string;
  referrer_slug: string | null; // 추천인 친구의 '닉네임' 저장 컬럼
  image_url_1: string | null;
  image_url_2: string | null;
  status: VerificationStatus; // '대기중' | '승인' | '반려'
  reject_reason: string | null;
  created_at?: string;
}

/**
 * 스노우볼 3단계 레벨 시스템 (Lv.0 민트 → Lv.1 핑크 → Lv.3 골드)
 * - Lv.0 (사인업 0명, 기본): 민트 스노우볼 (/lv0_snowball.png), 우편함 바탕 #C0EEE8, 편지지 카드 #F3D183
 * - Lv.1 (사인업 1~2명): 핑크 스노우볼 (/lv1_snowball.png), 우편함 바탕 #FBD0D8, 편지지 카드 #FDF9EB
 * - Lv.3 (사인업 3명 이상, 최대 단계): 골드 스노우볼 (/lv3_snowball.png), 우편함 바탕 #FAEBBF, 편지지 카드 #FFFBF9
 */
export interface SnowballLevelInfo {
  rawLevel: number;
  tier: 0 | 1 | 3;
  stageLabel: "Lv.0" | "Lv.1" | "Lv.3";
  tierLabel: string;
  shortBadge: string;
  baseColorName: string;
  mailboxBgHex: "#C0EEE8" | "#FBD0D8" | "#FAEBBF";
  letterCardBgHex: "#F3D183" | "#FDF9EB" | "#FFFBF9";
  imageSrc: string;
  nextTierTarget: number | null;
  remainingToNext: number;
  progressPercent: number;
}

export function getSnowballLevelInfo(
  levelInput?: number | null
): SnowballLevelInfo {
  const rawLevel = Math.max(0, Number(levelInput) || 0);
  // 최대치(100% 게이지)를 3명 기준으로 계산 (0명=0%, 1명=33%, 2명=67%, 3명 이상=100%)
  const progressPercent = Math.min(100, Math.round((rawLevel / 3) * 100));

  if (rawLevel >= 3) {
    return {
      rawLevel,
      tier: 3,
      stageLabel: "Lv.3",
      tierLabel: "최고 단계 · Lv.3",
      shortBadge: "Lv.3 · 골드 스노우볼",
      baseColorName: "골드 스노우볼",
      mailboxBgHex: "#FAEBBF",
      letterCardBgHex: "#FFFBF9",
      imageSrc: "/lv3_snowball.png",
      nextTierTarget: null,
      remainingToNext: 0,
      progressPercent: 100,
    };
  }

  if (rawLevel >= 1) {
    return {
      rawLevel,
      tier: 1,
      stageLabel: "Lv.1",
      tierLabel: "업그레이드 · Lv.1",
      shortBadge: "Lv.1 · 핑크 스노우볼",
      baseColorName: "핑크 스노우볼",
      mailboxBgHex: "#FBD0D8",
      letterCardBgHex: "#FDF9EB",
      imageSrc: "/lv1_snowball.png",
      nextTierTarget: 3,
      remainingToNext: 3 - rawLevel,
      progressPercent,
    };
  }

  return {
    rawLevel: 0,
    tier: 0,
    stageLabel: "Lv.0",
    tierLabel: "기본 · Lv.0",
    shortBadge: "Lv.0 · 민트 스노우볼",
    baseColorName: "민트 스노우볼",
    mailboxBgHex: "#C0EEE8",
    letterCardBgHex: "#F3D183",
    imageSrc: "/lv0_snowball.png",
    nextTierTarget: 1,
    remainingToNext: 1,
    progressPercent: 0,
  };
}

/**
 * S06 위시리스트 경품 목록 (1등 무신사 / 2등 신세계 / 3등 배민)
 */
export interface PrizeItem {
  id: string;
  rankBadge: string;
  shortTitle: string;
  name: string;
  winnersCount: string;
  emoji: string;
}

export const SAMPLE_PRIZES: PrizeItem[] = [
  {
    id: "musinsa_200k",
    rankBadge: "1등 · 1명",
    shortTitle: "1등 무신사",
    name: "무신사 20만 원 상품권",
    winnersCount: "1명",
    emoji: "🛍️",
  },
  {
    id: "shinsegae_100k",
    rankBadge: "2등 · 2명",
    shortTitle: "2등 신세계",
    name: "신세계 10만 원 상품권",
    winnersCount: "2명",
    emoji: "🏬",
  },
  {
    id: "baemin_30k",
    rankBadge: "3등 · 5명",
    shortTitle: "3등 배민",
    name: "배민 3만 원 상품권",
    winnersCount: "5명",
    emoji: "🛵",
  },
];

/**
 * 응모권 보유 및 사용 현황 요약 인터페이스
 */
export interface TicketSummary {
  totalTickets: number; // snowballs.ticket_count (총 누적 획득 응모권)
  allocatedTickets: number; // raffle_allocations 합계 (이미 배분 사용한 응모권)
  availableTickets: number; // 현재 사용 가능 잔여 응모권 (totalTickets - allocatedTickets)
  allocationsByPrize: Record<string, number>; // 내가 상품 ID별로 건 누적 수량
  totalAllocationsByPrize: Record<string, number>; // 상품 ID별 모든 유저가 건 전체 응모권의 총합(SUM)
}

/* ============================================================================
 * 2. 운영 일정(11.28 당첨자 공개 / 12.1 편지 공개) 및 브라우저 스토리지 헬퍼
 * ========================================================================== */

/**
 * 12월 1일 편지 공개일 오픈 여부 확인 함수 (한국 표준시 KST 기준: 2026-12-01T00:00:00+09:00)
 * 편지 공개일 이전에는 편지 원문 열람(/open 및 P04 원문)을 차단합니다.
 */
export function isLetterOpenDateReached(): boolean {
  const now = new Date();
  const openDate = new Date("2026-12-01T00:00:00+09:00");
  return now.getTime() >= openDate.getTime();
}

/**
 * 11월 28일 당첨자 공개일 오픈 여부 확인 함수 (한국 표준시 KST 기준: 2026-11-28T00:00:00+09:00)
 * 발표일 이전에는 당첨 발표(/result) 접근을 차단합니다.
 */
export function isResultOpenDateReached(): boolean {
  const now = new Date();
  const resultDate = new Date("2026-11-28T00:00:00+09:00");
  return now.getTime() >= resultDate.getTime();
}

/**
 * 기존 호환용 캠페인 편지 오픈일 확인 함수 (12월 1일 00:00 KST 기준)
 */
export function isCampaignOpenDateReached(): boolean {
  return isLetterOpenDateReached();
}

const PENDING_INVITE_STORAGE_KEY = "pending_friend_slug";
const LEGACY_INVITE_STORAGE_KEY = "santa_pending_invite_sb";
const INVITED_BY_NICKNAME_KEY = "santa_invited_by_nickname";
const GLOBAL_TOAST_KEY = "santa_global_toast_msg";

export function notifyAuthChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("santa-auth-changed"));
  }
}

/**
 * 페이지 이동 간 토스트 메시지 전달 (예: "존재하지 않는 스노우볼입니다.")
 */
export function setFlashToast(message: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(GLOBAL_TOAST_KEY, message);
  window.dispatchEvent(new Event("santa-toast"));
}

export function consumeFlashToast(): string | null {
  if (typeof window === "undefined") return null;
  const msg = window.sessionStorage.getItem(GLOBAL_TOAST_KEY);
  if (msg) {
    window.sessionStorage.removeItem(GLOBAL_TOAST_KEY);
  }
  return msg;
}

export function savePendingInviteSlug(slug: string): void {
  if (typeof window === "undefined") return;
  const trimmed = slug.trim();
  if (trimmed) {
    window.localStorage.setItem(PENDING_INVITE_STORAGE_KEY, trimmed);
    window.localStorage.setItem(LEGACY_INVITE_STORAGE_KEY, trimmed);
  }
}

export function getPendingInviteSlug(): string | null {
  if (typeof window === "undefined") return null;
  const val =
    window.localStorage.getItem(PENDING_INVITE_STORAGE_KEY) ||
    window.localStorage.getItem(LEGACY_INVITE_STORAGE_KEY);
  return val && val.trim() !== "" ? val.trim() : null;
}

export function clearPendingInviteSlug(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_INVITE_STORAGE_KEY);
}

/**
 * 친구 공유 링크(?sb=[slug])로 진입했을 때 초대한 친구의 닉네임을 저장하여
 * 추후 S08(제미나이 가입 인증) 추천인 입력란에 자동으로 채워줍니다.
 */
export function saveInvitedByNickname(nickname: string): void {
  if (typeof window === "undefined") return;
  const trimmed = nickname.trim();
  if (trimmed) {
    window.localStorage.setItem(INVITED_BY_NICKNAME_KEY, trimmed);
  }
}

export function getInvitedByNickname(): string | null {
  if (typeof window === "undefined") return null;
  const val = window.localStorage.getItem(INVITED_BY_NICKNAME_KEY);
  return val && val.trim() !== "" ? val.trim() : null;
}

export async function signOutAll(): Promise<void> {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("santa_mock_auth_session");
    window.localStorage.removeItem("santa_quick_user_slots_v1");
  }
  await supabase.auth.signOut();
  notifyAuthChanged();
}

/* ============================================================================
 * 3. F01: 실제 Supabase Google OAuth 로그인, 닉네임 중복 검사(2~8자), 스노우볼 생성
 * ========================================================================== */

export interface AuthSnowballState {
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  displayName: string | null;
  snowball: Snowball | null;
}

export async function getCurrentAuthAndSnowball(): Promise<AuthSnowballState> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user) {
    const user = session.user;
    const snowball = await getSnowballByUserId(user.id);
    const metaName =
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      null;

    return {
      isAuthenticated: true,
      userId: user.id,
      email: user.email ?? null,
      displayName: metaName,
      snowball,
    };
  }

  return {
    isAuthenticated: false,
    userId: null,
    email: null,
    displayName: null,
    snowball: null,
  };
}

export async function signInWithGoogle(inviteSlug?: string | null) {
  if (typeof window !== "undefined" && inviteSlug) {
    savePendingInviteSlug(inviteSlug);
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const query = inviteSlug ? `?sb=${encodeURIComponent(inviteSlug)}` : "";
  const redirectTo = `${origin}/auth/callback${query}`;

  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        prompt: "select_account",
      },
    },
  });
}

export async function generateUniqueSlug(): Promise<string> {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  for (let attempt = 0; attempt < 5; attempt++) {
    let candidate = "";
    for (let i = 0; i < 7; i++) {
      candidate += chars[Math.floor(Math.random() * chars.length)];
    }
    const existing = await getSnowballBySlug(candidate);
    if (!existing) {
      return candidate;
    }
  }
  return `sb${Date.now().toString(36)}`;
}

export async function getSnowballByUserId(
  userId: string
): Promise<Snowball | null> {
  const { data, error } = await supabase
    .from("snowballs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[Supabase] getSnowballByUserId 오류:", error.message);
    return null;
  }
  return (data as Snowball | null) ?? null;
}

export async function getSnowballById(id: string): Promise<Snowball | null> {
  const { data, error } = await supabase
    .from("snowballs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[Supabase] getSnowballById 오류:", error.message);
    return null;
  }
  return (data as Snowball | null) ?? null;
}

export async function getSnowballBySlug(
  slug: string
): Promise<Snowball | null> {
  const trimmed = slug.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from("snowballs")
    .select("*")
    .eq("slug", trimmed)
    .maybeSingle();

  if (error) {
    console.error("[Supabase] getSnowballBySlug 오류:", error.message);
    return null;
  }
  return (data as Snowball | null) ?? null;
}

export async function getSnowballByNickname(
  nickname: string
): Promise<Snowball | null> {
  const trimmed = nickname.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from("snowballs")
    .select("*")
    .eq("nickname", trimmed)
    .maybeSingle();

  if (error) {
    console.error("[Supabase] getSnowballByNickname 오류:", error.message);
    return null;
  }
  return (data as Snowball | null) ?? null;
}

/**
 * S02 닉네임 중복 확인 함수 (2~8자 제한 적용)
 */
export async function checkNicknameAvailable(
  nickname: string
): Promise<{ available: boolean; message: string }> {
  const trimmed = nickname.trim();
  if (trimmed.length < 2 || trimmed.length > 8) {
    return {
      available: false,
      message: "닉네임은 2~8자로 입력해 주세요.",
    };
  }
  const existing = await getSnowballByNickname(trimmed);
  if (existing) {
    return {
      available: false,
      message: "이미 사용 중인 닉네임이에요",
    };
  }
  return {
    available: true,
    message: "사용 가능한 닉네임이에요",
  };
}

export interface CreateSnowballInput {
  userId: string;
  nickname: string;
  termsAgreed: boolean;
}

/**
 * [S02] 내 스노우볼 생성 (2~8자 닉네임 중복 불가, ticket_count = 1, level = 0)
 */
export async function createSnowball(
  input: CreateSnowballInput
): Promise<Snowball> {
  const cleanNickname = input.nickname.trim();
  if (cleanNickname.length < 2 || cleanNickname.length > 8) {
    throw new Error("닉네임은 2~8자로 입력해 주세요.");
  }
  if (!input.termsAgreed) {
    throw new Error("필수 개인정보 수집·이용 동의 항목에 모두 체크해 주세요.");
  }
  if (!input.userId) {
    throw new Error("구글 로그인이 필요합니다.");
  }

  const existingByUser = await getSnowballByUserId(input.userId);
  if (existingByUser) {
    return existingByUser;
  }

  const dupCheck = await checkNicknameAvailable(cleanNickname);
  if (!dupCheck.available) {
    throw new Error(dupCheck.message);
  }

  const slug = await generateUniqueSlug();

  const { data, error } = await supabase
    .from("snowballs")
    .insert({
      user_id: input.userId,
      nickname: cleanNickname,
      slug,
      ticket_count: 1, // 최초 생성 시 기본 응모권 1장
      gemini_verified: false,
      referrer_code: null,
      terms_agreed: input.termsAgreed,
      level: 0, // 최초 가입 시 기본 level = 0 (회색 받침대)에서 시작!
      gemini_status: "미제출",
    })
    .select("*")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      throw new Error("이미 사용 중인 닉네임이에요");
    }
    throw new Error(error?.message || "스노우볼 생성 중 오류가 발생했습니다.");
  }

  const created = data as Snowball;
  notifyAuthChanged();
  return created;
}

/* ============================================================================
 * 4. 스노우볼 사인업 레벨 계산 및 동기화 (본인 승인 +1, 추천 친구 승인 1명당 +1)
 * ========================================================================== */

/**
 * 본인 Gemini 승인 여부(+1)와 나를 추천인으로 입력해 승인된 친구 수(+1 × N)를 합산해
 * 실제 사인업 레벨을 계산하고 DB의 level 값과 동기화합니다.
 */
export async function computeAndSyncSnowballLevel(
  snowball: Snowball
): Promise<number> {
  const selfBonus =
    snowball.gemini_verified || snowball.gemini_status === "승인" ? 1 : 0;

  const { count: approvedRefCount } = await supabase
    .from("gemini_verifications")
    .select("id", { count: "exact", head: true })
    .eq("referrer_slug", snowball.nickname)
    .eq("status", "승인");

  const calculatedLevel = selfBonus + (approvedRefCount ?? 0);

  if (calculatedLevel !== snowball.level) {
    await supabase
      .from("snowballs")
      .update({ level: calculatedLevel })
      .eq("id", snowball.id);
  }

  return calculatedLevel;
}

/* ============================================================================
 * 5. S05 / S04 / S10: 편지(메시지) 남기기(최소 15자 ~ 최대 200자), 쌍방 +1장 보상, 신고하기
 * ========================================================================== */

const REPORTED_LETTERS_KEY = "santa_reported_letter_ids";

function getReportedLetterIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(REPORTED_LETTERS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export async function getVisibleLettersBySnowballId(
  snowballId: string
): Promise<Letter[]> {
  const { data, error } = await supabase
    .from("letters")
    .select("*")
    .eq("snowball_id", snowballId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Supabase] getVisibleLettersBySnowballId 오류:", error.message);
    return [];
  }

  const localHidden = getReportedLetterIds();
  const rows = ((data as Letter[]) ?? []).filter(
    (item) => item.is_hidden !== true && !localHidden.has(item.id)
  );
  return rows;
}

export async function findMyExistingLetter(
  targetSnowballId: string,
  senderUserId: string | null,
  senderNickname: string
): Promise<Letter | null> {
  if (senderUserId) {
    const { data: byUid } = await supabase
      .from("letters")
      .select("*")
      .eq("snowball_id", targetSnowballId)
      .eq("sender_user_id", senderUserId)
      .limit(1)
      .maybeSingle();
    if (byUid) return byUid as Letter;
  }

  const cleanName = senderNickname.trim();
  if (cleanName) {
    const { data: byName } = await supabase
      .from("letters")
      .select("*")
      .eq("snowball_id", targetSnowballId)
      .eq("sender_name", cleanName)
      .limit(1)
      .maybeSingle();
    if (byName) return byName as Letter;
  }

  return null;
}

export async function getMyTotalSentLettersCount(
  senderUserId: string | null,
  senderNickname: string
): Promise<number> {
  if (senderUserId) {
    const { count } = await supabase
      .from("letters")
      .select("id", { count: "exact", head: true })
      .eq("sender_user_id", senderUserId);
    if (count && count > 0) return count;
  }

  const { count } = await supabase
    .from("letters")
    .select("id", { count: "exact", head: true })
    .eq("sender_name", senderNickname.trim());
  return count ?? 0;
}

export interface SendGiftLetterInput {
  targetSnowball: Snowball;
  senderSnowball: Snowball;
  senderUserId: string | null;
  content: string;
  ornamentType?: string;
}

export interface SendGiftLetterResult {
  letter: Letter;
  senderRewarded: boolean;
  totalSentCount: number;
}

/**
 * [S05] 친구 스노우볼에 편지 넣기 (최소 15자 ~ 최대 200자 제한, 친구당 1회 제한, 쌍방 +1장 보상)
 */
export async function sendGiftLetter(
  input: SendGiftLetterInput
): Promise<SendGiftLetterResult> {
  const {
    targetSnowball,
    senderSnowball,
    senderUserId,
    content,
    ornamentType = "gift",
  } = input;

  const effectiveSenderUserId =
    senderSnowball.user_id || senderUserId || senderSnowball.id;

  if (
    targetSnowball.id === senderSnowball.id ||
    (effectiveSenderUserId && targetSnowball.user_id === effectiveSenderUserId) ||
    targetSnowball.nickname === senderSnowball.nickname
  ) {
    throw new Error("내 스노우볼에는 편지를 넣을 수 없어요");
  }

  const trimmedContent = content.trim();
  if (trimmedContent.length < 15) {
    throw new Error("편지는 최소 15자 이상 작성해 주세요.");
  }
  if (trimmedContent.length > 200) {
    throw new Error("편지는 최대 200자까지 작성할 수 있어요.");
  }

  const existing = await findMyExistingLetter(
    targetSnowball.id,
    effectiveSenderUserId,
    senderSnowball.nickname
  );
  if (existing) {
    throw new Error("이미 편지를 보냈어요");
  }

  // 실제 letters 테이블 컬럼 구조에 100% 일치시켜 INSERT 수행
  const { data: insertedLetter, error: insertError } = await supabase
    .from("letters")
    .insert({
      snowball_id: targetSnowball.id,
      sender_name: senderSnowball.nickname,
      content: trimmedContent,
      ornament_type: ornamentType,
      is_read: false,
      sender_user_id: effectiveSenderUserId,
    })
    .select("*")
    .single();

  if (insertError || !insertedLetter) {
    if (insertError?.code === "23505") {
      throw new Error("이미 편지를 보냈어요");
    }
    throw new Error(insertError?.message || "편지 전송 중 오류가 발생했습니다.");
  }

  // 받은 사람(스노우볼 주인): 무조건 ticket_count + 1 DB 즉시 반영
  const freshReceiver = await getSnowballById(targetSnowball.id);
  if (freshReceiver) {
    await supabase
      .from("snowballs")
      .update({
        ticket_count: (Number(freshReceiver.ticket_count) || 0) + 1,
      })
      .eq("id", freshReceiver.id);
  }

  // 보낸 사람(작성자): 내가 보낸 총 편지 수가 10통 이하일 때만 ticket_count + 1 DB 즉시 반영
  const totalSentCount = await getMyTotalSentLettersCount(
    effectiveSenderUserId,
    senderSnowball.nickname
  );
  let senderRewarded = false;

  if (totalSentCount <= 10) {
    const freshSender = await getSnowballById(senderSnowball.id);
    if (freshSender) {
      await supabase
        .from("snowballs")
        .update({
          ticket_count: (Number(freshSender.ticket_count) || 0) + 1,
        })
        .eq("id", freshSender.id);
      senderRewarded = true;
    }
  }

  notifyAuthChanged();

  return {
    letter: insertedLetter as Letter,
    senderRewarded,
    totalSentCount,
  };
}

/**
 * [S10] 불건전 편지 신고하기
 */
export async function reportLetter(letterId: string): Promise<void> {
  if (typeof window !== "undefined") {
    const set = getReportedLetterIds();
    set.add(letterId);
    window.localStorage.setItem(
      REPORTED_LETTERS_KEY,
      JSON.stringify(Array.from(set))
    );
  }
  const { error } = await supabase
    .from("letters")
    .update({ is_reported: true, is_hidden: true })
    .eq("id", letterId);

  if (error) {
    await supabase.from("letters").delete().eq("id", letterId);
  }
}

/* ============================================================================
 * 6. S06: 상품별 응모권 배분 조회(경품별 전체 유저가 건 응모권 총합 SUM 집계) 및 응모 제출 (P03)
 * ========================================================================== */

export async function getTicketSummary(
  snowballId: string
): Promise<TicketSummary> {
  const [freshSnowball, { data: allRows }] = await Promise.all([
    getSnowballById(snowballId),
    supabase.from("raffle_allocations").select("*"),
  ]);

  const totalTickets = Number(freshSnowball?.ticket_count) || 0;
  const allocationsByPrize: Record<string, number> = {};
  const totalAllocationsByPrize: Record<string, number> = {};
  let allocatedTickets = 0;

  for (const prize of SAMPLE_PRIZES) {
    totalAllocationsByPrize[prize.id] = 0;
  }

  for (const row of (allRows as RaffleAllocation[]) ?? []) {
    const qty = Number(row.allocated_tickets) || 0;
    const pid = row.prize_id;
    const sid = row.snowball_id;

    totalAllocationsByPrize[pid] = (totalAllocationsByPrize[pid] || 0) + qty;

    if (sid === snowballId) {
      allocatedTickets += qty;
      allocationsByPrize[pid] = (allocationsByPrize[pid] || 0) + qty;
    }
  }

  const availableTickets = Math.max(0, totalTickets - allocatedTickets);

  return {
    totalTickets,
    allocatedTickets,
    availableTickets,
    allocationsByPrize,
    totalAllocationsByPrize,
  };
}

export async function submitRaffleAllocations(
  snowballId: string,
  addMap: Record<string, number>
): Promise<TicketSummary> {
  const entries = Object.entries(addMap).filter(([, count]) => count > 0);
  const totalToUse = entries.reduce((acc, [, count]) => acc + count, 0);

  if (totalToUse <= 0) {
    throw new Error("사용할 응모권 수량을 1장 이상 선택해 주세요.");
  }

  const currentSummary = await getTicketSummary(snowballId);
  if (totalToUse > currentSummary.availableTickets) {
    throw new Error(
      `남은 응모권(${currentSummary.availableTickets}장)을 초과하여 사용할 수 없어요.`
    );
  }

  for (const [prizeId, addQty] of entries) {
    const { data: existingRows } = await supabase
      .from("raffle_allocations")
      .select("*")
      .eq("snowball_id", snowballId)
      .eq("prize_id", prizeId)
      .order("created_at", { ascending: true })
      .limit(1);

    const existing = existingRows?.[0] as RaffleAllocation | undefined;

    if (existing) {
      const { error } = await supabase
        .from("raffle_allocations")
        .update({
          allocated_tickets:
            (Number(existing.allocated_tickets) || 0) + addQty,
        })
        .eq("id", existing.id);

      if (error) {
        throw new Error(error.message || "응모 저장 중 오류가 발생했습니다.");
      }
    } else {
      const { error } = await supabase
        .from("raffle_allocations")
        .insert({
          snowball_id: snowballId,
          prize_id: prizeId,
          allocated_tickets: addQty,
        });

      if (error) {
        throw new Error(error.message || "응모 저장 중 오류가 발생했습니다.");
      }
    }
  }

  notifyAuthChanged();
  return getTicketSummary(snowballId);
}

/* ============================================================================
 * 7. S07 & S08: 제미나이 가입 인증 (실제 파일 업로드 + Data URL 폴백) & 추천 현황 조회
 * ========================================================================== */

/**
 * [S08] Gemini 가입 바로가기 클릭 시 tracking_clicked_at 시각을 저장하고 갱신된 시각 반환
 */
export async function recordTrackingClick(snowballId: string): Promise<string> {
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("snowballs")
    .update({ tracking_clicked_at: nowIso })
    .eq("id", snowballId);

  if (error) {
    console.error("[Supabase] recordTrackingClick 오류:", error.message);
  }
  notifyAuthChanged();
  return nowIso;
}

/**
 * 이미지 파일(File)을 Supabase Storage의 'verifications' 공개 버킷에 업로드(`verifications/${Date.now()}_${random}.jpg`)하고,
 * `getPublicUrl`로 반환된 `https://...` 공개 URL을 반환합니다.
 * 버킷 업로드가 실패하는 경우에만 브라우저 Canvas로 압축한 Base64 Data URL(`data:image/jpeg;base64,...`) 폴백(Fallback)을 반환합니다.
 */
export async function uploadVerificationImage(
  file: File,
  _snowballId?: string
): Promise<string> {
  // 1) 'verifications' 공개 버킷으로 업로드 시도 (경로: verifications/${Date.now()}_${random}.jpg)
  try {
    const random = Math.random().toString(36).substring(2, 10);
    const storagePath = `verifications/${Date.now()}_${random}.jpg`;

    const { data: upData, error: upError } = await supabase.storage
      .from("verifications")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type || "image/jpeg",
      });

    if (!upError && upData?.path) {
      const { data: pubUrlData } = supabase.storage
        .from("verifications")
        .getPublicUrl(upData.path);

      if (pubUrlData?.publicUrl && pubUrlData.publicUrl.startsWith("http")) {
        return pubUrlData.publicUrl;
      }
    } else if (upError) {
      console.warn(
        "[Supabase Storage] verifications 버킷 업로드 실패, Base64 폴백으로 전환합니다:",
        upError.message
      );
    }
  } catch (storageErr) {
    console.warn(
      "[Supabase Storage] 업로드 예외 발생, Base64 폴백으로 전환합니다:",
      storageErr
    );
  }

  // 2) 버킷 업로드 실패 시 폴백(Fallback): Canvas 압축 후 Base64 Data URL 반환
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("이미지 파일을 읽는 중 오류가 발생했습니다."));
    reader.onload = () => {
      const resultStr = reader.result as string;
      const img = new Image();
      img.onerror = () => resolve(resultStr);
      img.onload = () => {
        try {
          const maxDim = 1280;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(resultStr);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.82);
          resolve(compressedDataUrl);
        } catch {
          resolve(resultStr);
        }
      };
      img.src = resultStr;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * [/admin] 관리자 검수 페이지용 전체 제미나이 인증 신청 내역 조회 (최신순)
 */
export async function getAllGeminiVerificationsForAdmin(): Promise<
  GeminiVerification[]
> {
  const { data, error } = await supabase
    .from("gemini_verifications")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      error.message || "인증 목록을 불러오는 중 오류가 발생했습니다."
    );
  }
  return (data as GeminiVerification[]) ?? [];
}

/**
 * [/admin] 관리자 검수 페이지에서 특정 인증 건을 '승인' 또는 '반려'로 즉시 변경
 * - DB의 `gemini_verifications.status` 컬럼을 `'승인'` 또는 `'반려'`로 업데이트합니다.
 * - 연결된 `snowballs.gemini_status` 및 `gemini_verified` 상태도 함께 동기화합니다.
 */
export async function updateGeminiVerificationStatusForAdmin(
  verification: GeminiVerification,
  nextStatus: "승인" | "반려",
  rejectReason?: string | null
): Promise<GeminiVerification> {
  const cleanReason =
    nextStatus === "반려"
      ? rejectReason?.trim() ||
        "주문 영수증 캡처에 계정 이메일 또는 주문 날짜가 확인되지 않아요."
      : null;

  const { data, error } = await supabase
    .from("gemini_verifications")
    .update({
      status: nextStatus,
      reject_reason: cleanReason,
    })
    .eq("id", verification.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message || `상태를 '${nextStatus}'(으)로 변경하지 못했습니다.`
    );
  }

  // 스노우볼의 gemini_status 표시 상태 동기화 (응모권 지급은 DB Trigger에서 자동 처리)
  if (verification.snowball_id) {
    await supabase
      .from("snowballs")
      .update({
        gemini_status: nextStatus,
        gemini_verified: nextStatus === "승인",
      })
      .eq("id", verification.snowball_id);
  }

  notifyAuthChanged();
  return data as GeminiVerification;
}

export async function getGeminiVerification(
  snowballId: string
): Promise<GeminiVerification | null> {
  const { data, error } = await supabase
    .from("gemini_verifications")
    .select("*")
    .eq("snowball_id", snowballId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[Supabase] getGeminiVerification 오류:", error.message);
    return null;
  }
  return (data as GeminiVerification | null) ?? null;
}

export interface SubmitGeminiVerificationInput {
  snowball: Snowball;
  geminiEmail: string;
  imageUrl1: string;
  imageUrl2?: string | null;
  referrerNickname?: string | null;
}

/**
 * [S08] 제미나이 가입 인증 제출
 * - tracking_clicked_at 기록 여부 확인
 * - Gemini 대학생 플랜 가입 주문 영수증 캡처 1장(image_url_1) 필수 확인
 * - 추천인 닉네임이 입력된 경우 본인 여부 및 DB 실존 닉네임 여부 검증
 * - gemini_verifications(status='대기중', referrer_slug=추천인닉네임) 저장 + snowballs.gemini_status='심사중' 변경
 */
export async function submitGeminiVerification(
  input: SubmitGeminiVerificationInput
): Promise<GeminiVerification> {
  const {
    snowball,
    geminiEmail,
    imageUrl1,
    imageUrl2,
    referrerNickname,
  } = input;

  if (!imageUrl1.trim()) {
    throw new Error(
      "Gemini 대학생 플랜 가입 주문 영수증 캡처 1장을 올려주세요."
    );
  }

  const cleanRefNick = referrerNickname?.trim() || null;
  if (cleanRefNick) {
    if (cleanRefNick === snowball.nickname) {
      throw new Error("본인은 추천인으로 입력할 수 없어요");
    }
    const referrerSnowball = await getSnowballByNickname(cleanRefNick);
    if (!referrerSnowball) {
      throw new Error("존재하지 않는 닉네임이에요. 다시 확인해 주세요.");
    }
  }

  const cleanEmail = geminiEmail.trim();
  if (!cleanEmail) {
    throw new Error("구글 로그인 계정 이메일 정보를 확인할 수 없어요.");
  }

  const { data, error } = await supabase
    .from("gemini_verifications")
    .insert({
      snowball_id: snowball.id,
      nickname: snowball.nickname,
      gemini_email: cleanEmail,
      referrer_slug: cleanRefNick,
      image_url_1: imageUrl1.trim(),
      image_url_2: imageUrl2?.trim() || null,
      status: "대기중",
      reject_reason: null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message || "제미나이 인증 제출 중 오류가 발생했습니다."
    );
  }

  await supabase
    .from("snowballs")
    .update({ gemini_status: "심사중" })
    .eq("id", snowball.id);

  notifyAuthChanged();
  return data as GeminiVerification;
}

export async function getMyReferralVerifications(
  myNickname: string
): Promise<GeminiVerification[]> {
  const trimmed = myNickname.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase
    .from("gemini_verifications")
    .select("*")
    .eq("referrer_slug", trimmed)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(
      "[Supabase] getMyReferralVerifications 오류:",
      error.message
    );
    return [];
  }
  return (data as GeminiVerification[]) ?? [];
}

/* ============================================================================
 * 8. 이벤트 로그 트래킹(event_logs) & 관리자(/admin) 통합 대시보드 집계
 * ========================================================================== */

export type EventLogType =
  | "page_view"
  | "gemini_link_click"
  | "gemini_link_copy"
  | "share_click";

export interface EventLogRow {
  id: string;
  event_type: EventLogType | string;
  user_slug: string | null;
  created_at?: string;
}

const PAGE_VIEW_SESSION_KEY = "santa_page_view_logged_v1";

/**
 * 화면 이동이나 클릭 액션을 방해하지 않도록 비동기(Fire-and-forget)로 event_logs 테이블에 기록합니다.
 */
export function logEventAsync(
  eventType: EventLogType,
  userSlug?: string | null
): void {
  void (async () => {
    try {
      await supabase.from("event_logs").insert({
        event_type: eventType,
        user_slug: userSlug?.trim() || null,
      });
    } catch (err) {
      console.warn("[EventLogs] 기록 중 예외(무시됨):", err);
    }
  })();
}

/**
 * 메인 사이트 최초 진입 시 세션당 1회만 'page_view' 이벤트를 기록합니다 (새로고침 중복 방지).
 */
export function logPageViewOncePerSession(userSlug?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const alreadyLogged = window.sessionStorage.getItem(PAGE_VIEW_SESSION_KEY);
    if (alreadyLogged === "true") return;
    window.sessionStorage.setItem(PAGE_VIEW_SESSION_KEY, "true");
    logEventAsync("page_view", userSlug);
  } catch {
    // sessionStorage 접근 제한 시에도 1회 기록 시도
    logEventAsync("page_view", userSlug);
  }
}

export interface AdminRaffleRankingEntry {
  rank: number;
  snowballId: string;
  prizeId: string;
  prizeName: string;
  prizeShortTitle: string;
  nickname: string;
  slug: string;
  email: string | null;
  allocatedTickets: number;
  totalTickets: number;
  createdAt: string | null;
}

export interface AdminPrizeStat {
  prizeId: string;
  rankBadge: string;
  shortTitle: string;
  name: string;
  emoji: string;
  totalTicketsSum: number;
  participantCount: number;
  maxTickets: number;
  rankings: AdminRaffleRankingEntry[];
}

export interface AdminDashboardData {
  // 방문 및 클릭 지표 (event_logs)
  pageViewCount: number;
  geminiLinkClickCount: number;
  geminiLinkCopyCount: number;
  geminiTotalClickCount: number;
  shareClickCount: number;
  // 참여 및 인증 지표
  totalSnowballsCount: number;
  totalLettersCount: number;
  waitingVerifCount: number;
  approvedVerifCount: number;
  rejectedVerifCount: number;
  referralInputCount: number;
  // 상세 목록 데이터
  verifications: GeminiVerification[];
  prizeStats: AdminPrizeStat[];
}

/**
 * [/admin] 관리자 대시보드에 필요한 전체 통계 및 목록을 병렬 조회하여 반환합니다.
 */
export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const [
    eventLogsRes,
    snowballsRes,
    lettersRes,
    verificationsRes,
    allocationsRes,
  ] = await Promise.all([
    supabase.from("event_logs").select("id, event_type, user_slug, created_at"),
    supabase
      .from("snowballs")
      .select("id, nickname, slug, ticket_count, gemini_verified, gemini_status, level, created_at"),
    supabase.from("letters").select("id", { count: "exact", head: true }),
    supabase
      .from("gemini_verifications")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("raffle_allocations")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  // 1) event_logs 집계
  let pageViewCount = 0;
  let geminiLinkClickCount = 0;
  let geminiLinkCopyCount = 0;
  let shareClickCount = 0;

  for (const row of (eventLogsRes.data as EventLogRow[]) ?? []) {
    if (row.event_type === "page_view") pageViewCount += 1;
    else if (row.event_type === "gemini_link_click") geminiLinkClickCount += 1;
    else if (row.event_type === "gemini_link_copy") geminiLinkCopyCount += 1;
    else if (row.event_type === "share_click") shareClickCount += 1;
  }

  const geminiTotalClickCount = geminiLinkClickCount + geminiLinkCopyCount;

  // 2) snowballs & letters 집계
  const snowballs = (snowballsRes.data as Snowball[]) ?? [];
  const totalSnowballsCount = snowballs.length;
  const totalLettersCount = lettersRes.count ?? 0;

  const snowballMap = new Map<string, Snowball>();
  for (const sb of snowballs) {
    snowballMap.set(sb.id, sb);
  }

  // 3) gemini_verifications 집계
  const verifications = (verificationsRes.data as GeminiVerification[]) ?? [];
  let waitingVerifCount = 0;
  let approvedVerifCount = 0;
  let rejectedVerifCount = 0;
  let referralInputCount = 0;

  const emailBySnowballId = new Map<string, string>();
  for (const v of verifications) {
    if (v.status === "승인") approvedVerifCount += 1;
    else if (v.status === "반려") rejectedVerifCount += 1;
    else waitingVerifCount += 1;

    if (v.referrer_slug && v.referrer_slug.trim() !== "") {
      referralInputCount += 1;
    }
    if (v.snowball_id && v.gemini_email && !emailBySnowballId.has(v.snowball_id)) {
      emailBySnowballId.set(v.snowball_id, v.gemini_email);
    }
  }

  // 4) raffle_allocations 상품별 통계 및 내림차순 랭킹 집계
  const allocations = (allocationsRes.data as RaffleAllocation[]) ?? [];

  // (prizeId -> (snowballId -> { tickets, createdAt }))
  const groupedByPrize = new Map<
    string,
    Map<string, { tickets: number; createdAt: string | null }>
  >();

  for (const prize of SAMPLE_PRIZES) {
    groupedByPrize.set(prize.id, new Map());
  }

  for (const row of allocations) {
    const qty = Number(row.allocated_tickets) || 0;
    if (qty <= 0) continue;

    let prizeMap = groupedByPrize.get(row.prize_id);
    if (!prizeMap) {
      prizeMap = new Map();
      groupedByPrize.set(row.prize_id, prizeMap);
    }

    const prev = prizeMap.get(row.snowball_id);
    if (prev) {
      prizeMap.set(row.snowball_id, {
        tickets: prev.tickets + qty,
        createdAt: prev.createdAt || row.created_at || null,
      });
    } else {
      prizeMap.set(row.snowball_id, {
        tickets: qty,
        createdAt: row.created_at || null,
      });
    }
  }

  const prizeStats: AdminPrizeStat[] = SAMPLE_PRIZES.map((prize) => {
    const userMap = groupedByPrize.get(prize.id) || new Map();
    const rawEntries: Omit<AdminRaffleRankingEntry, "rank">[] = [];
    let totalTicketsSum = 0;
    let maxTickets = 0;

    userMap.forEach((val, snowballId) => {
      totalTicketsSum += val.tickets;
      if (val.tickets > maxTickets) {
        maxTickets = val.tickets;
      }
      const sb = snowballMap.get(snowballId);
      rawEntries.push({
        snowballId,
        prizeId: prize.id,
        prizeName: prize.name,
        prizeShortTitle: prize.shortTitle,
        nickname: sb?.nickname || "알 수 없음",
        slug: sb?.slug || snowballId.slice(0, 8),
        email: emailBySnowballId.get(snowballId) || null,
        allocatedTickets: val.tickets,
        totalTickets: Number(sb?.ticket_count) || val.tickets,
        createdAt: val.createdAt,
      });
    });

    // 응모권을 많이 건 순서(내림차순) 정렬 (동률 시 보유 총 응모권 내림차순 -> 응모일시 오름차순)
    rawEntries.sort((a, b) => {
      if (b.allocatedTickets !== a.allocatedTickets) {
        return b.allocatedTickets - a.allocatedTickets;
      }
      if (b.totalTickets !== a.totalTickets) {
        return b.totalTickets - a.totalTickets;
      }
      return (a.createdAt || "").localeCompare(b.createdAt || "");
    });

    const rankings: AdminRaffleRankingEntry[] = rawEntries.map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
    }));

    return {
      prizeId: prize.id,
      rankBadge: prize.rankBadge,
      shortTitle: prize.shortTitle,
      name: prize.name,
      emoji: prize.emoji,
      totalTicketsSum,
      participantCount: rankings.length,
      maxTickets,
      rankings,
    };
  });

  return {
    pageViewCount,
    geminiLinkClickCount,
    geminiLinkCopyCount,
    geminiTotalClickCount,
    shareClickCount,
    totalSnowballsCount,
    totalLettersCount,
    waitingVerifCount,
    approvedVerifCount,
    rejectedVerifCount,
    referralInputCount,
    verifications,
    prizeStats,
  };
}
