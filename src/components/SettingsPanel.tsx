'use client';

import { useUserStore } from '@/store/useUserStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useT } from '@/hooks/useT';
import { useToastStore } from '@/store/useToastStore';
import { X, Camera, Image as ImageIcon, LogOut, Globe, Bell, BellOff, MapPin, Check } from 'lucide-react';
import { useState, useRef } from 'react';
import Image from 'next/image';
import { compressImage } from '@/lib/imageCompression';
import { MAX_UPLOAD_BYTES, Z } from '@/lib/constants';
import { LANGUAGE_NAMES, translate, type Language } from '@/lib/i18n';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useUserLocation } from '@/hooks/useUserLocation';
import { NotificationSettingsModal } from './NotificationSettingsModal';
import AccountSection from './settings/AccountSection';
import PrivacySection from './settings/PrivacySection';
import SoundSection from './settings/SoundSection';
import { deletionConfirmWord } from '@/lib/accountDeletion';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// Each language in its own name (no flag emoji, owner decision).

export default function SettingsPanel({ isOpen, onClose }: Readonly<SettingsPanelProps>) {
  const { user, signOut, updateProfilePicture, updateProfileBanner } = useUserStore();
  const { language, setLanguage } = useLanguageStore();
  const t = useT();
  const { showToast } = useToastStore();
  const { isPermissionGranted, isLoading: isNotificationLoading, requestPermission, disableNotifications } = usePushNotifications();
  const { request: requestLocation } = useUserLocation();
  
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  
  const pictureInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

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

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage as Language);
    let langName = 'Magyar';
    if (newLanguage === 'en') langName = 'English';
    else if (newLanguage === 'de') langName = 'Deutsch';
    // Toast in the newly chosen language (the render-time t still has the old one).
    showToast(translate(newLanguage as Language, 'languageChanged', { language: langName }), 'success');
  };

  const handleNotificationToggle = async () => {
    if (isPermissionGranted) {
      showToast(t('notificationsAlreadyEnabled'), 'info');
    } else {
      await requestPermission();
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
        aria-label="Close settings"
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
          {/* Profile Picture Section */}
          <div className="rounded-[18px] bg-surface-1 p-5">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-label-tertiary mb-3 flex items-center gap-2">
              <Camera className="w-5 h-5" />
              {t('changeProfilePicture')}
            </h3>
            
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-full overflow-hidden ring-4 ring-brand-500/30">
                {user.profilePictureURL || user.photoURL ? (
                  <Image
                    src={user.profilePictureURL || user.photoURL || ''}
                    alt={user.username}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-brand-600 flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">
                      {user.username?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
              </div>
              
              <button
                onClick={() => pictureInputRef.current?.click()}
                disabled={isUploadingPicture}
                className="flex-1 py-2.5 px-4 bg-brand-600 text-white rounded-xl font-semibold
                  active:bg-brand-700 transition-all duration-200 active:scale-95 disabled:opacity-50"
              >
                {isUploadingPicture ? t('uploadingImage') : t('uploadPicture')}
              </button>
            </div>
            
            <input
              ref={pictureInputRef}
              type="file"
              accept="image/*"
              onChange={handleProfilePictureUpload}
              className="hidden"
            />
          </div>

          {/* Profile Banner Section */}
          <div className="rounded-[18px] bg-surface-1 p-5">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-label-tertiary mb-3 flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              {t('changeProfileBanner')}
            </h3>
            
            <div className="space-y-3">
              <div className="relative w-full h-24 rounded-xl overflow-hidden ring-1 ring-white/10">
                {user.profileBannerURL ? (
                  <Image
                    src={user.profileBannerURL}
                    alt="Banner"
                    fill
                    sizes="(max-width: 768px) 100vw, 600px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-surface-2 flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-white/40" />
                  </div>
                )}
              </div>
              
              <button
                onClick={() => bannerInputRef.current?.click()}
                disabled={isUploadingBanner}
                className="w-full py-2.5 px-4 bg-brand-600 text-white rounded-xl font-semibold
                  active:bg-brand-700 transition-all duration-200 active:scale-95 disabled:opacity-50"
              >
                {isUploadingBanner ? t('uploadingImage') : t('uploadBanner')}
              </button>
            </div>
            
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              onChange={handleProfileBannerUpload}
              className="hidden"
            />
          </div>

          {/* Language Selection */}
          <div className="rounded-[18px] bg-surface-1 p-5">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-label-tertiary mb-3 flex items-center gap-2">
              <Globe className="w-5 h-5" />
              {t('languageSelection')}
            </h3>
            
            <div className="flex flex-col gap-2">
              {['hu', 'en', 'de'].map((lang) => (
                <button
                  key={lang}
                  onClick={() => handleLanguageChange(lang)}
                  className={`no-min-size w-full text-left py-3 px-4 rounded-xl font-medium transition-all duration-200 ${
                    language === lang
                      ? 'bg-white/8 text-label'
                      : 'bg-transparent text-label-secondary active:bg-white/6'
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span>{LANGUAGE_NAMES[lang as 'hu' | 'en' | 'de']}</span>
                    {language === lang && <Check className="w-5 h-5 text-brand-400" strokeWidth={2.5} aria-hidden="true" />}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Profile visibility (item 8) */}
          <PrivacySection user={user} />

          {/* Notifications */}
          <div className="rounded-[18px] bg-surface-1 p-5">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-label-tertiary mb-3 flex items-center gap-2">
              {isPermissionGranted ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              {t('notificationsHeader')}
            </h3>
            
            <button
              onClick={handleNotificationToggle}
              className={`w-full py-3 px-4 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                isPermissionGranted
                  ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                  : 'bg-brand-600 text-white active:bg-brand-700'
              }`}
            >
              {isPermissionGranted ? (
                <>
                  <Bell className="w-5 h-5" />
                  {t('enabled')}
                </>
              ) : (
                <>
                  <BellOff className="w-5 h-5" />
                  {t('enableAction')}
                </>
              )}
            </button>

            <button
              onClick={() => setShowNotificationSettings(true)}
              disabled={isNotificationLoading}
              className="mt-3 w-full py-2.5 px-4 rounded-xl bg-white/8 text-label font-medium text-sm
                active:bg-white/12 transition-colors disabled:opacity-50"
            >
              {t('notificationSettingsButton')}
            </button>
          </div>

          {/* Interface sounds */}
          <SoundSection />

          {/* Location Permission */}
          <div className="rounded-[18px] bg-surface-1 p-5">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-label-tertiary mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              {t('locationHeader')}
            </h3>
            
            <button
              onClick={async () => {
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
              }}
              disabled={isRequestingLocation}
              className="w-full py-3 px-4 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2
                bg-brand-600 text-white active:bg-brand-700 disabled:opacity-50"
            >
              <MapPin className="w-5 h-5" />
              {isRequestingLocation ? t('locationRequesting') : t('requestLocationPermission')}
            </button>
          </div>

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
