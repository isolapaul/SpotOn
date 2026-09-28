'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, FileText, Shield, UserX } from 'lucide-react';
import { useT } from '@/hooks/useT';
import DeleteAccountModal from './DeleteAccountModal';

interface AccountSectionProps {
  username: string;
}

/** Settings → Account: legal documents (A1) and account deletion (A2). */
export default function AccountSection({ username }: Readonly<AccountSectionProps>) {
  const t = useT();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const row = 'w-full flex items-center gap-3 px-1 py-3 text-left text-white/90 hover:text-white transition';

  return (
    <div className="glass-card p-5">
      <h3 className="text-white font-semibold mb-2">{t('accountHeader')}</h3>
      <Link href="/privacy" className={row}>
        <Shield className="w-5 h-5 text-white/60" />
        <span className="flex-1">{t('privacyPolicy')}</span>
        <ChevronRight className="w-4 h-4 text-white/40" />
      </Link>
      <Link href="/terms" className={`${row} border-t border-white/10`}>
        <FileText className="w-5 h-5 text-white/60" />
        <span className="flex-1">{t('termsOfUse')}</span>
        <ChevronRight className="w-4 h-4 text-white/40" />
      </Link>
      <button onClick={() => setIsDeleteOpen(true)} className={`${row} border-t border-white/10 text-red-400 hover:text-red-300`}>
        <UserX className="w-5 h-5" />
        <span className="flex-1">{t('deleteAccount')}</span>
      </button>
      {isDeleteOpen && <DeleteAccountModal username={username} onClose={() => setIsDeleteOpen(false)} />}
    </div>
  );
}
