/**
 * 사후 숫자 대조(7.4a 권장 안전장치): AI 응답의 숫자가 패킷 값(또는 그 단위 환산·반올림)과 맞는지 확인한다.
 * 패킷에 없는 큰 숫자가 나오면 경고 배지를 표시한다. 완벽한 검증이 아니라 명백한 지어내기를 잡는 용도.
 */
const UNIT_SCALE: Record<string, number> = { 조: 1e12, 억: 1e8, 천만: 1e7, 백만: 1e6, 만: 1e4, 천: 1e3 };

export interface GuardResult {
  ok: boolean;
  unmatched: string[];
}

export function checkNumbers(text: string, allowed: number[]): GuardResult {
  const body = text.split('---후속질문---')[0];
  const abs = allowed.map((n) => Math.abs(n));
  const unmatched: string[] = [];
  const re = /(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s*(조|억|천만|백만|만|천|%)?/g;
  for (const m of body.matchAll(re)) {
    const n = Number(`${m[1]}${m[2] ?? ''}`.replace(/,/g, ''));
    const suffix = m[3];
    const scale = suffix && suffix !== '%' ? UNIT_SCALE[suffix] : 1;
    const scaled = n * scale;
    if (!suffix && scaled < 1000) continue; // 작은 정수(순번·개수·월일)는 대조하지 않는다
    const decimals = m[2] ? m[2].length - 1 : 0;
    const half = 0.5 * Math.pow(10, -decimals) * scale; // 표기된 자릿수만큼의 반올림 폭
    const ok = abs.some((a) => Math.abs(scaled - a) <= Math.max(half, a * 0.001));
    if (!ok) unmatched.push(m[0].trim());
  }
  return { ok: unmatched.length === 0, unmatched: [...new Set(unmatched)].slice(0, 6) };
}
