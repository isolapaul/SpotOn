'use client';

import { MapPin, Compass, Heart, User, Plus } from 'lucide-react';
import { useState } from 'react';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useUserStore } from '@/store/useUserStore';
import Image from 'next/image';

type NavItem = 'explore' | 'navigate' | 'add' | 'favorites' | 'profile';

interface BottomNavigationProps {
  onAddSpotClick: () => void;
  onProfileClick: () => void;
  onExploreClick: () => void;
  onNavigateClick: () => void;
  onFavoritesClick: () => void;
}

export default function BottomNavigation({ 
  onAddSpotClick, 
  onProfileClick,
  onExploreClick,
  onNavigateClick,
  onFavoritesClick,
}: Readonly<BottomNavigationProps>) {
  const [activeTab, setActiveTab] = useState<NavItem>('explore');
  const { t } = useLanguageStore();
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
    } else if (itemId === 'explore') {
      onExploreClick();
    } else if (itemId === 'navigate') {
      onNavigateClick();
    } else if (itemId === 'favorites') {
      onFavoritesClick();
    }
  };

  return (
    <div 
      className="
        fixed bottom-0 left-0 right-0 z-50
        /* Mobile: Edge-to-Edge Native Design */
        bg-gray-900/90 backdrop-blur-xl border-t border-white/10
        pt-3
        /* Desktop: Floating Pill Design */
        md:bottom-8 md:left-1/2 md:-translate-x-1/2 md:w-auto md:bg-transparent md:backdrop-blur-none md:border-none
      "
    >
      <nav 
        className="
          w-full
          /* Desktop only: Floating pill with its own background */
          md:rounded-full md:border md:border-white/20 md:shadow-glass-lg md:px-6
          md:max-w-md md:mx-auto md:bg-gray-900/95 md:backdrop-blur-md md:py-3
        "
      >
        <div className="flex items-center justify-around md:gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            if (item.special) {
              // Special "Add" button with enhanced styling
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className="relative group min-h-[44px] flex items-center justify-center"
                  aria-label={item.label}
                >
                  <div className={`
                    relative flex items-center justify-center 
                    w-14 h-14 md:w-16 md:h-16
                    -mt-6 md:-mt-10
                    rounded-full transition-all duration-300
                    ${isActive 
                      ? 'bg-gradient-to-br from-primary-400 to-primary-600 shadow-xl shadow-primary-500/60' 
                      : 'bg-gradient-to-br from-primary-500 to-primary-700 shadow-xl shadow-primary-600/50'
                    }
                    active:scale-95 md:group-hover:shadow-2xl
                    border-4 border-gray-900/50
                  `}>
                    <Icon 
                      className="w-7 h-7 md:w-8 md:h-8 text-white" 
                      strokeWidth={2.5}
                    />
                  </div>
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
                    relative flex flex-col items-center justify-center gap-0.5 md:gap-1
                    px-2 md:px-4 py-2 md:py-2 rounded-xl md:rounded-2xl 
                    transition-all duration-200 min-h-[44px]
                    ${isActive 
                      ? 'bg-white/20 text-white' 
                      : 'text-white/60 hover:text-white/80 active:scale-95'
                    }
                  `}
                  aria-label={item.label}
                >
                  <div className={`relative w-6 h-6 md:w-7 md:h-7 rounded-full overflow-hidden border-2 transition-all duration-200 ${
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
                    text-[8px] md:text-[10px] font-medium transition-all duration-200
                    ${isActive ? 'opacity-100' : 'opacity-70'}
                  `}>
                    {item.label}
                  </span>
                </button>
              );
            }
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`
                  relative flex flex-col items-center justify-center gap-0.5 md:gap-1
                  px-2 md:px-4 py-2 md:py-2 rounded-xl md:rounded-2xl 
                  transition-all duration-200 min-h-[44px]
                  ${isActive 
                    ? 'bg-white/20 text-white' 
                    : 'text-white/60 hover:text-white/80 active:scale-95'
                  }
                `}
                aria-label={item.label}
              >
                <Icon 
                  className={`w-6 h-6 md:w-6 md:h-6 transition-all duration-200 ${
                    isActive ? 'scale-110' : 'scale-100'
                  }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span className={`
                  text-[8px] md:text-[10px] font-medium transition-all duration-200
                  ${isActive ? 'opacity-100' : 'opacity-70'}
                `}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
