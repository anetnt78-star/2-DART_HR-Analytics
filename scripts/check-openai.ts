import { checkOpenAi } from '../src/lib/checks';

async function main() {
  const r = await checkOpenAi();
  for (const s of r.steps) console.log(`${s.ok ? '✅' : '❌'} ${s.name} — ${s.detail}`);
  console.log(r.ok ? '\nOpenAI 점검 통과' : '\nOpenAI 점검 실패 (위 항목 확인)');
  process.exit(r.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
