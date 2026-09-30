import { NextResponse } from 'next/server';
import { getSource } from '@/lib/dart/source';
import { compareCached } from '@/lib/compare';
import { parseConditions } from '@/lib/api-util';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const c = parseConditions(await req.json().catch(() => null));
  if (!c.ok) return c.res;
  const { mode, a, b, year } = c.value;
  const result = await compareCached(getSource(mode), { a, b, year });
  return NextResponse.json({ result });
}
