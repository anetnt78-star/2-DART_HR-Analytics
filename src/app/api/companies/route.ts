import { NextResponse, type NextRequest } from 'next/server';
import { getSource } from '@/lib/dart/source';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('mode') === 'live' ? 'live' : 'synthetic';
  const q = req.nextUrl.searchParams.get('q') ?? '';
  const r = await getSource(mode).search(q);
  return NextResponse.json(r);
}
