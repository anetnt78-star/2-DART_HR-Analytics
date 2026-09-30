/**
 * 단계 0: empSttus 원본 확인.
 *   npm run inspect:emp -- 삼성전자 현대자동차 2025
 * 인자: 회사명(또는 8자리 고유번호) 여러 개 + 마지막에 사업연도(선택, 기본 최신 연도).
 * 출력 열: fo_bbm, sexdstn, sm, fyer_salary_totamt, jan_salary_am, stlm_dt, rm (키는 저장·출력하지 않음)
 * 원본은 data/raw/에 저장된다(.gitignore 대상).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fetchEmpSttus } from '../src/lib/dart/client';
import { searchCorpIndex } from '../src/lib/dart/corpIndex';
import { classifyRows } from '../src/lib/validate/structure';
import { LIVE_YEARS } from '../src/lib/dart/source';

async function main() {
  const args = process.argv.slice(2);
  const last = args[args.length - 1];
  const year = /^\d{4}$/.test(last ?? '') ? Number(args.pop()) : LIVE_YEARS[0];
  if (args.length === 0) {
    console.error('사용법: npm run inspect:emp -- 회사명 [회사명 ...] [연도]');
    process.exit(1);
  }

  const outDir = path.join(process.cwd(), 'data', 'raw');
  fs.mkdirSync(outDir, { recursive: true });

  for (const arg of args) {
    const code = /^\d{8}$/.test(arg) ? arg : searchCorpIndex(arg, 1)?.[0]?.code;
    if (!code) {
      console.error(`\n[${arg}] 회사를 찾지 못했습니다. 먼저 npm run build:corp-index 를 실행하거나 8자리 고유번호를 쓰세요.`);
      continue;
    }
    const rows = await fetchEmpSttus(code, year);
    fs.writeFileSync(path.join(outDir, `emp_${code}_${year}.json`), JSON.stringify(rows, null, 2));
    console.log(`\n=== ${arg} (${code}) ${year} · ${rows.length}행 ===`);
    console.table(
      classifyRows(rows).map((r) => ({
        '#': r.index + 1, fo_bbm: r.fo_bbm, sexdstn: r.sexdstn, sm: r.sm,
        fyer_salary_totamt: r.fyer_salary_totamt, jan_salary_am: r.jan_salary_am, stlm_dt: r.stlm_dt, rm: r.rm, 분류: r.cls,
      })),
    );
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
