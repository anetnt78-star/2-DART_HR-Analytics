import type { FsDiv, FsRowRaw, Metric } from '../types';
import { parseAmount, str } from '../parse';
import { metric, notOk } from '../metric';

/** 매출 계정 매핑표. 정확히 1개 매칭되어야 한다. (현대자동차 OFS 2025 확인: IS / ifrs-full_Revenue / 매출액) */
export const REVENUE_ACCOUNT_NAMES = ['매출액', '수익(매출액)', '영업수익'];
const REVENUE_SJ = ['IS', 'CIS'];

export function analyzeRevenue(rows: FsRowRaw[] | null | undefined, fsDiv: FsDiv, year: number): Metric {
  const formula = `${fsDiv} 손익계산서 매출 계정(${REVENUE_ACCOUNT_NAMES.join('/')}) 당기금액`;
  const rcept = rows && rows[0] ? str(rows[0].rcept_no) : '?';
  const source = `fnlttSinglAcntAll/rcept_no=${rcept}/bsns_year=${year}/fs_div=${fsDiv}`;
  if (!rows || rows.length === 0) {
    return notOk('MISSING', '원', formula, source, 'NO_DATA', '원본에 없음(조회된 재무제표 없음)');
  }
  const years = new Set(rows.map((r) => str(r.bsns_year)).filter(Boolean));
  if (years.size > 0 && (years.size > 1 || !years.has(String(year)))) {
    return notOk('HOLD', '원', formula, source, 'YEAR_MISMATCH', `재무제표 사업연도(${[...years].join(',')})가 선택 연도(${year})와 다릅니다.`);
  }
  const matches = rows.filter(
    (r) => REVENUE_SJ.includes(str(r.sj_div)) && REVENUE_ACCOUNT_NAMES.includes(str(r.account_nm).replace(/\s+/g, '')),
  );
  if (matches.length === 0) return notOk('MISSING', '원', formula, source, 'NO_REVENUE_ACCOUNT', '원본에 없음(매출 계정 매핑 0개)');
  if (matches.length > 1) {
    return notOk('HOLD', '원', formula, source, 'AMBIGUOUS_REVENUE', `매출 계정이 ${matches.length}개 매칭되어 하나로 정할 수 없습니다.`);
  }
  const m = matches[0];
  const cur = str(m.currency);
  if (cur !== 'KRW') {
    return notOk('HOLD', '원', formula, source, 'CURRENCY', `통화가 KRW로 확인되지 않습니다(${cur || '없음'}).`);
  }
  const p = parseAmount(m.thstrm_amount);
  if (p.kind === 'null') return notOk('MISSING', '원', formula, source, 'NO_VALUE', '원본에 없음(당기금액 없음)');
  if (p.kind === 'bad') return notOk('HOLD', '원', formula, source, 'PARSE_ERROR', '숫자로 읽을 수 없는 값');
  if (p.v < 0) return notOk('HOLD', '원', formula, source, 'NEGATIVE', '음수 매출');
  return metric('OK', p.v, '원', formula, source, { notes: [`계정: ${str(m.account_nm)} (${str(m.account_id) || 'id 없음'})`, '재무제표 금액은 원 단위(KRW)로 확인'] });
}
