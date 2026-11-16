/**
 * 한글 마지막 글자의 종성(받침) 유무를 판별하는 유틸리티
 * - 완성형 한글 음절(가~힣, U+AC00~U+D7A3)인 경우 (code - 0xAC00) % 28 > 0 여부로 받침 유무 판별
 * - 한글 음절이 아닌 영문, 숫자, 특수문자, 이모지 등은 받침 없음(false)으로 처리
 */
export function hasKoreanFinalConsonant(text: string): boolean {
  const trimmed = (text || "").trim();
  if (!trimmed) return false;

  const chars = Array.from(trimmed);
  const lastChar = chars[chars.length - 1];
  if (!lastChar) return false;

  const code = lastChar.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) {
    return false;
  }

  return (code - 0xac00) % 28 !== 0;
}

/**
 * 호격 조사('아' / '야') 자동 결합
 * - 받침 있음: '[닉네임]아' (예: 복만아, 수룡아)
 * - 받침 없음 / 영문·숫자·특수문자: '[닉네임]야' (예: 예솔이야, 수룡이야, Santa야)
 */
export function withVocativeParticle(name: string): string {
  const clean = (name || "").trim();
  if (!clean) return "";
  return `${clean}${hasKoreanFinalConsonant(clean) ? "아" : "야"}`;
}

/**
 * 주격 조사('이' / '가') 자동 결합
 * - 받침 있음: '[닉네임]이' (예: 복만이, 수룡이)
 * - 받침 없음 / 영문·숫자·특수문자: '[닉네임]가' (예: 예솔이가, Santa가)
 */
export function withSubjectParticle(name: string): string {
  const clean = (name || "").trim();
  if (!clean) return "";
  return `${clean}${hasKoreanFinalConsonant(clean) ? "이" : "가"}`;
}
