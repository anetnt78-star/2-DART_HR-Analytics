export type ParsedAmount = { kind: 'null' } | { kind: 'num'; v: number } | { kind: 'bad' };

/** 쉼표 제거, '-'·빈 문자열은 결측(null), 숫자 아님은 bad. 추정하지 않는다. */
export function parseAmount(s: unknown): ParsedAmount {
  if (s === null || s === undefined) return { kind: 'null' };
  const t = String(s).replace(/,/g, '').trim();
  if (t === '' || t === '-') return { kind: 'null' };
  if (!/^-?\d+(\.\d+)?$/.test(t)) return { kind: 'bad' };
  return { kind: 'num', v: Number(t) };
}

export function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}
