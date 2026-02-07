'use client';

import { X, MapPin, Heart, LogOut, Shield, Clock, UserPlus, Trash2, Bell, BellOff } from 'lucide-react';
import Image from 'next/image';
import { useUserStore } from '@/store/useUserStore';
import { useSpotStore, isAdmin, isSuperAdmin } from '@/store/useSpotStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Spot } from '@/store/useSpotStore';
import { useToastStore } from '@/store/useToastStore';

interface ProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfilePanel({ isOpen, onClose }: Readonly<ProfilePanelProps>) {
  const { user, signOut, adminUsers, addAdmin, removeAdmin, searchUserByEmail } = useUserStore();
  const { spots, approveSpot } = useSpotStore();
  const { t } = useLanguageStore();
  const { showToast } = useToastStore();
  const { isPermissionGranted, isLoading: isNotificationLoading, requestPermission, disableNotifications } = usePushNotifications();
  const [activeTab, setActiveTab] = useState<'my-spots' | 'favorites' | 'pending' | 'admin'>('my-spots');
  const [myAllSpots, setMyAllSpots] = useState<Spot[]>([]);
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [searchedUser, setSearchedUser] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  
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

  if (!isOpen || !user) return null;

  const favoriteSpots = spots.filter((spot) => user.savedSpots.includes(spot.id));
  const pendingSpots = spots.filter((spot) => spot.status === 'pending');

  const handleApproveSpot = async (spotId: string) => {
    try {
      await approveSpot(spotId);
    } catch (error) {
      console.error('Error approving spot:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      onClose();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSearchUser = async () => {
    if (!adminEmailInput.trim()) {
      showToast('Kérlek adj meg egy email címet!', 'error');
      return;
    }

    setIsSearching(true);
    try {
      const foundUser = await searchUserByEmail(adminEmailInput.trim());
      if (foundUser) {
        setSearchedUser(foundUser);
      } else {
        showToast('Felhasználó nem található', 'error');
        setSearchedUser(null);
      }
    } catch (error) {
      console.error('Error searching user:', error);
      showToast('Hiba történt a keresés során', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!searchedUser) return;

    try {
      await addAdmin(searchedUser.email);
      showToast(`${searchedUser.name} hozzáadva admin-ként!`, 'success');
      setAdminEmailInput('');
      setSearchedUser(null);
    } catch (error: any) {
      console.error('Error adding admin:', error);
      showToast(error.message || 'Hiba az admin hozzáadásakor', 'error');
    }
  };

  const handleRemoveAdmin = async (adminId: string, adminName: string) => {
    if (!confirm(`Biztosan eltávolítod ${adminName} admin jogosultságát?`)) return;

    try {
      await removeAdmin(adminId);
      showToast(`${adminName} eltávolítva az admin listából`, 'success');
    } catch (error: any) {
      console.error('Error removing admin:', error);
      showToast(error.message || 'Hiba az admin eltávolításakor', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[2500] animate-slide-up" style={{ backgroundColor: '#0f172a' }}>
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-xl cursor-default"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        aria-label="Close profile panel"
        tabIndex={-1}
      />
      
      {/* Panel */}
      <div className="absolute inset-0 flex flex-col bg-gray-900/95 backdrop-blur-2xl">
        {/* Header with Safe Area Top Padding */}
        <div className="flex-shrink-0 px-6 pb-4 border-b border-white/10" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)' }}>
          <div className="flex items-start justify-between mb-6">
            <button
              onClick={onClose}
              className="glass-button p-2 rounded-full"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            
            <button
              onClick={handleSignOut}
              className="glass-button px-4 py-2 rounded-full flex items-center gap-2"
            >
              <LogOut className="w-4 h-4 text-white" />
              <span className="text-white text-sm">{t('signOut')}</span>
            </button>
          </div>

          {/* User Info */}
          <div className="flex items-center gap-4 mb-4">
            {user.photoURL ? (
              <div className="relative w-20 h-20 rounded-full overflow-hidden border-4 border-white/30 shadow-lg">
                <Image
                  src={user.photoURL}
                  alt={user.name}
                  fill
                  className="object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    if (target.parentElement) {
                      target.parentElement.innerHTML = `<div class="w-full h-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center"><span class="text-white text-3xl font-bold">${user.name?.charAt(0).toUpperCase() || 'U'}</span></div>`;
                    }
                  }}
                />
              </div>
            ) : (
              <div className="relative w-20 h-20 rounded-full overflow-hidden border-4 border-white/30 shadow-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                <span className="text-white text-3xl font-bold">{user.name?.charAt(0).toUpperCase() || 'U'}</span>
              </div>
            )}
            
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-white">{user.name}</h2>
                {userIsAdmin && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/30">
                    <Shield className="w-3 h-3 text-amber-400" />
                    <span className="text-amber-400 text-xs font-bold">Admin</span>
                  </div>
                )}
              </div>
              <p className="text-white/60 text-sm">{user.email}</p>
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
                Jóváhagyásra vár
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
              <span>Admin</span>
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
                favoriteSpots.map((spot) => (
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
                        <span className="text-yellow-400">⭐</span>
                        <span className="text-white/80 text-sm">4.5</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Pending Spots Tab - Admin Only */}
          {activeTab === 'pending' && userIsAdmin && (
            <div className="space-y-4">
              {pendingSpots.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <Clock className="w-12 h-12 text-white/40 mx-auto mb-3" />
                  <p className="text-white/60">Nincs jóváhagyásra váró hely</p>
                  <p className="text-white/40 text-sm mt-1">Minden hely jóvá van hagyva! 🎉</p>
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
                            ⏳ Jóváhagyásra vár
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
                      <span>Jóváhagyás</span>
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
                  <h3 className="text-white font-bold text-lg">Admin hozzáadása</h3>
                </div>
                
                <div className="space-y-4">
                  <input
                    type="email"
                    placeholder="Felhasználó email címe..."
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
                    {isSearching ? 'Keresés...' : 'Felhasználó keresése'}
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
                        <span>Admin jogosultság megadása</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Current Admins List */}
              <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-amber-400" />
                  <h3 className="text-white font-bold text-lg">Jelenlegi adminok</h3>
                  <span className="text-white/60 text-sm ml-auto">{adminUsers.length} admin</span>
                </div>

                <div className="space-y-3">
                  {adminUsers.length === 0 ? (
                    <p className="text-white/40 text-center py-4">Még nincs admin hozzáadva</p>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
