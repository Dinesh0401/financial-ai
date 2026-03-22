import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FinMind AI — Your Agentic Finance Copilot',
  description: 'AI-powered personal finance platform for India. Analyze spending, optimize debt, simulate goals — powered by autonomous AI agents.',
  keywords: 'personal finance, AI, SIP, EMI, CIBIL, investment, budget India',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
