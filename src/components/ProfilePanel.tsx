'use client';

import { X, MapPin, Heart, LogOut, Shield, Clock, UserPlus, Trash2, Bell, BellOff, Pencil, Star, Plus } from 'lucide-react';
import Image from 'next/image';
import { useUserStore } from '@/store/useUserStore';
import { useSpotStore, isAdmin, isSuperAdmin } from '@/store/useSpotStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Spot } from '@/store/useSpotStore';
import { useToastStore } from '@/store/useToastStore';

interface ProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfilePanel({ isOpen, onClose }: Readonly<ProfilePanelProps>) {
  const { user, signOut, adminUsers, addAdmin, removeAdmin, searchUserByEmail, updateProfilePicture, updateProfileBanner, updateUsername } = useUserStore();
  const { spots, approveSpot } = useSpotStore();
  const { t } = useLanguageStore();
  const { showToast } = useToastStore();
  const { isPermissionGranted, isLoading: isNotificationLoading, requestPermission, disableNotifications } = usePushNotifications();
  const [activeTab, setActiveTab] = useState<'my-spots' | 'favorites' | 'pending' | 'admin'>('my-spots');
  const [myAllSpots, setMyAllSpots] = useState<Spot[]>([]);
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [searchedUser, setSearchedUser] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [firestoreCategories, setFirestoreCategories] = useState<Array<{ id: string; name: string; icon: string }>>([]);
  const profilePicInputRef = useRef<HTMLInputElement>(null);
  
  // iOS Swipe-to-Close Gesture
  const [dragStartX, setDragStartX] = useState(0);
  const [dragCurrentX, setDragCurrentX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  
  const userIsAdmin = isAdmin(user?.email);
  const userIsSuperAdmin = isSuperAdmin(user?.email);

  // Helper function for spot status styling
  const getStatusClassName = (status: string) => {
    if (status === 'approved') return 'bg-green-500/20 text-green-400';
    if (status === 'pending') return 'bg-yellow-500/20 text-yellow-400';
    return 'bg-red-500/20 text-red-400';
  };

  // Helper function for spot status text
  const getStatusText = (status: string) => {
    if (status === 'approved') return t('approved');
    if (status === 'pending') return t('pending');
    return t('rejected');
  };

  // Fetch ALL user's spots (approved + pending)
  useEffect(() => {
    if (!user || !isOpen) return;

    const spotsRef = collection(db, 'spots');
    const q = query(spotsRef, where('createdBy', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userSpots: Spot[] = [];
      snapshot.forEach((doc) => {
        userSpots.push({ id: doc.id, ...doc.data() } as Spot);
      });
      setMyAllSpots(userSpots);
    });

    return () => unsubscribe();
  }, [user, isOpen]);

  // Fetch dynamic categories from Firestore (admin only)
  useEffect(() => {
    if (!isOpen || !userIsSuperAdmin) return;

    const categoriesRef = collection(db, 'categories');
    const unsubscribe = onSnapshot(categoriesRef, (snapshot) => {
      const cats: Array<{ id: string; name: string; icon: string }> = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        cats.push({ id: doc.id, name: data.name, icon: data.icon });
      });
      setFirestoreCategories(cats);
    });

    return () => unsubscribe();
  }, [isOpen, userIsSuperAdmin]);

  if (!isOpen || !user) return null;

  const favoriteSpots = spots.filter((spot) => user.savedSpots.includes(spot.id));
  const pendingSpots = spots.filter((spot) => spot.status === 'pending');

  const handleApproveSpot = async (spotId: string) => {
    try {
      await approveSpot(spotId);
    } catch (error) {
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      onClose();
    } catch (error) {
    }
  };

  const handleSearchUser = async () => {
    if (!adminEmailInput.trim()) {
      showToast(t('enterEmail'), 'error');
      return;
    }

    setIsSearching(true);
    try {
      const foundUser = await searchUserByEmail(adminEmailInput.trim());
      if (foundUser) {
        setSearchedUser(foundUser);
      } else {
        showToast(t('userNotFound'), 'error');
        setSearchedUser(null);
      }
    } catch (error) {
      showToast(t('searchError'), 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!searchedUser) return;

    try {
      await addAdmin(searchedUser.email);
      showToast(`${searchedUser.name} ${t('addedAsAdmin')}`, 'success');
      setAdminEmailInput('');
      setSearchedUser(null);
    } catch (error: any) {
      showToast(error.message || t('adminAddError'), 'error');
    }
  };

  const handleRemoveAdmin = async (adminId: string, adminName: string) => {
    if (!confirm(t('confirmRemoveAdmin').replace('{name}', adminName))) return;

    try {
      await removeAdmin(adminId);
      showToast(`${adminName} ${t('removedFromAdmins')}`, 'success');
    } catch (error: any) {
      showToast(error.message || t('adminRemoveError'), 'error');
    }
  };

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast(t('imageTooLarge'), 'error');
      return;
    }
    setIsUploadingPicture(true);
    try {
      await updateProfilePicture(file);
      showToast(t('profileUpdated'), 'success');
    } catch {
      showToast(t('profileUpdateError'), 'error');
    } finally {
      setIsUploadingPicture(false);
    }
  };

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast(t('imageTooLarge'), 'error');
      return;
    }
    setIsUploadingBanner(true);
    try {
      await updateProfileBanner(file);
      showToast(t('profileUpdated'), 'success');
    } catch {
      showToast(t('profileUpdateError'), 'error');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleSaveUsername = async () => {
    const trimmed = newUsername.trim().toLowerCase();
    if (!trimmed) return;
    setIsSavingUsername(true);
    try {
      await updateUsername(trimmed);
      showToast(t('usernameSaved'), 'success');
      setIsEditingUsername(false);
    } catch (error: any) {
      showToast(error.message || t('usernameSaveError'), 'error');
    } finally {
      setIsSavingUsername(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !newCategoryIcon.trim()) return;
    setIsAddingCategory(true);
    try {
      await addDoc(collection(db, 'categories'), {
        name: newCategoryName.trim(),
        icon: newCategoryIcon.trim(),
        createdAt: serverTimestamp(),
      });
      showToast(t('categoryAdded'), 'success');
      setNewCategoryName('');
      setNewCategoryIcon('');
    } catch (error: any) {
      showToast(error.message || t('categoryAddError'), 'error');
    } finally {
      setIsAddingCategory(false);
    }
  };

  // Touch handlers for swipe gesture
  const handleTouchStart = (e: React.TouchEvent) => {
    setDragStartX(e.touches[0].clientX);
    setDragCurrentX(e.touches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - dragStartX;
    
    // Only allow rightward drag (iOS back gesture)
    if (diff > 0) {
      setDragCurrentX(currentX);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    const dragDistance = dragCurrentX - dragStartX;
    
    // Close if dragged more than 150px to the right
    if (dragDistance > 150) {
      onClose();
    }
    
    // Reset
    setIsDragging(false);
    setDragStartX(0);
    setDragCurrentX(0);
  };

  const translateX = isDragging ? Math.max(0, dragCurrentX - dragStartX) : 0;
  
  return (
    <div className="fixed inset-0 z-[60] animate-slide-up" style={{ backgroundColor: '#0f172a' }}>
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-xl cursor-default"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        aria-label="Close profile panel"
        tabIndex={-1}
      />
      
      {/* Panel with Swipe Support */}
      <div 
        className="absolute inset-0 flex flex-col bg-gray-900/95 backdrop-blur-2xl"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Profile Banner - Mobile Optimized 25vh */}
        <div className="relative w-full h-[25vh] flex-shrink-0 bg-gradient-to-r from-primary-700 to-primary-900">
          {user.profileBannerURL ? (
            <Image
              src={user.profileBannerURL}
              alt="Profile banner"
              fill
              className="object-cover"
              priority
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />
          
          {/* Hidden file inputs */}
          <input
            id="banner-upload"
            name="bannerUpload"
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            onChange={handleBannerChange}
            className="hidden"
          />
          <input
            id="profile-pic-upload"
            name="profilePicUpload"
            ref={profilePicInputRef}
            type="file"
            accept="image/*"
            onChange={handleProfilePictureChange}
            className="hidden"
          />
          
          {/* Top action buttons */}
          <div className="absolute left-4 right-4 flex justify-between items-center" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}>
            <button
              onClick={handleSignOut}
              className="glass-button p-3 rounded-full touch-manipulation min-w-[48px] min-h-[48px]"
              aria-label="Sign Out"
            >
              <LogOut className="w-5 h-5 text-white" />
            </button>
            
            <button
              onClick={onClose}
              className="glass-button p-3 rounded-full touch-manipulation min-w-[48px] min-h-[48px]"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Avatar & User Info - Overlapping Banner */}
        <div className="flex-shrink-0 px-6 -mt-16 mb-6">
          <div className="flex flex-col items-center">
            {/* Large Profile Picture */}
            <div className="relative">
              {(user.profilePictureURL || user.photoURL) ? (
                <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-gray-900 shadow-2xl bg-gray-800">
                  <Image
                    src={user.profilePictureURL || user.photoURL || ''}
                    alt={user.name}
                    fill
                    className="object-cover"
                    priority
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      if (target.parentElement) {
                        target.parentElement.innerHTML = `<div class="w-full h-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center"><span class="text-white text-5xl font-bold">${user.name?.charAt(0).toUpperCase() || 'U'}</span></div>`;
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-gray-900 shadow-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                  <span className="text-white text-5xl font-bold">{user.name?.charAt(0).toUpperCase() || 'U'}</span>
                </div>
              )}
            </div>
            
            {/* User Info - Centered */}
            <div className="flex flex-col items-center mt-4 w-full">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-3xl font-bold text-white text-center">{user.name}</h2>
                {userIsAdmin && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/30">
                    <Shield className="w-4 h-4 text-amber-400" />
                  </div>
                )}
              </div>
              {/* Editable Username */}
              {isEditingUsername ? (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-white/50">@</span>
                  <input
                    id="edit-username"
                    name="editUsername"
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    maxLength={20}
                    className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 w-32"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveUsername}
                    disabled={isSavingUsername || !newUsername.trim()}
                    className="text-green-400 text-sm font-medium disabled:opacity-50"
                  >
                    {isSavingUsername ? '...' : t('save')}
                  </button>
                  <button
                    onClick={() => setIsEditingUsername(false)}
                    className="text-white/40 text-sm"
                  >
                    {t('cancel')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 mt-1">
                  <p className="text-white/60 text-sm">@{user.username || 'no-username'}</p>
                  <button
                    onClick={() => {
                      setNewUsername(user.username || '');
                      setIsEditingUsername(true);
                    }}
                    className="p-1 text-white/40 hover:text-white/70 transition-colors"
                    aria-label={t('editUsername')}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="flex gap-4 mt-2">
                <div>
                  <span className="text-white font-bold">{myAllSpots.length}</span>
                  <span className="text-white/60 text-xs ml-1">{t('spots')}</span>
                </div>
                <div>
                  <span className="text-white font-bold">{favoriteSpots.length}</span>
                  <span className="text-white/60 text-xs ml-1">{t('favorites')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 flex overflow-x-auto border-b border-white/10 scrollbar-hide">
          <button
            onClick={() => setActiveTab('my-spots')}
            className={`flex-shrink-0 px-6 py-4 text-center font-medium transition-all whitespace-nowrap ${
              activeTab === 'my-spots'
                ? 'text-white border-b-2 border-primary-500 bg-white/5'
                : 'text-white/60'
            }`}
          >
            <MapPin className="w-4 h-4 inline mr-2" />
            {t('mySpots')}
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`flex-shrink-0 px-6 py-4 text-center font-medium transition-all whitespace-nowrap ${
              activeTab === 'favorites'
                ? 'text-white border-b-2 border-primary-500 bg-white/5'
                : 'text-white/60'
            }`}
          >
            <Heart className="w-4 h-4 inline mr-2" />
            {t('favorites')}
          </button>
          
          {/* Pending Tab - Only for Admins */}
          {userIsAdmin && (
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-shrink-0 px-6 py-4 text-center font-medium transition-all whitespace-nowrap ${
                activeTab === 'pending'
                  ? 'text-white border-b-2 border-amber-500 bg-white/5'
                  : 'text-white/60'
              }`}
            >
              <Clock className="w-4 h-4 inline mr-2" />
              <span className="relative">
                {t('pendingApproval')}
                {pendingSpots.length > 0 && (
                  <span className="absolute -top-1 -right-5 w-5 h-5 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {pendingSpots.length}
                  </span>
                )}
              </span>
            </button>
          )}

          {/* Admin Panel Tab - Only for Super Admin */}
          {userIsSuperAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex-shrink-0 px-6 py-4 text-center font-medium transition-all whitespace-nowrap ${
                activeTab === 'admin'
                  ? 'text-white border-b-2 border-purple-500 bg-white/5'
                  : 'text-white/60'
              }`}
            >
              <Shield className="w-4 h-4 inline mr-2" />
              <span>{t('adminCount')}</span>
            </button>
          )}
        </div>

        {/* Content with Safe Area Bottom Padding */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pt-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>
          {activeTab === 'my-spots' && (
            <div className="space-y-6">
              {/* Notification Settings */}
              <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {isPermissionGranted ? (
                      <Bell className="w-5 h-5 text-green-400" />
                    ) : (
                      <BellOff className="w-5 h-5 text-white/40" />
                    )}
                    <div>
                      <h3 className="text-white font-semibold text-sm">
                        {t('enableNotifications')}
                      </h3>
                      <p className="text-white/60 text-xs">
                        {t('notificationPromptText')}
                      </p>
                    </div>
                  </div>
                </div>
                
                {isPermissionGranted ? (
                  <button
                    onClick={disableNotifications}
                    className="w-full py-2 px-4 rounded-lg bg-red-500/20 text-red-400 
                      border border-red-500/30 font-medium text-sm hover:bg-red-500/30 
                      transition-all"
                  >
                    {t('notificationsDisabled')}
                  </button>
                ) : (
                  <button
                    onClick={requestPermission}
                    disabled={isNotificationLoading}
                    className="w-full py-2 px-4 rounded-lg bg-green-500/20 text-green-400 
                      border border-green-500/30 font-medium text-sm hover:bg-green-500/30 
                      transition-all disabled:opacity-50"
                  >
                    {isNotificationLoading ? t('enabling') : t('enable')}
                  </button>
                )}
              </div>

              {/* My Spots List */}
              <div className="space-y-4">
              {myAllSpots.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <MapPin className="w-12 h-12 text-white/40 mx-auto mb-3" />
                  <p className="text-white/60">{t('noSpotsYet')}</p>
                  <p className="text-white/40 text-sm mt-1">{t('startExploring')}</p>
                </div>
              ) : (
                myAllSpots.map((spot) => (
                  <div key={spot.id} className="glass-card p-4 flex gap-4">
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                      <Image
                        src={spot.imageUrl}
                        alt={spot.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold line-clamp-1">{spot.name}</h3>
                      <p className="text-white/60 text-sm line-clamp-2">{spot.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusClassName(spot.status)}`}>
                          {getStatusText(spot.status)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
              </div>
            </div>
          )}

          {activeTab === 'favorites' && (
            <div className="space-y-4">
              {favoriteSpots.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <Heart className="w-12 h-12 text-white/40 mx-auto mb-3" />
                  <p className="text-white/60">{t('noFavoritesYet')}</p>
                  <p className="text-white/40 text-sm mt-1">{t('startSaving')}</p>
                </div>
              ) : (
                favoriteSpots.map((spot) => {
                  const avgRating = spot.reviews && spot.reviews.length > 0
                    ? spot.reviews.reduce((acc, r) => acc + r.rating, 0) / spot.reviews.length
                    : 0;
                  const reviewCount = spot.reviews?.length || 0;
                  return (
                    <div key={spot.id} className="glass-card p-4 flex gap-4">
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                        <Image
                          src={spot.imageUrl}
                          alt={spot.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold line-clamp-1">{spot.name}</h3>
                        <p className="text-white/60 text-sm line-clamp-2">{spot.description}</p>
                        <div className="flex items-center gap-1 mt-2">
                          {avgRating > 0 ? (
                            <>
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`w-3 h-3 ${
                                      star <= Math.round(avgRating)
                                        ? 'text-yellow-400 fill-yellow-400'
                                        : 'text-white/20'
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="text-white/70 text-xs ml-1">
                                {avgRating.toFixed(1)} ({reviewCount})
                              </span>
                            </>
                          ) : (
                            <span className="text-white/40 text-xs">{t('noReviews')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Pending Spots Tab - Admin Only */}
          {activeTab === 'pending' && userIsAdmin && (
            <div className="space-y-4">
              {pendingSpots.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <Clock className="w-12 h-12 text-white/40 mx-auto mb-3" />
                  <p className="text-white/60">{t('noPendingSpots')}</p>
                  <p className="text-white/40 text-sm mt-1">{t('allSpotsApproved')}</p>
                </div>
              ) : (
                pendingSpots.map((spot) => (
                  <div key={spot.id} className="glass-card p-4">
                    <div className="flex gap-4 mb-3">
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                        <Image
                          src={spot.imageUrl}
                          alt={spot.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold line-clamp-1">{spot.name}</h3>
                        <p className="text-white/60 text-sm line-clamp-2">{spot.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400">
                            ⏳ {t('pendingApproval')}
                          </span>
                          <span className="text-white/50 text-xs">
                            {spot.createdByName}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Approve Button */}
                    <button
                      onClick={() => handleApproveSpot(spot.id)}
                      className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm
                        bg-green-500/20 text-green-400 border border-green-500/30
                        hover:bg-green-500/30 active:scale-98
                        transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <Shield className="w-4 h-4" />
                      <span>{t('approve')}</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Admin Panel - Super Admin Only */}
          {activeTab === 'admin' && userIsSuperAdmin && (
            <div className="space-y-6">
              {/* Add Admin Section */}
              <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-purple-400" />
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
                      text-white placeholder:text-white/40 focus:outline-none focus:border-purple-500/50"
                  />
                  
                  <button
                    onClick={handleSearchUser}
                    disabled={isSearching || !adminEmailInput.trim()}
                    className="w-full py-3 px-4 rounded-xl font-semibold
                      bg-purple-500/20 text-purple-400 border border-purple-500/30
                      hover:bg-purple-500/30 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed
                      transition-all duration-200"
                  >
                    {isSearching ? t('searching') : t('searchUser')}
                  </button>

                  {/* Searched User Preview */}
                  {searchedUser && (
                    <div className="bg-white/5 border border-purple-500/30 rounded-xl p-4">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-purple-500/30">
                          <Image
                            src={searchedUser.photoURL || '/default-avatar.png'}
                            alt={searchedUser.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <h4 className="text-white font-semibold">{searchedUser.name}</h4>
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

              {/* Current Admins List */}
              <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-amber-400" />
                  <h3 className="text-white font-bold text-lg">{t('currentAdmins')}</h3>
                  <span className="text-white/60 text-sm ml-auto">{adminUsers.length} {t('adminCount')}</span>
                </div>

                <div className="space-y-3">
                  {adminUsers.length === 0 ? (
                    <p className="text-white/40 text-center py-4">{t('noAdminsYet')}</p>
                  ) : (
                    adminUsers.map((admin) => (
                      <div key={admin.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
                        <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-amber-500/30 flex-shrink-0">
                          <Image
                            src={admin.photoURL || '/default-avatar.png'}
                            alt={admin.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-white font-semibold">{admin.name}</h4>
                            <Shield className="w-3 h-3 text-amber-400" />
                          </div>
                          <p className="text-white/60 text-sm truncate">{admin.email}</p>
                        </div>

                        <button
                          onClick={() => handleRemoveAdmin(admin.id, admin.name)}
                          className="p-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30
                            hover:bg-red-500/30 active:scale-95 transition-all duration-200 flex-shrink-0"
                          aria-label="Remove admin"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Category Management Section */}
              <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Plus className="w-5 h-5 text-green-400" />
                  <h3 className="text-white font-bold text-lg">{t('manageCategories')}</h3>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={t('categoryIcon')}
                      value={newCategoryIcon}
                      onChange={(e) => setNewCategoryIcon(e.target.value)}
                      className="w-16 px-3 py-3 bg-white/5 border border-white/10 rounded-xl
                        text-white text-center text-xl placeholder:text-white/40 focus:outline-none focus:border-green-500/50"
                      maxLength={4}
                    />
                    <input
                      type="text"
                      placeholder={t('categoryName')}
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl
                        text-white placeholder:text-white/40 focus:outline-none focus:border-green-500/50"
                    />
                  </div>

                  <button
                    onClick={handleAddCategory}
                    disabled={isAddingCategory || !newCategoryName.trim() || !newCategoryIcon.trim()}
                    className="w-full py-3 px-4 rounded-xl font-semibold
                      bg-green-500/20 text-green-400 border border-green-500/30
                      hover:bg-green-500/30 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed
                      transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isAddingCategory ? t('saving') : t('addCategory')}</span>
                  </button>

                  {/* Existing Dynamic Categories */}
                  {firestoreCategories.length > 0 ? (
                    <div className="space-y-2 mt-4">
                      {firestoreCategories.map((cat) => (
                        <div key={cat.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                          <span className="text-xl">{cat.icon}</span>
                          <span className="text-white font-medium">{cat.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-white/40 text-center py-2 text-sm">{t('noCategoriesYet')}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
