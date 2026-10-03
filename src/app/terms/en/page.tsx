import type { Metadata } from 'next';
import LegalPage from '@/components/legal/LegalPage';
import { TERMS_EN } from '@/content/legal/terms.en';

export const metadata: Metadata = { title: `${TERMS_EN.title} · SpotOn` };

export default function TermsEnPage() {
  return <LegalPage doc={TERMS_EN} other={{ href: '/terms', label: 'Magyar változat' }} />;
}
