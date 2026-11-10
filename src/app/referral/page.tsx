"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import {
  GeminiVerification,
  Snowball,
  computeAndSyncSnowballLevel,
  getCurrentAuthAndSnowball,
  getMyReferralVerifications,
  getSnowballLevelInfo,
} from "@/lib/supabase";

/**
 * S07 추천 현황 (/referral)
 * - 내 닉네임 복사 + 공유 링크 복사
 * - 사인업 레벨 진행바: LV0 -> LV1(1명) -> LV3(3명) -> LV10(10명)
 * - 업그레이드 단계 미리보기: LV1(파랑) / LV3(빨강) / LV10(황금) 실제 스노우볼 이미지 표시
 * - 나를 추천인으로 입력한 친구 N명 목록 (승인 +50 · LV+1 / 인증 심사 중)
 */
export default function ReferralPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [mySnowball, setMySnowball] = useState<Snowball | null>(null);
  const [referrals, setReferrals] = useState<GeminiVerification[]>([]);
  const [shareUrl, setShareUrl] = useState<string>("");
  const [copiedType, setCopiedType] = useState<"nick" | "link" | null>(null);

  const loadReferrals = useCallback(async () => {
    setLoading(true);
    const auth = await getCurrentAuthAndSnowball();
    const sb = auth.snowball;

    if (sb) {
      const [syncedLevel, list] = await Promise.all([
        computeAndSyncSnowballLevel(sb),
        getMyReferralVerifications(sb.nickname),
      ]);
      const updatedSb: Snowball = { ...sb, level: syncedLevel };
      setMySnowball(updatedSb);
      setReferrals(list);

      if (typeof window !== "undefined") {
        setShareUrl(
          `${window.location.origin}/?sb=${encodeURIComponent(
            updatedSb.slug
          )}&utm_source=friend`
        );
      }
    } else {
      setMySnowball(null);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadReferrals();

    window.addEventListener("santa-auth-changed", loadReferrals);
    return () => {
      window.removeEventListener("santa-auth-changed", loadReferrals);
    };
  }, [loadReferrals]);

  const handleCopy = async (type: "nick" | "link") => {
    if (!mySnowball) return;
    const targetText = type === "nick" ? mySnowball.nickname : shareUrl;
    const shareTitle = `${mySnowball.nickname}님에게 편지를 보내주세요 | 차곡차곡 크리스마스`;
    try {
      await navigator.clipboard.writeText(targetText);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2200);
    } catch {
      if (type === "link" && typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({
            title: shareTitle,
            url: shareUrl,
          });
          return;
        } catch {
          // 사용자가 공유 시트를 닫은 경우 무시
        }
      }
      window.prompt("복사할 텍스트:", targetText);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex-1 flex items-center justify-center py-20 text-xs text-white/70">
          추천 현황을 불러오는 중...
        </div>
      </AppShell>
    );
  }

  if (!mySnowball) {
    return (
      <AppShell>
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-base font-extrabold text-white mb-4">
            로그인 후 추천 현황을 확인할 수 있어요!
          </p>
          <Link
            href="/login"
            className="w-full py-3.5 rounded-xl bg-[#3898FF] text-white text-sm font-extrabold"
          >
            로그인하고 내 스노우볼 만들기
          </Link>
        </div>
      </AppShell>
    );
  }

  const levelInfo = getSnowballLevelInfo(mySnowball.level);

  return (
    <AppShell>
      <div className="flex flex-col px-5 pt-6 pb-12 break-keep">
        {/* 상단 타이틀 */}
        <div className="text-center mb-5">
          <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1.5">
            추천 현황
          </h1>
          <p className="text-xs text-sky-100/90 leading-relaxed break-keep">
            친구가 Gemini 가입 인증에서 나를 추천인으로 입력하면 응모권 +50장!
          </p>
        </div>

        {/* 1. 내 닉네임 & 공유 링크 복사 카드 */}
        <section className="w-full p-4 rounded-2xl bg-[#F4F9FF] text-[#0B1528] shadow-md mb-3 text-left">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-extrabold text-[#102A4E] break-keep">
              내 닉네임 · {mySnowball.nickname}
            </span>
            <button
              type="button"
              onClick={() => handleCopy("nick")}
              className="shrink-0 px-3 py-1 rounded-full border border-[#BFD8F5] bg-white hover:bg-[#EBF4FF] text-[10px] font-extrabold text-[#102A4E] transition-colors"
            >
              {copiedType === "nick" ? "✓ 복사됨" : "닉네임 복사"}
            </button>
          </div>

          <div className="w-full px-3 py-2.5 rounded-xl bg-[#E6F1FC] flex items-center justify-between gap-2">
            <span className="text-[11px] text-[#5B7493] font-mono break-all leading-snug">
              {shareUrl}
            </span>
            <button
              type="button"
              onClick={() => handleCopy("link")}
              className="shrink-0 px-3 py-1 rounded-full bg-[#1E88E5] hover:bg-[#1565C0] text-white text-[10px] font-extrabold transition-colors"
            >
              {copiedType === "link" ? "✓ 완료" : "링크 복사"}
            </button>
          </div>
        </section>

        {/* 2. 사인업 레벨 진행바 카드 (LV0 -> LV1(1명) -> LV3(3명) -> LV10(10명)) */}
        <section className="w-full p-4 rounded-2xl bg-[#F4F9FF] text-[#0B1528] shadow-md mb-3 text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-extrabold text-[#0D2B52]">
              사인업 LV{levelInfo.rawLevel}
            </span>
            <span className="text-[11px] font-semibold text-[#5B7493]">
              {levelInfo.nextTierTarget !== null
                ? `LV${levelInfo.nextTierTarget}까지 ${levelInfo.remainingToNext}명`
                : "최고 단계(LV10) 달성!"}
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-[#DCEBFA] overflow-hidden mb-2">
            <div
              className="h-full rounded-full bg-[#1E88E5] transition-all duration-500"
              style={{ width: `${levelInfo.progressPercent}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] font-bold text-[#5B7493] mb-2">
            <span className={levelInfo.rawLevel >= 0 ? "text-[#1E88E5]" : ""}>
              LV0
            </span>
            <span className={levelInfo.rawLevel >= 1 ? "text-[#1E88E5]" : ""}>
              LV1 · 1명
            </span>
            <span className={levelInfo.rawLevel >= 3 ? "text-[#1E88E5]" : ""}>
              LV3 · 3명
            </span>
            <span className={levelInfo.rawLevel >= 10 ? "text-[#1E88E5]" : ""}>
              LV10 · 10명
            </span>
          </div>

          <p className="text-[10px] text-[#5B7493]">
            내 Gemini 가입 승인 +1 · 추천 친구 승인 1명당 +1
          </p>
        </section>

        {/* 3. 업그레이드 단계 미리보기 카드 (LV1 파랑 / LV3 빨강 / LV10 황금) */}
        <section className="w-full p-4 rounded-2xl bg-[#F4F9FF] text-[#0B1528] shadow-md mb-5 text-left">
          <h2 className="text-xs font-extrabold text-[#102A4E] mb-3">
            업그레이드 단계 미리보기
          </h2>

          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              {
                img: "/lv1_snowball.png",
                title: "LV1 · 사인업 1명",
                sub: "파란색 받침대",
                reached: levelInfo.rawLevel >= 1,
              },
              {
                img: "/lv3_Snowball.png",
                title: "LV3 · 사인업 3명",
                sub: "빨간색 받침대",
                reached: levelInfo.rawLevel >= 3,
              },
              {
                img: "/lv10_snowball.png",
                title: "LV10 · 사인업 10명",
                sub: "황금색 받침대",
                reached: levelInfo.rawLevel >= 10,
              },
            ].map((item) => (
              <div key={item.title} className="flex flex-col items-center">
                <div
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full border flex items-center justify-center p-1.5 mb-1.5 ${
                    item.reached
                      ? "border-[#1E88E5] bg-[#E6F1FC] shadow-xs"
                      : "border-dashed border-[#90B8E8] bg-[#EBF4FF]/70"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.img}
                    alt={item.title}
                    className="w-12 h-12 sm:w-14 sm:h-14 object-contain"
                  />
                </div>
                <span className="text-[10px] font-extrabold text-[#102A4E] leading-tight break-keep">
                  {item.title}
                </span>
                <span className="text-[9px] text-[#5B7493] mt-0.5 break-keep">
                  {item.sub}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 4. 나를 추천인으로 입력한 친구 목록 */}
        <section className="w-full text-left mb-5">
          <h2 className="text-xs font-extrabold text-white mb-2.5">
            나를 추천인으로 입력한 친구 {referrals.length}명
          </h2>

          {referrals.length === 0 ? (
            <div className="w-full py-10 px-4 rounded-2xl border border-dashed border-sky-200/40 bg-white/5 text-center">
              <p className="text-xs font-bold text-sky-100/80 mb-1">
                아직 없어요
              </p>
              <p className="text-[11px] text-sky-200/70 break-keep">
                링크를 공유하고, 친구가 가입할 때 내 닉네임을 입력하게 해 주세요
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/15 border-y border-white/15">
              {referrals.map((item) => {
                const isApproved = item.status === "승인";
                const dateLabel = item.created_at
                  ? `${new Date(item.created_at).getMonth() + 1}/${new Date(
                      item.created_at
                    ).getDate()} 가입`
                  : "최근 가입";

                return (
                  <div
                    key={item.id}
                    className="py-3 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-full bg-sky-200/30 flex items-center justify-center text-xs shrink-0">
                        ⛄
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-extrabold text-white break-keep">
                          {item.nickname}
                        </p>
                        <p className="text-[10px] text-sky-200/75">{dateLabel}</p>
                      </div>
                    </div>

                    {isApproved ? (
                      <span className="shrink-0 px-3 py-1 rounded-full bg-[#3898FF] text-white text-[10px] font-extrabold">
                        승인 +50 · LV+1
                      </span>
                    ) : (
                      <span className="shrink-0 px-3 py-1 rounded-full border border-sky-200/50 bg-white/10 text-sky-100 text-[10px] font-bold">
                        인증 심사 중
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 하단 [내 스노우볼 공유하기] 버튼 */}
        <button
          type="button"
          onClick={() => handleCopy("link")}
          className="w-full py-3.5 rounded-xl bg-white hover:bg-sky-50 text-[#102A4E] text-sm font-extrabold shadow-lg transition-colors"
        >
          {copiedType === "link"
            ? "✓ 공유 링크가 복사되었어요!"
            : "내 스노우볼 공유하기"}
        </button>
      </div>
    </AppShell>
  );
}
