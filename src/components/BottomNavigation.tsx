'use client';

import { MapPin, User, Plus } from 'lucide-react';
import { useState } from 'react';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useUserStore } from '@/store/useUserStore';
import Image from 'next/image';

type NavItem = 'explore' | 'add' | 'profile';

interface BottomNavigationProps {
  onAddSpotClick: () => void;
  onProfileClick: () => void;
  onExploreClick: () => void;
}

export default function BottomNavigation({ 
  onAddSpotClick, 
  onProfileClick,
  onExploreClick,
}: Readonly<BottomNavigationProps>) {
  const [activeTab, setActiveTab] = useState<NavItem>('explore');
  const { t } = useLanguageStore();
  const { user } = useUserStore();

  const navItems = [
    { id: 'explore' as NavItem, icon: MapPin, label: t('explore') },
    { id: 'add' as NavItem, icon: Plus, label: t('add'), special: true },
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
    }
  };

  return (
    <div 
      className="
        fixed bottom-6 left-1/2 -translate-x-1/2 z-[1600]
        w-auto min-w-[320px] h-16
        rounded-full
        bg-[#0f172a]/80 backdrop-blur-2xl
        border border-white/10
        shadow-xl shadow-black/40
        px-6 py-3
        select-none
      "
      style={{
        bottom: 'max(1.5rem, calc(env(safe-area-inset-bottom) + 1rem))'
      }}
    >
      <nav 
        className="
          w-full
          /* Desktop only: Floating pill with its own background */
          md:rounded-full md:border md:border-white/20 md:shadow-glass-lg md:px-8
          md:max-w-sm md:mx-auto md:bg-gray-900/95 md:backdrop-blur-md md:py-3
        "
      >
        <div className="flex items-center justify-evenly md:gap-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            if (item.special) {
              // Special "Add" button with enhanced styling
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className="relative group min-h-[56px] min-w-[56px] flex items-center justify-center touch-manipulation"
                  aria-label={item.label}
                >
                  <div className={`
                    relative flex items-center justify-center 
                    w-16 h-16 md:w-20 md:h-20
                    -mt-8 md:-mt-12
                    rounded-full transition-all duration-300
                    ${isActive 
                      ? 'bg-gradient-to-br from-primary-400 to-primary-600 shadow-xl shadow-primary-500/60' 
                      : 'bg-gradient-to-br from-primary-500 to-primary-700 shadow-xl shadow-primary-600/50'
                    }
                    active:scale-95 md:group-hover:shadow-2xl
                    border-4 border-gray-900/50
                  `}>
                    <Icon 
                      className="w-8 h-8 md:w-10 md:h-10 text-white" 
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
                    relative flex flex-col items-center justify-center gap-1 md:gap-2
                    px-6 md:px-8 py-3 md:py-3 rounded-2xl md:rounded-3xl 
                    transition-all duration-200 min-h-[64px] min-w-[64px] touch-manipulation
                    ${isActive 
                      ? 'bg-white/20 text-white' 
                      : 'text-white/60 hover:text-white/80 active:scale-95'
                    }
                  `}
                  aria-label={item.label}
                >
                  <div className={`relative w-8 h-8 md:w-9 md:h-9 rounded-full overflow-hidden border-2 transition-all duration-200 ${
                    isActive ? 'border-white' : 'border-white/30'
                  }`}>
                    <Image 
                      src={user.photoURL || ''} 
                      alt={user?.name || 'Profile'}
                      fill
                      className="object-cover"
                      sizes="36px"
                    />
                  </div>
                  <span className={`
                    text-[9px] md:text-[11px] font-medium transition-all duration-200
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
                  relative flex flex-col items-center justify-center gap-1 md:gap-2
                  px-6 md:px-8 py-3 md:py-3 rounded-2xl md:rounded-3xl 
                  transition-all duration-200 min-h-[64px] min-w-[64px] touch-manipulation
                  ${isActive 
                    ? 'bg-white/20 text-white' 
                    : 'text-white/60 hover:text-white/80 active:scale-95'
                  }
                `}
                aria-label={item.label}
              >
                <Icon 
                  className={`w-7 h-7 md:w-8 md:h-8 transition-all duration-200 ${
                    isActive ? 'scale-110' : 'scale-100'
                  }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span className={`
                  text-[9px] md:text-[11px] font-medium transition-all duration-200
                  ${isActive ? 'opacity-100' : 'opacity-70'}
                `}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
      <div className="flex justify-between items-center w-full h-full">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          if (item.special) {
            // Special "Add" button - seamlessly integrated
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className="relative group flex items-center justify-center touch-manipulation"
                aria-label={item.label}
              >
                <div className={`
                  relative flex items-center justify-center 
                  w-12 h-12
                  rounded-full transition-all duration-300
                  ${isActive 
                    ? 'bg-gradient-to-br from-primary-400 to-primary-600 shadow-lg shadow-primary-500/40' 
                    : 'bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-600/30'
                  }
                  active:scale-95 group-hover:shadow-xl
                `}>
                  <Icon 
                    className="w-6 h-6 text-white" 
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
                  relative flex items-center justify-center
                  transition-all duration-200 touch-manipulation
                `}
                aria-label={item.label}
              >
                <div className={`relative w-7 h-7 rounded-full overflow-hidden border-2 transition-all duration-200 ${
                  isActive ? 'border-white scale-110' : 'border-white/30'
                }`}>
                  <Image 
                    src={user.photoURL || ''} 
                    alt={user?.name || 'Profile'}
                    fill
                    className="object-cover"
                    sizes="28px"
                  />
                </div>
              </button>
            );
          }
          
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`
                relative flex items-center justify-center
                transition-all duration-200 touch-manipulation
                ${isActive 
                  ? 'text-white scale-110' 
                  : 'text-gray-400 hover:text-white/80 active:scale-95'
                }
              `}
              aria-label={item.label}
            >
              <Icon 
                className="w-6 h-6 transition-all duration-200"
                strokeWidth={isActive ? 2.5 : 2}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
