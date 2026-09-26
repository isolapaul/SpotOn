'use client';

import { useUserStore } from '@/store/useUserStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useT } from '@/hooks/useT';
import { useToastStore } from '@/store/useToastStore';
import { X, Camera, Image as ImageIcon, LogOut, Globe, Bell, BellOff, MapPin } from 'lucide-react';
import { useState, useRef } from 'react';
import Image from 'next/image';
import { compressImage } from '@/lib/imageCompression';
import { MAX_UPLOAD_BYTES, Z } from '@/lib/constants';
import { translate, type Language } from '@/lib/i18n';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { NotificationSettingsModal } from './NotificationSettingsModal';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ isOpen, onClose }: Readonly<SettingsPanelProps>) {
  const { user, signOut, updateProfilePicture, updateProfileBanner } = useUserStore();
  const { language, setLanguage } = useLanguageStore();
  const t = useT();
  const { showToast } = useToastStore();
  const { isPermissionGranted, isLoading: isNotificationLoading, requestPermission, disableNotifications } = usePushNotifications();
  
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
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm ${Z.panelInnerBackdrop} transition-opacity cursor-default`}
        onClick={onClose}
        aria-label="Close settings"
      />
      
      {/* Settings Panel */}
      <div className={`fixed inset-y-0 right-0 w-full sm:w-96 bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl ${Z.panelInnerSheet} overflow-y-auto border-l border-white/10`}>
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-xl border-b border-white/10 p-4 z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              ⚙️ {t('settings')}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Profile Picture Section */}
          <div className="glass-card p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Camera className="w-5 h-5" />
              {t('changeProfilePicture')}
            </h3>
            
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-full overflow-hidden border-4 border-purple-500/30">
                {user.profilePictureURL || user.photoURL ? (
                  <Image
                    src={user.profilePictureURL || user.photoURL || ''}
                    alt={user.username}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">
                      {user.username?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
              </div>
              
              <button
                onClick={() => pictureInputRef.current?.click()}
                disabled={isUploadingPicture}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold
                  hover:from-purple-700 hover:to-pink-700 transition-all duration-200 active:scale-95 disabled:opacity-50"
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
          <div className="glass-card p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              {t('changeProfileBanner')}
            </h3>
            
            <div className="space-y-3">
              <div className="relative w-full h-24 rounded-xl overflow-hidden border-2 border-purple-500/30">
                {user.profileBannerURL ? (
                  <Image
                    src={user.profileBannerURL}
                    alt="Banner"
                    fill
                    sizes="(max-width: 768px) 100vw, 600px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-purple-600/30 to-pink-600/30 flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-white/40" />
                  </div>
                )}
              </div>
              
              <button
                onClick={() => bannerInputRef.current?.click()}
                disabled={isUploadingBanner}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold
                  hover:from-purple-700 hover:to-pink-700 transition-all duration-200 active:scale-95 disabled:opacity-50"
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
          <div className="glass-card p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5" />
              {t('languageSelection')}
            </h3>
            
            <div className="flex flex-col gap-2">
              {['hu', 'en', 'de'].map((lang) => (
                <button
                  key={lang}
                  onClick={() => handleLanguageChange(lang)}
                  className={`py-3 px-4 rounded-xl font-medium transition-all duration-200 ${
                    language === lang
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {lang === 'hu' && '🇭🇺 Magyar'}
                  {lang === 'en' && '🇬🇧 English'}
                  {lang === 'de' && '🇩🇪 Deutsch'}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="glass-card p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              {isPermissionGranted ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              {t('notificationsHeader')}
            </h3>
            
            <button
              onClick={handleNotificationToggle}
              className={`w-full py-3 px-4 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                isPermissionGranted
                  ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
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
              className="mt-3 w-full py-2.5 px-4 rounded-xl bg-blue-500/20 text-blue-400 
                border border-blue-500/30 font-medium text-sm hover:bg-blue-500/30 
                transition-all disabled:opacity-50"
            >
              {t('notificationSettingsButton')}
            </button>
          </div>

          {/* Location Permission */}
          <div className="glass-card p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              {t('locationHeader')}
            </h3>
            
            <button
              onClick={() => {
                if (!navigator.geolocation) return;
                setIsRequestingLocation(true);
                navigator.geolocation.getCurrentPosition(
                  () => {
                    setIsRequestingLocation(false);
                    showToast(t('locationSuccess'), 'success');
                    // Force page reload to pick up new location
                    globalThis.location.reload();
                  },
                  () => {
                    setIsRequestingLocation(false);
                    showToast(t('locationDenied'), 'error');
                  },
                  { enableHighAccuracy: true, timeout: 10000 }
                );
              }}
              disabled={isRequestingLocation}
              className="w-full py-3 px-4 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2
                bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
            >
              <MapPin className="w-5 h-5" />
              {isRequestingLocation ? t('locationRequesting') : t('requestLocationPermission')}
            </button>
          </div>

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
