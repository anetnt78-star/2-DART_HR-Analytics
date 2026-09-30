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
  const exact: CompanyInfo[] = [];
  const starts: CompanyInfo[] = [];
  const contains: CompanyInfo[] = [];
  for (const c of idx.corps) {
    const n = c.name.toLowerCase();
    const info = { code: c.code, name: c.name, stock: c.stock };
    if (c.stock === s) exact.push(info);
    else if (n === s) exact.push(info);
    else if (n.startsWith(s)) starts.push(info);
    else if (n.includes(s)) contains.push(info);
  }
  return [...exact, ...starts, ...contains].slice(0, limit);
}

export function corpNameFromIndex(code: string): string | null {
  return loadCorpIndex()?.corps.find((c) => c.code === code)?.name ?? null;
}
