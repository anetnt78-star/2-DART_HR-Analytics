export type Status = 'OK' | 'HOLD' | 'MISSING' | 'NOT_COMPARABLE';

export interface Metric {
  value: number | null;
  unit: string;
  status: Status;
  formula: string;
  source: string;
  reasonCode?: string;
  reason?: string;
  notes: string[];
}

/** DART empSttus 원본 행(문자열 그대로). 필요한 필드만 타입에 둔다. */
export interface EmpRowRaw {
  rcept_no?: string;
  corp_code?: string;
  corp_name?: string;
  fo_bbm?: string;
  sexdstn?: string;
  sm?: string;
  fyer_salary_totamt?: string;
  jan_salary_am?: string;
  stlm_dt?: string;
  rm?: string;
  [k: string]: unknown;
}

/** DART fnlttSinglAcntAll 원본 행 */
export interface FsRowRaw {
  rcept_no?: string;
  bsns_year?: string;
  sj_div?: string;
  account_id?: string;
  account_nm?: string;
  thstrm_amount?: string;
  currency?: string;
  [k: string]: unknown;
}

export type RowClass = 'DETAIL' | 'TOTAL' | 'UNCLASSIFIED';
export type Structure = 'A' | 'B' | 'C' | 'T' | 'D' | 'NONE';
export type FsDiv = 'OFS' | 'CFS';

export interface ClassifiedRow {
  index: number;
  fo_bbm: string;
  sexdstn: string;
  sm: string;
  fyer_salary_totamt: string;
  jan_salary_am: string;
  stlm_dt: string;
  rm: string;
  cls: RowClass;
}

export interface Check {
  id: string;
  label: string;
  /** true 통과, false 실패, null 해당 없음 */
  pass: boolean | null;
  detail: string;
}

export interface UnitInfo {
  status: 'OK' | 'HOLD';
  factor: number;
  label: string;
  note: string;
  reasonCode?: string;
  reason?: string;
}

export interface EmpAnalysis {
  structure: Structure;
  structureLabel: string;
  rows: ClassifiedRow[];
  checks: Check[];
  headcount: Metric;
  headcountByGender: { male: number | null; female: number | null };
  payroll: Metric;
  unit: UnitInfo;
  disclosedAvg: { male: Metric; female: Metric; overall: Metric };
  stlmDt: string | null;
  rceptNo: string | null;
}

export interface CompanyMetrics {
  headcount: Metric;
  payroll: Metric;
  perHeadPayroll: Metric;
  disclosedAvg: EmpAnalysis['disclosedAvg'];
  revenue: Metric;
  revenuePerHead: Metric;
}

export type GapMetric = 'headcount' | 'perHeadPayroll' | 'revenuePerHead';

export interface Gap {
  metric: GapMetric;
  base: 'A';
  target: 'B';
  diffAbs: number | null;
  diffPct: number | null;
  status: Status;
  reasonCode?: string;
  reason?: string;
}

export interface CompanyResult {
  corp: { code: string; name: string };
  error?: { kind: string; message: string };
  fsDiv: FsDiv;
  emp?: EmpAnalysis;
  metrics?: CompanyMetrics;
}

export interface ComparisonResult {
  mode: 'synthetic' | 'live';
  year: number;
  A: CompanyResult;
  B: CompanyResult;
  gaps: Gap[];
  generatedAt: string;
}

export interface CompanyInfo {
  code: string;
  name: string;
  stock?: string;
  note?: string;
}
