'use client';

import type { CompanyResult } from '@/lib/types';
import { CoTag } from './ui';

function Panel({ which, c }: { which: 'A' | 'B'; c: CompanyResult }) {
  if (c.error || !c.emp) {
    return (
      <div>
        <h3><CoTag which={which} name={c.corp.name} /></h3>
        <p className="err">조회 실패: {c.error?.message}</p>
      </div>
    );
  }
  const e = c.emp;
  return (
    <div>
      <h3><CoTag which={which} name={c.corp.name} /></h3>
      <p className="small" style={{ margin: '6px 0' }}>
        행 구조: <strong>{e.structureLabel}</strong> · 결산 기준일 {e.stlmDt ?? '—'} · 접수번호 {e.rceptNo ?? '—'} · 재무제표 범위 {c.fsDiv}
      </p>
      <ul className="checklist">
        {e.checks.map((k) => (
          <li key={k.id}>
            <span className={`badge ${k.pass === null ? 'na' : k.pass ? 'pass' : 'fail'}`}>{k.pass === null ? '해당 없음' : k.pass ? '통과' : '보류'}</span>
            <span><strong>{k.label}</strong> — {k.detail}</span>
          </li>
        ))}
      </ul>
      <details>
        <summary className="small" style={{ cursor: 'pointer' }}>원본 표 보기 (핵심 7개 필드 · {e.rows.length}행)</summary>
        <div className="tablewrap" style={{ marginTop: 8 }}>
          <table className="raw">
            <thead>
              <tr><th>#</th><th>fo_bbm</th><th>sexdstn</th><th>sm</th><th>fyer_salary_totamt</th><th>jan_salary_am</th><th>stlm_dt</th><th>rm</th><th>분류</th></tr>
            </thead>
            <tbody>
              {e.rows.map((r) => (
                <tr key={r.index}>
                  <td>{r.index + 1}</td><td>{r.fo_bbm}</td><td>{r.sexdstn}</td>
                  <td className="num">{r.sm || '-'}</td><td className="num">{r.fyer_salary_totamt || '-'}</td><td className="num">{r.jan_salary_am || '-'}</td>
                  <td>{r.stlm_dt}</td><td>{r.rm || '-'}</td>
                  <td className={`cls-${r.cls}`}>{r.cls === 'DETAIL' ? '상세' : r.cls === 'TOTAL' ? '성별합계' : '미분류'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export default function Validation({ A, B }: { A: CompanyResult; B: CompanyResult }) {
  return (
    <section className="panel" aria-labelledby="val-h">
      <h2 id="val-h">2. 원본 검증 패널</h2>
      <div className="val-grid">
        <Panel which="A" c={A} />
        <Panel which="B" c={B} />
      </div>
    </section>
  );
}
