import fs from 'node:fs';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import { DartError, dartKey, explainStatus } from './client';
import { CORP_INDEX_PATH } from './corpIndex';

/** corpCode.xml(zip)을 받아 상장사(주식코드 있음)만 추린 JSON 인덱스를 data/corp-index.json에 저장한다. */
export async function buildCorpIndex(): Promise<{ total: number; listed: number; path: string }> {
  const key = dartKey();
  if (!key) throw new DartError('NO_KEY', 'OPENDART_API_KEY가 비어 있습니다.');
  let res: Response;
  try {
    res = await fetch(`https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${encodeURIComponent(key)}`, { cache: 'no-store' });
  } catch {
    throw new DartError('NETWORK', 'OpenDART에 연결하지 못했습니다.');
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(buf);
  } catch {
    // 오류 시 zip이 아니라 XML(status/message)이 내려온다
    const xml = strFromU8(buf);
    const code = xml.match(/<status>(\d+)<\/status>/)?.[1];
    throw code ? explainStatus(code, xml.match(/<message>(.*?)<\/message>/)?.[1]) : new DartError('UNKNOWN', 'corpCode 응답을 읽을 수 없습니다.');
  }
  const name = Object.keys(files)[0];
  const parsed = new XMLParser({ parseTagValue: false, trimValues: true }).parse(strFromU8(files[name])) as {
    result?: { list?: Array<{ corp_code: string; corp_name: string; stock_code?: string }> };
  };
  const list = parsed.result?.list ?? [];
  const corps = list
    .filter((c) => c.stock_code && String(c.stock_code).trim() !== '')
    .map((c) => ({ code: String(c.corp_code).padStart(8, '0'), name: String(c.corp_name), stock: String(c.stock_code).trim() }));
  fs.mkdirSync(path.dirname(CORP_INDEX_PATH), { recursive: true });
  fs.writeFileSync(CORP_INDEX_PATH, JSON.stringify({ builtAt: new Date().toISOString(), corps }));
  return { total: list.length, listed: corps.length, path: CORP_INDEX_PATH };
}
