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
  logEventAsync,
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
    if (type === "link") {
      logEventAsync("share_click", mySnowball.slug);
    }
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
            className="w-full py-3.5 rounded-xl bg-[#2C2F63] hover:bg-[#222552] text-white text-sm font-extrabold"
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
            친구가 Gemini 가입하면 나도 응모권 50장!
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
              className="shrink-0 px-3 py-1 rounded-full bg-[#2C2F63] hover:bg-[#222552] text-white text-[10px] font-extrabold transition-colors"
            >
              {copiedType === "link" ? "✓ 완료" : "링크 복사"}
            </button>
          </div>
        </section>

        {/* 2. 사인업 레벨 진행바 카드 (Lv.0 -> Lv.1 -> Lv.3, 최대치 3명 기준 100%) */}
        <section className="w-full p-4 rounded-2xl bg-white/95 border border-[#2C2F63]/15 text-[#2C2F63] shadow-[0_6px_18px_rgba(44,47,99,0.12)] mb-3 text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-extrabold text-[#2C2F63]">
              사인업 {levelInfo.stageLabel}
            </span>
            <span className="text-[11px] font-bold text-[#2C2F63]/75">
              {levelInfo.nextTierTarget !== null
                ? `Lv.${levelInfo.nextTierTarget}까지 ${levelInfo.remainingToNext}명`
                : "최고 단계(Lv.3) 달성!"}
            </span>
          </div>

          <div className="w-full h-2.5 rounded-full bg-[#E8ECFA] overflow-hidden mb-2">
            <div
              className="h-full rounded-full bg-[#2C2F63] transition-all duration-500"
              style={{ width: `${levelInfo.progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-bold text-[#2C2F63]/65 mb-2">
            <span className={levelInfo.rawLevel >= 0 ? "text-[#2C2F63] font-extrabold" : ""}>
              Lv.0
            </span>
            <span className={levelInfo.rawLevel >= 1 ? "text-[#2C2F63] font-extrabold" : ""}>
              Lv.1
            </span>
            <span className={levelInfo.rawLevel >= 3 ? "text-[#2C2F63] font-extrabold" : ""}>
              Lv.3
            </span>
          </div>

          <p className="text-[10px] font-semibold text-[#2C2F63]/75">
            Gemini 가입 시 +1 · 추천 친구 Gemini 가입 시 +1
          </p>
        </section>

        {/* 3. 업그레이드 미리보기 카드 (Lv.0 민트 / Lv.1 핑크 / Lv.3 골드 - 캐시 방지 ?v=2 적용 및 선명한 프리뷰) */}
        <section className="w-full p-4 rounded-2xl bg-white/95 border border-[#2C2F63]/15 text-[#2C2F63] shadow-[0_6px_18px_rgba(44,47,99,0.12)] mb-3 text-left">
          <h2 className="text-xs font-extrabold text-[#2C2F63] mb-3">
            업그레이드 미리보기
          </h2>

          <div className="grid grid-cols-3 gap-2.5 text-center">
            {[
              {
                img: "/lv0_snowball.png?v=2",
                title: "Lv.0",
                sub: "민트",
                reached: levelInfo.rawLevel >= 0,
              },
              {
                img: "/lv1_snowball.png?v=2",
                title: "Lv.1",
                sub: "핑크",
                reached: levelInfo.rawLevel >= 1,
              },
              {
                img: "/lv3_snowball.png?v=2",
                title: "Lv.3",
                sub: "골드",
                reached: levelInfo.rawLevel >= 3,
              },
            ].map((item) => (
              <div key={item.title} className="flex flex-col items-center">
                <div
                  className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border flex items-center justify-center p-1.5 mb-1.5 ${
                    item.reached
                      ? "border-[#2C2F63] bg-[#E8ECFA] shadow-xs"
                      : "border-dashed border-[#2C2F63]/35 bg-[#F4F6FC]"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.img}
                    alt={`${item.title} ${item.sub} 스노우볼`}
                    className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
                  />
                </div>
                <span className="text-xs font-extrabold text-[#2C2F63] leading-tight break-keep">
                  {item.title}
                </span>
                <span className="text-[10px] font-bold text-[#2C2F63]/70 leading-tight mt-0.5">
                  {item.sub}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 4. 내 추천 친구 목록 (하단 눈밭 위에서도 선명하게 보이도록 화이트 카드 & #2C2F63 대비 적용) */}
        <section className="w-full p-4 rounded-2xl bg-white/95 border border-[#2C2F63]/15 text-[#2C2F63] shadow-[0_6px_18px_rgba(44,47,99,0.12)] text-left mb-5">
          <h2 className="text-xs font-extrabold text-[#2C2F63] mb-2.5">
            내 추천 친구 {referrals.length}명
          </h2>

          {referrals.length === 0 ? (
            <div className="w-full py-8 px-4 rounded-xl border border-dashed border-[#2C2F63]/25 bg-[#F8F9FE] text-center">
              <p className="text-xs font-extrabold text-[#2C2F63] mb-1">
                아직 없어요
              </p>
              <p className="text-[11px] font-semibold text-[#2C2F63]/70 break-keep">
                링크를 공유하고, 친구가 가입할 때 내 닉네임을 입력하게 해 주세요
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#2C2F63]/10 border-y border-[#2C2F63]/10">
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
                      <div className="w-7 h-7 rounded-full bg-[#E8ECFA] flex items-center justify-center text-xs shrink-0">
                        ⛄
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-extrabold text-[#2C2F63] break-keep">
                          {item.nickname}
                        </p>
                        <p className="text-[10px] font-semibold text-[#2C2F63]/65">
                          {dateLabel}
                        </p>
                      </div>
                    </div>

                    {isApproved ? (
                      <span className="shrink-0 px-3 py-1 rounded-full bg-[#2C2F63] text-white text-[10px] font-extrabold">
                        승인 +50 · LV+1
                      </span>
                    ) : (
                      <span className="shrink-0 px-3 py-1 rounded-full border border-[#2C2F63]/25 bg-[#F4F6FC] text-[#2C2F63] text-[10px] font-bold">
                        인증 심사 중
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 하단 [내 스노우볼 공유하기] 버튼 (#2C2F63 남색 통일) */}
        <button
          type="button"
          onClick={() => handleCopy("link")}
          className="w-full py-3.5 rounded-xl bg-[#2C2F63] hover:bg-[#222552] text-white text-sm font-extrabold shadow-lg transition-colors"
        >
          {copiedType === "link"
            ? "✓ 공유 링크가 복사되었어요!"
            : "내 스노우볼 공유하기"}
        </button>
      </div>
    </AppShell>
  );
}
