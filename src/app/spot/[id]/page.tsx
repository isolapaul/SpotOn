import type { Metadata } from 'next';
import Home from '../../page';
import { fetchSpotPreview } from '@/lib/spotPreview';

// A shared spot link: the app itself (it opens the spot, see hooks/useSpotLink), with a link
// preview (Open Graph) for approved spots. Pending, rejected or missing spots get the plain app.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const spot = await fetchSpotPreview(decodeURIComponent(id));
  if (!spot) return { title: 'SpotOn' };
  const description = [spot.rating !== null ? `★ ${spot.rating}` : '', spot.description].filter(Boolean).join(' · ');
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://spoton.isolapaul.hu'),
    title: `${spot.name} · SpotOn`,
    description,
    openGraph: {
      title: spot.name,
      description,
      siteName: 'SpotOn',
      type: 'website',
      ...(spot.imageUrl ? { images: [{ url: spot.imageUrl }] } : { images: [{ url: '/icon-512x512.png' }] }),
    },
    twitter: { card: spot.imageUrl ? 'summary_large_image' : 'summary', title: spot.name, description },
  };
}

export default Home;
