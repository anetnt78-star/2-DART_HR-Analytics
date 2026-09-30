import { NextResponse } from 'next/server';
import { getSource } from '@/lib/dart/source';
import { compareCached } from '@/lib/compare';
import { parseConditions } from '@/lib/api-util';
import { makeBrief } from '@/lib/ai/openai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** 조건만 받고 서버가 다시 계산(캐시)한 검증 값으로 브리핑한다. 클라이언트가 보낸 숫자는 쓰지 않는다. */
export async function POST(req: Request) {
  const c = parseConditions(await req.json().catch(() => null));
  if (!c.ok) return c.res;
  const { mode, a, b, year } = c.value;
  const result = await compareCached(getSource(mode), { a, b, year });
  if (result.A.error || result.B.error) {
    return NextResponse.json({ error: '한쪽 기업 조회에 실패해 브리핑을 만들지 않았습니다.' }, { status: 422 });
  }
  return NextResponse.json(await makeBrief(result));
}
