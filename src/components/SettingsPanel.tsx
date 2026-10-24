'use client';

import { useUserStore } from '@/store/useUserStore';
import { useT } from '@/hooks/useT';
import { useToastStore } from '@/store/useToastStore';
import { X, LogOut } from 'lucide-react';
import { useState } from 'react';
import { compressImage } from '@/lib/imageCompression';
import { MAX_UPLOAD_BYTES, Z } from '@/lib/constants';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useUserLocation } from '@/hooks/useUserLocation';
import { NotificationSettingsModal } from './NotificationSettingsModal';
import AccountSection from './settings/AccountSection';
import LanguageSection from './settings/LanguageSection';
import LocationSection from './settings/LocationSection';
import NotificationsSection from './settings/NotificationsSection';
import PrivacySection from './settings/PrivacySection';
import ProfileImagesSection from './settings/ProfileImagesSection';
import SoundSection from './settings/SoundSection';
import { deletionConfirmWord } from '@/lib/accountDeletion';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ isOpen, onClose }: Readonly<SettingsPanelProps>) {
  const { user, signOut, updateProfilePicture, updateProfileBanner } = useUserStore();
  const t = useT();
  const { showToast } = useToastStore();
  const { isPermissionGranted, isLoading: isNotificationLoading, requestPermission, disableNotifications } = usePushNotifications();
  const { request: requestLocation } = useUserLocation();
  
  // Kept here (not in the sections): this panel stays mounted while closed, so an upload or a
  // location request that is still running shows again when the settings reopen.
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);

  if (!isOpen || !user) return null;

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      showToast(t('imageTooLarge'), 'error');
      return;
    }

    setIsUploadingPicture(true);
    try {
      // First of two passes (the store compresses again); kept as is, see T23.
      const compressedFile = await compressImage(file, 'settingsProfilePicture');
      await updateProfilePicture(compressedFile);
      showToast(t('profileUpdated'), 'success');
    } catch (error) {
      console.error('Failed to update profile picture:', error);
      showToast(t('profileUpdateError'), 'error');
    } finally {
      setIsUploadingPicture(false);
    }
  };

  const handleProfileBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      showToast(t('imageTooLarge'), 'error');
      return;
    }

    setIsUploadingBanner(true);
    try {
      // First of two passes (the store compresses again); kept as is, see T23.
      const compressedFile = await compressImage(file, 'settingsBanner');
      await updateProfileBanner(compressedFile);
      showToast(t('profileUpdated'), 'success');
    } catch (error) {
      console.error('Failed to update profile banner:', error);
      showToast(t('profileUpdateError'), 'error');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      onClose();
      showToast(t('signOutSuccess'), 'success');
    } catch {
      showToast(t('signOutError'), 'error');
    }
  };

  const handleNotificationToggle = async () => {
    if (isPermissionGranted) {
      showToast(t('notificationsAlreadyEnabled'), 'info');
    } else {
      await requestPermission();
    }
  };

  const handleLocationRequest = async () => {
    // Unsupported: silent, as before (no spinner, no toast)
    if (!navigator.geolocation) return;
    setIsRequestingLocation(true);
    const result = await requestLocation();
    setIsRequestingLocation(false);
    if (result === 'granted') {
      showToast(t('locationSuccess'), 'success');
      // Force page reload so the map re-pans to the new (now cached) location
      globalThis.location.reload();
    } else if (result === 'denied') {
      showToast(t('locationDenied'), 'error');
    }
  };

  // BUG-22: SettingsPanel is only rendered inside ProfilePanel's fixed root at Z.panel (60),
  // which is its stacking context. z-40/z-50 therefore stack above the profile content (a sibling
  // without a z-index inside that root) and never compete with the app-level z-50 dock. Mounting it
  // anywhere else would need the app-level scale instead.
  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        className={`fixed inset-0 bg-black/60 backdrop-blur-xs ${Z.panelInnerBackdrop} transition-opacity cursor-default`}
        onClick={onClose}
        aria-label={t('closeSettings')}
      />
      
      {/* Settings Panel */}
      <div className={`fixed inset-y-0 right-0 w-full sm:w-96 bg-surface-0 ${Z.panelInnerSheet} overflow-y-auto border-l border-white/6`}>
        {/* Header */}
        <div className="sticky top-0 bg-surface-0/85 backdrop-blur-xl px-5 pb-3 z-10" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-[28px] font-bold text-label">
              {t('settings')}
            </h2>
            <button
              onClick={onClose}
              className="no-min-size w-11 h-11 -mr-1.5 grid place-items-center rounded-full"
            >
              <span className="w-[30px] h-[30px] rounded-full grid place-items-center bg-white/10">
                <X className="w-4 h-4 text-label-secondary" strokeWidth={2.5} />
              </span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pt-2 pb-10 space-y-4">
          <ProfileImagesSection
            user={user}
            isUploadingPicture={isUploadingPicture}
            isUploadingBanner={isUploadingBanner}
            onPictureChange={handleProfilePictureUpload}
            onBannerChange={handleProfileBannerUpload}
          />

          <LanguageSection />

          {/* Profile visibility (item 8) */}
          <PrivacySection user={user} />

          <NotificationsSection
            isPermissionGranted={isPermissionGranted}
            isLoading={isNotificationLoading}
            onToggle={handleNotificationToggle}
            onOpenSettings={() => setShowNotificationSettings(true)}
          />

          {/* Interface sounds */}
          <SoundSection />

          <LocationSection isRequesting={isRequestingLocation} onRequest={handleLocationRequest} />

          {/* Account: legal documents and deletion (A1, A2) */}
          <AccountSection confirmWord={deletionConfirmWord(user)} />

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className="w-full py-3 px-4 bg-red-600/20 text-red-400 rounded-xl font-semibold border border-red-500/30
              hover:bg-red-600/30 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            {t('signOut')}
          </button>
        </div>
      </div>

      <NotificationSettingsModal
        isOpen={showNotificationSettings}
        onClose={() => setShowNotificationSettings(false)}
        isEnabled={isPermissionGranted}
        isLoading={isNotificationLoading}
        onEnableNotifications={requestPermission}
        onDisableNotifications={disableNotifications}
      />
    </>
  );
}
