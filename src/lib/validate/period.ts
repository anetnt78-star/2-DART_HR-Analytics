/** 결산 기준일 비교(연도가 아니라 월·일 — 같은 사업연도를 이미 선택했으므로). */
export function monthDay(stlm: string | null): string | null {
  if (!stlm) return null;
  const m = stlm.match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}-${m[2]}` : null;
}

export function sameSettlement(a: string | null, b: string | null): boolean | null {
  const x = monthDay(a);
  const y = monthDay(b);
  if (!x || !y) return null; // 판정 불가
  return x === y;
}

/** 결산일의 연도가 사업연도와 같은가 (재무제표 기간 종료일은 API 응답에 없으므로 이 대조만 가능). */
export function stlmMatchesYear(stlm: string | null, year: number): boolean {
  return !!stlm && stlm.startsWith(`${year}-`);
}
