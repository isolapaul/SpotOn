'use client';

import { X, MapPin, Heart, Settings, Shield, Clock, UserPlus, Trash2, Pencil, Star, Plus, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import { useUserStore } from '@/store/useUserStore';
import { useSpotStore, isAdmin, isSuperAdmin } from '@/store/useSpotStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Spot } from '@/store/useSpotStore';
import { useToastStore } from '@/store/useToastStore';
import { getLevelInfo, getLevelProgress, getSpotsRemainingText, CUSTOM_NAME_COLORS, CUSTOM_NAME_FONTS } from '@/lib/levelUtils';
import SettingsPanel from './SettingsPanel';

interface ProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfilePanel({ isOpen, onClose }: Readonly<ProfilePanelProps>) {
  const { user, adminUsers, addAdmin, removeAdmin, searchUserByEmail, updateUsername, highlightSpot, unhighlightSpot, updateCustomNameColor, updateCustomNameFont } = useUserStore();
  const { spots, approveSpot } = useSpotStore();
  const { t } = useLanguageStore();
  const { showToast } = useToastStore();
  const [activeTab, setActiveTab] = useState<'my-spots' | 'favorites' | 'pending' | 'admin'>('my-spots');
  const [myAllSpots, setMyAllSpots] = useState<Spot[]>([]);
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [searchedUser, setSearchedUser] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [firestoreCategories, setFirestoreCategories] = useState<Array<{ id: string; name: string; icon: string }>>([]);
  const [showHighlightPanel, setShowHighlightPanel] = useState(false);
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [showCustomizationPanel, setShowCustomizationPanel] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showLevelInfo, setShowLevelInfo] = useState(false);
  
  // iOS Swipe-to-Close Gesture
  const [dragStartX, setDragStartX] = useState(0);
  const [dragCurrentX, setDragCurrentX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
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
      console.error('Failed to add category:', error);
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
              sizes="100vw"
              className="object-cover"
              priority
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />
          
          {/* Top action buttons */}
          <div className="absolute left-4 right-4 flex justify-between items-center" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="glass-button p-3 rounded-full touch-manipulation min-w-[48px] min-h-[48px]"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5 text-white" />
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
                    alt={user.username}
                    fill
                    sizes="128px"
                    className="object-cover"
                    priority
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      if (target.parentElement) {
                        target.parentElement.innerHTML = `<div class="w-full h-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center"><span class="text-white text-5xl font-bold">${user.username?.charAt(0).toUpperCase() || 'U'}</span></div>`;
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-gray-900 shadow-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                  <span className="text-white text-5xl font-bold">{user.username?.charAt(0).toUpperCase() || 'U'}</span>
                </div>
              )}
            </div>
            
            {/* User Info - Centered */}
            <div className="flex flex-col items-center mt-4 w-full">
              <div className="flex items-center gap-2 mb-2 flex-wrap justify-center">
                {isEditingUsername ? (
                  <div className="flex items-center gap-2">
                    <span className="text-white/50 text-3xl font-bold">@</span>
                    <input
                      id="edit-username"
                      name="editUsername"
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value.toLowerCase().replaceAll(/[^a-z0-9_]/g, ''))}
                      maxLength={20}
                      className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 w-48"
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
                ) : (
                  <>
                    <h2 className="text-3xl font-bold text-white text-center">@{user.username}</h2>
                    <button
                      onClick={() => {
                        setNewUsername(user.username || '');
                        setIsEditingUsername(true);
                      }}
                      className="p-2 text-white/40 hover:text-white/70 transition-colors rounded-lg hover:bg-white/10"
                      aria-label={t('editUsername')}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
              
              {/* Badges Row */}
              <div className="flex items-center gap-2 mb-3 flex-wrap justify-center">
                {userIsAdmin && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/30">
                    <Shield className="w-4 h-4 text-amber-400" />
                  </div>
                )}
                {(() => {
                  const levelInfo = getLevelInfo(myAllSpots.length);
                  return (
                    <button
                      onClick={() => setShowLevelInfo(true)}
                      className={`flex items-center gap-1 px-3 py-1 rounded-full ${levelInfo.bgColor} border ${levelInfo.borderColor} hover:opacity-80 transition-all active:scale-95`}
                    >
                      <span className="text-lg">{levelInfo.icon}</span>
                      <span className={`${levelInfo.textColor} text-xs font-bold`}>
                        {levelInfo.level}. szint
                      </span>
                    </button>
                  );
                })()}
              </div>

              {/* Level Progress Button */}
              {(() => {
                const levelInfo = getLevelInfo(myAllSpots.length);
                const progress = getLevelProgress(myAllSpots.length);
                const spotsRemaining = getSpotsRemainingText(myAllSpots.length, levelInfo.spotsForNext);
                
                return (
                  <div className={`w-full max-w-md px-4 py-3 rounded-xl ${levelInfo.bgColor} border ${levelInfo.borderColor} transition-all mb-3`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{levelInfo.icon}</span>
                        <div>
                          <p className={`${levelInfo.textColor} font-bold text-sm`}>
                            {levelInfo.name}
                          </p>
                          <p className="text-white/60 text-xs">
                            {spotsRemaining}
                          </p>
                        </div>
                      </div>
                      <span className={`${levelInfo.textColor} font-bold text-lg`}>
                        {progress.toFixed(0)}%
                      </span>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="relative w-full h-2 bg-white/20 rounded-full overflow-hidden">
                      <div 
                        className="absolute top-0 left-0 h-full transition-all duration-500"
                        style={{ width: `${progress}%`, backgroundColor: levelInfo.progressColor }}
                      />
                    </div>
                    
                    {/* Perks Preview */}
                    {levelInfo.level >= 3 && (
                      <div className="mt-2 flex flex-wrap gap-1 text-xs text-white/70">
                        {levelInfo.maxHighlights > 0 && <span>✨ {levelInfo.maxHighlights}x kiemelés</span>}
                        {levelInfo.canCustomizeIcon && <span>🎨 ikonok</span>}
                        {levelInfo.canCustomizeName && <span>💎 testreszabás</span>}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="flex gap-4 mt-0">
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
              {/* Level Management Buttons */}
              {(() => {
                const levelInfo = getLevelInfo(myAllSpots.length);
                
                return levelInfo.level >= 3 ? (
                  <div className="w-full max-w-md space-y-2 mt-3">
                    {/* Highlight Management Button */}
                    {levelInfo.maxHighlights > 0 && (
                      <button
                        onClick={() => setShowHighlightPanel(!showHighlightPanel)}
                        className={`w-full py-2 px-4 rounded-lg font-medium text-sm transition-all ${levelInfo.bgColor} ${levelInfo.textColor} border ${levelInfo.borderColor} hover:opacity-80`}
                      >
                        {showHighlightPanel ? '✨ Kiemelés bezárása' : '✨ Helyek kiemelése'}
                      </button>
                    )}
                    
                    {/* Customization Button (Level 5) */}
                    {levelInfo.canCustomizeName && (
                      <button
                        onClick={() => setShowCustomizationPanel(!showCustomizationPanel)}
                        className={`w-full py-2 px-4 rounded-lg font-medium text-sm transition-all ${levelInfo.bgColor} ${levelInfo.textColor} border ${levelInfo.borderColor} hover:opacity-80`}
                      >
                        {showCustomizationPanel ? '💎 Testreszabás bezárása' : '💎 Név testreszabása'}
                      </button>
                    )}
                  </div>
                ) : null;
              })()}

              {/* Highlight Panel */}
              {(() => {
                const levelInfo = getLevelInfo(myAllSpots.length);
                const highlightedSpots = user?.highlightedSpots || [];
                
                return showHighlightPanel && levelInfo.level >= 3 && (
                  <div className="glass-card p-5 space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className={`font-bold ${levelInfo.textColor}`}>
                          ✨ Helyek kiemelése
                        </h3>
                        <p className="text-white/60 text-xs mt-1">
                          {highlightedSpots.length} / {levelInfo.maxHighlights} kiemelve
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {myAllSpots.filter(s => s.status === 'approved').length === 0 ? (
                        <p className="text-white/60 text-sm text-center py-4">
                          Nincs jóváhagyott helyed a kiemeléshez.
                        </p>
                      ) : (
                        myAllSpots
                          .filter(s => s.status === 'approved')
                          .map((spot) => {
                            const isHighlighted = highlightedSpots.includes(spot.id);
                            
                            return (
                              <div key={spot.id} className={`p-3 rounded-xl border transition-all ${
                                isHighlighted 
                                  ? `${levelInfo.bgColor} ${levelInfo.borderColor}` 
                                  : 'bg-white/5 border-white/10'
                              }`}>
                                <div className="flex gap-3 items-center">
                                  <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                                    <Image
                                      src={(spot.imageUrls?.[spot.primaryImageIndex || 0] || spot.imageUrls?.[0] || (spot as any).imageUrl) || '/placeholder-spot.jpg'}
                                      alt={spot.name}
                                      fill
                                      sizes="56px"
                                      className="object-cover"
                                      unoptimized={!spot.imageUrls && !(spot as any).imageUrl}
                                    />
                                    {isHighlighted && (
                                      <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                                        <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-white font-medium text-sm line-clamp-1">
                                      {spot.name}
                                    </h4>
                                    <p className="text-white/60 text-xs line-clamp-1">
                                      {spot.description}
                                    </p>
                                  </div>
                                  <button
                                    onClick={async () => {
                                      setIsHighlighting(true);
                                      try {
                                        if (isHighlighted) {
                                          await unhighlightSpot(spot.id);
                                          showToast('Kiemelés megszüntetve', 'success');
                                        } else {
                                          await highlightSpot(spot.id, levelInfo.maxHighlights);
                                          showToast('Hely kiemelve! ✨', 'success');
                                        }
                                      } catch (error: any) {
                                        showToast(error.message || 'Hiba történt', 'error');
                                      } finally {
                                        setIsHighlighting(false);
                                      }
                                    }}
                                    disabled={isHighlighting || (!isHighlighted && highlightedSpots.length >= levelInfo.maxHighlights)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                      isHighlighted
                                        ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                                        : `${levelInfo.bgColor} ${levelInfo.textColor} border ${levelInfo.borderColor} hover:opacity-80`
                                    }`}
                                  >
                                    {isHighlighted ? 'Törlés' : 'Kiemel'}
                                  </button>
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Level 5 Customization Panel */}
              {(() => {
                const levelInfo = getLevelInfo(myAllSpots.length);
                
                return showCustomizationPanel && levelInfo.level >= 5 && (
                  <div className="glass-card p-5 space-y-5 animate-fade-in">
                    <div>
                      <h3 className="text-cyan-300 font-bold mb-2 flex items-center gap-2">
                        💎 Gyémánt Testreszabás
                      </h3>
                      <p className="text-white/60 text-xs">
                        5. szint kizárólagos funkciók - válassz egyedi színt és betűstílust!
                      </p>
                    </div>
                    
                    {/* Color Selection */}
                    <div className="space-y-3">
                      <h4 className="text-white font-semibold text-sm">Név színe:</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {CUSTOM_NAME_COLORS.map((colorOption) => {
                          const isSelected = user?.customNameColor === colorOption.value;
                          return (
                            <button
                              key={colorOption.value}
                              onClick={async () => {
                                setIsCustomizing(true);
                                try {
                                  await updateCustomNameColor(colorOption.value);
                                  showToast(`Szín beállítva: ${colorOption.name}`, 'success');
                                } catch (error: any) {
                                  showToast(error.message || 'Hiba történt', 'error');
                                } finally {
                                  setIsCustomizing(false);
                                }
                              }}
                              disabled={isCustomizing}
                              className={`p-3 rounded-xl transition-all text-left ${
                                isSelected
                                  ? `${colorOption.value.replace('text-', 'bg-')}/20 border-2 ${colorOption.value.replace('text-', 'border-')}`
                                  : 'bg-white/5 border border-white/10 hover:bg-white/10'
                              }`}
                            >
                              <div className={`font-bold ${colorOption.value} text-sm mb-1`}>
                                {colorOption.name}
                              </div>
                              <div className={`text-xs ${colorOption.value} opacity-70`}>
                                @{user?.username || 'username'}
                              </div>
                              {isSelected && (
                                <div className="mt-1 text-xs text-green-400">✓ Aktív</div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Font Selection */}
                    <div className="space-y-3">
                      <h4 className="text-white font-semibold text-sm">Betűstílus:</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {CUSTOM_NAME_FONTS.map((fontOption) => {
                          const isSelected = user?.customNameFont === fontOption.value;
                          return (
                            <button
                              key={fontOption.value}
                              onClick={async () => {
                                setIsCustomizing(true);
                                try {
                                  await updateCustomNameFont(fontOption.value);
                                  showToast(`Betűstílus beállítva: ${fontOption.name}`, 'success');
                                } catch (error: any) {
                                  showToast(error.message || 'Hiba történt', 'error');
                                } finally {
                                  setIsCustomizing(false);
                                }
                              }}
                              disabled={isCustomizing}
                              className={`p-3 rounded-xl transition-all text-left ${
                                isSelected
                                  ? 'bg-cyan-500/20 border-2 border-cyan-500'
                                  : 'bg-white/5 border border-white/10 hover:bg-white/10'
                              }`}
                            >
                              <div className={`text-white text-sm mb-1 ${fontOption.value}`}>
                                {fontOption.name}
                              </div>
                              <div className={`text-xs text-white/60 ${fontOption.value}`}>
                                @{user?.username || 'username'}
                              </div>
                              {isSelected && (
                                <div className="mt-1 text-xs text-green-400">✓ Aktív</div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Preview */}
                    <div className="pt-3 border-t border-white/10">
                      <h4 className="text-white font-semibold text-sm mb-2">Előnézet:</h4>
                      <div className="glass-card p-4 flex items-center gap-3">
                        <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-cyan-500/30">
                          {(user?.profilePictureURL || user?.photoURL) && (
                            <Image
                              src={user.profilePictureURL || user.photoURL || ''}
                              alt="Preview"
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          )}
                        </div>
                        <div>
                          <p className={`font-medium ${user?.customNameFont || 'font-sans'} ${user?.customNameColor || 'text-cyan-300'}`}>
                            @{user?.username || 'username'}
                          </p>
                          <p className="text-white/60 text-xs">Így fog megjelenni másoknak</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

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
                        src={(spot.imageUrls?.[spot.primaryImageIndex || 0] || spot.imageUrls?.[0] || (spot as any).imageUrl) || '/placeholder-spot.jpg'}
                        alt={spot.name}
                        fill
                        sizes="80px"
                        className="object-cover"
                        unoptimized={!spot.imageUrls && !(spot as any).imageUrl}
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
                          src={(spot.imageUrls?.[spot.primaryImageIndex || 0] || spot.imageUrls?.[0] || (spot as any).imageUrl) || '/placeholder-spot.jpg'}
                          alt={spot.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                          unoptimized={!spot.imageUrls && !(spot as any).imageUrl}
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
                          src={(spot.imageUrls?.[spot.primaryImageIndex || 0] || spot.imageUrls?.[0] || (spot as any).imageUrl) || '/placeholder-spot.jpg'}
                          alt={spot.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                          unoptimized={!spot.imageUrls && !(spot as any).imageUrl}
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
                            alt={searchedUser.username}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <h4 className="text-white font-semibold">@{searchedUser.username}</h4>
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
                            sizes="48px"
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
      
      {/* Settings Panel */}
      <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      
      {/* Level Info Modal */}
      {showLevelInfo && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowLevelInfo(false)}
            aria-label="Close level info"
          />
          
          <div className="relative max-w-2xl w-full max-h-[90vh] overflow-y-auto glass-card p-6 rounded-2xl animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-primary-400" />
                {t('levelSystem')}
              </h2>
              <button
                onClick={() => setShowLevelInfo(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>
            
            {/* Current Level */}
            {(() => {
              const currentLevel = getLevelInfo(myAllSpots.length);
              const progress = getLevelProgress(myAllSpots.length);
              return (
                <div className={`p-6 rounded-xl ${currentLevel.bgColor} border-2 ${currentLevel.borderColor} mb-6`}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-5xl">{currentLevel.icon}</div>
                    <div className="flex-1">
                      <h3 className={`text-2xl font-bold ${currentLevel.textColor}`}>{currentLevel.name}</h3>
                      <p className="text-white/80 text-sm">{t('currentLevel')}</p>
                    </div>
                  </div>
                  
                  <div className="relative w-full h-3 bg-white/20 rounded-full overflow-hidden mb-2">
                    <div 
                      className={`absolute top-0 left-0 h-full ${currentLevel.bgColor.replace('/20', '/80')} transition-all duration-500`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/80">
                      {myAllSpots.length} / {currentLevel.spotsForNext || currentLevel.spotsRequired} {t('spots')}
                    </span>
                    <span className={`font-bold ${currentLevel.textColor}`}>
                      {progress.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })()}
            
            {/* All Levels */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-white mb-4">{t('allLevels')}</h3>
              
              {[1, 2, 3, 4, 5].map((level) => {
                // Calculate spots needed for each level
                const spotsForLevel = [0, 0, 3, 10, 15, 20][level];
                const levelInfo = getLevelInfo(spotsForLevel);
                const isUnlocked = level <= getLevelInfo(myAllSpots.length).level;
                
                return (
                  <div 
                    key={level} 
                    className={`p-5 rounded-xl border-2 transition-all ${
                      isUnlocked 
                        ? `${levelInfo.bgColor} ${levelInfo.borderColor}` 
                        : 'bg-white/5 border-white/10 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-4xl">{levelInfo.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className={`text-xl font-bold ${isUnlocked ? levelInfo.textColor : 'text-white/60'}`}>
                            {level}. {levelInfo.name}
                          </h4>
                          {isUnlocked && (
                            <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 font-medium">
                              {t('unlocked')} ✓
                            </span>
                          )}
                        </div>
                        
                        <p className="text-white/70 text-sm mb-3">
                          {t('requiredSpots')}: <span className="font-bold">{levelInfo.spotsRequired}</span>
                        </p>
                        
                        {/* Perks */}
                        <div className="space-y-2">
                          <p className="text-white/90 text-sm font-semibold">{t('benefits')}:</p>
                          <ul className="space-y-1 text-white/70 text-sm">
                            {level === 1 && (
                              <li className="text-white/50 italic">{t('noSpecialBenefits')}</li>
                            )}
                            {level === 2 && (
                              <li className="flex items-center gap-2">
                                <span className="text-base">🥈</span>
                                {t('silverName')}
                              </li>
                            )}
                            {level === 3 && (
                              <>
                                <li className="flex items-center gap-2">
                                  <span className="text-base">🥇</span>
                                  {t('goldName')}
                                </li>
                                <li className="flex items-center gap-2">
                                  <span className="text-base">✨</span>
                                  {t('highlightOneSpot')} {t('goldAppearance')}
                                </li>
                              </>
                            )}
                            {level === 4 && (
                              <>
                                <li className="flex items-center gap-2">
                                  <span className="text-base">🥇</span>
                                  {t('goldName')}
                                </li>
                                <li className="flex items-center gap-2">
                                  <span className="text-base">✨</span>
                                  {t('highlightTwoSpots')} {t('goldAppearance')}
                                </li>
                                <li className="flex items-center gap-2">
                                  <span className="text-base">🎨</span>
                                  {t('useCustomIcons')}
                                </li>
                              </>
                            )}
                            {level === 5 && (
                              <>
                                <li className="flex items-center gap-2">
                                  <span className="text-base">💎</span>
                                  {t('diamondNameAndBadge')}
                                </li>
                                <li className="flex items-center gap-2">
                                  <span className="text-base">✨</span>
                                  {t('highlightTwoSpots')} {t('goldAppearance')}
                                </li>
                                <li className="flex items-center gap-2">
                                  <span className="text-base">🎨</span>
                                  {t('useCustomIcons')}
                                </li>
                                <li className="flex items-center gap-2">
                                  <span className="text-base">🌈</span>
                                  {t('customizeNameStyle')}
                                </li>
                              </>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Motivational Message */}
            <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-primary-500/20 to-purple-500/20 border border-primary-500/30">
              <p className="text-white/90 text-sm text-center">
                {t('keepExploringMessage')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
