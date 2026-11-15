import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export interface ReferralLeaderItem {
  rank: number;
  isTied: boolean;
  nickname: string;
  ticketCount: number;
}

export interface MyReferralRankRecord {
  nickname: string;
  ticketCount: number;
  rank: number | null;
  isTied: boolean;
}

function isApprovedVerificationStatus(status?: string | null): boolean {
  const clean = (status || "").trim();
  return clean === "승인" || clean.toLowerCase() === "approved";
}

function parseTimestampMs(raw?: string | null): number | null {
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * 실시간 누적 획득 응모권 랭킹 조회 API (/api/referral/leaderboard)
 * - 서버/브라우저 캐시를 완전히 비활성화(force-dynamic, revalidate=0, fetch cache='no-store')하고,
 *   오직 현재 Supabase snowballs 테이블에 실제로 존재하는 활성 행(Row)만 실시간 조회하여 집계합니다 (탈퇴 계정 완벽 제외).
 * - 산정 기준: 총 누적 획득 응모권 수 (현재 보유 잔여 응모권 + 이미 경품에 배분해 사용한 응모권 합계).
 *   경품에 응모권을 배분/사용하더라도 누적 획득 응모권 수치는 절대 줄어들지 않습니다.
 * - 어드민 승인 전(대기중/심사중/pending) 또는 반려(반려/rejected) 상태인 제미나이 인증 건은 응모권 수에 절대 포함되지 않습니다.
 * - 누적 획득 응모권이 1장 이상인 유저만 랭킹 대상에 포함합니다.
 * - 공동 순위 처리(Dense Rank: 1, 1, 1, 2, 2, 3...) 및 최대 10명(.slice(0, 10)) 엄격 제한을 적용합니다.
 */
export async function GET(req: NextRequest) {
  try {
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { leaders: [], myRecord: null },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // Next.js 서버 fetch 캐시가 절대 개입하지 않도록 매 요청마다 cache: 'no-store' 전용 클라이언트 생성
    const liveSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            cache: "no-store",
          }),
      },
    });

    const myNicknameParam =
      req.nextUrl.searchParams.get("nickname")?.trim() || null;

    const [snowballsRes, allocationsRes, verificationsRes, lettersRes] =
      await Promise.all([
        liveSupabase
          .from("snowballs")
          .select(
            "id, user_id, nickname, slug, ticket_count, gemini_verified, gemini_status, created_at"
          ),
        liveSupabase
          .from("raffle_allocations")
          .select("snowball_id, allocated_tickets, created_at"),
        liveSupabase
          .from("gemini_verifications")
          .select(
            "id, snowball_id, nickname, referrer_slug, status, created_at"
          )
          .order("created_at", { ascending: true }),
        liveSupabase
          .from("letters")
          .select(
            "id, snowball_id, sender_user_id, sender_name, is_hidden, created_at"
          )
          .order("created_at", { ascending: true }),
      ]);

    const snowballs = snowballsRes.data ?? [];
    const allocations = allocationsRes.data ?? [];
    const verifications = verificationsRes.data ?? [];
    const letters = lettersRes.data ?? [];

    // 1) 현재 snowballs 테이블에 실제로 존재하는 활성 계정만 등록 (탈퇴 계정 완벽 제외)
    interface ActiveUserMeta {
      id: string;
      userId: string | null;
      nickname: string;
      slug: string;
      dbTicketCount: number;
      createdAtMs: number;
    }

    const activeUsersById = new Map<string, ActiveUserMeta>();
    const activeIdByNickname = new Map<string, string>();
    const activeNicknameBySlug = new Map<string, string>();
    const activeIdByAuthUserId = new Map<string, string>();

    for (const sb of snowballs) {
      const id = (sb.id || "").trim();
      const nick = (sb.nickname || "").trim();
      const slug = (sb.slug || "").trim();
      const userId = sb.user_id ? String(sb.user_id).trim() : null;
      if (!id || !nick) continue;

      const createdAtMs =
        parseTimestampMs(sb.created_at) ?? Number.MAX_SAFE_INTEGER;

      activeUsersById.set(id, {
        id,
        userId,
        nickname: nick,
        slug,
        dbTicketCount: Math.max(0, Number(sb.ticket_count) || 0),
        createdAtMs,
      });

      activeIdByNickname.set(nick, id);
      if (slug) {
        activeNicknameBySlug.set(slug, nick);
      }
      if (userId) {
        activeIdByAuthUserId.set(userId, id);
      }
    }

    const resolveActiveReferrerId = (rawRef?: string | null): string | null => {
      const clean = (rawRef || "").trim();
      if (!clean) return null;
      const nickFromSlug = activeNicknameBySlug.get(clean);
      const targetNick = nickFromSlug || clean;
      return activeIdByNickname.get(targetNick) ?? null;
    };

    // 2) 경품 응모에 이미 배분해 사용한 응모권 합계 집계 (raffle_allocations)
    const allocatedBySnowballId = new Map<string, number>();
    for (const row of allocations) {
      const sid = (row.snowball_id || "").trim();
      if (!sid || !activeUsersById.has(sid)) continue;
      const qty = Math.max(0, Number(row.allocated_tickets) || 0);
      if (qty <= 0) continue;
      allocatedBySnowballId.set(
        sid,
        (allocatedBySnowballId.get(sid) ?? 0) + qty
      );
    }

    // 3) 편지 수·발신 집계 및 달성 시각 추적 (보낸 편지 보상은 최대 10통까지만 인정)
    const receivedLetterCountById = new Map<string, number>();
    const sentLetterCountById = new Map<string, number>();
    const latestAchievedAtById = new Map<string, number>();

    for (const [id, meta] of Array.from(activeUsersById.entries())) {
      latestAchievedAtById.set(id, meta.createdAtMs);
    }

    const recordAchievedAt = (snowballId: string, rawDate?: string | null) => {
      const ts = parseTimestampMs(rawDate);
      if (ts === null) return;
      const prev = latestAchievedAtById.get(snowballId);
      if (prev === undefined || prev === Number.MAX_SAFE_INTEGER || ts > prev) {
        latestAchievedAtById.set(snowballId, ts);
      }
    };

    for (const letter of letters) {
      const receiverId = (letter.snowball_id || "").trim();
      if (
        receiverId &&
        activeUsersById.has(receiverId) &&
        letter.is_hidden !== true
      ) {
        receivedLetterCountById.set(
          receiverId,
          (receivedLetterCountById.get(receiverId) ?? 0) + 1
        );
        recordAchievedAt(receiverId, letter.created_at);
      }

      const rawSenderUid = letter.sender_user_id
        ? String(letter.sender_user_id).trim()
        : "";
      const rawSenderName = (letter.sender_name || "").trim();
      const senderSnowballId =
        (rawSenderUid &&
          (activeIdByAuthUserId.get(rawSenderUid) ??
            (activeUsersById.has(rawSenderUid) ? rawSenderUid : null))) ||
        (rawSenderName ? activeIdByNickname.get(rawSenderName) ?? null : null);

      if (senderSnowballId && senderSnowballId !== receiverId) {
        const nextSent = (sentLetterCountById.get(senderSnowballId) ?? 0) + 1;
        sentLetterCountById.set(senderSnowballId, nextSent);
        if (nextSent <= 10) {
          recordAchievedAt(senderSnowballId, letter.created_at);
        }
      }
    }

    // 4) 제미나이 인증 검증: 오직 status === '승인' 건만 인정하고, 대기중(pending)/반려(rejected) 건은 철저히 배제
    const approvedSelfById = new Set<string>();
    const approvedRefFriendsById = new Map<string, Set<string>>();
    const unapprovedRefCountById = new Map<string, number>();

    for (const v of verifications) {
      const rawSbId = (v.snowball_id || "").trim();
      const rawNick = (v.nickname || "").trim();
      const ownerId =
        rawSbId && activeUsersById.has(rawSbId)
          ? rawSbId
          : rawNick
          ? activeIdByNickname.get(rawNick) ?? null
          : null;

      const isApproved = isApprovedVerificationStatus(v.status);

      if (ownerId && isApproved && !approvedSelfById.has(ownerId)) {
        approvedSelfById.add(ownerId);
        recordAchievedAt(ownerId, v.created_at);
      }

      const referrerId = resolveActiveReferrerId(v.referrer_slug);
      if (referrerId && referrerId !== ownerId) {
        // 추천 보상(+50장)은 피추천인이 현재 snowballs에 실존하고 어드민 '승인' 완료된 경우에만 인정
        if (isApproved && ownerId && activeUsersById.has(ownerId)) {
          let refSet = approvedRefFriendsById.get(referrerId);
          if (!refSet) {
            refSet = new Set<string>();
            approvedRefFriendsById.set(referrerId, refSet);
          }
          if (!refSet.has(ownerId)) {
            refSet.add(ownerId);
            recordAchievedAt(referrerId, v.created_at);
          }
        } else {
          unapprovedRefCountById.set(
            referrerId,
            (unapprovedRefCountById.get(referrerId) ?? 0) + 1
          );
        }
      }
    }

    // 5) 유저별 총 누적 획득 응모권 수 계산 및 정렬용 목록 생성
    interface RawRankEntry {
      nickname: string;
      ticketCount: number;
      latestAchievedAt: number;
      userCreatedAt: number;
    }

    const rawEntries: RawRankEntry[] = [];

    for (const [id, meta] of Array.from(activeUsersById.entries())) {
      const allocated = allocatedBySnowballId.get(id) ?? 0;
      // getTicketSummary와 동일하게 잔여 응모권 = max(0, dbTicketCount - allocated)이므로,
      // (현재 보유 잔여 응모권 + 이미 경품에 응모/배분해 사용한 응모권 합계) = max(dbTicketCount, allocated)
      const available = Math.max(0, meta.dbTicketCount - allocated);
      let cumulativeTickets = available + allocated;

      // 승인되지 않은(pending / rejected) 제미나이 인증 보너스가 섞여 있는지 엄격 검증하여 차감 보호
      const receivedCount = receivedLetterCountById.get(id) ?? 0;
      const sentRewardCount = Math.min(10, sentLetterCountById.get(id) ?? 0);
      const hasApprovedSelf = approvedSelfById.has(id);
      const approvedRefCount = approvedRefFriendsById.get(id)?.size ?? 0;

      const verifiedFormulaMax =
        1 +
        receivedCount +
        sentRewardCount +
        (hasApprovedSelf ? 100 : 0) +
        approvedRefCount * 50;

      if (
        !hasApprovedSelf &&
        cumulativeTickets - verifiedFormulaMax >= 90
      ) {
        cumulativeTickets = Math.max(0, cumulativeTickets - 100);
      }

      let remainingUnapprovedRefs = unapprovedRefCountById.get(id) ?? 0;
      while (
        remainingUnapprovedRefs > 0 &&
        cumulativeTickets - verifiedFormulaMax >= 45
      ) {
        cumulativeTickets = Math.max(0, cumulativeTickets - 50);
        remainingUnapprovedRefs -= 1;
      }

      if (cumulativeTickets >= 1) {
        rawEntries.push({
          nickname: meta.nickname,
          ticketCount: cumulativeTickets,
          latestAchievedAt:
            latestAchievedAtById.get(id) ?? meta.createdAtMs,
          userCreatedAt: meta.createdAtMs,
        });
      }
    }

    // 누적 획득 응모권 내림차순 -> 먼저 달성한 순(latestAchievedAt 오름차순) -> 생성일(created_at 오름차순) 정렬
    rawEntries.sort((a, b) => {
      if (b.ticketCount !== a.ticketCount) {
        return b.ticketCount - a.ticketCount;
      }
      if (a.latestAchievedAt !== b.latestAchievedAt) {
        return a.latestAchievedAt - b.latestAchievedAt;
      }
      if (a.userCreatedAt !== b.userCreatedAt) {
        return a.userCreatedAt - b.userCreatedAt;
      }
      return a.nickname.localeCompare(b.nickname, "ko");
    });

    // 6) Dense Rank(밀집 순위: 1, 1, 1, 1, 1, 2, 2, 3, 3, 3) 부여
    const countFrequency = new Map<number, number>();
    const countToDenseRank = new Map<number, number>();
    let currentDenseRank = 0;

    for (const item of rawEntries) {
      countFrequency.set(
        item.ticketCount,
        (countFrequency.get(item.ticketCount) ?? 0) + 1
      );
      if (!countToDenseRank.has(item.ticketCount)) {
        currentDenseRank += 1;
        countToDenseRank.set(item.ticketCount, currentDenseRank);
      }
    }

    const rankedAll: ReferralLeaderItem[] = rawEntries.map((item) => {
      const rank = countToDenseRank.get(item.ticketCount) ?? 1;
      const isTied = (countFrequency.get(item.ticketCount) ?? 1) >= 2;
      return {
        rank,
        isTied,
        nickname: item.nickname,
        ticketCount: item.ticketCount,
      };
    });

    // 공동 순위자가 아무리 많더라도 랭킹 보드에는 최대 10명(상위 10개 행)까지만 엄격 제한
    const leaders: ReferralLeaderItem[] = rankedAll.slice(0, 10);

    // 내 현재 기록 조회 (현재 snowballs 테이블에 실존하는 계정인 경우에만 반환)
    let myRecord: MyReferralRankRecord | null = null;
    if (myNicknameParam && activeIdByNickname.has(myNicknameParam)) {
      const found = rankedAll.find((r) => r.nickname === myNicknameParam);
      myRecord = {
        nickname: myNicknameParam,
        ticketCount: found ? found.ticketCount : 0,
        rank: found ? found.rank : null,
        isTied: found ? found.isTied : false,
      };
    }

    return NextResponse.json(
      { leaders, myRecord },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err) {
    console.error("[Referral Leaderboard API] 오류:", err);
    return NextResponse.json(
      { leaders: [], myRecord: null },
      { status: 200, headers: NO_CACHE_HEADERS }
    );
  }
}
