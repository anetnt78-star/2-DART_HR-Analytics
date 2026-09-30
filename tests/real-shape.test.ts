import { describe, expect, it } from 'vitest';
import { analyzeEmp } from '../src/lib/validate/structure';

/**
 * 단계 0에서 확인한 실제 empSttus 응답(2025 사업보고서)의 관련 필드만 옮긴 것.
 * 삼성전자: 부문(DX/DS) 상세 + fo_bbm="성별합계" 행 / 현대자동차: 단일 "자동차부문".
 */
const base = { stlm_dt: '2025-12-31', rm: '-' };
const samsung = (rcept = '20260310002820') => [
  { ...base, rcept_no: rcept, sexdstn: '남', fo_bbm: 'DX', sm: '38,119', fyer_salary_totamt: '-', jan_salary_am: '-' },
  { ...base, rcept_no: rcept, sexdstn: '여', fo_bbm: 'DX', sm: '12,698', fyer_salary_totamt: '-', jan_salary_am: '-' },
  { ...base, rcept_no: rcept, sexdstn: '남', fo_bbm: 'DS', sm: '56,154', fyer_salary_totamt: '-', jan_salary_am: '-' },
  { ...base, rcept_no: rcept, sexdstn: '여', fo_bbm: 'DS', sm: '21,910', fyer_salary_totamt: '-', jan_salary_am: '-' },
  { ...base, rcept_no: rcept, sexdstn: '남', fo_bbm: '성별합계', sm: '94,273', fyer_salary_totamt: '15,562,454,000,000', jan_salary_am: '167,000,000' },
  { ...base, rcept_no: rcept, sexdstn: '여', fo_bbm: '성별합계', sm: '34,608', fyer_salary_totamt: '4,237,308,000,000', jan_salary_am: '130,000,000' },
];
const hyundai = [
  { ...base, rcept_no: '20260318001394', sexdstn: '남', fo_bbm: '자동차부문', sm: '66,681', fyer_salary_totamt: '8,825,013,000,000', jan_salary_am: '132,000,000' },
  { ...base, rcept_no: '20260318001394', sexdstn: '여', fo_bbm: '자동차부문', sm: '5,917', fyer_salary_totamt: '695,296,000,000', jan_salary_am: '118,000,000' },
];

describe('실제 원본 형태(단계 0 확인)', () => {
  it('삼성전자형: 구조 C, 상세 합 = 성별합계 = 128,881명, 급여총액은 성별합계 행 사용', () => {
    const a = analyzeEmp(samsung());
    expect(a.structure).toBe('C');
    expect(a.headcount.status).toBe('OK');
    expect(a.headcount.value).toBe(128_881);
    expect(a.payroll.value).toBe(15_562_454_000_000 + 4_237_308_000_000);
    expect(a.disclosedAvg.male.value).toBe(167_000_000);
    expect(a.disclosedAvg.female.value).toBe(130_000_000);
    expect(a.disclosedAvg.overall.status).toBe('MISSING');
  });

  it('삼성전자형: 성별합계 직원 수가 상세 합과 다르면 HOLD(CONFLICT)', () => {
    const rows = samsung();
    rows[4].sm = '94,274';
    const a = analyzeEmp(rows);
    expect(a.headcount.status).toBe('HOLD');
    expect(a.headcount.reasonCode).toBe('CONFLICT');
    expect(a.payroll.status).toBe('HOLD');
  });

  it('현대자동차형: 구조 A, 남+여 합산', () => {
    const a = analyzeEmp(hyundai);
    expect(a.structure).toBe('A');
    expect(a.headcount.value).toBe(72_598);
    expect(a.payroll.value).toBe(8_825_013_000_000 + 695_296_000_000);
    expect(a.disclosedAvg.male.value).toBe(132_000_000);
  });

  it('sexdstn이 남/여가 아니면 구조 D로 HOLD', () => {
    const rows = [...hyundai, { ...base, rcept_no: '20260318001394', sexdstn: '계', fo_bbm: '자동차부문', sm: '72,598', fyer_salary_totamt: '-', jan_salary_am: '-' }];
    const a = analyzeEmp(rows);
    expect(a.structure).toBe('D');
    expect(a.headcount.status).toBe('HOLD');
  });

  it('데이터 없음(013)은 MISSING', () => {
    const a = analyzeEmp([]);
    expect(a.headcount.status).toBe('MISSING');
    expect(a.payroll.status).toBe('MISSING');
  });
});
