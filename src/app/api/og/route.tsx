import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
 * - 실제 배경 이미지(/bg-night-snow.png)를 레이어로 사용하고,
 *   가로형 1200x630 높이에 맞춰 스노우볼 높이를 396px(가로 330px)로 자연스럽게 조절하여
 *   하단 크레용 눈언덕 이미지 위에 스노우볼 받침대 바닥이 착지(bottom: 30px)하도록 배치합니다.
 */
export async function GET(req: NextRequest) {
  try {
    const publicDir = path.join(process.cwd(), "public");

    // 1) 향후 public/og-thumbnail.png 전용 썸네일 파일이 직접 추가된 경우 최우선 사용
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

    // 2) 실제 크레용 밤하늘·눈언덕 배경 이미지(bg-night-snow.png) 로드
    const bgPath = path.join(publicDir, "bg-night-snow.png");
    let bgDataUrl = "https://santa-snowball.vercel.app/bg-night-snow.png";
    if (fs.existsSync(bgPath)) {
      const bgBuffer = fs.readFileSync(bgPath);
      bgDataUrl = `data:image/png;base64,${bgBuffer.toString("base64")}`;
    }

    // 3) 유저 레벨 파라미터(?level=...)에 맞는 새 스노우볼 PNG 로드 (없으면 기본 lv0_snowball.png)
    const levelParam = req.nextUrl.searchParams.get("level");
    const snowballFilename = getSnowballFilenameByLevel(levelParam);
    const snowballPath = path.join(publicDir, snowballFilename);

    let snowballDataUrl = `https://santa-snowball.vercel.app/${snowballFilename}`;
    if (fs.existsSync(snowballPath)) {
      const fileBuffer = fs.readFileSync(snowballPath);
      snowballDataUrl = `data:image/png;base64,${fileBuffer.toString("base64")}`;
    }

    // 스노우볼 원본 비율(1144 x 1375)을 유지하면서 높이를 396px(380~410px 범위)로 설정
    const snowballHeight = 396;
    const snowballWidth = Math.round(snowballHeight * (1144 / 1375)); // 329px
    const snowballLeft = Math.round((1200 - snowballWidth) / 2); // 436px

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
          {/* 실제 bg-night-snow.png 배경 이미지 레이어 (상단 별·산타썰매와 하단 눈언덕이 1200x630 안에 자연스럽게 들어오도록 배치) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bgDataUrl}
            alt="배경"
            width={1200}
            height={720}
            style={{
              position: "absolute",
              left: "0px",
              top: "-25px",
              width: "1200px",
              height: "720px",
            }}
          />

          {/* 스노우볼 일러스트 (높이 396px, 하단 눈언덕 위에 받침대가 착지하도록 bottom: 30px 배치) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={snowballDataUrl}
            alt="차곡차곡 크리스마스 스노우볼"
            width={snowballWidth}
            height={snowballHeight}
            style={{
              position: "absolute",
              left: `${snowballLeft}px`,
              bottom: "30px",
              width: `${snowballWidth}px`,
              height: `${snowballHeight}px`,
              objectFit: "contain",
            }}
          />
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (err) {
    console.error("[OG Image Route] 생성 오류:", err);
    return new Response("Failed to generate OG image", { status: 500 });
  }
}
