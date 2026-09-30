import type { EmpRowRaw, FsDiv, FsRowRaw } from '../types';

const BASE = 'https://opendart.fss.or.kr/api';
const TTL_MS = 10 * 60 * 1000;

export type DartErrorKind = 'NO_KEY' | 'AUTH' | 'RATE_LIMIT' | 'SERVICE' | 'NETWORK' | 'BAD_REQUEST' | 'UNKNOWN';

export class DartError extends Error {
  constructor(public kind: DartErrorKind, message: string, public code?: string) {
    super(message);
  }
}

/** status 코드 → 사용자가 이해할 수 있는 원인 (키·URL은 메시지에 넣지 않는다) */
export function explainStatus(code: string, message?: string): DartError {
  switch (code) {
    case '010': return new DartError('AUTH', 'OpenDART 인증키가 등록되지 않은 키입니다. .env의 OPENDART_API_KEY를 확인하세요.', code);
    case '011': return new DartError('AUTH', '사용할 수 없는 인증키입니다(일시 정지 등). OpenDART 마이페이지에서 키 상태를 확인하세요.', code);
    case '012': return new DartError('AUTH', '접근할 수 없는 IP입니다. OpenDART 키의 허용 IP 설정을 확인하세요.', code);
    case '020': return new DartError('RATE_LIMIT', '요청 제한을 초과했습니다. 잠시 후 다시 시도하세요.', code);
    case '021': return new DartError('BAD_REQUEST', '조회 가능한 회사 개수를 초과했습니다.', code);
    case '100': case '101': return new DartError('BAD_REQUEST', `요청 값이 올바르지 않습니다(${message ?? code}).`, code);
    case '800': case '900': case '901':
      return new DartError('SERVICE', 'OpenDART 서비스 점검 또는 장애 상태입니다. 나중에 다시 시도하세요.', code);
    default: return new DartError('UNKNOWN', `OpenDART 응답 오류(${code}: ${message ?? ''})`, code);
  }
}

interface Cached { at: number; data: unknown }
const cache = new Map<string, Cached>();

export function dartKey(): string | null {
  const k = process.env.OPENDART_API_KEY?.trim();
  return k ? k : null;
}

async function getJson(path: string, params: Record<string, string>): Promise<{ status: string; message?: string; list?: unknown[] }> {
  const key = dartKey();
  if (!key) throw new DartError('NO_KEY', 'OPENDART_API_KEY가 비어 있습니다. .env에 키를 입력하세요.');
  const cacheKey = `${path}?${new URLSearchParams(params).toString()}`; // 키 제외
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data as never;

  const url = `${BASE}/${path}?${new URLSearchParams({ crtfc_key: key, ...params }).toString()}`;
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new DartError('NETWORK', 'OpenDART에 연결하지 못했습니다. 네트워크 상태를 확인하세요.');
  }
  if (!res.ok) throw new DartError('SERVICE', `OpenDART HTTP 오류(${res.status})`);
  const data = (await res.json()) as { status: string; message?: string; list?: unknown[] };
  if (data.status !== '000' && data.status !== '013') throw explainStatus(data.status, data.message);
  cache.set(cacheKey, { at: Date.now(), data });
  return data;
}

/** 직원 현황. 013(데이터 없음)이면 빈 배열. */
export async function fetchEmpSttus(corpCode: string, year: number): Promise<EmpRowRaw[]> {
  const d = await getJson('empSttus.json', { corp_code: corpCode, bsns_year: String(year), reprt_code: '11011' });
  return (d.list ?? []) as EmpRowRaw[];
}

/** 단일회사 전체 재무제표. 013이면 빈 배열. */
export async function fetchFinancials(corpCode: string, year: number, fsDiv: FsDiv): Promise<FsRowRaw[]> {
  const d = await getJson('fnlttSinglAcntAll.json', { corp_code: corpCode, bsns_year: String(year), reprt_code: '11011', fs_div: fsDiv });
  return (d.list ?? []) as FsRowRaw[];
}
