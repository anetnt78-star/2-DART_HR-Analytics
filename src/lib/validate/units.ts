import type { ClassifiedRow, UnitInfo } from '../types';
import { parseAmount } from '../parse';

/** 화이트리스트 단위만 인식한다. 긴 표기를 먼저 둔다. 값의 크기로는 절대 판정하지 않는다. */
const UNIT_TOKENS: Array<[string, number]> = [
  ['억원', 100_000_000],
  ['백만원', 1_000_000],
  ['천원', 1_000],
  ['만원', 10_000],
  ['원', 1],
];
const TOKEN_ALT = UNIT_TOKENS.map(([t]) => t).join('|');
const AFTER_LABEL = new RegExp(`단위\\s*[:：]?\\s*[\\(\\[]?\\s*(${TOKEN_ALT})`);
const BARE = new RegExp(`^[\\(\\[]?\\s*(${TOKEN_ALT})\\s*[\\)\\]]?$`);

export type UnitNote =
  | { kind: 'none' }
  | { kind: 'unit'; label: string; factor: number }
  | { kind: 'unknown' };

export function parseUnitNote(rm: string): UnitNote {
  const t = rm.trim();
  if (t === '' || t === '-') return { kind: 'none' };
  const m = t.match(AFTER_LABEL) ?? t.match(BARE);
  if (m) {
    const hit = UNIT_TOKENS.find(([tok]) => tok === m[1])!;
    return { kind: 'unit', label: hit[0], factor: hit[1] };
  }
  if (t.includes('단위')) return { kind: 'unknown' };
  return { kind: 'none' }; // 단위와 무관한 비고
}

function hasSalaryValue(r: ClassifiedRow): boolean {
  return parseAmount(r.fyer_salary_totamt).kind !== 'null' || parseAmount(r.jan_salary_am).kind !== 'null';
}

/** 급여 값이 있는 행들의 비고만 본다(PRD 6.3). */
export function resolveUnit(rows: ClassifiedRow[]): UnitInfo {
  const salaryRows = rows.filter(hasSalaryValue);
  if (salaryRows.length === 0) {
    return { status: 'OK', factor: 1, label: '원', note: '급여 값이 있는 행 없음 → 원 단위 기준' };
  }
  const notes = salaryRows.map((r) => parseUnitNote(r.rm));
  if (notes.some((n) => n.kind === 'unknown')) {
    return {
      status: 'HOLD', factor: 1, label: '?',
      note: '비고에 인식할 수 없는 단위 표기',
      reasonCode: 'UNIT_UNKNOWN',
      reason: '비고에 "단위"라는 표기가 있으나 인식 가능한 단위(원·천원·만원·백만원·억원)가 아닙니다.',
    };
  }
  const units = new Map<string, number>();
  for (const n of notes) if (n.kind === 'unit') units.set(n.label, n.factor);
  if (units.size > 1) {
    return {
      status: 'HOLD', factor: 1, label: '혼재',
      note: `단위 표기 혼재: ${[...units.keys()].join(', ')}`,
      reasonCode: 'UNIT_MIXED',
      reason: `급여 행마다 단위 표기가 다릅니다(${[...units.keys()].join(', ')}). 원화 값·격차를 보류합니다.`,
    };
  }
  if (units.size === 1) {
    if (notes.some((n) => n.kind === 'none')) {
      return {
        status: 'HOLD', factor: 1, label: '일부만 표기',
        note: '일부 행에만 단위 표기가 있음',
        reasonCode: 'UNIT_PARTIAL',
        reason: '일부 급여 행에만 단위 표기가 있어 적용 범위를 원본 근거로 판정할 수 없습니다.',
      };
    }
    const [label, factor] = [...units.entries()][0];
    return { status: 'OK', factor, label, note: `비고 단위 표기: ${label} → 원 단위로 환산(×${factor.toLocaleString('ko-KR')})` };
  }
  return { status: 'OK', factor: 1, label: '원', note: '비고 단위 표기 없음 → 원 단위로 처리' };
}
