'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { useUserStore, userErrorKey } from '@/store/useUserStore';
import { useToastStore } from '@/store/useToastStore';
import { useT } from '@/hooks/useT';

interface UsernameEditorProps {
  username: string;
}

/** The username heading with its inline edit form (renders inside ProfileHeader's name row). */
export default function UsernameEditor({ username }: Readonly<UsernameEditorProps>) {
  const updateUsername = useUserStore((s) => s.updateUsername);
  const { showToast } = useToastStore();
  const t = useT();
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [isSavingUsername, setIsSavingUsername] = useState(false);

  const handleSaveUsername = async () => {
    const trimmed = newUsername.trim().toLowerCase();
    if (!trimmed) return;
    setIsSavingUsername(true);
    try {
      await updateUsername(trimmed);
      showToast(t('usernameSaved'), 'success');
      setIsEditingUsername(false);
    } catch (error) {
      showToast(t(userErrorKey(error) ?? 'usernameSaveError'), 'error');
    } finally {
      setIsSavingUsername(false);
    }
  };

  const handleStartEditing = () => {
    setNewUsername(username || '');
    setIsEditingUsername(true);
  };

  if (isEditingUsername) {
    return (
      <div className="flex items-center gap-2">
        <input
          id="edit-username"
          name="editUsername"
          type="text"
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value.toLowerCase().replaceAll(/[^a-z0-9_]/g, ''))}
          maxLength={20}
          className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-2xl font-bold focus:outline-hidden focus:ring-2 focus:ring-primary-500 w-48"
          autoFocus
        />
        <button
          onClick={handleSaveUsername}
          disabled={isSavingUsername || !newUsername.trim()}
          className="text-green-400 text-sm font-medium disabled:opacity-50 px-3 py-2 bg-green-500/20 rounded-lg"
        >
          {isSavingUsername ? '...' : t('save')}
        </button>
        <button
          onClick={() => setIsEditingUsername(false)}
          className="text-white/60 text-sm px-3 py-2 bg-white/10 rounded-lg hover:bg-white/20"
        >
          {t('cancel')}
        </button>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-3xl font-bold text-white text-center">{username}</h2>
      <button
        onClick={handleStartEditing}
        className="p-2 text-white/40 hover:text-white/70 transition-colors rounded-lg hover:bg-white/10"
        aria-label={t('editUsername')}
      >
        <Pencil className="w-4 h-4" />
      </button>
    </>
  );
}
