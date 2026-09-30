import OpenAI from 'openai';
import { DartError, dartKey, fetchEmpSttus, fetchFinancials } from './dart/client';
import { buildCorpIndex } from './dart/buildIndex';
import { LIVE_YEARS } from './dart/source';
import { aiConfig, explainOpenAiError } from './ai/openai';

export interface CheckStep { name: string; ok: boolean; detail: string }
export interface CheckReport { target: 'dart' | 'openai'; ok: boolean; steps: CheckStep[] }

const REQUIRED = ['fo_bbm', 'sexdstn', 'sm', 'fyer_salary_totamt', 'jan_salary_am', 'stlm_dt', 'rm'];
const SAMPLE = { code: '00126380', name: '삼성전자' };

const errText = (e: unknown) => (e instanceof DartError ? e.message : e instanceof Error ? e.message : '알 수 없는 오류');

/** OpenDART 점검: ① 인덱스 ② empSttus ③ 재무제표 ④ 필수 7개 필드. OpenAI와 독립. */
export async function checkDart(): Promise<CheckReport> {
  const steps: CheckStep[] = [];
  const push = (name: string, ok: boolean, detail: string) => steps.push({ name, ok, detail });
  if (!dartKey()) {
    push('인증키', false, 'OPENDART_API_KEY가 비어 있습니다.');
    return { target: 'dart', ok: false, steps };
  }
  try {
    const r = await buildCorpIndex();
    push('① 고유번호 인덱스', true, `전체 ${r.total.toLocaleString()}개 중 상장사 ${r.listed.toLocaleString()}개 저장`);
  } catch (e) {
    push('① 고유번호 인덱스', false, errText(e));
  }
  let rows: Awaited<ReturnType<typeof fetchEmpSttus>> = [];
  let year = 0;
  try {
    for (const y of LIVE_YEARS.slice(0, 3)) {
      rows = await fetchEmpSttus(SAMPLE.code, y);
      if (rows.length) { year = y; break; }
    }
    push(`② empSttus (${SAMPLE.name})`, rows.length > 0, rows.length ? `${year}년 ${rows.length}행 수신` : '최근 3개 연도에 데이터가 없습니다.');
  } catch (e) {
    push(`② empSttus (${SAMPLE.name})`, false, errText(e));
  }
  try {
    const fs = await fetchFinancials(SAMPLE.code, year || LIVE_YEARS[1], 'OFS');
    push(`③ fnlttSinglAcntAll (${SAMPLE.name}, OFS)`, fs.length > 0, fs.length ? `${fs.length}행 수신` : '데이터가 없습니다.');
  } catch (e) {
    push(`③ fnlttSinglAcntAll (${SAMPLE.name}, OFS)`, false, errText(e));
  }
  if (rows.length) {
    const missing = REQUIRED.filter((f) => !(f in rows[0]));
    push('④ 필수 7개 필드', missing.length === 0, missing.length ? `없는 필드: ${missing.join(', ')}` : REQUIRED.join(', '));
  } else {
    push('④ 필수 7개 필드', false, 'empSttus 응답이 없어 확인하지 못했습니다.');
  }
  return { target: 'dart', ok: steps.every((s) => s.ok), steps };
}

/** OpenAI 점검: OPENAI_MODEL로 최소 요청 1회. DART와 독립. */
export async function checkOpenAi(): Promise<CheckReport> {
  const cfg = aiConfig();
  const steps: CheckStep[] = [];
  if (!cfg.keySet) return { target: 'openai', ok: false, steps: [{ name: '인증키', ok: false, detail: 'OPENAI_API_KEY가 비어 있습니다.' }] };
  if (!cfg.model) return { target: 'openai', ok: false, steps: [{ name: '모델', ok: false, detail: 'OPENAI_MODEL이 비어 있습니다(모델 미설정).' }] };
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY!.trim(), timeout: 30_000 });
    const res = await client.chat.completions.create({
      model: cfg.model,
      messages: [{ role: 'user', content: '연결 확인입니다. "OK"라고만 답하세요.' }],
    });
    steps.push({ name: '최소 요청 1회', ok: true, detail: `응답 수신 · 모델 ${res.model}` });
  } catch (e) {
    steps.push({ name: '최소 요청 1회', ok: false, detail: explainOpenAiError(e) });
  }
  return { target: 'openai', ok: steps.every((s) => s.ok), steps };
}
