import type { CompanyResult, ComparisonResult } from './types';
import type { DataSource } from './dart/source';
import { DartError } from './dart/client';
import { analyzeEmp } from './validate/structure';
import { analyzeRevenue } from './validate/revenue';
import { buildCompanyMetrics, computeGaps } from './metrics';

async function analyzeCompany(src: DataSource, code: string, year: number): Promise<CompanyResult> {
  const fsDiv = src.fsDivFor(code);
  const fallbackName = src.companyName(code) ?? code;
  try {
    // 직원 현황과 재무제표는 서로 독립적으로 조회한다.
    const [empRows, fsRes] = await Promise.all([
      src.emp(code, year),
      src.revenueRows(code, year, fsDiv).then(
        (rows) => ({ rows, err: null as null | DartError }),
        (err) => ({ rows: [], err: err as DartError }),
      ),
    ]);
    const emp = analyzeEmp(empRows);
    const name = (empRows[0]?.corp_name as string | undefined)?.trim() || fallbackName;
    // 재무제표 조회 실패(인증·제한 등)는 empSttus와 달리 매출만 보류로 처리하지 않고 오류를 그대로 알린다.
    if (fsRes.err && fsRes.err.kind !== 'BAD_REQUEST') throw fsRes.err;
    const revenue = analyzeRevenue(fsRes.rows, fsDiv, year);
    return { corp: { code, name }, fsDiv, emp, metrics: buildCompanyMetrics(emp, revenue, fsDiv, year) };
  } catch (e) {
    const err = e instanceof DartError ? e : new DartError('UNKNOWN', e instanceof Error ? e.message : '알 수 없는 오류');
    return { corp: { code, name: fallbackName }, fsDiv, error: { kind: err.kind, message: err.message } };
  }
}

export async function compareCompanies(
  src: DataSource,
  input: { a: string; b: string; year: number },
): Promise<ComparisonResult> {
  const [A, B] = await Promise.all([analyzeCompany(src, input.a, input.year), analyzeCompany(src, input.b, input.year)]);
  const gaps =
    A.metrics && B.metrics && A.emp && B.emp
      ? computeGaps(
          { metrics: A.metrics, stlmDt: A.emp.stlmDt, fsDiv: A.fsDiv },
          { metrics: B.metrics, stlmDt: B.emp.stlmDt, fsDiv: B.fsDiv },
        )
      : [];
  return { mode: src.mode, year: input.year, A, B, gaps, generatedAt: new Date().toISOString() };
}

/** 같은 조건의 반복 요청(브리핑·대화)에서 재조회하지 않도록 서버 메모리에 짧게 캐시 */
const resultCache = new Map<string, { at: number; value: ComparisonResult }>();
export async function compareCached(
  src: DataSource,
  input: { a: string; b: string; year: number },
): Promise<ComparisonResult> {
  const key = `${src.mode}|${input.a}|${input.b}|${input.year}`;
  const hit = resultCache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.value;
  const value = await compareCompanies(src, input);
  // 오류가 섞인 결과는 캐시하지 않는다(재시도 가능).
  if (!value.A.error && !value.B.error) resultCache.set(key, { at: Date.now(), value });
  return value;
}
