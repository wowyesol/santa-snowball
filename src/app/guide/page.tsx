"use client";

import React, { useState } from "react";
import AppShell from "@/components/AppShell";

interface FaqItem {
  q: string;
  a: string;
}

// 클릭 시 펼쳐지는 아코디언(Accordion) FAQ 4개 항목 정의
const FAQ_LIST: FaqItem[] = [
  {
    q: "Q. 이미 Gemini 계정이 있으면 참여할 수 없나요?",
    a: "네, 스노우볼 만들고 친구와 편지를 주고받으며 응모권을 모으는 것은 누구나 참여 가능합니다! 다만 'Gemini 신규 가입 인증(+100장)'과 '추천인 보상(+50장 · LV+1)'은 이번 캠페인 기간(11/9~11/27) 내 전용 링크를 통해 생애 최초로 가입한 신규 계정만 인정됩니다.",
  },
  {
    q: "Q. 편지는 언제 열리나요?",
    a: "편지 공개일 전까지는 누가 보냈는지만 확인하고 편지 내용은 비밀로 보관됩니다. 12월 1일 편지 공개일에 우편함을 열어보면 친구들이 보낸 편지 전문(최대 200자)을 모두 열어볼 수 있어요!",
  },
  {
    q: "Q. 응모권을 여러 상품에 나눠 걸 수 있나요?",
    a: "네! 보유한 응모권 내에서 1등 무신사, 2등 신세계, 3등 배민 상품에 원하는 만큼 자유롭게 배분해서 걸 수 있습니다. 또한 응모권을 1장 이상 보유한 모든 참여자는 투썸플레이스 1만 원권(15명) 추첨에 자동 응모됩니다.",
  },
  {
    q: "Q. 1 · 2등 당첨 시 세금이 있나요?",
    a: "5만 원을 초과하는 경품(1등 무신사 20만 원, 2등 신세계 10만 원)은 소득세법에 따라 제세공과금(22%) 신고 대상입니다. 당첨 발표 후 입력하신 이메일을 통해 관련 서류 안내를 개별 발송해 드립니다.",
  },
];

/**
 * [S12] 이벤트 안내 / 유의사항 페이지 컴포넌트(Component)
 * - 비로그인 상태에서도 언제든 열람 가능
 * - 참여 방법, 응모권 규칙, 당첨 방식, 사인업 레벨 업그레이드(LV 0 -> 1 -> 3 -> 10),
 *   경품 안내 표, 일정, 클릭형 아코디언 FAQ 4개, 개인정보 처리방침 포함
 */
export default function GuidePage() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = (idx: number) => {
    setOpenFaqIndex((prev) => (prev === idx ? null : idx));
  };

  return (
    <AppShell>
      <div className="flex flex-col px-4 pt-5 pb-12 text-white">
        {/* 상단 타이틀 */}
        <h1 className="text-xl font-extrabold tracking-tight text-white">
          이벤트 안내 · 유의사항
        </h1>
        <p className="mt-1 text-xs font-medium text-blue-100/80">
          차곡차곡 크리스마스 : 산타보다 빠른 우체국
        </p>

        {/* 1. 참여 방법 */}
        <section className="mt-6">
          <h2 className="mb-2 inline-block px-3 py-1 rounded-full bg-[#2C2F63] text-xs font-extrabold text-white shadow-xs">
            참여 방법
          </h2>
          <div className="rounded-2xl border border-[#2C2F63]/15 bg-white/95 p-4 text-xs leading-relaxed text-slate-800 shadow-md">
            <ol className="space-y-1.5 font-medium">
              <li>
                <strong className="font-extrabold text-slate-900">1.</strong>{" "}
                구글 계정으로 로그인하고 내 스노우볼을 만들어요.
              </li>
              <li>
                <strong className="font-extrabold text-slate-900">2.</strong>{" "}
                내 스노우볼 링크를 친구에게 공유하고, 친구 스노우볼에도 편지를 넣어요.
              </li>
              <li>
                <strong className="font-extrabold text-slate-900">3.</strong>{" "}
                응모권을 모아 원하는 상품에 걸어요.
              </li>
              <li>
                <strong className="font-extrabold text-slate-900">4.</strong>{" "}
                11/28에 당첨 결과를 확인하고, 12/1에 받은 편지를 열어봐요.
              </li>
            </ol>
          </div>
        </section>

        {/* 2. 응모권 규칙 */}
        <section className="mt-5">
          <h2 className="mb-2 inline-block px-3 py-1 rounded-full bg-[#2C2F63] text-xs font-extrabold text-white shadow-xs">
            응모권 규칙
          </h2>
          <div className="rounded-2xl border border-[#2C2F63]/15 bg-white/95 p-4 text-xs text-slate-800 shadow-md break-keep">
            <div className="divide-y divide-slate-100">
              <div className="flex items-center justify-between gap-3 py-2">
                <span className="font-medium text-slate-600">최초 가입 보너스</span>
                <span className="shrink-0 font-extrabold text-slate-900">+1장</span>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <span className="font-medium text-slate-600">
                  친구 스노우볼에 편지 넣기
                </span>
                <span className="shrink-0 font-extrabold text-slate-900">
                  +1장 (최대 10명)
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <span className="font-medium text-slate-600">
                  내 스노우볼에 편지 받기
                </span>
                <span className="shrink-0 font-extrabold text-slate-900">
                  +1장 (무제한)
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <span className="font-bold text-[#2C2F63] leading-snug">
                  Gemini 대학생 플랜 가입 주문 영수증 캡처 1장 승인
                </span>
                <span className="shrink-0 font-extrabold text-[#2C2F63] text-right">
                  +100장 · LV+1
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <span className="font-bold text-indigo-700 leading-snug">
                  내가 초대한 친구의 Gemini 가입 승인
                </span>
                <span className="shrink-0 font-extrabold text-indigo-700 text-right">
                  +50장 · LV+1 (무제한)
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 3. 당첨 방식 */}
        <section className="mt-5">
          <h2 className="mb-2 inline-block px-3 py-1 rounded-full bg-[#2C2F63] text-xs font-extrabold text-white shadow-xs">
            당첨 방식
          </h2>
          <div className="rounded-2xl border border-[#2C2F63]/15 bg-white/95 p-4 text-xs leading-relaxed text-slate-700 shadow-md break-keep">
            <ul className="list-disc space-y-1.5 pl-4 font-medium">
              <li>
                <strong className="font-extrabold text-slate-900">
                  1 · 2 · 3등 상품:
                </strong>{" "}
                원하는 상품에 응모권을 직접 걸어 응모해요. 많이 걸수록 유리!
              </li>
              <li>
                <strong className="font-extrabold text-slate-900">
                  투썸 1만 원권 (15명):
                </strong>{" "}
                응모권 1장 이상 보유자 전원 자동 추첨 응모돼요.
              </li>
            </ul>
          </div>
        </section>

        {/* 4. 사인업 레벨 · 스노우볼 업그레이드 */}
        <section className="mt-5">
          <h2 className="mb-2 inline-block px-3 py-1 rounded-full bg-[#2C2F63] text-xs font-extrabold text-white shadow-xs">
            사인업 레벨 · 스노우볼 업그레이드
          </h2>
          <div className="rounded-2xl border border-[#2C2F63]/15 bg-white/95 p-4 text-xs text-slate-800 shadow-md break-keep">
            <p className="leading-relaxed font-medium text-slate-600">
              내 Gemini 가입 인증(+1)과 내가 추천한 친구의 가입 인증(+1/명)이 쌓일 때마다 사인업 레벨이 올라가고 스노우볼 디자인이 업그레이드돼요.
            </p>

            {/* 3단계 스노우볼 이미지 미리보기 */}
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                { lv: "Lv.1", name: "기본 스노우볼", img: "/lv0_snowball.png" },
                { lv: "Lv.3", name: "리본 스노우볼", img: "/lv1_snowball.png" },
                { lv: "Lv.10", name: "황금 스노우볼", img: "/lv3_snowball.png" },
              ].map((item) => (
                <div
                  key={item.lv}
                  className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50 px-1 py-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.img}
                    alt={item.name}
                    className="h-12 w-12 object-contain"
                  />
                  <span className="mt-1 text-[10px] font-extrabold text-[#2C2F63]">
                    {item.lv}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 주의사항 강조 박스 2개 */}
          <div className="mt-2.5 space-y-2">
            <div className="rounded-xl border border-[#2C2F63]/20 bg-white p-3.5 text-slate-900 shadow-xs">
              <p className="text-xs font-extrabold text-[#2C2F63]">
                ! 기존 Gemini 이용자 참여 불가
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                Gemini 가입 인증(+100장)과 친구 추천 보상(+50장)은 이 캠페인으로 처음 Gemini에 가입한 신규 계정만 대상이에요. 이미 가입된 계정은 승인되지 않아요.
              </p>
            </div>

            <div className="rounded-xl border border-[#2C2F63]/20 bg-white p-3.5 text-slate-900 shadow-xs">
              <p className="text-xs font-extrabold text-[#2C2F63]">
                ! 허위 · 부정 인증 시 응모권 회수 및 당첨 취소
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                타인 캡처 도용 · 합성 · 중복 계정 등 부정한 방법이 확인되면 지급된 응모권(+100/+50장)과 사인업 레벨이 모두 회수되며, 당첨 이후라도 당첨이 취소될 수 있어요.
              </p>
            </div>
          </div>
        </section>

        {/* 5. 경품 안내 (총 23명 · 70만 원) */}
        <section className="mt-5">
          <h2 className="mb-2 inline-block px-3 py-1 rounded-full bg-[#2C2F63] text-xs font-extrabold text-white shadow-xs">
            경품 (총 23명 · 70만 원)
          </h2>
          <div className="rounded-2xl border border-[#2C2F63]/15 bg-white/95 p-4 text-xs text-slate-800 shadow-md">
            <div className="divide-y divide-slate-100">
              <div className="flex items-center justify-between py-2">
                <span className="font-semibold text-slate-700">
                  1등 무신사 상품권 20만 원
                </span>
                <span className="font-extrabold text-slate-900">1명</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="font-semibold text-slate-700">
                  2등 신세계 상품권 10만 원
                </span>
                <span className="font-extrabold text-slate-900">2명</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="font-semibold text-slate-700">
                  3등 배민 상품권 3만 원
                </span>
                <span className="font-extrabold text-slate-900">5명</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="font-semibold text-slate-700">
                  추첨 투썸플레이스 1만 원권
                </span>
                <span className="font-extrabold text-slate-900">15명</span>
              </div>
            </div>
          </div>
        </section>

        {/* 6. 일정 안내 */}
        <section className="mt-5">
          <h2 className="mb-2 inline-block px-3 py-1 rounded-full bg-[#2C2F63] text-xs font-extrabold text-white shadow-xs">
            일정
          </h2>
          <div className="rounded-2xl border border-[#2C2F63]/15 bg-white/95 p-4 text-xs text-slate-800 shadow-md">
            <div className="divide-y divide-slate-100">
              <div className="flex items-center justify-between py-2">
                <span className="font-semibold text-slate-600">참여 기간</span>
                <span className="font-extrabold text-slate-900">11/9 ~ 11/27</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="font-semibold text-slate-600">당첨자 공개</span>
                <span className="font-extrabold text-[#2C2F63]">11/28</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="font-semibold text-slate-600">편지 공개</span>
                <span className="font-extrabold text-[#2C2F63]">12/1</span>
              </div>
            </div>
          </div>
        </section>

        {/* 7. 자주 묻는 질문 (클릭형 아코디언 4개) */}
        <section className="mt-5">
          <h2 className="mb-2 inline-block px-3 py-1 rounded-full bg-[#2C2F63] text-xs font-extrabold text-white shadow-xs">
            자주 묻는 질문
          </h2>
          <div className="space-y-2">
            {FAQ_LIST.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={item.q}
                  className="overflow-hidden rounded-xl border border-[#2C2F63]/15 bg-white/95 text-slate-900 shadow-md transition"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    className="flex w-full items-center justify-between px-4 py-3.5 text-left text-xs font-extrabold text-[#2C2F63] hover:bg-slate-50"
                  >
                    <span>{item.q}</span>
                    <span className="ml-2 text-slate-400">
                      {isOpen ? "▴" : "▾"}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3 text-[11px] leading-relaxed font-medium text-slate-600">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 8. 개인정보 처리 안내 (#privacy 앵커 지원) */}
        <section id="privacy" className="mt-5 scroll-mt-20">
          <h2 className="mb-2 inline-block px-3 py-1 rounded-full bg-[#2C2F63] text-xs font-extrabold text-white shadow-xs">
            개인정보 처리 안내
          </h2>
          <div className="rounded-2xl border border-[#2C2F63]/15 bg-white/95 p-4 text-[11px] leading-relaxed font-medium text-slate-600 shadow-md">
            수집 항목: 구글 계정 이메일, 닉네임, 이벤트 참여 기록, (선택) Gemini 대학생 플랜 가입 주문 영수증 캡처 1장, (당첨자) 이름 · 연락처 · 이메일. 수집 목적: 이벤트 운영 및 경품 발송. 보유 기간: 이벤트 종료 및 경품 발송 완료 후 30일 이내 파기.
          </div>
        </section>
      </div>
    </AppShell>
  );
}
