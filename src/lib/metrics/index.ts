import type { CompanyMetrics, EmpAnalysis, FsDiv, Gap, GapMetric, Metric } from '../types';
import { metric, notOk } from '../metric';
import { sameSettlement, stlmMatchesYear } from '../validate/period';

export function perHeadPayroll(emp: EmpAnalysis): Metric {
  const formula = '연간급여총액 ÷ 사업연도말 직원 수';
  const source = emp.payroll.source;
  const { payroll, headcount } = emp;
  if (payroll.status !== 'OK') {
    return notOk(payroll.status === 'MISSING' ? 'MISSING' : 'HOLD', '원', formula, source,
      payroll.reasonCode ?? 'PAYROLL_NOT_OK', payroll.reason ?? '연간급여총액이 검증되지 않았습니다.');
  }
  if (headcount.status !== 'OK' || !headcount.value) {
    return notOk('HOLD', '원', formula, source, headcount.reasonCode ?? 'HEADCOUNT_NOT_OK',
      headcount.reason ?? '사업연도말 직원 수가 검증되지 않았습니다.');
  }
  return metric('OK', payroll.value! / headcount.value, '원', formula, source, {
    notes: ['앱 계산값이며 공시 1인평균급여(jan_salary_am)와 다른 계산입니다.'],
  });
}

export function revenuePerHead(revenue: Metric, fsDiv: FsDiv, emp: EmpAnalysis, year: number): Metric {
  const formula = `연간 매출(${fsDiv}) ÷ 사업연도말 직원 수`;
  const source = `${revenue.source} ÷ ${emp.headcount.source}`;
  if (fsDiv === 'CFS') {
    return notOk('NOT_COMPARABLE', '원', formula, source, 'SCOPE_MISMATCH',
      '연결(CFS) 매출은 별도 기준 직원 수와 범위가 달라 인당 매출을 산출하지 않습니다.');
  }
  if (revenue.status !== 'OK') {
    return notOk(revenue.status === 'MISSING' ? 'MISSING' : 'HOLD', '원', formula, source,
      revenue.reasonCode ?? 'REVENUE_NOT_OK', revenue.reason ?? '매출이 검증되지 않았습니다.');
  }
  if (emp.headcount.status !== 'OK' || !emp.headcount.value) {
    return notOk('HOLD', '원', formula, source, emp.headcount.reasonCode ?? 'HEADCOUNT_NOT_OK',
      emp.headcount.reason ?? '사업연도말 직원 수가 검증되지 않았습니다.');
  }
  if (!stlmMatchesYear(emp.stlmDt, year)) {
    return notOk('HOLD', '원', formula, source, 'PERIOD_MISMATCH',
      `결산 기준일(${emp.stlmDt ?? '없음'})이 사업연도 ${year}와 맞는지 확인할 수 없어 보류합니다.`);
  }
  return metric('OK', revenue.value! / emp.headcount.value, '원', formula, source, {
    notes: [`매출 범위 ${fsDiv}, 직원 수와 같은 사업연도(${year})`],
  });
}

export function buildCompanyMetrics(emp: EmpAnalysis, revenue: Metric, fsDiv: FsDiv, year: number): CompanyMetrics {
  return {
    headcount: emp.headcount,
    payroll: emp.payroll,
    perHeadPayroll: perHeadPayroll(emp),
    disclosedAvg: emp.disclosedAvg,
    revenue,
    revenuePerHead: revenuePerHead(revenue, fsDiv, emp, year),
  };
}

const GAP_METRICS: GapMetric[] = ['headcount', 'perHeadPayroll', 'revenuePerHead'];

/** 격차는 B가 A보다 얼마나 큰지(B − A). 남·여 공시 평균은 격차에 넣지 않는다. */
export function computeGaps(
  A: { metrics: CompanyMetrics; stlmDt: string | null; fsDiv: FsDiv },
  B: { metrics: CompanyMetrics; stlmDt: string | null; fsDiv: FsDiv },
): Gap[] {
  return GAP_METRICS.map((m): Gap => {
    const a = A.metrics[m];
    const b = B.metrics[m];
    const base = { metric: m, base: 'A' as const, target: 'B' as const, diffAbs: null, diffPct: null };

    if (a.status === 'HOLD' || b.status === 'HOLD' || a.status === 'MISSING' || b.status === 'MISSING') {
      const who = [a.status !== 'OK' && a.status !== 'NOT_COMPARABLE' ? 'A' : '', b.status !== 'OK' && b.status !== 'NOT_COMPARABLE' ? 'B' : '']
        .filter(Boolean).join('·');
      return { ...base, status: 'HOLD', reasonCode: 'VALUE_NOT_OK', reason: `${who} 값이 OK가 아니어서 격차를 계산하지 않습니다.` };
    }
    if (a.status === 'NOT_COMPARABLE' || b.status === 'NOT_COMPARABLE') {
      return { ...base, status: 'NOT_COMPARABLE', reasonCode: 'VALUE_NOT_COMPARABLE', reason: '한쪽 값이 비교 불가 상태입니다.' };
    }
    if (sameSettlement(A.stlmDt, B.stlmDt) === false) {
      return { ...base, status: 'NOT_COMPARABLE', reasonCode: 'PERIOD_MISMATCH', reason: `결산 기준일이 다릅니다(A ${A.stlmDt} / B ${B.stlmDt}).` };
    }
    if (sameSettlement(A.stlmDt, B.stlmDt) === null) {
      return { ...base, status: 'HOLD', reasonCode: 'PERIOD_UNKNOWN', reason: '결산 기준일을 확인할 수 없어 격차를 계산하지 않습니다.' };
    }
    if (m === 'revenuePerHead' && A.fsDiv !== B.fsDiv) {
      return { ...base, status: 'NOT_COMPARABLE', reasonCode: 'FS_DIV_MIXED', reason: `재무제표 범위가 다릅니다(A ${A.fsDiv} / B ${B.fsDiv}).` };
    }
    if (a.value === null || b.value === null || a.value <= 0) {
      return { ...base, status: 'HOLD', reasonCode: 'BASE_NOT_POSITIVE', reason: '기준값(A)이 0 이하라 격차율을 계산하지 않습니다.' };
    }
    const diffAbs = b.value - a.value;
    return { ...base, status: 'OK', diffAbs, diffPct: (diffAbs / a.value) * 100 };
  });
}
