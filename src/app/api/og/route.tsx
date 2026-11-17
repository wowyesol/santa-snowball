import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { getSnowballBySlug } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 밤하늘 배경에 내리는 불투명 순백색(#FFFFFF) 눈송이 좌표 (1200x630 기준)
const SKY_SNOWFLAKES = [
  { left: 75, top: 55, w: 9, h: 7, radius: "58% 42% 63% 37%" },
  { left: 155, top: 135, w: 5, h: 5, radius: "50%" },
  { left: 235, top: 75, w: 11, h: 9, radius: "44% 56% 39% 61%" },
  { left: 110, top: 225, w: 7, h: 6, radius: "64% 36% 52% 48%" },
  { left: 265, top: 195, w: 6, h: 5, radius: "49% 51% 62% 38%" },
  { left: 335, top: 95, w: 8, h: 7, radius: "37% 63% 55% 45%" },
  { left: 185, top: 310, w: 9, h: 8, radius: "61% 39% 44% 56%" },
  { left: 305, top: 295, w: 6, h: 5, radius: "58% 42% 63% 37%" },
  { left: 85, top: 355, w: 5, h: 5, radius: "50%" },
  { left: 865, top: 70, w: 9, h: 7, radius: "58% 42% 63% 37%" },
  { left: 945, top: 145, w: 6, h: 5, radius: "44% 56% 39% 61%" },
  { left: 1035, top: 85, w: 10, h: 8, radius: "64% 36% 52% 48%" },
  { left: 1120, top: 165, w: 7, h: 6, radius: "49% 51% 62% 38%" },
  { left: 895, top: 235, w: 8, h: 7, radius: "37% 63% 55% 45%" },
  { left: 1010, top: 265, w: 11, h: 9, radius: "61% 39% 44% 56%" },
  { left: 1105, top: 315, w: 6, h: 5, radius: "58% 42% 63% 37%" },
  { left: 935, top: 345, w: 5, h: 5, radius: "50%" },
];

// 스노우볼 원형 유리구 안쪽에 소복하게 흩날리는 크고 작은 불투명 순백색(#FFFFFF) 눈송이 좌표
// (유리구 중심 약 X: 600, Y: 295, 반경 약 170px 내부)
const GLOBE_SNOWFLAKES = [
  { left: 530, top: 165, w: 6, h: 5, radius: "58% 42% 63% 37%" },
  { left: 585, top: 150, w: 4, h: 4, radius: "50%" },
  { left: 645, top: 168, w: 7, h: 6, radius: "44% 56% 39% 61%" },
  { left: 485, top: 205, w: 5, h: 4, radius: "64% 36% 52% 48%" },
  { left: 555, top: 200, w: 8, h: 7, radius: "49% 51% 62% 38%" },
  { left: 620, top: 195, w: 5, h: 5, radius: "50%" },
  { left: 690, top: 210, w: 6, h: 5, radius: "37% 63% 55% 45%" },
  { left: 460, top: 255, w: 7, h: 6, radius: "61% 39% 44% 56%" },
  { left: 515, top: 245, w: 4, h: 4, radius: "50%" },
  { left: 575, top: 240, w: 5, h: 4, radius: "58% 42% 63% 37%" },
  { left: 640, top: 245, w: 8, h: 7, radius: "44% 56% 39% 61%" },
  { left: 715, top: 255, w: 5, h: 5, radius: "50%" },
  { left: 450, top: 305, w: 5, h: 4, radius: "64% 36% 52% 48%" },
  { left: 495, top: 295, w: 8, h: 7, radius: "49% 51% 62% 38%" },
  { left: 545, top: 285, w: 4, h: 4, radius: "50%" },
  { left: 605, top: 290, w: 6, h: 5, radius: "37% 63% 55% 45%" },
  { left: 665, top: 295, w: 5, h: 4, radius: "61% 39% 44% 56%" },
  { left: 725, top: 305, w: 7, h: 6, radius: "58% 42% 63% 37%" },
  { left: 470, top: 350, w: 6, h: 5, radius: "44% 56% 39% 61%" },
  { left: 525, top: 340, w: 5, h: 5, radius: "50%" },
  { left: 585, top: 345, w: 7, h: 6, radius: "64% 36% 52% 48%" },
  { left: 645, top: 338, w: 4, h: 4, radius: "50%" },
  { left: 700, top: 348, w: 8, h: 7, radius: "49% 51% 62% 38%" },
  { left: 510, top: 385, w: 5, h: 4, radius: "37% 63% 55% 45%" },
  { left: 565, top: 390, w: 6, h: 5, radius: "61% 39% 44% 56%" },
  { left: 625, top: 382, w: 5, h: 5, radius: "50%" },
  { left: 675, top: 388, w: 6, h: 5, radius: "58% 42% 63% 37%" },
];

function getSnowballFilenameByLevel(levelParam: string | null): string {
  const lv = Number(levelParam);
  if (!Number.isNaN(lv)) {
    if (lv >= 3) return "lv3_snowball.png";
    if (lv >= 1) return "lv1_snowball.png";
  }
  return "lv0_snowball.png";
}

/**
 * 카카오톡 · 인스타그램 DM 등 SNS 공유용 동적 Open Graph 썸네일 생성 라우트 (/api/og)
 * - 규격: 1200 x 630 px
 * - 상하 합성 없이 원본 비율 그대로인 bg-night-snow.png(width: 1200px, height: 2133px) 단 한 장만 놓고,
 *   이미지의 맨 아래쪽 지면 영역(위쪽 절반은 밤하늘 푸른색, 아래쪽 절반 정도에 흰 눈언덕 지면이 자연스럽게 보이는 하단 구간)에
 *   맞춰 찌그러짐 없이 깔끔하게 단일 크롭합니다.
 * - 그 눈언덕 지면 바로 위에 스노우볼(510x510)이 공중에 뜨지 않고 바닥에 안정감 있게 올라앉도록 배치합니다.
 */
export async function GET(req: NextRequest) {
  try {
    const publicDir = path.join(process.cwd(), "public");
    const sbSlugParam =
      req.nextUrl.searchParams.get("sb")?.trim() ||
      req.nextUrl.searchParams.get("slug")?.trim() ||
      null;
    const levelParam = req.nextUrl.searchParams.get("level");
    const isUserSpecificOg = Boolean(sbSlugParam || levelParam !== null);

    // 1) 비로그인 순수 기본 홈(/) 요청이면서 public/og-thumbnail.png 전용 파일이 있을 때만 정적 파일 사용
    if (!isUserSpecificOg) {
      const customThumbnailPath = path.join(publicDir, "og-thumbnail.png");
      if (fs.existsSync(customThumbnailPath)) {
        const customBuffer = fs.readFileSync(customThumbnailPath);
        return new Response(customBuffer, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
          },
        });
      }
    }

    // 2) 실제 크레용 밤하늘·눈언덕 배경 이미지(bg-night-snow.png) 로드
    const bgPath = path.join(publicDir, "bg-night-snow.png");
    let bgDataUrl = "https://santa-snowball.vercel.app/bg-night-snow.png";
    if (fs.existsSync(bgPath)) {
      const bgBuffer = fs.readFileSync(bgPath);
      bgDataUrl = `data:image/png;base64,${bgBuffer.toString("base64")}`;
    }

    // 3) 유저 공유 링크(?sb=[slug] 또는 ?level=...)에 맞춰 실제 유저의 스노우볼 색상(Lv.0 민트 / Lv.1 핑크 / Lv.3 골드) 동적 반영
    //    (비로그인 순수 기본 홈 '/' 자체의 미리보기는 기존 기본값 유지)
    let resolvedLevelStr: string | null = levelParam;
    if (sbSlugParam) {
      const sbData = await getSnowballBySlug(sbSlugParam);
      if (sbData) {
        resolvedLevelStr = String(sbData.level ?? 0);
      }
    }

    const snowballFilename = getSnowballFilenameByLevel(resolvedLevelStr);
    const snowballPath = path.join(publicDir, snowballFilename);

    let snowballDataUrl = `https://santa-snowball.vercel.app/${snowballFilename}`;
    if (fs.existsSync(snowballPath)) {
      const fileBuffer = fs.readFileSync(snowballPath);
      snowballDataUrl = `data:image/png;base64,${fileBuffer.toString("base64")}`;
    }

    const snowballSize = 515;
    const snowballLeft = Math.round((1200 - snowballSize) / 2); // 343px

    return new ImageResponse(
      (
        <div
          style={{
            width: "1200px",
            height: "630px",
            display: "flex",
            position: "relative",
            backgroundColor: "#1A1E43",
            overflow: "hidden",
          }}
        >
          {/* 단일 배경 이미지 크롭: 원본 가로세로 비율(width: 1200px, height: 2133px) 단 한 장만 하단 지면 영역(bottom: -140px)에 맞춰 배치 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bgDataUrl}
            alt="배경"
            width={1200}
            height={2133}
            style={{
              position: "absolute",
              left: "0px",
              bottom: "-140px",
              width: "1200px",
              height: "2133px",
            }}
          />

          {/* 밤하늘 배경에 내리는 불투명 순백색(#FFFFFF) 눈송이 점 */}
          {SKY_SNOWFLAKES.map((dot, idx) => (
            <div
              key={`sky-${idx}`}
              style={{
                position: "absolute",
                left: `${dot.left}px`,
                top: `${dot.top}px`,
                width: `${dot.w}px`,
                height: `${dot.h}px`,
                borderRadius: dot.radius,
                backgroundColor: "#FFFFFF",
              }}
            />
          ))}

          {/* 스노우볼 일러스트 (width: 515px, height: 515px, 하단 눈언덕 지면 바로 위에 받침대가 안정감 있게 안착) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={snowballDataUrl}
            alt="차곡차곡 크리스마스 스노우볼"
            width={snowballSize}
            height={snowballSize}
            style={{
              position: "absolute",
              left: `${snowballLeft}px`,
              bottom: "10px",
              width: `${snowballSize}px`,
              height: `${snowballSize}px`,
              objectFit: "contain",
            }}
          />

          {/* 스노우볼 유리구 안에 소복하게 내리는 크고 작은 불투명 순백색(#FFFFFF) 눈송이 점 */}
          {GLOBE_SNOWFLAKES.map((dot, idx) => (
            <div
              key={`globe-${idx}`}
              style={{
                position: "absolute",
                left: `${dot.left}px`,
                top: `${dot.top}px`,
                width: `${dot.w}px`,
                height: `${dot.h}px`,
                borderRadius: dot.radius,
                backgroundColor: "#FFFFFF",
              }}
            />
          ))}
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: isUserSpecificOg
          ? {
              "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
            }
          : {
              "Cache-Control": "public, max-age=3600, s-maxage=3600",
            },
      }
    );
  } catch (err) {
    console.error("[OG Image Route] 생성 오류:", err);
    return new Response("Failed to generate OG image", { status: 500 });
  }
}
