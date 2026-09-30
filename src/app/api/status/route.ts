import { NextResponse } from 'next/server';
import { dartKey } from '@/lib/dart/client';
import { aiConfig } from '@/lib/ai/openai';
import { hasCorpIndex, LIVE_YEARS } from '@/lib/dart/source';

export const dynamic = 'force-dynamic';

/** 키 값은 절대 반환하지 않고 설정 여부만 알려준다. */
export function GET() {
  const ai = aiConfig();
  return NextResponse.json({
    dart: { configured: !!dartKey(), corpIndex: hasCorpIndex() },
    openai: { configured: ai.keySet && !!ai.model, keySet: ai.keySet, modelSet: !!ai.model, model: ai.model },
    defaultMode: dartKey() ? 'live' : 'synthetic',
    liveYears: LIVE_YEARS,
  });
}
