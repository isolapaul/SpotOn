import type { Metadata } from 'next';
import LegalPage from '@/components/legal/LegalPage';
import { PRIVACY_EN } from '@/content/legal/privacy.en';

export const metadata: Metadata = { title: `${PRIVACY_EN.title} · SpotOn` };

export default function PrivacyEnPage() {
  return <LegalPage doc={PRIVACY_EN} other={{ href: '/privacy', label: 'Magyar változat' }} />;
}
