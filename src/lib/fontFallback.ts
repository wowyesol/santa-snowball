/**
 * 1순위 동그리 폰트(HakgyoansimDunggeunmisoTTF-B) 실제 글리프 외곽선(contour) 보유 여부 판별 및
 * <canvas> 하이브리드 텍스트 렌더링 유틸리티
 * - 일반 글자('예', '이', '의', '스', '노', '우', '볼' 등)는 100% 기존 동그리 폰트로 렌더링하고,
 *   원본 동그리 폰트에 외곽선이 없는 희귀 한글 음절('슮' U+C2AE 등)만 2순위 둥근 폴백 폰트(CookieRun-Bold)로 선명하게 렌더링합니다.
 */

// U+AC00 ~ U+D7A3 (11,172자) 중 HakgyoansimDunggeunmisoTTF-B에 실제 외곽선(nContours !== 0)이 존재하는 2,808자의 정확한 비트맵
const HAKGYOANSIM_HANGUL_BITSET_B64 =
  "kwf/PhGwAxMBKBARAACTBXseEbADlwE7EhGgAJOVazBRsAJRATIwEbACEQEqMHm4BhMBMBAAkAITAQswERAAkwMrERAAAJMFa3TRsCMTATtxMLACAQAAcBmwAxMAKzARkCEBAAAwFbAOEwEwMBAwAhEBIxAQAAAXgWsQELADE4MbMBEwAgEAADBVuDIAAQAwGbAClwf7OhGwUxMBIQAAAAAbDTs4EbAjEwEzEQEAABMFKxwRAAEAAAAQEbACEwEqMBmwAgEAEDAQMAIRASswEbACEwdrFBGwAhNFK3X5uI8TATs0EZACAAAAcNmwThMBOxAREAMRAAAwWbEqEQEAEBGwAxEBKxAAAAATASsQAAABAQArEBGwAhEBITBZsAIBAAAwGbAHEw87OBGwAwEAIBAAAAITDTs4EbADAQAQEAAAABMBKxAQAAARASMQAQAAEwErcBE4AgAAABAQsAITASsQAAgAkwUrEBGwAhMBKzARsPcTATs2EbByAQAgMBGwwxMBOzARsAMRACswEbByEwEoEAAAAREBKzARoEITASsXARABAwADMBGwAhMBKzERsGYAAQAwEbBS0w9/PxGwBxMBIAAAAAATBWs4EbATEwG7EAAAABsFKxABAAMAAAAQEaACEQEKcHmwohEBKjAQgBIRAQAQEZAQkQHpHxAAAJMFu/P5sDITATsyASAAAAAAMFmwBpMDOzARoCMRACBwEbACEwA5ECAAARMBAxABgAKTBysXMAABAwIgMBEQAhEBKTARsHYAACAwUbAeEwU7OBGwAwMAKRAAIACTATkwcAACEwA7EAEAABMPIxAAEAIAAAAwETACBwErMBGQAgAAADAgMAICAAAwARACEQELAAAAABMBK7B5uHMTATsxEbBSEQEh8NmwYxMFOzIRsAMTASNwUbAiEwEgEBGwAxEBCzARsEKTAas3ETADE4EpMBGwAhMBqzExsAIAAAAwGbhDHwUzOREwAwMBIRAAAAATDzs0ESACAQAgEBEAAJMFIzARsAMBABAQETAAAQMoMBEwAgEAEDAAAAARACAQAbACE4UDEREQAhMBOzd3uHMTATs40bCyEQECMHvwVxcBK3DR8OMRARsw8bkKEwE7MBGQEhMBKzARsCIXBysxEbADEwMjMBGwAhMBq3AZ9P4RAStwcbhX0wV7MBGwA1MBIxQRAAATBWswEbACEQE7EAAAABMP6zgRsAIRATMQEbACEwErMHGwAgEAGDABEAATASswETACEwErEAEAAJMFazaVsAMTATtwEbACAQAAMBGwAwEAKzARsAMAAAAwEbAKAwEzEAAAAREBA3ABsAoTASMQAAADAAAAEAAAABMBIxAAsAIAAAAwGbDGUwd7NRGwA1MBKQQAAAATATswEbACEQASEAEAAhMBKxBRMAIAAAAwEbACEwArMBGwAgEBMzABsAIRASswETACEwErAAAAAJMDKzURsBITATtxEAASAAAAMBmwExMBKxERsAMBAAAwEbACEwEhEACwAgEBADAAgBATASswETACAQAgMBGwAhEBCXARsBIAAAAwEbAyEw87MBGwQwEAIQAAAAATBTswEbACEQAwEAEAABMBKxQBAAABAAAQAYACAQAAMBGwAgEAEBAAgAATASMQERACkwULEBEwABMBK3BRsCMTATswAAAAAAAAMBGwAxMBKxQRMAMBAQowEbACAQAgAAAAABEAABARoACTBSsQAAACAAAAEBGQABEBKRARsAAAAAAwEbACEyErMBGwgwEAIAAAAAATBSswEbACEwE7EBEgABMhKzIRgAITACgwEaACEQEKMBGSAhEBITARAAITASswEZAC0wMrEhEwAhMBKwA=";

let decodedBitset: Uint8Array | null = null;

function getHangulBitset(): Uint8Array {
  if (decodedBitset) return decodedBitset;
  if (typeof window !== "undefined" && typeof window.atob === "function") {
    const bin = window.atob(HAKGYOANSIM_HANGUL_BITSET_B64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      arr[i] = bin.charCodeAt(i);
    }
    decodedBitset = arr;
    return arr;
  }
  const buf = Buffer.from(HAKGYOANSIM_HANGUL_BITSET_B64, "base64");
  decodedBitset = new Uint8Array(buf);
  return decodedBitset;
}

/**
 * 해당 유니코드 코드포인트가 1순위 동그리 폰트(HakgyoansimDunggeunmisoTTF-B)에서
 * 빈 글리프가 아닌 실제 외곽선으로 지원되는지 여부를 반환합니다.
 */
export function isSupportedByPrimaryDisplayFont(codePoint: number): boolean {
  // 한글 완성형 음절 구간 (U+AC00 ~ U+D7A3)
  if (codePoint >= 0xac00 && codePoint <= 0xd7a3) {
    const idx = codePoint - 0xac00;
    const bitset = getHangulBitset();
    return (bitset[idx >> 3] & (1 << (idx & 7))) !== 0;
  }
  // 한글 호환 자모 구간 (ㄱ~ㅎ, ㅏ~ㅣ: U+3131 ~ U+318E) - 동그리 폰트에 외곽선 존재
  if (codePoint >= 0x3131 && codePoint <= 0x318e) {
    return true;
  }
  // 기본 영문/숫자/공백/일반 문장부호
  if (codePoint >= 0x0020 && codePoint <= 0x007e) {
    return true;
  }
  return false;
}

export interface FontSegment {
  text: string;
  usePrimary: boolean;
}

/**
 * 문자열을 1순위 동그리 폰트 지원 구간과 2순위 둥근 폴백 폰트 구간으로 분리합니다.
 */
export function splitDisplayFontSegments(input: string): FontSegment[] {
  const segments: FontSegment[] = [];
  for (const ch of Array.from(input)) {
    const cp = ch.codePointAt(0) ?? 0;
    const usePrimary = isSupportedByPrimaryDisplayFont(cp);
    const last = segments[segments.length - 1];
    if (last && last.usePrimary === usePrimary) {
      last.text += ch;
    } else {
      segments.push({ text: ch, usePrimary });
    }
  }
  return segments;
}

/**
 * <canvas>에서 1순위 동그리 폰트의 빈 글리프(nContours = 0) 간섭 없이
 * 지원 글자는 100% HakgyoansimDunggeunmisoTTF-B로, 미지원 희귀 한글('슮' 등)은 CookieRun-Bold로
 * 정확히 중앙 정렬하여 렌더링합니다.
 */
export function fillCenteredDisplayTextOnCanvas(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  fontSizePx: number,
  fontWeight: number | string = 800
): void {
  const segments = splitDisplayFontSegments(text);
  if (segments.length === 0) return;

  const primaryFont = `${fontWeight} ${fontSizePx}px "HakgyoansimDunggeunmisoTTF-B", "CookieRun-Bold", "ONE-Mobile-POP", sans-serif`;
  // CookieRun-Bold는 시각적 글자 크기가 동그리 폰트와 거의 동일하며 살짝 묵직하므로 0.96 스케일로 높이/두께 밸런스를 맞춤
  const fallbackFontSize = Math.round(fontSizePx * 0.96);
  const fallbackFont = `700 ${fallbackFontSize}px "CookieRun-Bold", "ONE-Mobile-POP", "Gowun Dodum", sans-serif`;

  const widths: number[] = [];
  let totalWidth = 0;

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  for (const seg of segments) {
    ctx.font = seg.usePrimary ? primaryFont : fallbackFont;
    const w = ctx.measureText(seg.text).width;
    widths.push(w);
    totalWidth += w;
  }

  let cursorX = centerX - totalWidth * 0.5;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    ctx.font = seg.usePrimary ? primaryFont : fallbackFont;
    ctx.fillText(seg.text, cursorX, centerY);
    cursorX += widths[i];
  }
  ctx.restore();
}
