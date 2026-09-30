import { describe, expect, it } from 'vitest';
import { loadFixtures, syntheticSource } from '../src/lib/dart/source';
import { compareCompanies } from '../src/lib/compare';
import { analyzeEmp } from '../src/lib/validate/structure';
import { analyzeRevenue } from '../src/lib/validate/revenue';
import { buildCompanyMetrics } from '../src/lib/metrics';

const fixtures = loadFixtures();
const byCase = (id: string) => fixtures.find((f) => f.caseId === id)!;

function run(id: string) {
  const f = byCase(id);
  const emp = analyzeEmp(f.emp);
  const revenue = analyzeRevenue(f.revenue[f.fsDiv], f.fsDiv, f.year);
  return { f, emp, metrics: buildCompanyMetrics(emp, revenue, f.fsDiv, f.year) };
}

describe('합성 F01~F12 기대 결과', () => {
  for (const f of fixtures) {
    it(`${f.caseId} ${f.description}`, () => {
      const { emp, metrics } = run(f.caseId);
      const e = f.expect as Record<string, unknown>;
      if (e.structure) expect(emp.structure).toBe(e.structure);
      if (e.headcount) expect(metrics.headcount.status).toBe(e.headcount);
      if (e.headcountValue !== undefined) expect(metrics.headcount.value).toBe(e.headcountValue);
      if (e.headcountReason) expect(metrics.headcount.reasonCode).toBe(e.headcountReason);
      if (e.payroll) expect(metrics.payroll.status).toBe(e.payroll);
      if (e.payrollValue !== undefined) expect(metrics.payroll.value).toBe(e.payrollValue);
      if (e.payrollReason) expect(metrics.payroll.reasonCode).toBe(e.payrollReason);
      if (e.perHeadPayroll) expect(metrics.perHeadPayroll.status).toBe(e.perHeadPayroll);
      if (e.perHeadValue !== undefined) expect(metrics.perHeadPayroll.value).toBe(e.perHeadValue);
      if (e.revenuePerHead) expect(metrics.revenuePerHead.status).toBe(e.revenuePerHead);
      if (e.revenuePerHeadValue !== undefined) expect(metrics.revenuePerHead.value).toBe(e.revenuePerHeadValue);
      if (e.overall) expect(metrics.disclosedAvg.overall.status).toBe(e.overall);
      if (typeof e.maleAvg === 'number') expect(metrics.disclosedAvg.male.value).toBe(e.maleAvg);
      if (typeof e.femaleAvg === 'number') expect(metrics.disclosedAvg.female.value).toBe(e.femaleAvg);
      if (e.maleAvg === 'HOLD') expect(metrics.disclosedAvg.male.status).toBe('HOLD');
    });
  }

  it('HOLD/MISSING 값은 value가 null (숫자를 숨김)', () => {
    for (const f of fixtures) {
      const { metrics } = run(f.caseId);
      for (const m of [metrics.headcount, metrics.payroll, metrics.perHeadPayroll, metrics.revenuePerHead, metrics.revenue]) {
        if (m.status !== 'OK') expect(m.value).toBeNull();
      }
    }
  });

  it('F02: 성별합계와 상세를 함께 더하지 않는다(직원 수 1,100명이지 2,200명이 아님)', () => {
    expect(run('F02').metrics.headcount.value).toBe(1100);
  });

  it('F02: 남·여 공시 평균은 공시값 그대로이고 전체 평균은 만들지 않는다', () => {
    const { metrics } = run('F02');
    expect(metrics.disclosedAvg.male.value).toBe(105_000_000);
    expect(metrics.disclosedAvg.female.value).toBe(92_000_000);
    expect(metrics.disclosedAvg.overall.value).toBeNull();
    expect(metrics.disclosedAvg.overall.status).toBe('MISSING');
    expect(metrics.perHeadPayroll.value).toBe(100_000_000);
  });

  it('F07: 단위 혼재면 원화 카드값·격차 보류, 직원 수는 유지', async () => {
    const r = await compareCompanies(syntheticSource, { a: byCase('F01').corp_code, b: byCase('F07').corp_code, year: 2025 });
    expect(r.B.metrics!.headcount.status).toBe('OK');
    expect(r.B.metrics!.perHeadPayroll.status).toBe('HOLD');
    expect(r.gaps.find((g) => g.metric === 'perHeadPayroll')!.status).toBe('HOLD');
    expect(r.gaps.find((g) => g.metric === 'headcount')!.status).toBe('OK');
  });
});

describe('격차 계산', () => {
  it('정상 두 기업(F01↔F02): 모든 격차 OK, B−A 기준', async () => {
    const r = await compareCompanies(syntheticSource, { a: byCase('F01').corp_code, b: byCase('F02').corp_code, year: 2025 });
    const g = Object.fromEntries(r.gaps.map((x) => [x.metric, x]));
    expect(g.headcount.status).toBe('OK');
    expect(g.headcount.diffAbs).toBe(100);
    expect(g.perHeadPayroll.diffAbs).toBe(8_000_000);
    expect(g.perHeadPayroll.diffPct).toBeCloseTo((8_000_000 / 92_000_000) * 100, 10);
    expect(g.revenuePerHead.diffAbs).toBe(100_000_000);
  });

  it('F11: A는 OFS, B는 CFS → 인당 매출 격차 NOT_COMPARABLE', async () => {
    const r = await compareCompanies(syntheticSource, { a: byCase('F01').corp_code, b: byCase('F11').corp_code, year: 2025 });
    expect(r.gaps.find((g) => g.metric === 'revenuePerHead')!.status).toBe('NOT_COMPARABLE');
    expect(r.gaps.find((g) => g.metric === 'perHeadPayroll')!.status).toBe('OK');
  });

  it('F12: 결산월이 다르면 모든 격차 NOT_COMPARABLE, 개별 값은 OK', async () => {
    const r = await compareCompanies(syntheticSource, { a: byCase('F01').corp_code, b: byCase('F12').corp_code, year: 2025 });
    expect(r.B.metrics!.perHeadPayroll.status).toBe('OK');
    for (const g of r.gaps) expect(g.status).toBe('NOT_COMPARABLE');
  });

  it('보류 값이 있으면 그 격차는 계산되지 않는다', async () => {
    const r = await compareCompanies(syntheticSource, { a: byCase('F01').corp_code, b: byCase('F03').corp_code, year: 2025 });
    for (const g of r.gaps) {
      expect(g.status).toBe('HOLD');
      expect(g.diffAbs).toBeNull();
      expect(g.diffPct).toBeNull();
    }
  });
});
