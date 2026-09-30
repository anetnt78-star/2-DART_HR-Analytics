import type { Packet, PacketMetric } from './packet';
import { DEFINITION_FULL } from '../metric';
import { formatKRW, formatInt, formatPct } from '../format';

const LABEL: Record<string, string> = {
  headcount: '사업연도말 직원 수',
  perHeadPayroll: '기말 인원당 급여총액',
  revenuePerHead: '인당 매출',
};

const v = (m: PacketMetric | undefined, f: (n: number) => string) =>
  m && m.status === 'OK' && m.value !== null ? f(m.value) : `산출되지 않음(${m?.status ?? 'MISSING'}${m?.reason ? ` · ${m.reason}` : ''})`;

type Co = Packet['companies']['A'];
const asMetrics = (c: Co) => c as unknown as Record<string, PacketMetric | undefined>;

/** AI 미연결 시의 고정 문장 템플릿(패킷 값 채우기). 실제 AI 답변이 아니다. */
export function buildTemplateBrief(p: Packet): string {
  const A = asMetrics(p.companies.A);
  const B = asMetrics(p.companies.B);
  const gap = (metric: string) => p.verifiedGaps.find((g) => g.metric === metric);
  const gapLine = (metric: string, f: (n: number) => string) => {
    const g = gap(metric);
    if (g) return `B − A = ${g.diffAbs >= 0 ? '+' : '-'}${f(Math.abs(g.diffAbs))} (${formatPct(g.diffPct)})`;
    const u = p.unavailableGaps.find((x) => x.metric === metric);
    return `격차 산출되지 않음${u ? `(${u.status} · ${u.reason})` : ''}`;
  };
  const a = p.companies.A;
  const b = p.companies.B;
  const dis = (c: Co) => {
    const d = (c as { disclosedAvgByGender?: { male: PacketMetric; female: PacketMetric; overall: PacketMetric } }).disclosedAvgByGender;
    if (!d) return '산출되지 않음';
    return `남 ${v(d.male, formatKRW)} / 여 ${v(d.female, formatKRW)} / 전체 ${d.overall.status === 'OK' ? v(d.overall, formatKRW) : '공시 원본에 없음'}`;
  };

  return [
    `**AI 미연결 — 고정 템플릿 요약입니다(실제 AI 답변 아님).**`,
    '',
    `① 결론: ${a.name}와 ${b.name}의 ${a.year}년 사업보고서 기준 검증 결과를 나란히 정리했습니다. 보류된 항목은 값을 만들지 않았습니다.`,
    `② 인력 규모: ${a.name} ${v(A.headcountYearEnd, (n) => formatInt(n) + '명')} / ${b.name} ${v(B.headcountYearEnd, (n) => formatInt(n) + '명')} — ${gapLine('headcount', (n) => formatInt(n) + '명')}`,
    `③ 급여(기말 인원당 급여총액 · 앱 계산값, 공시 1인평균급여 아님): ${a.name} ${v(A.perHeadPayroll, formatKRW)} / ${b.name} ${v(B.perHeadPayroll, formatKRW)} — ${gapLine('perHeadPayroll', formatKRW)}`,
    `④ 남·여 공시 1인평균급여(별도 항목, 공시값 그대로): ${a.name} ${dis(a)} / ${b.name} ${dis(b)}`,
    `⑤ 인당 매출: ${a.name} ${v(A.revenuePerHead, formatKRW)} / ${b.name} ${v(B.revenuePerHead, formatKRW)} — ${gapLine('revenuePerHead', formatKRW)}`,
    `⑥ 보류·한계: ${p.unavailableGaps.length ? p.unavailableGaps.map((g) => `${LABEL[g.metric] ?? g.metric} 격차(${g.status})`).join(', ') : '격차 항목은 모두 산출되었습니다.'}`,
    `⑦ 시사점: 격차의 원인은 이 데이터만으로 단정할 수 없으며, 산업·직무 구성·근속·결산 기준 차이를 추가로 확인해야 합니다.`,
    '',
    `각주: ${DEFINITION_FULL}`,
  ].join('\n');
}

/** 패킷 상태에 맞춘 후속 질문(템플릿용·AI가 질문을 못 만들었을 때의 대체) */
export function buildFollowups(p: Packet): string[] {
  const q: string[] = [];
  const hasGap = (m: string) => p.verifiedGaps.some((g) => g.metric === m);
  if (hasGap('perHeadPayroll')) q.push('기말 인원당 급여총액 격차는 공시 1인평균급여 격차와 어떻게 다른가요?');
  if (hasGap('revenuePerHead')) q.push('인당 매출 격차를 읽을 때 매출 범위(별도/연결)와 직원 수 기준에서 주의할 점은?');
  if (hasGap('headcount')) q.push('직원 수 격차가 급여 비교에 어떤 영향을 줄 수 있나요?');
  if (p.unavailableGaps.length) q.push('보류되거나 비교 불가인 항목은 왜 산출되지 않았고, 무엇을 확인하면 되나요?');
  const bothGender = ['A', 'B'].some((k) => {
    const d = (p.companies[k as 'A' | 'B'] as { disclosedAvgByGender?: { male: { status: string }; female: { status: string } } }).disclosedAvgByGender;
    return d && d.male.status === 'OK' && d.female.status === 'OK';
  });
  if (bothGender) q.push('남·여 공시 1인평균급여의 차이는 어떻게 해석해야 하나요?');
  q.push('이 비교로 HR 보고서에 쓸 때 확인이 더 필요한 사항은 무엇인가요?');
  return [...new Set(q)].slice(0, 3);
}
