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
 * - 상하 합성 없이 원본 비율 그대로인 bg-night-snow.png(width: 1200px, height: 2133px) 단 한 장만 놓고,
 *   이미지의 맨 아래쪽 지면 영역(위쪽 절반은 밤하늘 푸른색, 아래쪽 절반 정도에 흰 눈언덕 지면이 자연스럽게 보이는 하단 구간)에
 *   맞춰 찌그러짐 없이 깔끔하게 단일 크롭합니다.
 * - 그 눈언덕 지면 바로 위에 스노우볼(510x510)이 공중에 뜨지 않고 바닥에 안정감 있게 올라앉도록 배치합니다.
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
