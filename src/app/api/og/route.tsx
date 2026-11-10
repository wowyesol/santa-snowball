import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 밤하늘 배경 위에 은은하게 배치할 눈송이 점 좌표 및 크기 (1200x630 기준)
const SNOWFLAKE_DOTS = [
  { left: 110, top: 85, size: 8, opacity: 0.55 },
  { left: 240, top: 190, size: 6, opacity: 0.4 },
  { left: 160, top: 380, size: 10, opacity: 0.5 },
  { left: 290, top: 490, size: 7, opacity: 0.45 },
  { left: 390, top: 110, size: 9, opacity: 0.6 },
  { left: 450, top: 270, size: 6, opacity: 0.35 },
  { left: 760, top: 95, size: 8, opacity: 0.55 },
  { left: 840, top: 230, size: 10, opacity: 0.5 },
  { left: 930, top: 130, size: 7, opacity: 0.45 },
  { left: 1060, top: 210, size: 9, opacity: 0.6 },
  { left: 980, top: 410, size: 8, opacity: 0.5 },
  { left: 1090, top: 510, size: 6, opacity: 0.4 },
  { left: 820, top: 500, size: 7, opacity: 0.45 },
  { left: 340, top: 540, size: 6, opacity: 0.35 },
];

function getSnowballFilenameByLevel(levelParam: string | null): string {
  const lv = Number(levelParam);
  if (!Number.isNaN(lv)) {
    if (lv >= 10) return "lv10_snowball.png";
    if (lv >= 3) return "lv3_Snowball.png";
    if (lv >= 1) return "lv1_snowball.png";
  }
  return "lv0_snowball.png";
}

/**
 * 카카오톡 · 인스타그램 DM 등 SNS 공유용 동적 Open Graph 썸네일 생성 라우트 (/api/og)
 * - 규격: 1200 x 630 px
 * - 향후 public/og-thumbnail.png 파일이 추가되면 해당 이미지를 최우선으로 반환합니다.
 * - 기본 동작: 크리스마스 밤하늘 네이비 그라데이션(#0B192C ~ #16325B) + 은은한 눈송이 배경 정중앙에
 *   유저 레벨(또는 기본) 스노우볼 PNG 일러스트를 높이 480px로 선명하게 배치합니다.
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

    // 2) 유저 레벨 파라미터(?level=...)에 맞는 스노우볼 PNG 로드 (없으면 기본 lv0_snowball.png)
    const levelParam = req.nextUrl.searchParams.get("level");
    const snowballFilename = getSnowballFilenameByLevel(levelParam);
    const snowballPath = path.join(publicDir, snowballFilename);

    let snowballDataUrl = "";
    if (fs.existsSync(snowballPath)) {
      const fileBuffer = fs.readFileSync(snowballPath);
      snowballDataUrl = `data:image/png;base64,${fileBuffer.toString("base64")}`;
    } else {
      const fallbackUrl = new URL(`/${snowballFilename}`, req.url);
      const res = await fetch(fallbackUrl);
      const arrBuf = await res.arrayBuffer();
      snowballDataUrl = `data:image/png;base64,${Buffer.from(arrBuf).toString(
        "base64"
      )}`;
    }

    return new ImageResponse(
      (
        <div
          style={{
            width: "1200px",
            height: "630px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            background: "linear-gradient(180deg, #0B192C 0%, #16325B 100%)",
            overflow: "hidden",
          }}
        >
          {/* 중앙 스노우볼 뒤편 은은한 밤하늘 빛무리 */}
          <div
            style={{
              position: "absolute",
              width: "540px",
              height: "540px",
              borderRadius: "9999px",
              background:
                "radial-gradient(circle, rgba(56,152,255,0.22) 0%, rgba(22,50,91,0) 70%)",
            }}
          />

          {/* 은은한 작은 흰색 눈송이 점 배치 */}
          {SNOWFLAKE_DOTS.map((dot, idx) => (
            <div
              key={idx}
              style={{
                position: "absolute",
                left: `${dot.left}px`,
                top: `${dot.top}px`,
                width: `${dot.size}px`,
                height: `${dot.size}px`,
                borderRadius: "9999px",
                backgroundColor: `rgba(255, 255, 255, ${dot.opacity})`,
              }}
            />
          ))}

          {/* 정중앙 스노우볼 일러스트 (높이 480px, 잘림 없이 선명하게 배치) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={snowballDataUrl}
            alt="차곡차곡 크리스마스 스노우볼"
            width={480}
            height={480}
            style={{
              width: "480px",
              height: "480px",
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
