import type { Metadata } from 'next';
import LegalPage from '@/components/legal/LegalPage';
import { PRIVACY_HU } from '@/content/legal/privacy.hu';

export const metadata: Metadata = { title: `${PRIVACY_HU.title} · SpotOn` };

export default function PrivacyPage() {
  return <LegalPage doc={PRIVACY_HU} other={{ href: '/privacy/en', label: 'English' }} />;
}
