import { NextResponse } from 'next/server';
import { getSource } from '@/lib/dart/source';
import { compareCached } from '@/lib/compare';
import { parseConditions } from '@/lib/api-util';
import { chat, type ChatTurn } from '@/lib/ai/openai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const c = parseConditions(body);
  if (!c.ok) return c.res;
  const raw = (body as { messages?: unknown }).messages;
  const messages: ChatTurn[] = Array.isArray(raw)
    ? raw
        .filter((m): m is ChatTurn => !!m && typeof m === 'object' && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-16)
    : [];
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return NextResponse.json({ error: '질문이 비어 있습니다.' }, { status: 400 });
  }
  const { mode, a, b, year } = c.value;
  const result = await compareCached(getSource(mode), { a, b, year });
  if (result.A.error || result.B.error) {
    return NextResponse.json({ error: '한쪽 기업 조회에 실패해 답변할 수 없습니다.' }, { status: 422 });
  }
  return NextResponse.json(await chat(result, messages));
}
