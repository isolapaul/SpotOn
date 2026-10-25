import type { Metadata } from 'next';
import LegalPage from '@/components/legal/LegalPage';
import { legalAlternates } from '@/lib/legal';
import { TERMS_DE } from '@/content/legal/terms.de';

export const metadata: Metadata = { title: `${TERMS_DE.title} · SpotOn` };

export default function TermsDePage() {
  return <LegalPage doc={TERMS_DE} others={legalAlternates('terms', 'de')} />;
}
