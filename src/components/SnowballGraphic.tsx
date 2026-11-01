"use client";

import React from "react";

// 스노우볼 그래픽 컴포넌트 Props 인터페이스(Interface)
interface SnowballGraphicProps {
  // 친구 초대 링크로 진입했는지 여부
  isFriendInvite: boolean;
  // 초대한 친구 이름 (기본값: '수룡이')
  friendName?: string;
}

/**
 * 중앙 스노우볼 그래픽(회색 플레이스홀더 처리) 컴포넌트
 * 일반 상태에서는 '기본' 요소를, 친구 초대 상태(?sb=id)에서는 '친구 버전' 요소를 표시합니다.
 */
export default function SnowballGraphic({
  isFriendInvite,
  friendName = "수룡이",
}: SnowballGraphicProps) {
  return (
    <div className="flex flex-col items-center w-full my-3">
      {/* 원형 스노우볼 돔 영역 */}
      <div className="relative w-64 h-64 rounded-full border border-neutral-400 bg-neutral-100 flex flex-col items-center justify-center shadow-inner">
        {/* 스노우볼 상단 캡슐 라벨 (예: 정원일 모션) - 일반 상태에서 표시 */}
        {!isFriendInvite && (
          <div className="absolute -top-3 px-3 py-0.5 rounded-full bg-neutral-900 text-white text-[10px] font-medium z-10">
            정원일 모션
          </div>
        )}

        {/* 안쪽 점선 가이드라인 */}
        <div className="w-[236px] h-[236px] rounded-full border border-dashed border-neutral-300 flex flex-col items-center justify-center relative">
          {/* 좌측 상단: 눈 입자 상태 표시 */}
          <span className="absolute top-12 left-7 text-[10px] text-neutral-500">
            {isFriendInvite ? "[눈 입자 친구]" : "[눈 입자 기본]"}
          </span>

          {/* 우측 상단: 트리 탑 상태 표시 */}
          <span className="absolute top-7 right-9 text-[10px] text-neutral-500">
            {isFriendInvite ? "[트리 탑 친구]" : "[트리 탑 기본]"}
          </span>

          {/* 중앙 크리스마스 트리 플레이스홀더 (별 + 삼각형 트리) */}
          <div className="flex flex-col items-center mt-2">
            {/* 꼭대기 별 아이콘 */}
            <div className="text-neutral-400 text-lg leading-none mb-0.5">★</div>
            {/* 삼각형 트리 모양 (CSS border 활용) */}
            <div
              className="w-0 h-0 border-l-[38px] border-l-transparent border-r-[38px] border-r-transparent border-b-[76px] border-b-neutral-300"
              aria-hidden="true"
            />
          </div>

          {/* 트리 하단 선물 상자들 플레이스홀더 */}
          <div className="flex items-end justify-center gap-1 -mt-2 z-10">
            <div className="w-4 h-3.5 bg-neutral-400 rounded-[2px] -rotate-6" />
            <div className="w-5 h-4 bg-neutral-500 rounded-[2px]" />
            <div className="w-4 h-5 bg-neutral-400 rounded-[2px] rotate-3" />
            <div className="w-5 h-3.5 bg-neutral-500 rounded-[2px] -rotate-3" />
          </div>

          {/* 우측 하단: 소품 상태 플레이스홀더 */}
          <div className="absolute bottom-11 right-5 flex flex-col items-center">
            <div
              className={`w-7 h-8 rounded-[3px] mb-1 ${
                isFriendInvite
                  ? "bg-neutral-400"
                  : "border border-dashed border-neutral-300 bg-neutral-50/60"
              }`}
            />
            <span className="text-[10px] text-neutral-500">
              {isFriendInvite ? "[소품 친구]" : "[소품 기본]"}
            </span>
          </div>
        </div>
      </div>

      {/* 스노우볼 하단 받침대 (닉네임 표시 영역) */}
      <div className="w-44 h-9 -mt-1.5 rounded-md border border-neutral-300 bg-neutral-200/90 flex items-center justify-center z-10">
        <span className="text-xs text-neutral-700 font-medium">닉네임</span>
      </div>

      {/* 친구 초대 분기 시 하단 미리보기 캡션 노출 */}
      {isFriendInvite && (
        <p className="mt-2.5 text-[11px] text-neutral-500 font-medium">
          ↑ {friendName}님의 스노우볼 미리보기 (업그레이드 단계 그대로)
        </p>
      )}
    </div>
  );
}
