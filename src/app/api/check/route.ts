import { NextResponse, type NextRequest } from 'next/server';
import { checkDart, checkOpenAi } from '@/lib/checks';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** 사용자가 "점검 실행"을 눌렀을 때만 외부 API를 호출한다. 두 점검은 서로 독립. */
export async function POST(req: NextRequest) {
  const target = req.nextUrl.searchParams.get('target');
  if (target === 'dart') return NextResponse.json(await checkDart());
  if (target === 'openai') return NextResponse.json(await checkOpenAi());
  return NextResponse.json({ error: 'target은 dart 또는 openai여야 합니다.' }, { status: 400 });
}
