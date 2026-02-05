'use client';

import { X, MapPin, Heart, LogOut } from 'lucide-react';
import Image from 'next/image';
import { useUserStore } from '@/store/useUserStore';
import { useSpotStore } from '@/store/useSpotStore';
import { useState } from 'react';

interface ProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfilePanel({ isOpen, onClose }: Readonly<ProfilePanelProps>) {
  const { user, signOut } = useUserStore();
  const { spots } = useSpotStore();
  const [activeTab, setActiveTab] = useState<'my-spots' | 'favorites'>('my-spots');

  if (!isOpen || !user) return null;

  const mySpots = spots.filter((spot) => spot.createdBy === user.uid);
  const favoriteSpots = spots.filter((spot) => user.savedSpots.includes(spot.id));

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
              <span className="text-white text-sm">Sign Out</span>
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
              <h2 className="text-2xl font-bold text-white">{user.name}</h2>
              <p className="text-white/60 text-sm">{user.email}</p>
              <div className="flex gap-4 mt-2">
                <div>
                  <span className="text-white font-bold">{mySpots.length}</span>
                  <span className="text-white/60 text-xs ml-1">Spots</span>
                </div>
                <div>
                  <span className="text-white font-bold">{favoriteSpots.length}</span>
                  <span className="text-white/60 text-xs ml-1">Favorites</span>
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
            My Spots
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
            Favorites
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {activeTab === 'my-spots' && (
            <div className="space-y-4">
              {mySpots.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <MapPin className="w-12 h-12 text-white/40 mx-auto mb-3" />
                  <p className="text-white/60">You haven't added any spots yet</p>
                  <p className="text-white/40 text-sm mt-1">Start exploring and share your favorite places!</p>
                </div>
              ) : (
                mySpots.map((spot) => (
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
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {spot.status}
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
                  <p className="text-white/60">No favorite spots yet</p>
                  <p className="text-white/40 text-sm mt-1">Start exploring and save your favorites!</p>
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
        </div>
      </div>
    </div>
  );
}
