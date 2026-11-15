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
  referralCount: number;
}

export interface MyReferralRankRecord {
  nickname: string;
  referralCount: number;
  rank: number | null;
  isTied: boolean;
}

/**
 * 실시간 산타 초대 랭킹 조회 API (/api/referral/leaderboard)
 * - 서버/브라우저 캐시를 완전히 비활성화(force-dynamic, revalidate=0, fetch cache='no-store')하고,
 *   오직 현재 Supabase snowballs 테이블에 실제로 존재하는 활성 행(Row)만 실시간 조회하여 집계합니다.
 * - 탈퇴/삭제되어 snowballs 테이블에서 사라진 추천인이나 피추천인은 즉시 집계에서 제외됩니다.
 * - Dense Rank(밀집 순위) 기준: 초대 인원수(referralCount)가 같은 유저들은 모두 동일한 순위와 메달을 부여하며,
 *   동점자가 2명 이상인 경우 isTied = true('공동 N위')로 표기합니다.
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

    const [snowballsRes, verificationsRes] = await Promise.all([
      liveSupabase
        .from("snowballs")
        .select("id, nickname, slug, referrer_code, created_at"),
      liveSupabase
        .from("gemini_verifications")
        .select("id, snowball_id, nickname, referrer_slug, status, created_at")
        .order("created_at", { ascending: true }),
    ]);

    const snowballs = snowballsRes.data ?? [];
    const verifications = verificationsRes.data ?? [];

    // 현재 snowballs 테이블에 실제로 존재하는 계정만 유효한 유저로 인정
    const activeSnowballIds = new Set<string>();
    const activeNicknames = new Set<string>();
    const slugToActiveNickname = new Map<string, string>();
    const nicknameToActiveId = new Map<string, string>();
    const nicknameCreatedAt = new Map<string, number>();

    for (const sb of snowballs) {
      const id = (sb.id || "").trim();
      const nick = (sb.nickname || "").trim();
      const slug = (sb.slug || "").trim();
      if (!id || !nick) continue;

      activeSnowballIds.add(id);
      activeNicknames.add(nick);
      nicknameToActiveId.set(nick, id);
      if (slug) {
        slugToActiveNickname.set(slug, nick);
      }

      const createdMs = sb.created_at
        ? new Date(sb.created_at).getTime()
        : Number.MAX_SAFE_INTEGER;
      nicknameCreatedAt.set(nick, createdMs);
    }

    // 추천인 코드(slug 또는 닉네임)가 현재 snowballs에 실제 존재하는 계정인지 검증 후 닉네임 반환
    const resolveActiveReferrerNickname = (rawRef: string): string | null => {
      const clean = rawRef.trim();
      if (!clean) return null;
      const bySlug = slugToActiveNickname.get(clean);
      if (bySlug) return bySlug;
      if (activeNicknames.has(clean)) return clean;
      return null;
    };

    // 추천인 닉네임별 실제 존재하는 피추천 친구(snowball.id 기준) 고유키 Set 집계
    const statsMap = new Map<
      string,
      { referredSet: Set<string>; latestAchievedAt: number }
    >();

    const recordReferral = (
      referrerNick: string,
      friendSnowballId: string,
      createdAtStr?: string | null
    ) => {
      if (!activeNicknames.has(referrerNick)) return;
      if (!activeSnowballIds.has(friendSnowballId)) return;

      const referrerSnowballId = nicknameToActiveId.get(referrerNick);
      if (!referrerSnowballId || referrerSnowballId === friendSnowballId) return;

      let entry = statsMap.get(referrerNick);
      if (!entry) {
        entry = { referredSet: new Set<string>(), latestAchievedAt: 0 };
        statsMap.set(referrerNick, entry);
      }

      if (!entry.referredSet.has(friendSnowballId)) {
        entry.referredSet.add(friendSnowballId);
        const ts = createdAtStr ? new Date(createdAtStr).getTime() : Date.now();
        if (!Number.isNaN(ts) && ts > entry.latestAchievedAt) {
          entry.latestAchievedAt = ts;
        }
      }
    };

    // 1) gemini_verifications의 referrer_slug 기준 집계 (반려 제외 + 추천인/피추천인 모두 현재 snowballs에 실존할 때만 반영)
    for (const v of verifications) {
      if (v.status === "반려") continue;
      const resolvedRefNick = resolveActiveReferrerNickname(
        v.referrer_slug || ""
      );
      if (!resolvedRefNick) continue;

      const rawSbId = (v.snowball_id || "").trim();
      const rawFriendNick = (v.nickname || "").trim();
      const activeFriendId =
        rawSbId && activeSnowballIds.has(rawSbId)
          ? rawSbId
          : rawFriendNick
          ? nicknameToActiveId.get(rawFriendNick) ?? null
          : null;

      if (!activeFriendId) continue;
      recordReferral(resolvedRefNick, activeFriendId, v.created_at);
    }

    // 2) snowballs 테이블의 referrer_code에 기록된 초대 관계도 함께 반영 (추천인이 현재 snowballs에 실존할 때만 반영)
    for (const sb of snowballs) {
      const friendId = (sb.id || "").trim();
      if (!friendId || !activeSnowballIds.has(friendId)) continue;

      const resolvedRefNick = resolveActiveReferrerNickname(
        sb.referrer_code || ""
      );
      if (!resolvedRefNick) continue;

      recordReferral(resolvedRefNick, friendId, sb.created_at);
    }

    // 현재 snowballs에 실존하며 referralCount >= 1인 유저만 추출 후 초대 수 내림차순 정렬
    const sortedRaw = Array.from(statsMap.entries())
      .filter(([nickname]) => activeNicknames.has(nickname))
      .map(([nickname, info]) => ({
        nickname,
        referralCount: info.referredSet.size,
        latestAchievedAt: info.latestAchievedAt || Number.MAX_SAFE_INTEGER,
        userCreatedAt:
          nicknameCreatedAt.get(nickname) ?? Number.MAX_SAFE_INTEGER,
      }))
      .filter((item) => item.referralCount >= 1)
      .sort((a, b) => {
        if (b.referralCount !== a.referralCount) {
          return b.referralCount - a.referralCount;
        }
        if (a.latestAchievedAt !== b.latestAchievedAt) {
          return a.latestAchievedAt - b.latestAchievedAt;
        }
        return a.userCreatedAt - b.userCreatedAt;
      });

    // 초대 인원수(referralCount)별 동점자 수 집계 및 Dense Rank(1위, 2위, 3위...) 부여
    const countFrequency = new Map<number, number>();
    const countToDenseRank = new Map<number, number>();
    let currentDenseRank = 0;

    for (const item of sortedRaw) {
      countFrequency.set(
        item.referralCount,
        (countFrequency.get(item.referralCount) ?? 0) + 1
      );
      if (!countToDenseRank.has(item.referralCount)) {
        currentDenseRank += 1;
        countToDenseRank.set(item.referralCount, currentDenseRank);
      }
    }

    const rankedAll: ReferralLeaderItem[] = sortedRaw.map((item) => {
      const rank = countToDenseRank.get(item.referralCount) ?? 1;
      const isTied = (countFrequency.get(item.referralCount) ?? 1) >= 2;
      return {
        rank,
        isTied,
        nickname: item.nickname,
        referralCount: item.referralCount,
      };
    });

    // UI 길이 보호: 화면 리스트에는 최대 10줄(TOP 10 항목)까지만 반환
    const leaders: ReferralLeaderItem[] = rankedAll.slice(0, 10);

    // 내 기록도 현재 snowballs 테이블에 실존하는 닉네임인 경우에만 반환
    let myRecord: MyReferralRankRecord | null = null;
    if (myNicknameParam && activeNicknames.has(myNicknameParam)) {
      const found = rankedAll.find((r) => r.nickname === myNicknameParam);
      myRecord = {
        nickname: myNicknameParam,
        referralCount: found ? found.referralCount : 0,
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
