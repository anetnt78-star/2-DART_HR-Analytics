'use client';

import type { Metric, Status } from '@/lib/types';
import { formatKRW, formatInt, formatWonExact } from '@/lib/format';

export const STATUS_LABEL: Record<Status, string> = {
  OK: '검증 완료',
  HOLD: '보류',
  MISSING: '원본에 없음',
  NOT_COMPARABLE: '비교 불가',
};

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge ${status}`}>{STATUS_LABEL[status]}</span>;
}

export function CoTag({ which, name }: { which: 'A' | 'B'; name?: string }) {
  return (
    <span>
      <span className={`co-tag ${which}`}>{which}</span>
      {name}
    </span>
  );
}

/** **굵게** 만 지원하는 가벼운 텍스트 렌더러(HTML 주입 없음) */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <div className="ai-text">
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>,
      )}
    </div>
  );
}

export type ValueKind = 'count' | 'won';

export function fmt(kind: ValueKind, v: number): string {
  return kind === 'count' ? `${formatInt(v)}명` : formatKRW(v);
}

/** 값 또는 (보류·없음·비교불가일 때) 사유. 보류 값은 숫자를 숨기고 사유를 눈에 띄게 보여준다. */
export function MetricValue({ m, kind }: { m: Metric; kind: ValueKind }) {
  return (
    <div>
      {m.status === 'OK' && m.value !== null ? (
        <>
          <div className="big">{fmt(kind, m.value)}</div>
          {kind === 'won' && <div className="exact">{formatWonExact(m.value)}</div>}
        </>
      ) : (
        <>
          <div className="big hold">{m.status === 'HOLD' ? '보류' : m.status === 'MISSING' ? '원본에 없음' : '비교 불가'}</div>
          <div className="reason">{m.reason}</div>
        </>
      )}
      <div style={{ marginTop: 6 }}><StatusBadge status={m.status} /></div>
      <MetricMeta m={m} />
    </div>
  );
}

export function MetricMeta({ m }: { m: Metric }) {
  return (
    <details className="meta">
      <summary>산식·출처</summary>
      <div>산식: {m.formula}</div>
      <div>출처: {m.source}</div>
      {m.notes.map((n, i) => <div key={i}>비고: {n}</div>)}
    </details>
  );
}
