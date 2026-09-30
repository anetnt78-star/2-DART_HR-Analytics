'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CompanyInfo, ComparisonResult } from '@/lib/types';
import Setup, { type Mode } from './Setup';
import ConnectionPanel, { type StatusInfo } from './ConnectionPanel';
import Validation from './Validation';
import Cards from './Cards';
import Charts from './Charts';
import AiPanel, { type AiReplyView, type ChatMsg } from './AiPanel';

interface FullStatus extends StatusInfo { defaultMode: Mode; liveYears: number[] }
interface Conditions { mode: Mode; a: string; b: string; year: number }

const SYNTHETIC_YEARS = [2025];

export default function Dashboard() {
  const [status, setStatus] = useState<FullStatus | null>(null);
  const [mode, setModeState] = useState<Mode>('synthetic');
  const [a, setA] = useState<CompanyInfo | null>(null);
  const [b, setB] = useState<CompanyInfo | null>(null);
  const [year, setYear] = useState<number>(2025);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const [briefLoading, setBriefLoading] = useState(false);
  const [brief, setBrief] = useState<AiReplyView | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [followups, setFollowups] = useState<string[]>([]);

  // 조건이 바뀌면 진행 중 요청을 무효화한다(뒤늦게 도착한 응답이 새 조건 화면을 덮어쓰지 않도록).
  const epoch = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const ran = useRef<Conditions | null>(null);

  const years = mode === 'live' ? (status?.liveYears ?? []) : SYNTHETIC_YEARS;
  const liveAvailable = !!status?.dart.configured;

  const resetAll = useCallback(() => {
    epoch.current += 1;
    abort.current?.abort();
    abort.current = null;
    ran.current = null;
    setResult(null); setRunError(null); setRunning(false);
    setBrief(null); setBriefError(null); setBriefLoading(false);
    setMessages([]); setChatLoading(false); setFollowups([]);
  }, []);

  // 초기 상태 로드 + 합성 모드 기본 선택
  useEffect(() => {
    (async () => {
      const s = (await (await fetch('/api/status')).json()) as FullStatus;
      setStatus(s);
      if (s.defaultMode === 'live') {
        setModeState('live');
        setYear(s.liveYears[0]);
      } else {
        const d = (await (await fetch('/api/companies?mode=synthetic&q=')).json()) as { companies: CompanyInfo[] };
        setA(d.companies[0] ?? null);
        setB(d.companies[1] ?? null);
      }
    })().catch(() => setRunError('서버 상태를 불러오지 못했습니다. 개발 서버가 실행 중인지 확인하세요.'));
  }, []);

  // 모드·기업·연도가 바뀌면 결과·브리핑·대화를 모두 초기화
  useEffect(() => { resetAll(); }, [mode, a?.code, b?.code, year, resetAll]);

  async function setMode(m: Mode) {
    if (m === mode) return;
    setModeState(m);
    setA(null); setB(null);
    if (m === 'synthetic') {
      setYear(2025);
      const d = (await (await fetch('/api/companies?mode=synthetic&q=')).json()) as { companies: CompanyInfo[] };
      setA(d.companies[0] ?? null);
      setB(d.companies[1] ?? null);
    } else if (status) {
      setYear(status.liveYears[0]);
    }
  }

  async function post<T>(url: string, body: unknown, signal: AbortSignal): Promise<{ ok: boolean; data: T & { error?: string } }> {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    return { ok: res.ok, data: (await res.json()) as T & { error?: string } };
  }

  async function run() {
    if (!a || !b) return;
    resetAll();
    const my = epoch.current;
    const ac = new AbortController();
    abort.current = ac;
    const cond: Conditions = { mode, a: a.code, b: b.code, year };
    setRunning(true);
    try {
      const r = await post<{ result: ComparisonResult }>('/api/compare', cond, ac.signal);
      if (my !== epoch.current) return;
      if (!r.ok) { setRunError(r.data.error ?? '비교하지 못했습니다.'); return; }
      ran.current = cond;
      setResult(r.data.result);
      setRunning(false);
      // 검증이 끝나면 자동으로 AI 브리핑
      if (!r.data.result.A.error && !r.data.result.B.error) {
        setBriefLoading(true);
        const br = await post<AiReplyView>('/api/brief', cond, ac.signal);
        if (my !== epoch.current) return;
        if (!br.ok) setBriefError(br.data.error ?? '브리핑을 만들지 못했습니다.');
        else { setBrief(br.data); setFollowups(br.data.followups ?? []); }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      if (my === epoch.current) setRunError('요청에 실패했습니다. 잠시 후 다시 시도하세요.');
    } finally {
      if (my === epoch.current) { setRunning(false); setBriefLoading(false); }
    }
  }

  async function ask(q: string) {
    const cond = ran.current;
    if (!cond) return;
    const my = epoch.current;
    const ac = abort.current ?? new AbortController();
    const next: ChatMsg[] = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setFollowups([]);
    setChatLoading(true);
    try {
      const r = await post<AiReplyView>('/api/chat', { ...cond, messages: next.map(({ role, content }) => ({ role, content })) }, ac.signal);
      if (my !== epoch.current) return;
      const reply: ChatMsg = r.ok
        ? { role: 'assistant', content: r.data.text, guard: r.data.guard, connected: r.data.connected }
        : { role: 'assistant', content: r.data.error ?? '답변을 만들지 못했습니다.' };
      setMessages([...next, reply]);
      setFollowups(r.ok ? (r.data.followups ?? []) : []);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      if (my === epoch.current) setMessages([...next, { role: 'assistant', content: '요청에 실패했습니다. 잠시 후 다시 시도하세요.' }]);
    } finally {
      if (my === epoch.current) setChatLoading(false);
    }
  }

  const bothOk = !!result && !result.A.error && !result.B.error;

  return (
    <>
      {mode === 'synthetic' && <div className="banner" role="status">합성 예시(실제 기업 아님) — 가상 데이터로 화면과 보류 동작을 확인하는 모드입니다</div>}
      <main className="wrap">
        <h1 className="title">HR Analytics 에이전트 · 두 기업 급여·인력 비교</h1>
        <p className="subtitle">DART 사업보고서 공시를 검증한 값만 카드·차트·AI 브리핑에 사용합니다. 확인되지 않은 값은 계산하지 않고 &ldquo;보류&rdquo;로 표시합니다.</p>

        <ConnectionPanel status={status} />
        <Setup
          mode={mode} setMode={setMode} liveAvailable={liveAvailable}
          a={a} b={b} setA={setA} setB={setB}
          year={year} setYear={setYear} years={years}
          onRun={run} running={running}
        />

        {runError && <div className="panel err" role="alert">{runError}</div>}
        {running && <div className="panel muted" aria-live="polite">DART 원본을 조회하고 검증하는 중…</div>}

        {result && (
          <>
            <Validation A={result.A} B={result.B} />
            <Cards r={result} />
            {bothOk && <Charts r={result} />}
            {bothOk && (
              <AiPanel
                briefLoading={briefLoading} brief={brief} briefError={briefError}
                messages={messages} chatLoading={chatLoading} followups={followups} onAsk={ask}
              />
            )}
          </>
        )}
      </main>
    </>
  );
}
