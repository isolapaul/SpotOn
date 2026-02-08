'use client';

import { useState } from 'react';
import { User, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useUserStore } from '@/store/useUserStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useToastStore } from '@/store/useToastStore';

interface UsernameSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UsernameSetupModal({ isOpen, onClose }: Readonly<UsernameSetupModalProps>) {
  const { user, updateUsername, checkUsernameAvailable, setNeedsUsername } = useUserStore();
  const { t } = useLanguageStore();
  const { showToast } = useToastStore();
  const [username, setUsername] = useState(user?.username || '');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const VALID_USERNAME_REGEX = /^[a-z0-9_]+$/;

  if (!isOpen || !user) return null;

  const validateFormat = (value: string): string | null => {
    if (value.length < 3) return t('usernameTooShort');
    if (value.length > 20) return t('usernameTooLong');
    if (!VALID_USERNAME_REGEX.test(value)) return t('usernameInvalidChars');
    return null;
  };

  const handleCheck = async () => {
    const trimmed = username.trim().toLowerCase();
    const formatError = validateFormat(trimmed);
    if (formatError) {
      setError(formatError);
      setIsAvailable(null);
      return;
    }

    setIsChecking(true);
    setError(null);
    try {
      const available = await checkUsernameAvailable(trimmed);
      setIsAvailable(available);
      if (!available) {
        setError(t('usernameTaken'));
      }
    } catch {
      setError(t('usernameCheckError'));
    } finally {
      setIsChecking(false);
    }
  };

  const handleSave = async () => {
    const trimmed = username.trim().toLowerCase();
    const formatError = validateFormat(trimmed);
    if (formatError) {
      setError(formatError);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await updateUsername(trimmed);
      showToast(t('usernameSaved'), 'success');
      onClose();
    } catch (err: any) {
      setError(err.message || t('usernameSaveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    setNeedsUsername(false);
    onClose();
  };

  const handleInputChange = (value: string) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(sanitized);
    setIsAvailable(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-[3500] flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)' }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" />
      
      {/* Modal */}
      <div className="relative glass-card max-w-md w-full p-8 animate-slide-up">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="glass-button p-4 rounded-full">
            <User className="w-12 h-12 text-white" strokeWidth={1.5} />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-white text-center mb-2">
          {t('chooseUsername')}
        </h2>
        <p className="text-white/70 text-center mb-6">
          {t('chooseUsernameDesc')}
        </p>

        {/* Username Input */}
        <div className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-white/80 text-sm font-medium mb-2">
              {t('username')}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50">@</span>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => handleInputChange(e.target.value)}
                onBlur={handleCheck}
                placeholder={t('usernamePlaceholder')}
                maxLength={20}
                className="w-full pl-10 pr-12 py-3 rounded-xl bg-white/10 border border-white/20 
                  text-white placeholder-white/50 focus:outline-none focus:ring-2 
                  focus:ring-primary-500 focus:border-transparent transition-all"
              />
              {/* Status indicator */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {isChecking && <Loader2 className="w-5 h-5 text-white/50 animate-spin" />}
                {isAvailable === true && !isChecking && <Check className="w-5 h-5 text-green-400" />}
                {isAvailable === false && !isChecking && <AlertCircle className="w-5 h-5 text-red-400" />}
              </div>
            </div>
            <p className="text-white/50 text-xs mt-1">{t('usernameHint')}</p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30">
              <p className="text-red-200 text-sm text-center">{error}</p>
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving || !username.trim() || isAvailable === false}
            className="w-full py-4 px-6 rounded-2xl font-semibold text-lg
              bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg
              hover:shadow-xl active:scale-98
              transition-all duration-200
              flex items-center justify-center gap-3
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{t('saving')}</span>
              </>
            ) : (
              <span>{t('saveUsername')}</span>
            )}
          </button>

          {/* Skip Button */}
          <button
            type="button"
            onClick={handleSkip}
            className="w-full py-3 text-white/60 hover:text-white text-sm transition-colors"
          >
            {t('skipForNow')}
          </button>
        </div>
      </div>
    </div>
  );
}
