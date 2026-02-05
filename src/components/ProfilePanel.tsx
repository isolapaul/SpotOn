'use client';

import { X, MapPin, Heart, LogOut, Shield, Clock } from 'lucide-react';
import Image from 'next/image';
import { useUserStore } from '@/store/useUserStore';
import { useSpotStore, isAdmin } from '@/store/useSpotStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Spot } from '@/store/useSpotStore';

interface ProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfilePanel({ isOpen, onClose }: Readonly<ProfilePanelProps>) {
  const { user, signOut } = useUserStore();
  const { spots, approveSpot } = useSpotStore();
  const { t } = useLanguageStore();
  const [activeTab, setActiveTab] = useState<'my-spots' | 'favorites' | 'pending'>('my-spots');
  const [myAllSpots, setMyAllSpots] = useState<Spot[]>([]);
  
  const userIsAdmin = isAdmin(user?.email);

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

  return (
    <div className="fixed inset-0 z-[2500] animate-slide-up">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="absolute inset-0 flex flex-col glass">
        {/* Header */}
        <div className="flex-shrink-0 p-6 border-b border-white/10">
          <div className="flex items-start justify-between mb-4">
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
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-white/20">
              <Image
                src={user.photoURL || '/default-avatar.png'}
                alt={user.name}
                fill
                className="object-cover"
              />
            </div>
            
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
        <div className="flex-shrink-0 flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('my-spots')}
            className={`flex-1 py-4 text-center font-medium transition-all ${
              activeTab === 'my-spots'
                ? 'text-white border-b-2 border-primary-500'
                : 'text-white/60'
            }`}
          >
            <MapPin className="w-4 h-4 inline mr-2" />
            {t('mySpots')}
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`flex-1 py-4 text-center font-medium transition-all ${
              activeTab === 'favorites'
                ? 'text-white border-b-2 border-primary-500'
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
              className={`flex-1 py-4 text-center font-medium transition-all ${
                activeTab === 'pending'
                  ? 'text-white border-b-2 border-amber-500'
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
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {activeTab === 'my-spots' && (
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
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          spot.status === 'approved' 
                            ? 'bg-green-500/20 text-green-400'
                            : spot.status === 'pending'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {spot.status === 'approved' ? t('approved') : spot.status === 'pending' ? t('pending') : t('rejected')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
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
        </div>
      </div>
    </div>
  );
}
