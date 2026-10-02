'use client';

import { useState } from 'react';
import { Shield, UserPlus } from 'lucide-react';
import Image from 'next/image';
import { useUserStore, userErrorKey, type LookedUpUser } from '@/store/useUserStore';
import { useToastStore } from '@/store/useToastStore';
import { useT } from '@/hooks/useT';

/** Super admin: look a user up by email and grant them admin. */
export default function AdminSearch() {
  const lookupUserByEmail = useUserStore((s) => s.lookupUserByEmail);
  const addAdmin = useUserStore((s) => s.addAdmin);
  const { showToast } = useToastStore();
  const t = useT();
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [searchedUser, setSearchedUser] = useState<LookedUpUser | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearchUser = async () => {
    if (!adminEmailInput.trim()) {
      showToast(t('enterEmail'), 'error');
      return;
    }

    setIsSearching(true);
    try {
      const foundUser = await lookupUserByEmail(adminEmailInput.trim());
      if (foundUser) {
        setSearchedUser(foundUser);
      } else {
        showToast(t('userNotFound'), 'error');
        setSearchedUser(null);
      }
    } catch (error) {
      console.error('Failed to search user:', error);
      showToast(t('searchError'), 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!searchedUser) return;

    try {
      await addAdmin(searchedUser.email);
      showToast(`@${searchedUser.username} ${t('addedAsAdmin')}`, 'success');
      setAdminEmailInput('');
      setSearchedUser(null);
    } catch (error) {
      showToast(t(userErrorKey(error) ?? 'adminAddError'), 'error');
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-amber-400" />
        <h3 className="text-white font-bold text-lg">{t('addAdmin')}</h3>
      </div>

      <div className="space-y-4">
        <input
          id="admin-email"
          name="adminEmail"
          type="email"
          placeholder={t('adminEmailPlaceholder')}
          value={adminEmailInput}
          onChange={(e) => setAdminEmailInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearchUser()}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl
            text-white placeholder:text-white/40 focus:outline-hidden focus:border-amber-500/50"
        />

        <button
          onClick={handleSearchUser}
          disabled={isSearching || !adminEmailInput.trim()}
          className="w-full py-3 px-4 rounded-xl font-semibold
            bg-amber-500/20 text-amber-400 border border-amber-500/30
            hover:bg-amber-500/30 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200"
        >
          {isSearching ? t('searching') : t('searchUser')}
        </button>

        {/* Searched User Preview */}
        {searchedUser && (
          <div className="bg-white/5 border border-amber-500/30 rounded-xl p-4">
            <div className="flex items-center gap-4 mb-4">
              {searchedUser.photoURL ? (
                <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-amber-500/30">
                  <Image
                    src={searchedUser.photoURL}
                    alt={searchedUser.username}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-amber-500/30 bg-brand-600 flex items-center justify-center">
                  <span className="text-white text-xl font-bold">{(searchedUser.username?.charAt(0) || 'U').toUpperCase()}</span>
                </div>
              )}
              <div>
                <h4 className="text-white font-semibold">{searchedUser.username}</h4>
                <p className="text-white/60 text-sm">{searchedUser.email}</p>
              </div>
            </div>

            <button
              onClick={handleAddAdmin}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm
                bg-green-500/20 text-green-400 border border-green-500/30
                hover:bg-green-500/30 active:scale-98
                transition-all duration-200 flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>{t('grantAdmin')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
