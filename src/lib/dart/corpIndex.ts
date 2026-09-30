import fs from 'node:fs';
import path from 'node:path';
import type { CompanyInfo } from '../types';

export const CORP_INDEX_PATH = path.join(process.cwd(), 'data', 'corp-index.json');

interface IndexFile { builtAt: string; corps: Array<{ code: string; name: string; stock: string }> }

let memo: { mtime: number; data: IndexFile } | null = null;

export function loadCorpIndex(): IndexFile | null {
  try {
    const st = fs.statSync(CORP_INDEX_PATH);
    if (memo && memo.mtime === st.mtimeMs) return memo.data;
    const data = JSON.parse(fs.readFileSync(CORP_INDEX_PATH, 'utf-8')) as IndexFile;
    memo = { mtime: st.mtimeMs, data };
    return data;
  } catch {
    return null;
  }
}

export function searchCorpIndex(q: string, limit = 15): CompanyInfo[] | null {
  const idx = loadCorpIndex();
  if (!idx) return null;
  const s = q.trim().toLowerCase();
  if (!s) return [];
  // 일치도(정확 > 접두 > 포함) 순, 같은 일치도에서는 상장사가 비상장보다 앞에 온다.
  const buckets: CompanyInfo[][] = [[], [], [], [], [], []];
  for (const c of idx.corps) {
    const n = c.name.toLowerCase();
    const tier = c.stock === s || n === s ? 0 : n.startsWith(s) ? 1 : n.includes(s) ? 2 : -1;
    if (tier < 0) continue;
    buckets[c.stock ? tier : tier + 3].push({ code: c.code, name: c.name, stock: c.stock || undefined });
  }
  return buckets.flat().slice(0, limit);
}

export function corpNameFromIndex(code: string): string | null {
  return loadCorpIndex()?.corps.find((c) => c.code === code)?.name ?? null;
}
