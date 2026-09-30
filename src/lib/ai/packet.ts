import type { ComparisonResult, CompanyResult, Metric } from '../types';
import { DEFINITION_FULL } from '../metric';

/**
 * OpenAI에 전달하는 사실 패킷(7.4a).
 * - 전달: 지표별 {value, unit, status, formula, source, reason}, 서버가 계산한 격차·격차율, 정의 문구
 * - 미전달: 원본 행 전체, HOLD 값의 후보 숫자, 키·환경변수
 * - status !== OK 이면 value는 항상 null
 */
export interface PacketMetric {
  value: number | null;
  unit: string;
  status: string;
  formula: string;
  source: string;
  reason?: string;
}

function pm(m: Metric): PacketMetric {
  const out: PacketMetric = { value: m.status === 'OK' ? m.value : null, unit: m.unit, status: m.status, formula: m.formula, source: m.source };
  if (m.status !== 'OK' && m.reason) out.reason = m.reason;
  return out;
}

function pmSmall(m: Metric) {
  return { value: m.status === 'OK' ? m.value : null, status: m.status, ...(m.status !== 'OK' && m.reason ? { reason: m.reason } : {}) };
}

function company(c: CompanyResult, year: number) {
  if (c.error || !c.metrics) {
    return { name: c.corp.name, year, status: 'HOLD', reason: c.error?.message ?? '조회하지 못했습니다.' };
  }
  const m = c.metrics;
  return {
    name: c.corp.name,
    year,
    revenueScope: c.fsDiv,
    headcountYearEnd: pm(m.headcount),
    annualPayroll: pm(m.payroll),
    perHeadPayroll: pm(m.perHeadPayroll),
    disclosedAvgByGender: {
      note: '공시 1인평균급여(공시값 그대로). 기말 인원당 급여총액과 별개이며 같은 순위·격차에 넣지 않는다.',
      male: pmSmall(m.disclosedAvg.male),
      female: pmSmall(m.disclosedAvg.female),
      overall: pmSmall(m.disclosedAvg.overall),
    },
    revenuePerHead: pm(m.revenuePerHead),
  };
}

export interface Packet {
  mode: string;
  definitions: { perHeadPayroll: string; gaps: string };
  companies: { A: ReturnType<typeof company>; B: ReturnType<typeof company> };
  verifiedGaps: Array<{ metric: string; base: string; target: string; diffAbs: number; diffPct: number; status: 'OK' }>;
  unavailableGaps: Array<{ metric: string; status: string; reason: string }>;
}

export function buildPacket(r: ComparisonResult): Packet {
  return {
    mode: r.mode === 'synthetic' ? '합성 예시(실제 기업 아님)' : '실제 DART 공시',
    definitions: {
      perHeadPayroll: DEFINITION_FULL,
      gaps: '격차 = B − A (절대값), 격차율 = (B − A) ÷ A × 100 (%). 앱이 서버에서 계산한 값이며 status가 OK인 항목만 숫자가 있다.',
    },
    companies: { A: company(r.A, r.year), B: company(r.B, r.year) },
    verifiedGaps: r.gaps
      .filter((g) => g.status === 'OK' && g.diffAbs !== null && g.diffPct !== null)
      .map((g) => ({ metric: g.metric, base: 'A', target: 'B', diffAbs: g.diffAbs!, diffPct: Number(g.diffPct!.toFixed(2)), status: 'OK' as const })),
    unavailableGaps: r.gaps
      .filter((g) => g.status !== 'OK')
      .map((g) => ({ metric: g.metric, status: g.status, reason: g.reason ?? '' })),
  };
}

/** 가드 대조용: 패킷 안의 모든 숫자 */
export function packetNumbers(p: Packet): number[] {
  const nums: number[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'number' && Number.isFinite(v)) nums.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(p);
  return nums;
}
