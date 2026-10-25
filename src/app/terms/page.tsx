import type { Metadata } from 'next';
import LegalPage from '@/components/legal/LegalPage';
import { legalAlternates } from '@/lib/legal';
import { TERMS_HU } from '@/content/legal/terms.hu';

export const metadata: Metadata = { title: `${TERMS_HU.title} · SpotOn` };

export default function TermsPage() {
  return <LegalPage doc={TERMS_HU} others={legalAlternates('terms', 'hu')} />;
}
