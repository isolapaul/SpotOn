import type { Metadata } from 'next';
import AccountDeletionPage from '@/components/legal/AccountDeletionPage';

export const metadata: Metadata = {
  title: 'Delete your account · SpotOn',
  description: 'How to delete your SpotOn account and data, in the app or on this page.',
};

export default function AccountDeletion() {
  return <AccountDeletionPage />;
}
