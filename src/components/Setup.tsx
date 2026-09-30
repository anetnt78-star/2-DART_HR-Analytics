'use client';

import { useEffect, useRef, useState } from 'react';
import type { CompanyInfo } from '@/lib/types';

export type Mode = 'synthetic' | 'live';

function CompanyPicker({
  label, tag, mode, value, onPick, disabled,
}: { label: string; tag: 'A' | 'B'; mode: Mode; value: CompanyInfo | null; onPick: (c: CompanyInfo | null) => void; disabled?: boolean }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<CompanyInfo[]>([]);
  const [hint, setHint] = useState('');
  const [open, setOpen] = useState(false);
  const seq = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const my = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/companies?mode=${mode}&q=${encodeURIComponent(q)}`);
        const d = (await r.json()) as { companies: CompanyInfo[]; hint?: string };
        if (my === seq.current) { setList(d.companies); setHint(d.hint ?? ''); }
      } catch { /* 검색 실패는 조용히 무시 */ }
    }, 200);
    return () => clearTimeout(t);
  }, [q, open, mode]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="field combo" ref={box}>
      <label htmlFor={`co-${tag}`}><span className={tag === 'A' ? 'tagA' : 'tagB'}>기업 {tag}</span> {label}</label>
      <input
        id={`co-${tag}`} className="input" disabled={disabled} autoComplete="off"
        placeholder={mode === 'live' ? '회사명·종목코드·8자리 고유번호' : '가상 기업 검색(비우면 전체)'}
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
      />
      <div className="picked">
        {value ? <>선택됨: <strong>{value.name}</strong> ({value.code}){' '}
          <button className="btn secondary small" type="button" onClick={() => { onPick(null); setQ(''); }}>지우기</button></> : '아직 선택하지 않음'}
      </div>
      {open && (
        <div className="combo-list" role="listbox">
          {list.length === 0 && <div className="combo-item muted small">{hint || (q ? '검색 결과가 없습니다.' : '검색어를 입력하세요.')}</div>}
          {list.map((c) => (
            <button key={c.code} type="button" className="combo-item" role="option" aria-selected={value?.code === c.code}
              onClick={() => { onPick(c); setQ(''); setOpen(false); }}>
              {c.name}{c.stock ? ` (${c.stock})` : ''}
              <small>{c.note ?? c.code}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export interface SetupProps {
  mode: Mode; setMode: (m: Mode) => void; liveAvailable: boolean;
  a: CompanyInfo | null; b: CompanyInfo | null; setA: (c: CompanyInfo | null) => void; setB: (c: CompanyInfo | null) => void;
  year: number; setYear: (y: number) => void; years: number[];
  onRun: () => void; running: boolean;
}

export default function Setup(p: SetupProps) {
  const canRun = !!p.a && !!p.b && p.a.code !== p.b.code && !p.running;
  return (
    <section className="panel" aria-labelledby="setup-h">
      <h2 id="setup-h">1. 설정</h2>
      <div className="setup-grid">
        <div className="field">
          <label>실행 모드</label>
          <div className="seg" role="group" aria-label="실행 모드">
            <button type="button" aria-pressed={p.mode === 'synthetic'} onClick={() => p.setMode('synthetic')}>합성 예시</button>
            <button type="button" aria-pressed={p.mode === 'live'} disabled={!p.liveAvailable} onClick={() => p.setMode('live')}
              title={p.liveAvailable ? '' : 'OPENDART_API_KEY를 .env에 입력하면 사용할 수 있습니다'}>실제 DART</button>
          </div>
        </div>
        <CompanyPicker label="선택" tag="A" mode={p.mode} value={p.a} onPick={p.setA} />
        <CompanyPicker label="선택" tag="B" mode={p.mode} value={p.b} onPick={p.setB} />
        <div className="field">
          <label htmlFor="year">사업연도 (사업보고서)</label>
          <select id="year" className="input" value={p.year} onChange={(e) => p.setYear(Number(e.target.value))}>
            {p.years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button className="btn" type="button" disabled={!canRun} onClick={p.onRun}>
          {p.running ? '비교 중…' : '비교하기'}
        </button>
      </div>
      <p className="xsmall muted" style={{ margin: '10px 0 0' }}>
        조건(모드·기업·연도)을 바꾸면 비교 결과·AI 브리핑·대화가 초기화됩니다. 인당 매출은 별도재무제표(OFS)를 기본으로 사용합니다.
        {!p.liveAvailable && ' 현재 OPENDART_API_KEY가 없어 합성 예시로 동작합니다.'}
      </p>
    </section>
  );
}
