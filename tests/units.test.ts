import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseUnitNote } from '../src/lib/validate/units';
import { parseAmount } from '../src/lib/parse';

describe('단위 표기 판독(화이트리스트)', () => {
  it.each([
    ['단위: 원', 1], ['(단위 : 천원)', 1_000], ['단위:만원', 10_000], ['단위 : 백만원', 1_000_000], ['(단위:억원)', 100_000_000],
    ['백만원', 1_000_000], ['(천원)', 1_000],
  ])('%s → ×%d', (rm, factor) => {
    const n = parseUnitNote(rm);
    expect(n.kind).toBe('unit');
    if (n.kind === 'unit') expect(n.factor).toBe(factor);
  });
  it('단위라는 말은 있으나 목록 밖이면 unknown', () => {
    expect(parseUnitNote('단위: 달러').kind).toBe('unknown');
    expect(parseUnitNote('단위: 십억원').kind).toBe('unknown');
  });
  it('단위와 무관한 비고·"-"·빈 값은 none', () => {
    expect(parseUnitNote('-').kind).toBe('none');
    expect(parseUnitNote('').kind).toBe('none');
    expect(parseUnitNote('기간제 근로자 포함').kind).toBe('none');
  });
});

describe('숫자 파싱', () => {
  it('쉼표 제거, -와 빈 문자열은 결측, 이상한 문자열은 bad(추정 금지)', () => {
    expect(parseAmount('1,234')).toEqual({ kind: 'num', v: 1234 });
    expect(parseAmount('-')).toEqual({ kind: 'null' });
    expect(parseAmount('')).toEqual({ kind: 'null' });
    expect(parseAmount('12억')).toEqual({ kind: 'bad' });
  });
});

describe('PRD 단계 2 코드 검색 기준', () => {
  const dir = path.join(process.cwd(), 'src', 'lib', 'validate');
  it('단위 판정 코드에 값의 크기를 쓰는 비교가 없다', () => {
    const src = fs.readFileSync(path.join(dir, 'units.ts'), 'utf-8');
    expect(src).not.toMatch(/\.v\s*[<>]/);
    expect(src).not.toMatch(/Math\.(log|abs)/);
    expect(src).not.toMatch(/자릿수|magnitude/);
  });
  it('전체 평균을 남·여 평균으로 역산하는 코드가 없다', () => {
    const src = fs.readFileSync(path.join(dir, 'structure.ts'), 'utf-8');
    expect(src).not.toMatch(/jan_salary_am[^\n]*\*[^\n]*sm/);
    expect(src).toMatch(/NO_OVERALL_ROW/);
  });
});
