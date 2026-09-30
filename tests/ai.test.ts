import { describe, expect, it } from 'vitest';
import { syntheticSource, loadFixtures } from '../src/lib/dart/source';
import { compareCompanies } from '../src/lib/compare';
import { buildPacket, packetNumbers } from '../src/lib/ai/packet';
import { checkNumbers } from '../src/lib/ai/guard';
import { buildFollowups, buildTemplateBrief } from '../src/lib/ai/template';
import { SYSTEM_PROMPT } from '../src/lib/ai/prompts';
import { DEFINITION_FULL } from '../src/lib/metric';

const code = (id: string) => loadFixtures().find((f) => f.caseId === id)!.corp_code;

function everyValueHasOk(node: unknown): void {
  if (Array.isArray(node)) return node.forEach(everyValueHasOk);
  if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>;
    if ('value' in o && 'status' in o) {
      if (typeof o.value === 'number') expect(o.status).toBe('OK');
      if (o.status !== 'OK') expect(o.value).toBeNull();
    }
    Object.values(o).forEach(everyValueHasOk);
  }
}

describe('AI 패킷', () => {
  it('value가 있는 항목은 모두 status=OK이고, 보류 항목은 value=null (F01↔F07)', async () => {
    const r = await compareCompanies(syntheticSource, { a: code('F01'), b: code('F07'), year: 2025 });
    const p = buildPacket(r);
    everyValueHasOk(p);
    expect(p.companies.B).toMatchObject({ perHeadPayroll: { value: null, status: 'HOLD' } });
    expect(p.unavailableGaps.some((g) => g.metric === 'perHeadPayroll')).toBe(true);
  });

  it('원본 행·키·환경변수가 들어가지 않는다', async () => {
    process.env.OPENDART_API_KEY = 'secret-dart-key';
    process.env.OPENAI_API_KEY = 'secret-openai-key';
    const r = await compareCompanies(syntheticSource, { a: code('F01'), b: code('F02'), year: 2025 });
    const json = JSON.stringify(buildPacket(r));
    expect(json).not.toContain('secret-');
    expect(json).not.toContain('fo_bbm');
    expect(json).not.toContain('sexdstn');
    expect(json).not.toContain('rows');
    delete process.env.OPENDART_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it('서버 계산 격차·격차율과 정의 문구를 포함한다', async () => {
    const r = await compareCompanies(syntheticSource, { a: code('F01'), b: code('F02'), year: 2025 });
    const p = buildPacket(r);
    expect(p.definitions.perHeadPayroll).toBe(DEFINITION_FULL);
    const g = p.verifiedGaps.find((x) => x.metric === 'perHeadPayroll')!;
    expect(g.diffAbs).toBe(8_000_000);
    expect(g.diffPct).toBeCloseTo(8.7, 1);
    expect(SYSTEM_PROMPT).toContain(DEFINITION_FULL);
  });
});

describe('숫자 대조 가드', () => {
  const allowed = [92_000_000, 100_000_000, 8_000_000, 8.7, 1100, 2025];
  it('패킷 값과 단위 환산·반올림은 통과', () => {
    const r = checkNumbers('B의 기말 인원당 급여총액은 1억 원, A는 9,200만 원으로 약 800만 원(8.7%) 차이, 직원은 1,100명(2025년)', allowed);
    expect(r.ok).toBe(true);
  });
  it('패킷에 없는 큰 숫자는 경고', () => {
    const r = checkNumbers('업종 평균은 1억 3,000만 원이고 인원은 3,456명입니다.', allowed);
    expect(r.ok).toBe(false);
    expect(r.unmatched.length).toBeGreaterThan(0);
  });
  it('후속 질문 영역의 숫자는 검사하지 않는다', () => {
    expect(checkNumbers('본문\n---후속질문---\n12345명이면?', allowed).ok).toBe(true);
  });
});

describe('템플릿·후속 질문', () => {
  it('보류가 있으면 보류 관련 질문, 격차가 있으면 격차 질문이 생성된다', async () => {
    const r = await compareCompanies(syntheticSource, { a: code('F01'), b: code('F07'), year: 2025 });
    const qs = buildFollowups(buildPacket(r));
    expect(qs.length).toBeGreaterThan(0);
    expect(qs.join('\n')).toContain('보류');
  });
  it('템플릿은 AI 미연결임을 밝히고 정의 각주를 포함한다', async () => {
    const r = await compareCompanies(syntheticSource, { a: code('F01'), b: code('F02'), year: 2025 });
    const t = buildTemplateBrief(buildPacket(r));
    expect(t).toContain('AI 미연결');
    expect(t).toContain(DEFINITION_FULL);
    expect(packetNumbers(buildPacket(r)).length).toBeGreaterThan(0);
  });
});
