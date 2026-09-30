'use client';

import { useState } from 'react';

export interface StatusInfo {
  dart: { configured: boolean; corpIndex: boolean };
  openai: { configured: boolean; keySet: boolean; modelSet: boolean; model: string | null };
}
interface Report { ok: boolean; steps: Array<{ name: string; ok: boolean; detail: string }> }

export default function ConnectionPanel({ status }: { status: StatusInfo | null }) {
  const [reports, setReports] = useState<Record<string, Report | 'loading' | undefined>>({});

  async function run(target: 'dart' | 'openai') {
    setReports((r) => ({ ...r, [target]: 'loading' }));
    try {
      const res = await fetch(`/api/check?target=${target}`, { method: 'POST' });
      const report = (await res.json()) as Report;
      setReports((r) => ({ ...r, [target]: report }));
    } catch {
      setReports((r) => ({ ...r, [target]: { ok: false, steps: [{ name: '요청', ok: false, detail: '점검 요청에 실패했습니다.' }] } }));
    }
  }

  const badge = (configured: boolean | undefined, rep: Report | 'loading' | undefined) => {
    if (rep === 'loading') return <span className="badge MISSING">점검 중…</span>;
    if (rep) return <span className={`badge ${rep.ok ? 'OK' : 'NOT_COMPARABLE'}`}>{rep.ok ? '점검 통과' : '점검 실패'}</span>;
    return <span className={`badge ${configured ? 'HOLD' : 'NOT_COMPARABLE'}`}>{configured ? '설정됨 · 미점검' : '미설정'}</span>;
  };

  const item = (
    target: 'dart' | 'openai', title: string, configured: boolean | undefined, detail: string,
  ) => {
    const rep = reports[target];
    return (
      <div className="conn-item">
        <h3>{title} {badge(configured, rep)}</h3>
        <div className="small muted">{detail}</div>
        <div style={{ marginTop: 8 }}>
          <button className="btn secondary small" type="button" disabled={rep === 'loading' || !configured} onClick={() => run(target)}>
            점검 실행
          </button>
        </div>
        {rep && rep !== 'loading' && (
          <ul className="steps">
            {rep.steps.map((s) => (
              <li key={s.name}><span className={`badge ${s.ok ? 'pass' : 'fail'}`}>{s.ok ? '통과' : '실패'}</span> {s.name} — {s.detail}</li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <details className="panel">
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>연결 상태 (OpenDART · OpenAI는 서로 독립)</summary>
      <div className="conn" style={{ marginTop: 12 }}>
        {item('dart', 'OpenDART', status?.dart.configured,
          status ? (status.dart.configured ? `키 입력됨 · 상장사 인덱스 ${status.dart.corpIndex ? '있음' : '없음(점검 실행 시 생성)'}` : 'OPENDART_API_KEY가 비어 있어 합성 예시로 동작합니다.') : '확인 중…')}
        {item('openai', 'OpenAI', status?.openai.configured,
          status ? (status.openai.configured ? `키·모델 입력됨 (${status.openai.model})` : !status.openai.keySet ? 'OPENAI_API_KEY가 비어 있어 AI 미연결(템플릿 요약)로 동작합니다.' : 'OPENAI_MODEL이 비어 있습니다(모델 미설정).') : '확인 중…')}
      </div>
      <p className="xsmall muted" style={{ margin: '10px 0 0' }}>키는 서버에서만 읽으며 화면·로그에 표시하지 않습니다. 점검은 버튼을 눌렀을 때만 외부 API를 호출합니다.</p>
    </details>
  );
}
