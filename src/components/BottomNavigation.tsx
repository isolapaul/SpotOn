'use client';

import { MapPin, Compass, Heart, User, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useUserStore } from '@/store/useUserStore';
import Image from 'next/image';

type NavItem = 'explore' | 'navigate' | 'add' | 'favorites' | 'profile';

interface BottomNavigationProps {
  onAddSpotClick: () => void;
  onProfileClick: () => void;
}

export default function BottomNavigation({ onAddSpotClick, onProfileClick }: Readonly<BottomNavigationProps>) {
  const [activeTab, setActiveTab] = useState<NavItem>('explore');
  const { t } = useTranslation();
  const { user } = useUserStore();

  const navItems = [
    { id: 'explore' as NavItem, icon: MapPin, label: t('explore') },
    { id: 'navigate' as NavItem, icon: Compass, label: t('navigate') },
    { id: 'add' as NavItem, icon: Plus, label: t('add'), special: true },
    { id: 'favorites' as NavItem, icon: Heart, label: t('favorites') },
    { id: 'profile' as NavItem, icon: User, label: t('profile'), isProfile: true },
  ];

  const handleNavClick = (itemId: NavItem) => {
    setActiveTab(itemId);
    
    if (itemId === 'add') {
      onAddSpotClick();
    } else if (itemId === 'profile') {
      onProfileClick();
    }
  };

  return (
    <div className="fixed bottom-6 left-0 right-0 z-[1000] px-6 safe-bottom">
      <nav className="glass-nav mx-auto max-w-md rounded-[32px] px-4 py-3 shadow-glass-lg">
        <div className="flex items-center justify-around gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            if (item.special) {
              // Special "Add" button with enhanced styling
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className="relative group"
                  aria-label={item.label}
                >
                  <div className={`
                    relative flex items-center justify-center w-14 h-14 -mt-6
                    rounded-full transition-all duration-300
                    ${isActive 
                      ? 'bg-gradient-to-br from-primary-400 to-primary-600 shadow-lg shadow-primary-500/50' 
                      : 'bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-600/40'
                    }
                    active:scale-95 group-hover:shadow-xl
                  `}>
                    <Icon 
                      className="w-7 h-7 text-white" 
                      strokeWidth={2.5}
                    />
                  </div>
                  
                  {/* Ripple effect on active */}
                  {isActive && (
                    <div className="absolute inset-0 rounded-full bg-primary-400/30 animate-ping" />
                  )}
                </button>
              );
            }
            
            // Profile button - show avatar if logged in
            if (item.isProfile && user?.photoURL) {
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`
                    relative flex flex-col items-center justify-center gap-1
                    px-4 py-2 rounded-2xl transition-all duration-200
                    ${isActive 
                      ? 'bg-white/20 text-white' 
                      : 'text-white/60 hover:text-white/80 active:scale-95'
                    }
                  `}
                  aria-label={item.label}
                >
                  <div className={`relative w-7 h-7 rounded-full overflow-hidden border-2 transition-all duration-200 ${
                    isActive ? 'border-white' : 'border-white/30'
                  }`}>
                    <Image 
                      src={user.photoURL || ''} 
                      alt={user?.name || 'Profile'}
                      fill
                      className="object-cover"
                      sizes="28px"
                    />
                  </div>
                  <span className={`
                    text-[10px] font-medium transition-all duration-200
                    ${isActive ? 'opacity-100' : 'opacity-70'}
                  `}>
                    {item.label}
                  </span>
                  
                  {/* Active indicator dot */}
                  {isActive && (
                    <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-white shadow-lg shadow-white/50 animate-fade-in" />
                  )}
                </button>
              );
            }
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`
                  relative flex flex-col items-center justify-center gap-1
                  px-4 py-2 rounded-2xl transition-all duration-200
                  ${isActive 
                    ? 'bg-white/20 text-white' 
                    : 'text-white/60 hover:text-white/80 active:scale-95'
                  }
                `}
                aria-label={item.label}
              >
                <Icon 
                  className={`w-6 h-6 transition-all duration-200 ${
                    isActive ? 'scale-110' : 'scale-100'
                  }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span className={`
                  text-[10px] font-medium transition-all duration-200
                  ${isActive ? 'opacity-100' : 'opacity-70'}
                `}>
                  {item.label}
                </span>
                
                {/* Active indicator dot */}
                {isActive && (
                  <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-white shadow-lg shadow-white/50 animate-fade-in" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
