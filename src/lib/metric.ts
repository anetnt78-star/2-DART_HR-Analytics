import type { Metric, Status } from './types';

export const DEFINITION_FULL =
  '기말 인원당 급여총액 = 연간급여총액 ÷ 사업연도말 직원 수 (앱 계산값, 공시 1인평균급여와 다름)';
export const DEFINITION_SHORT = '앱 계산값·공시 1인평균급여와 다름';
export const PER_HEAD_LABEL = '기말 인원당 급여총액 · 계산값(공시 1인평균 아님)';

export function metric(
  status: Status,
  value: number | null,
  unit: string,
  formula: string,
  source: string,
  extra: { reasonCode?: string; reason?: string; notes?: string[] } = {},
): Metric {
  return {
    value: status === 'OK' ? value : null,
    unit,
    status,
    formula,
    source,
    reasonCode: extra.reasonCode,
    reason: extra.reason,
    notes: extra.notes ?? [],
  };
}

export function notOk(
  status: Exclude<Status, 'OK'>,
  unit: string,
  formula: string,
  source: string,
  reasonCode: string,
  reason: string,
  notes: string[] = [],
): Metric {
  return metric(status, null, unit, formula, source, { reasonCode, reason, notes });
}
