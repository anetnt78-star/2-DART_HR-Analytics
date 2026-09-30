import OpenAI from 'openai';
import type { ComparisonResult } from '../types';
import { buildPacket, packetNumbers } from './packet';
import { BRIEF_INSTRUCTION, FOLLOWUP_MARK, SYSTEM_PROMPT, packetMessage } from './prompts';
import { checkNumbers, type GuardResult } from './guard';
import { buildFollowups, buildTemplateBrief } from './template';

export interface AiReply {
  connected: boolean;
  text: string;
  followups: string[];
  guard: GuardResult | null;
  /** 연결되지 않았거나 실패한 이유(사용자에게 그대로 보여줄 쉬운 말) */
  notice?: string;
  model?: string;
}

export interface ChatTurn { role: 'user' | 'assistant'; content: string }

export function aiConfig(): { keySet: boolean; model: string | null } {
  return { keySet: !!process.env.OPENAI_API_KEY?.trim(), model: process.env.OPENAI_MODEL?.trim() || null };
}

/** 오류를 원인별로 쉬운 말로 바꾼다(키·요청 본문은 노출하지 않는다). */
export function explainOpenAiError(e: unknown): string {
  const status = (e as { status?: number })?.status;
  if (status === 401) return 'OpenAI 인증에 실패했습니다. OPENAI_API_KEY를 확인하세요.';
  if (status === 404) return '설정한 OPENAI_MODEL 이름을 찾을 수 없거나 사용 권한이 없습니다. 모델명을 확인하세요.';
  if (status === 429) return 'OpenAI 요청 제한 또는 사용 한도를 초과했습니다. 잠시 후 다시 시도하거나 결제·한도를 확인하세요.';
  if (status && status >= 500) return 'OpenAI 서비스에 일시적인 문제가 있습니다. 잠시 후 다시 시도하세요.';
  if (status === 400) return 'OpenAI가 요청을 받아들이지 않았습니다(모델이 지원하지 않는 형식일 수 있음).';
  return 'OpenAI에 연결하지 못했습니다. 네트워크 상태를 확인하세요.';
}

function splitReply(raw: string): { body: string; followups: string[] } {
  const i = raw.indexOf(FOLLOWUP_MARK);
  if (i < 0) return { body: raw.trim(), followups: [] };
  const body = raw.slice(0, i).trim();
  const followups = raw
    .slice(i + FOLLOWUP_MARK.length)
    .split('\n')
    .map((l) => l.replace(/^[\s\-*•\d.)]+/, '').trim())
    .filter((l) => l.length > 3)
    .slice(0, 4);
  return { body, followups };
}

async function callModel(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): Promise<string> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY!.trim(), timeout: 60_000 });
  const res = await client.chat.completions.create({ model: process.env.OPENAI_MODEL!.trim(), messages });
  return res.choices[0]?.message?.content ?? '';
}

function notConnected(result: ComparisonResult, notice: string): AiReply {
  const packet = buildPacket(result);
  return { connected: false, text: buildTemplateBrief(packet), followups: buildFollowups(packet), guard: null, notice };
}

export async function makeBrief(result: ComparisonResult): Promise<AiReply> {
  const cfg = aiConfig();
  if (!cfg.keySet) return notConnected(result, 'AI 미연결: .env에 OPENAI_API_KEY를 입력하면 자동 브리핑이 실제 AI로 생성됩니다.');
  if (!cfg.model) return notConnected(result, '모델 미설정: .env에 OPENAI_MODEL을 입력하세요.');
  const packet = buildPacket(result);
  try {
    const raw = await callModel([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `${packetMessage(JSON.stringify(packet, null, 2))}\n\n${BRIEF_INSTRUCTION}` },
    ]);
    const { body, followups } = splitReply(raw);
    return {
      connected: true, text: body, model: cfg.model,
      followups: followups.length ? followups : buildFollowups(packet),
      guard: checkNumbers(body, packetNumbers(packet)),
    };
  } catch (e) {
    return notConnected(result, `AI 브리핑 실패: ${explainOpenAiError(e)} (아래는 고정 템플릿 요약입니다)`);
  }
}

const MAX_TURNS = 8;

export async function chat(result: ComparisonResult, history: ChatTurn[]): Promise<AiReply> {
  const cfg = aiConfig();
  const packet = buildPacket(result);
  if (!cfg.keySet || !cfg.model) {
    return {
      connected: false, guard: null, followups: buildFollowups(packet),
      text: 'AI가 연결되어 있지 않아 후속 질문에 답할 수 없습니다. .env에 OPENAI_API_KEY와 OPENAI_MODEL을 입력하세요.',
      notice: !cfg.keySet ? 'AI 미연결' : '모델 미설정',
    };
  }
  const recent = history.slice(-MAX_TURNS * 2).map((t): OpenAI.Chat.Completions.ChatCompletionMessageParam => ({
    role: t.role, content: t.content.slice(0, 2000),
  }));
  try {
    const raw = await callModel([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: packetMessage(JSON.stringify(packet, null, 2)) },
      { role: 'assistant', content: '패킷을 확인했습니다. 이 패킷의 값만 근거로 질문에 답하겠습니다.' },
      ...recent,
    ]);
    const { body, followups } = splitReply(raw);
    return {
      connected: true, text: body, model: cfg.model,
      followups: followups.length ? followups : buildFollowups(packet),
      guard: checkNumbers(body, packetNumbers(packet)),
    };
  } catch (e) {
    return { connected: false, guard: null, followups: [], text: `답변 생성에 실패했습니다. ${explainOpenAiError(e)}`, notice: explainOpenAiError(e) };
  }
}
