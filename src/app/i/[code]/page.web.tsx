import type { Metadata } from 'next';
import Home from '../../page';
import { normalizeInviteCode } from '@/lib/referral';

// An invite link (/i/<username>, growth plan §2): the app itself, which remembers the inviter
// for the "Who invited you?" step (hooks/useSpotLink), with a link preview naming the inviter.
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const name = normalizeInviteCode(code);
  const title = name ? `${name} meghívott a SpotOnra` : 'SpotOn';
  const description = 'Fedezd fel és oszd meg a legjobb helyeket a térképen. Regisztrálj, és mindketten XP-t kaptok.';
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://spoton.isolapaul.hu'),
    title,
    description,
    openGraph: { title, description, siteName: 'SpotOn', type: 'website', images: [{ url: '/icon-512x512.png' }] },
    twitter: { card: 'summary', title, description },
  };
}

export default Home;
