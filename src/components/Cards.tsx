'use client';

import type { ComparisonResult, Gap, GapMetric, Metric } from '@/lib/types';
import { DEFINITION_FULL, PER_HEAD_LABEL } from '@/lib/metric';
import { formatInt, formatKRW, formatPct, formatWonExact, signed } from '@/lib/format';
import { CoTag, MetricMeta, MetricValue, StatusBadge, type ValueKind } from './ui';

function GapLine({ gap, kind }: { gap: Gap | undefined; kind: ValueKind }) {
  if (!gap) return <div className="gap-row muted small">격차: 계산되지 않음</div>;
  if (gap.status !== 'OK' || gap.diffAbs === null || gap.diffPct === null) {
    return (
      <div className="gap-row">
        <span className="muted small">격차(B − A) </span><StatusBadge status={gap.status} />
        <div className="reason">{gap.reason}</div>
      </div>
    );
  }
  const abs = kind === 'count' ? `${signed(gap.diffAbs, formatInt)}명` : signed(gap.diffAbs, formatKRW);
  return (
    <div className="gap-row">
      <span className="muted small">격차(B − A) </span>
      <strong>{abs}</strong> <span>({formatPct(gap.diffPct)})</span>
      {kind === 'won' && <div className="exact">{signed(gap.diffAbs, formatWonExact)}</div>}
    </div>
  );
}

function CoreCard({
  title, def, kind, a, b, gap,
}: { title: string; def?: string; kind: ValueKind; a: Metric | undefined; b: Metric | undefined; gap: Gap | undefined }) {
  return (
    <article className="card" aria-label={title}>
      <h3>{title}</h3>
      {def && <div className="def">{def}</div>}
      <div className="pair">
        <div className="cell A"><div className="xsmall muted"><CoTag which="A" /></div>{a ? <MetricValue m={a} kind={kind} /> : <div className="reason">조회 실패</div>}</div>
        <div className="cell B"><div className="xsmall muted"><CoTag which="B" /></div>{b ? <MetricValue m={b} kind={kind} /> : <div className="reason">조회 실패</div>}</div>
      </div>
      <GapLine gap={gap} kind={kind} />
    </article>
  );
}

function AvgCell({ m }: { m: Metric }) {
  return m.status === 'OK' && m.value !== null ? (
    <><strong>{formatKRW(m.value)}</strong> <span className="exact">{formatWonExact(m.value)}</span></>
  ) : (
    <><StatusBadge status={m.status} /> <span className="reason">{m.reason}</span></>
  );
}

export default function Cards({ r }: { r: ComparisonResult }) {
  const gap = (m: GapMetric) => r.gaps.find((g) => g.metric === m);
  const a = r.A.metrics;
  const b = r.B.metrics;
  return (
    <section aria-labelledby="cards-h">
      <h2 id="cards-h" style={{ fontSize: 16, margin: '0 0 12px' }}>3. 비교 카드 <span className="muted small">— {r.year}년 사업보고서 · {r.mode === 'synthetic' ? '합성 예시' : '실제 DART'}</span></h2>
      <div className="cards-core">
        <CoreCard title="사업연도말 직원 수" kind="count" a={a?.headcount} b={b?.headcount} gap={gap('headcount')} />
        <CoreCard title={PER_HEAD_LABEL} def={DEFINITION_FULL} kind="won" a={a?.perHeadPayroll} b={b?.perHeadPayroll} gap={gap('perHeadPayroll')} />
        <CoreCard title="인당 매출" def="인당 매출 = 같은 사업연도 연간 매출 ÷ 사업연도말 직원 수 (별도재무제표 OFS 기준)" kind="won" a={a?.revenuePerHead} b={b?.revenuePerHead} gap={gap('revenuePerHead')} />
      </div>

      <div className="cards-sub">
        <article className="card">
          <h3>연간급여총액 (원 단위 환산값)</h3>
          <div className="def">기말 인원당 급여총액의 분자입니다. 비고 단위 표기가 있으면 그 표기를 따라 원으로 환산합니다.</div>
          <div className="pair">
            <div className="cell A"><div className="xsmall muted"><CoTag which="A" /></div>{a ? <MetricValue m={a.payroll} kind="won" /> : <div className="reason">조회 실패</div>}</div>
            <div className="cell B"><div className="xsmall muted"><CoTag which="B" /></div>{b ? <MetricValue m={b.payroll} kind="won" /> : <div className="reason">조회 실패</div>}</div>
          </div>
        </article>

        <article className="card">
          <h3>공시 1인평균급여 (남/여) — 공시값 그대로</h3>
          <div className="def">기말 인원당 급여총액과 별개의 공시 값입니다. 같은 순위·격차 계산에 넣지 않으며, 남·여 평균으로 전체 평균을 만들지 않습니다.</div>
          <div className="pair">
            {(['A', 'B'] as const).map((k) => {
              const m = (k === 'A' ? a : b)?.disclosedAvg;
              return (
                <div key={k} className={`cell ${k}`}>
                  <div className="xsmall muted"><CoTag which={k} /></div>
                  {m ? (
                    <div className="small" style={{ display: 'grid', gap: 6, marginTop: 4 }}>
                      <div>남 · 공시값: <AvgCell m={m.male} /></div>
                      <div>여 · 공시값: <AvgCell m={m.female} /></div>
                      <div>전체 · 공시값: <AvgCell m={m.overall} /></div>
                      <MetricMeta m={m.male} />
                    </div>
                  ) : <div className="reason">조회 실패</div>}
                </div>
              );
            })}
          </div>
        </article>
      </div>
    </section>
  );
}
