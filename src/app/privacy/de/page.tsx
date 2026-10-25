import type { Metadata } from 'next';
import LegalPage from '@/components/legal/LegalPage';
import { legalAlternates } from '@/lib/legal';
import { PRIVACY_DE } from '@/content/legal/privacy.de';

export const metadata: Metadata = { title: `${PRIVACY_DE.title} · SpotOn` };

export default function PrivacyDePage() {
  return <LegalPage doc={PRIVACY_DE} others={legalAlternates('privacy', 'de')} />;
}
