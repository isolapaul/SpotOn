'use client';

import { MapPin, Compass, Heart, User, Plus } from 'lucide-react';
import { useState, useMemo, memo } from 'react';
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

function BottomNavigation({ 
  onAddSpotClick, 
  onProfileClick,
  onExploreClick,
  onNavigateClick,
  onFavoritesClick,
}: Readonly<BottomNavigationProps>) {
  const [activeTab, setActiveTab] = useState<NavItem>('explore');
  const { t } = useLanguageStore();
  const { user } = useUserStore();

  const navItems = useMemo(() => [
    { id: 'explore' as NavItem, icon: MapPin, label: t('explore') },
    { id: 'navigate' as NavItem, icon: Compass, label: t('navigate') },
    { id: 'add' as NavItem, icon: Plus, label: t('add'), special: true },
    { id: 'favorites' as NavItem, icon: Heart, label: t('favorites') },
    { id: 'profile' as NavItem, icon: User, label: t('profile'), isProfile: true },
  ], [t]);

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

// Memoize to prevent unnecessary re-renders
export default memo(BottomNavigation);
