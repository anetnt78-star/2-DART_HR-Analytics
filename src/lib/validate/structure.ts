import type {
  Check, ClassifiedRow, EmpAnalysis, EmpRowRaw, Metric, RowClass, Structure,
} from '../types';
import { parseAmount, str } from '../parse';
import { metric, notOk } from '../metric';
import { resolveUnit } from './units';

const NO_DIVISION = '(부문 없음)';
const TOTAL_LABEL = '성별합계'; // 2개 기업 원본 확인: 합계는 sexdstn이 아니라 fo_bbm에 온다.

const STRUCTURE_LABEL: Record<Structure, string> = {
  A: 'A. 단일 부문',
  B: 'B. 다부문 상세(합계 행 없음)',
  C: 'C. 성별합계 행 + 부문 상세',
  T: 'T. 성별합계 행만(상세 없음)',
  D: 'D. 미분류',
  NONE: '데이터 없음',
};

export function classifyRows(raw: EmpRowRaw[]): ClassifiedRow[] {
  return raw.map((r, index) => {
    const fo = str(r.fo_bbm);
    const sex = str(r.sexdstn);
    let cls: RowClass;
    if (sex !== '남' && sex !== '여') cls = 'UNCLASSIFIED';
    else if (fo === TOTAL_LABEL) cls = 'TOTAL';
    else if (/합계|총계|전체/.test(fo)) cls = 'UNCLASSIFIED'; // 인식되지 않은 합계 성격
    else cls = 'DETAIL';
    return {
      index,
      fo_bbm: fo === '' || fo === '-' ? NO_DIVISION : fo,
      sexdstn: sex,
      sm: str(r.sm),
      fyer_salary_totamt: str(r.fyer_salary_totamt),
      jan_salary_am: str(r.jan_salary_am),
      stlm_dt: str(r.stlm_dt),
      rm: str(r.rm),
      cls,
    };
  });
}

interface Fatal { code: string; reason: string }

const won = (n: number) => n.toLocaleString('ko-KR');

export function analyzeEmp(raw: EmpRowRaw[] | null | undefined): EmpAnalysis {
  const rceptNos = new Set((raw ?? []).map((r) => str(r.rcept_no)).filter(Boolean));
  const rceptNo = rceptNos.size === 1 ? [...rceptNos][0] : null;
  const rows = classifyRows(raw ?? []);
  const checks: Check[] = [];
  const stlmSet = new Set(rows.map((r) => r.stlm_dt).filter(Boolean));
  const stlmDt = stlmSet.size === 1 ? [...stlmSet][0] : null;
  const source = `empSttus/rcept_no=${rceptNo ?? '?'}/stlm_dt=${stlmDt ?? '?'}`;

  const emptyDisclosed = (m: Metric) => ({ male: m, female: m, overall: m });

  // ── 데이터 없음 ─────────────────────────────────────────────
  if (rows.length === 0) {
    const m = (unit: string, formula: string) =>
      notOk('MISSING', unit, formula, source, 'NO_DATA', '원본에 없음(조회된 직원 현황 데이터 없음)');
    return {
      structure: 'NONE', structureLabel: STRUCTURE_LABEL.NONE, rows, checks,
      headcount: m('명', '남 sm + 여 sm'),
      headcountByGender: { male: null, female: null },
      payroll: m('원', '남 fyer_salary_totamt + 여 fyer_salary_totamt'),
      unit: { status: 'OK', factor: 1, label: '원', note: '데이터 없음' },
      disclosedAvg: emptyDisclosed(m('원', '공시값')),
      stlmDt: null, rceptNo: null,
    };
  }

  const details = rows.filter((r) => r.cls === 'DETAIL');
  const totals = rows.filter((r) => r.cls === 'TOTAL');
  const unclassified = rows.filter((r) => r.cls === 'UNCLASSIFIED');
  const divisions = new Set(details.map((r) => r.fo_bbm));

  let structure: Structure;
  if (unclassified.length > 0) structure = 'D';
  else if (totals.length > 0 && details.length > 0) structure = 'C';
  else if (totals.length > 0) structure = 'T';
  else if (divisions.size <= 1) structure = 'A';
  else structure = 'B';

  // ── 구조 검사 (치명적 문제는 첫 번째만 대표 사유로 쓰고, 나머지도 검사표에 남긴다) ─────
  const fatals: Fatal[] = [];

  checks.push({
    id: 'classification', label: '행 분류(남/여·합계 인식)',
    pass: unclassified.length === 0,
    detail: unclassified.length === 0
      ? `상세 ${details.length}행 · 성별합계 ${totals.length}행`
      : `인식할 수 없는 행 ${unclassified.length}개: ` +
        unclassified.map((r) => `#${r.index + 1}(${r.fo_bbm}/${r.sexdstn || '∅'})`).join(', '),
  });
  if (unclassified.length > 0) {
    fatals.push({ code: 'UNCLASSIFIED', reason: '남/여가 아닌 성별 값 또는 인식되지 않은 합계 행이 있어 사람이 원본을 검토해야 합니다.' });
  }

  checks.push({
    id: 'filing', label: '단일 공시(접수번호)', pass: rceptNos.size <= 1,
    detail: rceptNos.size <= 1 ? `rcept_no=${rceptNo ?? '없음'}` : `접수번호 ${rceptNos.size}개 혼재`,
  });
  if (rceptNos.size > 1) fatals.push({ code: 'FILING_MIXED', reason: '서로 다른 접수번호의 행이 섞여 있습니다.' });

  checks.push({
    id: 'period', label: '결산 기준일 일치(stlm_dt)', pass: stlmSet.size <= 1,
    detail: stlmSet.size <= 1 ? (stlmDt ?? '결산 기준일 없음') : `서로 다른 결산일: ${[...stlmSet].join(', ')}`,
  });
  if (stlmSet.size > 1) fatals.push({ code: 'PERIOD_MIXED', reason: '행마다 결산 기준일이 다릅니다.' });

  // 중복
  const seen = new Map<string, number>();
  for (const r of rows) {
    if (r.cls === 'UNCLASSIFIED') continue;
    const k = `${r.cls}|${r.fo_bbm}|${r.sexdstn}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const dups = [...seen.entries()].filter(([, n]) => n > 1);
  checks.push({
    id: 'duplicate', label: '중복 행(부문×성별)', pass: dups.length === 0,
    detail: dups.length === 0 ? '중복 없음' : dups.map(([k, n]) => `${k.split('|').slice(1).join('/')} ×${n}`).join(', '),
  });
  if (dups.length) fatals.push({ code: 'DUPLICATE', reason: `같은 (부문, 성별) 행이 중복됩니다: ${dups.map(([k]) => k.split('|').slice(1).join('/')).join(', ')}. 자동 병합하지 않습니다.` });

  // 누락 (부문마다 남·여, 합계 행도 남·여)
  const missing: string[] = [];
  for (const d of divisions) {
    for (const g of ['남', '여']) {
      if (!details.some((r) => r.fo_bbm === d && r.sexdstn === g)) missing.push(`${d}/${g}`);
    }
  }
  if (totals.length > 0) {
    for (const g of ['남', '여']) {
      if (!totals.some((r) => r.sexdstn === g)) missing.push(`${TOTAL_LABEL}/${g}`);
    }
  }
  checks.push({
    id: 'completeness', label: '누락 행(남·여 짝)', pass: missing.length === 0,
    detail: missing.length === 0 ? '남·여 행이 모두 있음' : `없는 행: ${missing.join(', ')}`,
  });
  if (missing.length) fatals.push({ code: 'MISSING_ROW', reason: `필요한 행이 없습니다: ${missing.join(', ')}.` });

  // 값 파싱·음수·결측 (직원 수)
  const used = [...details, ...totals];
  const smVals = used.map((r) => ({ r, p: parseAmount(r.sm) }));
  const badParse = used.some((r) => parseAmount(r.sm).kind === 'bad' || parseAmount(r.fyer_salary_totamt).kind === 'bad');
  const smMissing = smVals.filter((x) => x.p.kind === 'null').length;
  const smNegative = smVals.some((x) => x.p.kind === 'num' && x.p.v < 0);
  checks.push({
    id: 'values', label: '핵심 값(sm) 형식·결측·음수',
    pass: !badParse && smMissing === 0 && !smNegative,
    detail: badParse ? '숫자로 읽을 수 없는 값이 있음' : smMissing ? `sm 결측 ${smMissing}행` : smNegative ? '음수 값' : '정상',
  });
  if (badParse) fatals.push({ code: 'PARSE_ERROR', reason: '숫자로 읽을 수 없는 값이 있어 추정하지 않고 보류합니다.' });
  else if (smMissing) fatals.push({ code: 'MISSING_VALUE', reason: `직원 수(sm)가 결측인 행이 ${smMissing}개 있습니다.` });
  else if (smNegative) fatals.push({ code: 'NEGATIVE', reason: '음수 직원 수가 있습니다.' });

  // 직원 수 교차 검증(합계 행 ↔ 상세 합) — 이중 계산 금지: 한쪽만 쓰고 다른 쪽은 대조용
  const sumSm = (list: ClassifiedRow[]) =>
    list.reduce((s, r) => {
      const p = parseAmount(r.sm);
      return s + (p.kind === 'num' ? p.v : 0);
    }, 0);
  const detailSum = details.length ? sumSm(details) : null;
  const totalSum = totals.length ? sumSm(totals) : null;
  if (detailSum !== null && totalSum !== null) {
    const ok = detailSum === totalSum;
    checks.push({
      id: 'headcount-cross', label: '직원 수: 성별합계 ↔ 부문 상세 합', pass: ok,
      detail: ok ? `일치 (${won(detailSum)}명, 상세 합만 사용)` : `불일치: 상세 합 ${won(detailSum)}명 ≠ 성별합계 ${won(totalSum)}명 (차이 ${won(Math.abs(detailSum - totalSum))}명)`,
    });
    if (!ok) fatals.push({ code: 'CONFLICT', reason: `성별합계(${won(totalSum)}명)와 부문 상세 합(${won(detailSum)}명)이 다릅니다(차이 ${won(Math.abs(detailSum - totalSum))}명).` });
  } else {
    checks.push({ id: 'headcount-cross', label: '직원 수: 성별합계 ↔ 부문 상세 합', pass: null, detail: '두 종류 행이 함께 없어 대조 불가' });
  }

  // 단위 (급여 값이 있는 행 기준)
  const unit = resolveUnit(rows);
  checks.push({
    id: 'unit', label: '급여 단위(비고 rm)', pass: unit.status === 'OK',
    detail: unit.status === 'OK' ? unit.note : (unit.reason ?? unit.note),
  });

  const fatal = fatals[0] ?? null;

  // ── 직원 수 ───────────────────────────────────────────────
  const hcFormula = details.length
    ? '부문 상세 남 sm + 여 sm 합' + (totals.length ? ' (성별합계 행과 일치 확인, 이중 합산 없음)' : '')
    : '성별합계 남 sm + 여 sm (상세 행 없어 대조 불가)';
  let headcount: Metric;
  let headcountByGender = { male: null as number | null, female: null as number | null };
  if (fatal) {
    headcount = notOk('HOLD', '명', hcFormula, source, fatal.code, fatal.reason);
  } else {
    const basis = details.length ? details : totals;
    const total = sumSm(basis);
    const by = (g: string) => sumSm(basis.filter((r) => r.sexdstn === g));
    headcountByGender = { male: by('남'), female: by('여') };
    const notes = totals.length > 0 && details.length === 0 ? ['상세 행이 없어 성별합계 값을 검증 없이 사용'] : [];
    headcount = total === 0
      ? notOk('HOLD', '명', hcFormula, source, 'ZERO_HEADCOUNT', '직원 수가 0명이라 검증할 수 없고, 나누기 지표를 계산하지 않습니다.', notes)
      : metric('OK', total, '명', hcFormula, source, { notes });
  }

  // ── 연간급여총액 ──────────────────────────────────────────
  const payFormula = '남 fyer_salary_totamt + 여 fyer_salary_totamt (원 단위 환산 후 합산)';
  const fy = (r: ClassifiedRow) => parseAmount(r.fyer_salary_totamt);
  const allNum = (list: ClassifiedRow[]) => list.length > 0 && list.every((r) => fy(r).kind === 'num');
  const anyNum = (list: ClassifiedRow[]) => list.some((r) => fy(r).kind === 'num');
  const sumFy = (list: ClassifiedRow[]) => list.reduce((s, r) => { const p = fy(r); return s + (p.kind === 'num' ? p.v : 0); }, 0);

  let payroll: Metric;
  const payNotes: string[] = [];
  if (fatal) {
    payroll = notOk('HOLD', '원', payFormula, source, fatal.code, fatal.reason);
  } else if (unit.status === 'HOLD') {
    payroll = notOk('HOLD', '원', payFormula, source, unit.reasonCode!, unit.reason!);
  } else if (!anyNum(totals) && !anyNum(details)) {
    payroll = notOk('MISSING', '원', payFormula, source, 'NO_SALARY', '원본에 없음(연간급여총액 값 없음)');
  } else {
    const totComplete = allNum(totals);
    const detComplete = allNum(details);
    let raw: number | null = null;
    let basisLabel = '';
    let bad: Fatal | null = null;

    if (totals.length && anyNum(totals) && !totComplete) {
      bad = { code: 'PARTIAL_SALARY', reason: '성별합계 행 중 일부만 연간급여총액이 있어 완전한 총액을 만들 수 없습니다.' };
    } else if (totComplete) {
      raw = sumFy(totals);
      basisLabel = '성별합계 행';
      if (anyNum(details)) {
        if (detComplete) {
          const dSum = sumFy(details);
          const ok = dSum === raw;
          checks.push({
            id: 'salary-cross', label: '급여총액: 성별합계 ↔ 부문 상세 합', pass: ok,
            detail: ok ? '일치' : `불일치: 상세 합 ${won(dSum)} ≠ 성별합계 ${won(raw)} (환산 전 값)`,
          });
          if (!ok) bad = { code: 'CONFLICT', reason: `성별합계 급여총액(${won(raw)})과 부문 상세 합(${won(dSum)})이 다릅니다(환산 전 값).` };
        } else {
          payNotes.push('부문 상세 행은 급여가 일부만 있어 성별합계 행 값을 사용(이중 합산 없음)');
        }
      }
    } else if (detComplete) {
      raw = sumFy(details);
      basisLabel = '부문 상세 행';
    } else {
      bad = { code: 'PARTIAL_SALARY', reason: '일부 행에만 연간급여총액이 있어 완전한 총액을 만들 수 없습니다.' };
    }

    if (!bad && raw !== null && raw < 0) bad = { code: 'NEGATIVE', reason: '음수 연간급여총액입니다.' };

    if (bad) payroll = notOk('HOLD', '원', payFormula, source, bad.code, bad.reason);
    else {
      payNotes.push(`합산 기준: ${basisLabel}`, unit.note);
      payroll = metric('OK', raw! * unit.factor, '원', payFormula, source, { notes: [...payNotes, `환산 전 합 ${won(raw!)} × ${won(unit.factor)}`] });
    }
  }
  if (!checks.some((c) => c.id === 'salary-cross')) {
    checks.push({ id: 'salary-cross', label: '급여총액: 성별합계 ↔ 부문 상세 합', pass: null, detail: '두 종류 모두 완전한 값이 없어 대조 불가' });
  }

  // ── 공시 1인평균급여(남/여) — 공시값 그대로, 역산·평균 금지 ────────────
  const gender = (g: '남' | '여'): Metric => {
    const f = `공시 jan_salary_am(${g})`;
    if (fatal) return notOk('HOLD', '원', f, source, fatal.code, fatal.reason);
    const src = totals.find((r) => r.sexdstn === g) ?? (divisions.size === 1 ? details.find((r) => r.sexdstn === g) : undefined);
    if (!src) return notOk('MISSING', '원', f, source, 'NO_SINGLE_ROW', `성별 단일 공시값 없음(부문별 값만 있어 합치지 않음)`);
    const p = parseAmount(src.jan_salary_am);
    if (p.kind === 'bad') return notOk('HOLD', '원', f, source, 'PARSE_ERROR', '숫자로 읽을 수 없는 값');
    if (p.kind === 'null') return notOk('MISSING', '원', f, source, 'NO_VALUE', '원본에 없음');
    if (unit.status === 'HOLD') return notOk('HOLD', '원', f, source, unit.reasonCode!, unit.reason!);
    if (p.v < 0) return notOk('HOLD', '원', f, source, 'NEGATIVE', '음수 값');
    return metric('OK', p.v * unit.factor, '원', f, `${source}/row#${src.index + 1}(${src.fo_bbm}/${g})`, { notes: [`공시값 그대로(환산 전 ${won(p.v)})`] });
  };
  const overall = notOk('MISSING', '원', '공시 전체 평균(성별 구분 없는 행)', source, 'NO_OVERALL_ROW',
    '원본에 없음(성별 구분 없는 전체 평균 행이 없음 — 남·여 평균으로 역산하지 않음)');

  return {
    structure, structureLabel: STRUCTURE_LABEL[structure], rows, checks,
    headcount, headcountByGender, payroll, unit,
    disclosedAvg: { male: gender('남'), female: gender('여'), overall },
    stlmDt, rceptNo,
  };
}
