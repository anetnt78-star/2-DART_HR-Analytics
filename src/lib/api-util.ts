import { NextResponse } from 'next/server';
import { getSource, type Mode } from './dart/source';
import { dartKey } from './dart/client';

export interface Conditions { mode: Mode; a: string; b: string; year: number }

export function parseConditions(body: unknown): { ok: true; value: Conditions } | { ok: false; res: NextResponse } {
  const bad = (msg: string) => ({ ok: false as const, res: NextResponse.json({ error: msg }, { status: 400 }) });
  const o = (body ?? {}) as Record<string, unknown>;
  const mode = o.mode === 'live' ? 'live' : o.mode === 'synthetic' ? 'synthetic' : null;
  if (!mode) return bad('실행 모드(mode)가 올바르지 않습니다.');
  const a = String(o.a ?? '').trim();
  const b = String(o.b ?? '').trim();
  const year = Number(o.year);
  if (!a || !b) return bad('기업 A와 B를 모두 선택하세요.');
  if (a === b) return bad('서로 다른 두 기업을 선택하세요.');
  if (!Number.isInteger(year)) return bad('사업연도가 올바르지 않습니다.');
  if (!getSource(mode).years.includes(year)) return bad(`${mode === 'synthetic' ? '합성 예시' : '실제 DART'}에서 지원하지 않는 연도입니다.`);
  if (mode === 'live' && !dartKey()) return bad('OPENDART_API_KEY가 비어 있어 실제 DART 모드를 쓸 수 없습니다. 합성 예시를 선택하거나 .env에 키를 입력하세요.');
  return { ok: true, value: { mode, a, b, year } };
}
