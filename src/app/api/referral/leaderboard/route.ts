import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export interface ReferralLeaderItem {
  rank: number;
  nickname: string;
  referralCount: number;
}

export interface MyReferralRankRecord {
  nickname: string;
  referralCount: number;
  rank: number | null;
}

/**
 * 실시간 산타 초대 랭킹 조회 API (/api/referral/leaderboard)
 * - 별도 테이블 추가 없이 기존 DB(gemini_verifications의 추천인 관계 및 snowballs 가입 정보)를 집계합니다.
 * - 실제 초대 성공 인원수(referralCount >= 1) 내림차순 정렬 (동점일 경우 먼저 달성/가입한 순).
 * - 이메일 등 민감 정보는 절대 노출하지 않고 오직 순위(rank), 닉네임(nickname), 초대 인원수(referralCount) 및
 *   요청한 유저의 내 현재 순위/초대 수(myRecord)만 반환합니다.
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

    // 닉네임 및 슬러그 매핑 테이블 구성
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

    // 추천인 닉네임별 { 초대된 친구 고유키 Set, 마지막 달성 시각(ms) } 집계
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

    // 2) snowballs 테이블의 referrer_code에 기록된 초대 관계도 함께 반영 (누락 방지)
    for (const sb of snowballs) {
      const rawRefCode = (sb.referrer_code || "").trim();
      if (!rawRefCode) continue;
      const resolvedRefNick = slugToNickname.get(rawRefCode) || rawRefCode;
      const friendUniqueKey = (sb.id || sb.nickname || "").trim();
      recordReferral(resolvedRefNick, friendUniqueKey, sb.created_at);
    }

    // referralCount >= 1인 유저만 추출 후 정렬 (초대 수 내림차순 -> 먼저 달성한 순 -> 먼저 가입한 순)
    const rankedAll = Array.from(statsMap.entries())
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
      })
      .map((item, idx) => ({
        rank: idx + 1,
        nickname: item.nickname,
        referralCount: item.referralCount,
      }));

    // 상위 TOP 10 추출 (민감 정보 일절 제외)
    const leaders: ReferralLeaderItem[] = rankedAll.slice(0, 10);

    let myRecord: MyReferralRankRecord | null = null;
    if (myNicknameParam) {
      const found = rankedAll.find((r) => r.nickname === myNicknameParam);
      myRecord = {
        nickname: myNicknameParam,
        referralCount: found ? found.referralCount : 0,
        rank: found ? found.rank : null,
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
