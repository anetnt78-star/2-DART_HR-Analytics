/** 표시 계층 전용 변환. 계산값은 항상 원 단위로 유지한다. */
export function formatInt(n: number): string {
  return Math.round(n).toLocaleString('ko-KR');
}

export function formatKRW(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const trim = (x: number, d: number) => Number(x.toFixed(d)).toLocaleString('ko-KR', { maximumFractionDigits: d });
  if (a >= 1e12) return `${sign}${trim(a / 1e12, 2)}조 원`;
  if (a >= 1e8) return `${sign}${trim(a / 1e8, 2)}억 원`;
  if (a >= 1e4) return `${sign}${trim(a / 1e4, 0)}만 원`;
  return `${sign}${formatInt(a)}원`;
}

/** 툴팁·상세용: 원 단위 전체 */
export function formatWonExact(n: number): string {
  return `${Math.round(n).toLocaleString('ko-KR')}원`;
}

export function formatPct(n: number): string {
  const s = n >= 0 ? '+' : '';
  return `${s}${n.toFixed(1)}%`;
}

export function signed(n: number, f: (x: number) => string): string {
  return `${n >= 0 ? '+' : '-'}${f(Math.abs(n))}`;
}
