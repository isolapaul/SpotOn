import type { Metadata } from 'next';
import Lab from './Lab';

// TEMPORARY device lab for the iOS 26 bottom band (design 1A). Branch preview only: deleted before
// the design work is merged. Installed from this page, the app keeps the see-through status bar and
// has no manifest, so iOS opens this page (not /) from the home-screen icon.
export const metadata: Metadata = {
  title: 'iOS lab',
  manifest: null,
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'iOS lab' },
};

export default function IosLabPage() {
  return <Lab />;
}
