import { buildCorpIndex } from '../src/lib/dart/buildIndex';

async function main() {
  try {
    const r = await buildCorpIndex();
    console.log(`기업 인덱스 저장: 전체 ${r.total.toLocaleString()}개 (상장사 ${r.listed.toLocaleString()}개) → ${r.path}`);
  } catch (e) {
    console.error('실패:', e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
