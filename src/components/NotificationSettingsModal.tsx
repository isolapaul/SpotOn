'use client';

import React, { useState, useEffect } from 'react';
import { X, Bell } from 'lucide-react';
import { useLanguageStore } from '@/store/useLanguageStore';
import { translations } from '@/lib/translations';
import { useUserStore } from '@/store/useUserStore';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useNotificationStore } from '@/store/useNotificationStore';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  isEnabled: boolean;
  isLoading: boolean;
  onEnableNotifications: () => Promise<boolean> | boolean;
  onDisableNotifications: () => Promise<void> | void;
}

interface NotificationSettingsState {
  spotApproved: boolean;
  spotReviewed: boolean;
  newPendingSpot: boolean;
}

interface ToggleCardProps {
  title: string;
  description: string;
  isEnabled: boolean;
  disabled: boolean;
  onToggle: () => void;
  adminBadge?: boolean;
}

const ToggleCard = ({
  title,
  description,
  isEnabled,
  disabled,
  onToggle,
  adminBadge
}: ToggleCardProps) => (
  <div className={`glass-card p-4 ${disabled ? 'opacity-50 pointer-events-none' : ''} ${adminBadge ? 'border border-yellow-500/30' : ''}`}>
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-white font-semibold text-sm">
            {title}
          </h3>
          {adminBadge && (
            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] font-bold rounded">
              ADMIN
            </span>
          )}
        </div>
        <p className="text-white/60 text-xs">
          {description}
        </p>
      </div>
      <button
        onClick={onToggle}
        className={`flex-shrink-0 w-12 h-6 rounded-full transition-all ${
          isEnabled ? 'bg-green-500' : 'bg-white/20'
        }`}
      >
        <div
          className={`w-5 h-5 bg-white rounded-full shadow-md transition-all ${
            isEnabled ? 'ml-[26px]' : 'ml-[2px]'
          } mt-[2px]`}
        />
      </button>
    </div>
  </div>
);

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({ 
  isOpen, 
  onClose,
  isAdmin,
  isEnabled,
  isLoading,
  onEnableNotifications,
  onDisableNotifications
}) => {
  const { language } = useLanguageStore();
  const { user, setUser } = useUserStore();
  const { addNotification } = useNotificationStore();
  const t = (key: keyof typeof translations.hu) => translations[language || 'hu'][key] || key;

  // Default settings if none exist
  const defaultSettings: NotificationSettingsState = {
    spotApproved: true,
    spotReviewed: true,
    newPendingSpot: true,
  };

  const [settings, setSettings] = useState<NotificationSettingsState>(user?.notificationSettings || defaultSettings);
  const [isSaving, setIsSaving] = useState(false);

  // Update local state when user data changes
  useEffect(() => {
    if (user?.notificationSettings) {
      setSettings(user.notificationSettings);
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleToggle = (key: keyof NotificationSettingsState) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        notificationSettings: settings
      });

      // Update local user state
      setUser({
        ...user,
        notificationSettings: settings
      });

      addNotification({
        title: t('notificationSettingsSaved'),
        body: t('notificationSettingsInfo'),
        type: 'success',
      });
      onClose();
    } catch (error) {
      console.error('Error saving notification settings:', error);
      addNotification({
        title: t('errorSavingSettings'),
        body: '',
        type: 'warning',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleNotifications = async () => {
    if (isEnabled) {
      await onDisableNotifications();
      onClose();
      return;
    }

    const enabled = await onEnableNotifications();
    if (!enabled) {
      return;
    }
  };

  let actionLabel = t('enable');
  if (isLoading) {
    actionLabel = t('enabling');
  } else if (isEnabled) {
    actionLabel = t('disableNotificationsButton');
  }

  const statusTitle = isEnabled ? t('notificationsEnabled') : t('notificationsDisabled');
  const statusDesc = isEnabled ? t('disableNotificationsDesc') : t('enableNotificationsDesc');
  const statusCardClass = isEnabled ? 'border border-green-500/30' : 'border border-red-500/30';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="relative p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-bold text-white">
              {t('notificationSettings')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className={`glass-card p-4 ${statusCardClass}`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-white font-semibold text-sm mb-1">
                  {statusTitle}
                </h3>
                <p className="text-white/60 text-xs">
                  {statusDesc}
                </p>
              </div>
              <button
                onClick={handleToggleNotifications}
                disabled={isLoading}
                className={`flex-shrink-0 px-3 py-2 rounded-lg border font-medium text-xs transition-all disabled:opacity-50 ${
                  isEnabled
                    ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
                    : 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30'
                }`}
              >
                {actionLabel}
              </button>
            </div>
          </div>

          {!isEnabled && (
            <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <Bell className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-amber-200/80 text-xs">
                {t('notificationSettingsEnableHint')}
              </p>
            </div>
          )}

          <ToggleCard
            title={t('notifySpotApproved')}
            description={t('notifySpotApprovedDesc')}
            isEnabled={settings.spotApproved}
            disabled={!isEnabled}
            onToggle={() => handleToggle('spotApproved')}
          />

          <ToggleCard
            title={t('notifySpotReviewed')}
            description={t('notifySpotReviewedDesc')}
            isEnabled={settings.spotReviewed}
            disabled={!isEnabled}
            onToggle={() => handleToggle('spotReviewed')}
          />

          {isAdmin && (
            <ToggleCard
              title={t('notifyNewPendingSpot')}
              description={t('notifyNewPendingSpotDesc')}
              isEnabled={settings.newPendingSpot}
              disabled={!isEnabled}
              onToggle={() => handleToggle('newPendingSpot')}
              adminBadge
            />
          )}

          {/* Info Banner */}
          <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <Bell className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-blue-200/80 text-xs">
              {t('notificationSettingsInfo')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-lg bg-white/10 text-white 
              font-medium text-sm hover:bg-white/20 transition-all"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-2.5 px-4 rounded-lg bg-blue-500 text-white 
              font-medium text-sm hover:bg-blue-600 transition-all disabled:opacity-50"
          >
            {isSaving ? t('saving') : t('saveSettings')}
          </button>
        </div>
      </div>
    </div>
  );
};
