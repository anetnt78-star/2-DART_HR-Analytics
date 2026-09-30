'use client';

import { useState } from 'react';
import { RichText } from './ui';

export interface AiReplyView {
  connected: boolean;
  text: string;
  followups: string[];
  guard: { ok: boolean; unmatched: string[] } | null;
  notice?: string;
  model?: string;
}
export interface ChatMsg { role: 'user' | 'assistant'; content: string; guard?: AiReplyView['guard']; connected?: boolean }

export default function AiPanel(props: {
  briefLoading: boolean;
  brief: AiReplyView | null;
  briefError: string | null;
  messages: ChatMsg[];
  chatLoading: boolean;
  followups: string[];
  onAsk: (q: string) => void;
}) {
  const { briefLoading, brief, briefError, messages, chatLoading, followups, onAsk } = props;
  const [input, setInput] = useState('');
  const busy = chatLoading || briefLoading;

  const submit = (q: string) => {
    const t = q.trim();
    if (!t || busy) return;
    setInput('');
    onAsk(t);
  };

  return (
    <section className="panel" aria-labelledby="ai-h">
      <h2 id="ai-h">5. AI HR 브리핑 · 후속 대화</h2>

      {briefLoading && (
        <div aria-live="polite">
          <div className="small muted">검증된 값으로 브리핑을 생성하는 중…</div>
          <div className="skeleton" style={{ width: '90%' }} /><div className="skeleton" style={{ width: '80%' }} /><div className="skeleton" style={{ width: '85%' }} />
        </div>
      )}
      {briefError && <p className="err">{briefError}</p>}
      {brief && (
        <>
          {brief.notice && <div className="notice">{brief.notice}</div>}
          <RichText text={brief.text} />
          {brief.connected && brief.model && <div className="xsmall muted" style={{ marginTop: 8 }}>생성 모델: {brief.model}</div>}
          {brief.guard && !brief.guard.ok && (
            <div className="warnbox">⚠ 패킷에 없는 숫자가 포함되었을 수 있습니다: {brief.guard.unmatched.join(', ')} — 위 카드의 검증 값과 대조하세요.</div>
          )}
        </>
      )}

      {(brief || messages.length > 0) && (
        <>
          <div className="chat-log" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                {m.role === 'assistant' ? <RichText text={m.content} /> : m.content}
                {m.role === 'assistant' && m.guard && !m.guard.ok && (
                  <div className="warnbox">⚠ 패킷에 없는 숫자가 포함되었을 수 있습니다: {m.guard.unmatched.join(', ')}</div>
                )}
              </div>
            ))}
            {chatLoading && <div className="msg assistant"><div className="skeleton" style={{ width: 200 }} /></div>}
          </div>

          {followups.length > 0 && (
            <div className="chips" aria-label="추천 후속 질문">
              {followups.map((q) => (
                <button key={q} type="button" className="chip" disabled={busy} onClick={() => submit(q)}>{q}</button>
              ))}
            </div>
          )}

          <form className="chat-form" onSubmit={(e) => { e.preventDefault(); submit(input); }}>
            <input className="input" value={input} onChange={(e) => setInput(e.target.value)} disabled={busy}
              placeholder="검증된 비교 결과에 대해 질문하세요" aria-label="후속 질문 입력" maxLength={500} />
            <button className="btn" type="submit" disabled={busy || !input.trim()}>보내기</button>
          </form>
          <p className="xsmall muted" style={{ margin: '8px 0 0' }}>
            대화 기록은 서버·DB에 저장되지 않고 이 브라우저 메모리에만 있으며, 새로고침하거나 조건을 바꾸면 사라집니다.
          </p>
        </>
      )}
    </section>
  );
}
