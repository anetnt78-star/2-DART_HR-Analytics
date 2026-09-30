import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HR Analytics 에이전트 — DART 급여·인력 비교',
  description: '두 상장기업의 인력·급여·인당 매출을 DART 공시로 검증해 비교하고 AI 브리핑을 제공합니다.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
