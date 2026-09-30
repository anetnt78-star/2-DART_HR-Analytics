import fs from 'node:fs';
import path from 'node:path';
import type { CompanyInfo, EmpRowRaw, FsDiv, FsRowRaw } from '../types';
import { fetchEmpSttus, fetchFinancials } from './client';
import { corpNameFromIndex, searchCorpIndex, loadCorpIndex } from './corpIndex';

export type Mode = 'synthetic' | 'live';

export interface DataSource {
  mode: Mode;
  years: number[];
  search(q: string): Promise<{ companies: CompanyInfo[]; hint?: string }>;
  companyName(code: string): string | null;
  fsDivFor(code: string): FsDiv;
  emp(code: string, year: number): Promise<EmpRowRaw[]>;
  revenueRows(code: string, year: number, fsDiv: FsDiv): Promise<FsRowRaw[]>;
}

// ── 합성 예시 ───────────────────────────────────────────────
interface Fixture {
  caseId: string;
  corp_code: string;
  corp_name: string;
  description: string;
  year: number;
  fsDiv: FsDiv;
  emp: EmpRowRaw[];
  revenue: Partial<Record<FsDiv, FsRowRaw[]>>;
  expect: Record<string, unknown>;
}

export const FIXTURE_DIR = path.join(process.cwd(), 'fixtures', 'synthetic');
let fixtureMemo: Fixture[] | null = null;

export function loadFixtures(): Fixture[] {
  if (fixtureMemo) return fixtureMemo;
  fixtureMemo = fs
    .readdirSync(FIXTURE_DIR)
    .filter((f) => /^F\d+\.json$/.test(f))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, f), 'utf-8')) as Fixture);
  return fixtureMemo;
}

export const syntheticSource: DataSource = {
  mode: 'synthetic',
  years: [2025],
  async search(q) {
    const s = q.trim();
    const all = loadFixtures().map((f) => ({ code: f.corp_code, name: f.corp_name, note: `${f.caseId} · ${f.description}` }));
    return { companies: s ? all.filter((c) => c.name.includes(s) || c.note.includes(s) || c.code === s) : all };
  },
  companyName: (code) => loadFixtures().find((f) => f.corp_code === code)?.corp_name ?? null,
  fsDivFor: (code) => loadFixtures().find((f) => f.corp_code === code)?.fsDiv ?? 'OFS',
  async emp(code, year) {
    const f = loadFixtures().find((x) => x.corp_code === code);
    return f && f.year === year ? f.emp : [];
  },
  async revenueRows(code, year, fsDiv) {
    const f = loadFixtures().find((x) => x.corp_code === code);
    return f && f.year === year ? (f.revenue[fsDiv] ?? []) : [];
  },
};

// ── 실제 DART ──────────────────────────────────────────────
const thisYear = new Date().getFullYear();
export const LIVE_YEARS = Array.from({ length: thisYear - 1 - 2015 + 1 }, (_, i) => thisYear - 1 - i); // 최신 → 2015

export const liveSource: DataSource = {
  mode: 'live',
  years: LIVE_YEARS,
  async search(q) {
    const s = q.trim();
    if (/^\d{8}$/.test(s)) return { companies: [{ code: s, name: corpNameFromIndex(s) ?? `고유번호 ${s}` }] };
    const found = searchCorpIndex(s);
    if (found === null) {
      return { companies: [], hint: '상장사 인덱스가 없습니다. 터미널에서 `npm run build:corp-index`를 실행하거나 8자리 고유번호를 직접 입력하세요.' };
    }
    return { companies: found };
  },
  companyName: (code) => corpNameFromIndex(code),
  fsDivFor: () => 'OFS', // 기본 매출 범위는 별도(OFS) — 직원 수 범위와 일치(PRD 4.3)
  emp: (code, year) => fetchEmpSttus(code, year),
  revenueRows: (code, year, fsDiv) => fetchFinancials(code, year, fsDiv),
};

export function getSource(mode: Mode): DataSource {
  return mode === 'live' ? liveSource : syntheticSource;
}

export function hasCorpIndex(): boolean {
  return loadCorpIndex() !== null;
}
