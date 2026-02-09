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
        fixed left-1/2 -translate-x-1/2 z-50
        w-auto min-w-[320px]
        rounded-full
        bg-[#0f172a]/90 backdrop-blur-2xl
        border border-white/10
        shadow-2xl
        px-6 py-3
        select-none
      "
      style={{
        bottom: 'max(2rem, calc(env(safe-area-inset-bottom) + 1rem))'
      }}
    >
      <div className="flex items-center justify-between gap-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          if (item.special) {
            // Special "+" Add Button - prominent and centered
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className="relative group flex items-center justify-center touch-manipulation min-w-[48px] min-h-[48px]"
                aria-label={item.label}
              >
                <div className={`
                  flex items-center justify-center 
                  w-14 h-14
                  rounded-full transition-all duration-300
                  ${isActive 
                    ? 'bg-gradient-to-br from-primary-400 to-primary-600 shadow-xl shadow-primary-500/50' 
                    : 'bg-gradient-to-br from-primary-500 to-primary-700 shadow-xl shadow-primary-600/40'
                  }
                  active:scale-95 group-hover:shadow-2xl
                `}>
                  <Icon 
                    className="w-7 h-7 text-white" 
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
                className="flex items-center justify-center transition-all duration-200 touch-manipulation min-w-[48px] min-h-[48px]"
                aria-label={item.label}
              >
                <div className={`relative w-9 h-9 rounded-full overflow-hidden border-2 transition-all duration-200 ${
                  isActive ? 'border-white scale-110' : 'border-white/40'
                }`}>
                  <Image 
                    src={user.photoURL || ''} 
                    alt={user?.username || 'Profile'}
                    fill
                    className="object-cover"
                    sizes="36px"
                  />
                </div>
              </button>
            );
          }
          
          // Regular icon buttons  
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`
                flex items-center justify-center
                transition-all duration-200 touch-manipulation min-w-[48px] min-h-[48px]
                ${isActive 
                  ? 'text-white scale-110' 
                  : 'text-gray-400 hover:text-white active:scale-95'
                }
              `}
              aria-label={item.label}
            >
              <Icon 
                className="w-7 h-7 transition-all duration-200"
                strokeWidth={isActive ? 2.5 : 2}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
