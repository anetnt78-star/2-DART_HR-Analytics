'use client';

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ComparisonResult, Metric } from '@/lib/types';
import { DEFINITION_SHORT } from '@/lib/metric';
import { formatKRW, formatWonExact } from '@/lib/format';

const COLOR_A = '#5ab0ff';
const COLOR_B = '#f5b84b';
const TXT = '#a9b8cf';

const axisWon = (v: number) => (v >= 1e8 ? `${+(v / 1e8).toFixed(1)}억` : v >= 1e4 ? `${Math.round(v / 1e4)}만` : `${v}`);

/** B는 색뿐 아니라 빗금 패턴으로도 구분. Recharts는 컴포넌트 래퍼가 아닌 <defs> 요소를 직접 자식으로 받아야 한다. */
function hatchDefs(id: string) {
  return (
    <defs>
      <pattern id={id} patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
        <rect width="7" height="7" fill={COLOR_B} />
        <rect width="3" height="7" fill="#7a5410" />
      </pattern>
    </defs>
  );
}

function Legend({ a, b }: { a: string; b: string }) {
  return (
    <div className="legend">
      <span><span className="swatch" style={{ background: COLOR_A, borderColor: COLOR_A }} />A · {a} (단색)</span>
      <span><span className="swatch" style={{ background: 'repeating-linear-gradient(45deg,#f5b84b 0 3px,#7a5410 3px 6px)', borderColor: COLOR_B }} />B · {b} (빗금)</span>
    </div>
  );
}

function HoldNotes({ items }: { items: Array<{ who: 'A' | 'B'; m: Metric | undefined; label?: string }> }) {
  const bad = items.filter((i) => !i.m || i.m.status !== 'OK');
  if (bad.length === 0) return null;
  return (
    <div className="small" style={{ marginTop: 6 }}>
      {bad.map((i, k) => (
        <div key={k} className="reason">
          {i.who}{i.label ? ` ${i.label}` : ''}: {i.m ? (i.m.status === 'HOLD' ? '보류' : i.m.status === 'MISSING' ? '원본에 없음' : '비교 불가') + ` — ${i.m.reason ?? ''}` : '조회 실패'} (막대 없음)
        </div>
      ))}
    </div>
  );
}

function WonTip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number | null }; value: number | null }> }) {
  if (!active || !payload?.length || payload[0].value == null) return null;
  const p = payload[0];
  return (
    <div style={{ background: '#1a355e', border: '1px solid #2b4a78', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}>
      <div><strong>{p.payload.name}</strong></div>
      <div>{formatKRW(p.value as number)} ({formatWonExact(p.value as number)})</div>
    </div>
  );
}

function TwoBar({ data, formatter, id }: { data: Array<{ name: string; value: number | null }>; formatter: (v: number) => string; id: string }) {
  return (
    <div className="chart-frame"><ResponsiveContainer width="100%" height="100%" debounce={60}>
      <BarChart data={data} margin={{ top: 22, right: 8, left: 0, bottom: 4 }}>
        {hatchDefs(id)}
        <CartesianGrid stroke="#2b4a78" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: TXT, fontSize: 12 }} />
        <YAxis tick={{ fill: TXT, fontSize: 11 }} tickFormatter={axisWon} width={48} />
        <Tooltip content={<WonTip />} cursor={{ fill: 'rgba(255,255,255,.05)' }} />
        <Bar dataKey="value" isAnimationActive={false} maxBarSize={80}>
          {data.map((d, i) => <Cell key={i} fill={i === 0 ? COLOR_A : `url(#${id})`} stroke={i === 0 ? COLOR_A : COLOR_B} />)}
          <LabelList dataKey="value" position="top" fill="#eaf0f8" fontSize={11} formatter={(v: number | null) => (v == null ? '' : formatter(v))} />
        </Bar>
      </BarChart>
    </ResponsiveContainer></div>
  );
}

export default function Charts({ r }: { r: ComparisonResult }) {
  const a = r.A.metrics;
  const b = r.B.metrics;
  const an = r.A.corp.name;
  const bn = r.B.corp.name;
  const val = (m: Metric | undefined) => (m && m.status === 'OK' ? m.value : null);

  const perHead = [{ name: `A ${an}`, value: val(a?.perHeadPayroll) }, { name: `B ${bn}`, value: val(b?.perHeadPayroll) }];
  const revenue = [{ name: `A ${an}`, value: val(a?.revenuePerHead) }, { name: `B ${bn}`, value: val(b?.revenuePerHead) }];
  const gender = [
    { name: '남', A: val(a?.disclosedAvg.male), B: val(b?.disclosedAvg.male) },
    { name: '여', A: val(a?.disclosedAvg.female), B: val(b?.disclosedAvg.female) },
  ];

  return (
    <section aria-labelledby="charts-h">
      <h2 id="charts-h" style={{ fontSize: 16, margin: '0 0 12px' }}>4. 차트</h2>
      <div className="charts">
        <article className="panel chart-box">
          <h3>기말 인원당 급여총액 · 계산값 ({DEFINITION_SHORT})</h3>
          <div className="def">세로축: 기말 인원당 급여총액(원) · 앱 계산값, 공시 1인평균급여와 다름</div>
          <TwoBar id="hatchPerHead" data={perHead} formatter={formatKRW} />
          <Legend a={an} b={bn} />
          <HoldNotes items={[{ who: 'A', m: a?.perHeadPayroll }, { who: 'B', m: b?.perHeadPayroll }]} />
        </article>

        <article className="panel chart-box">
          <h3>남·여 공시 1인평균급여 (공시값)</h3>
          <div className="def">공시 원본 값 그대로 · 위 계산값 차트와 섞지 않음 · 전체 평균은 원본에 있을 때만 표시</div>
          <div className="chart-frame"><ResponsiveContainer width="100%" height="100%" debounce={60}>
            <BarChart data={gender} margin={{ top: 22, right: 8, left: 0, bottom: 4 }}>
              {hatchDefs('hatchGender')}
              <CartesianGrid stroke="#2b4a78" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: TXT, fontSize: 12 }} />
              <YAxis tick={{ fill: TXT, fontSize: 11 }} tickFormatter={axisWon} width={48} />
              <Tooltip content={<WonTip />} cursor={{ fill: 'rgba(255,255,255,.05)' }} />
              <Bar dataKey="A" name={`A ${an}`} fill={COLOR_A} isAnimationActive={false} maxBarSize={48}>
                <LabelList dataKey="A" position="top" fill="#eaf0f8" fontSize={11} formatter={(v: number | null) => (v == null ? '' : formatKRW(v))} />
              </Bar>
              <Bar dataKey="B" name={`B ${bn}`} fill="url(#hatchGender)" stroke={COLOR_B} isAnimationActive={false} maxBarSize={48}>
                <LabelList dataKey="B" position="top" fill="#eaf0f8" fontSize={11} formatter={(v: number | null) => (v == null ? '' : formatKRW(v))} />
              </Bar>
            </BarChart>
          </ResponsiveContainer></div>
          <Legend a={an} b={bn} />
          <HoldNotes items={[
            { who: 'A', m: a?.disclosedAvg.male, label: '남' }, { who: 'A', m: a?.disclosedAvg.female, label: '여' },
            { who: 'B', m: b?.disclosedAvg.male, label: '남' }, { who: 'B', m: b?.disclosedAvg.female, label: '여' },
          ]} />
          <div className="small muted" style={{ marginTop: 6 }}>
            전체 평균: A {a?.disclosedAvg.overall.status === 'OK' ? formatKRW(a.disclosedAvg.overall.value!) : '원본에 없음'} / B {b?.disclosedAvg.overall.status === 'OK' ? formatKRW(b.disclosedAvg.overall.value!) : '원본에 없음'}
          </div>
        </article>

        <article className="panel chart-box">
          <h3>인당 매출 (계산값)</h3>
          <div className="def">세로축: 연간 매출(OFS) ÷ 사업연도말 직원 수(원)</div>
          <TwoBar id="hatchRevenue" data={revenue} formatter={formatKRW} />
          <Legend a={an} b={bn} />
          <HoldNotes items={[{ who: 'A', m: a?.revenuePerHead }, { who: 'B', m: b?.revenuePerHead }]} />
        </article>
      </div>
    </section>
  );
}
