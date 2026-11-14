import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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
 * - 별도 테이블 추가 없이 기존 DB(gemini_verifications의 추천인 관계 및 snowballs 가입 정보)를 집계합니다.
 * - Dense Rank(밀집 순위) 기준: 초대 인원수(referralCount)가 같은 유저들은 모두 동일한 순위(1위, 2위, 3위...)와 동일한 메달을 부여하며,
 *   동점자가 2명 이상인 경우 isTied = true('공동 N위')로 표기합니다.
 * - 화면 카드가 과도하게 길어지지 않도록 리스트(leaders)는 최대 10줄까지만 반환하되,
 *   내 기록(myRecord)은 전체 랭킹에서 조회하여 10줄 밖에 있더라도 실제 공동 순위가 정확히 반환됩니다.
 * - 이메일 등 민감 정보는 절대 노출하지 않습니다.
 */
export async function GET(req: NextRequest) {
  try {
    const myNicknameParam =
      req.nextUrl.searchParams.get("nickname")?.trim() || null;

    const [snowballsRes, verificationsRes] = await Promise.all([
      supabase
        .from("snowballs")
        .select("id, nickname, slug, referrer_code, created_at"),
      supabase
        .from("gemini_verifications")
        .select("id, snowball_id, nickname, referrer_slug, status, created_at")
        .order("created_at", { ascending: true }),
    ]);

    const snowballs = snowballsRes.data ?? [];
    const verifications = verificationsRes.data ?? [];

    const slugToNickname = new Map<string, string>();
    const nicknameCreatedAt = new Map<string, number>();

    for (const sb of snowballs) {
      const nick = (sb.nickname || "").trim();
      const slug = (sb.slug || "").trim();
      if (!nick) continue;
      if (slug) {
        slugToNickname.set(slug, nick);
      }
      const createdMs = sb.created_at
        ? new Date(sb.created_at).getTime()
        : Number.MAX_SAFE_INTEGER;
      nicknameCreatedAt.set(nick, createdMs);
    }

    // 추천인 닉네임별 초대된 친구 고유키 Set 집계
    const statsMap = new Map<
      string,
      { referredSet: Set<string>; latestAchievedAt: number }
    >();

    const recordReferral = (
      referrerNick: string,
      friendKey: string,
      createdAtStr?: string | null
    ) => {
      const cleanRef = referrerNick.trim();
      const cleanFriend = friendKey.trim();
      if (!cleanRef || !cleanFriend || cleanRef === cleanFriend) return;

      let entry = statsMap.get(cleanRef);
      if (!entry) {
        entry = { referredSet: new Set<string>(), latestAchievedAt: 0 };
        statsMap.set(cleanRef, entry);
      }

      if (!entry.referredSet.has(cleanFriend)) {
        entry.referredSet.add(cleanFriend);
        const ts = createdAtStr ? new Date(createdAtStr).getTime() : Date.now();
        if (!Number.isNaN(ts) && ts > entry.latestAchievedAt) {
          entry.latestAchievedAt = ts;
        }
      }
    };

    // 1) gemini_verifications의 referrer_slug(추천인 닉네임) 기준 집계 (반려 제외)
    for (const v of verifications) {
      if (v.status === "반려") continue;
      const rawRef = (v.referrer_slug || "").trim();
      if (!rawRef) continue;
      const resolvedRefNick = slugToNickname.get(rawRef) || rawRef;
      const friendUniqueKey = (v.snowball_id || v.nickname || v.id || "").trim();
      recordReferral(resolvedRefNick, friendUniqueKey, v.created_at);
    }

    // 2) snowballs 테이블의 referrer_code에 기록된 초대 관계도 함께 반영
    for (const sb of snowballs) {
      const rawRefCode = (sb.referrer_code || "").trim();
      if (!rawRefCode) continue;
      const resolvedRefNick = slugToNickname.get(rawRefCode) || rawRefCode;
      const friendUniqueKey = (sb.id || sb.nickname || "").trim();
      recordReferral(resolvedRefNick, friendUniqueKey, sb.created_at);
    }

    // referralCount >= 1인 유저만 추출 후 초대 수 내림차순 정렬
    const sortedRaw = Array.from(statsMap.entries())
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

    // 내 기록은 전체 rankedAll에서 찾아 10줄 밖에 있더라도 실제 내 공동 순위를 정확히 반환
    let myRecord: MyReferralRankRecord | null = null;
    if (myNicknameParam) {
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
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (err) {
    console.error("[Referral Leaderboard API] 오류:", err);
    return NextResponse.json(
      { leaders: [], myRecord: null },
      { status: 200 }
    );
  }
}
