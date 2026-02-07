'use client';

import { useState } from 'react';
import { Bell, X, Check } from 'lucide-react';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useLanguageStore } from '@/store/useLanguageStore';

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, markAsRead, markAllAsRead, clearAll, getUnreadCount } = useNotificationStore();
  const { t } = useLanguageStore();
  const unreadCount = getUnreadCount();

  const handleNotificationClick = (id: string) => {
    markAsRead(id);
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return t('justNow');
    if (minutes < 60) return `${minutes} ${t('minutesAgo')}`;
    if (hours < 24) return `${hours} ${t('hoursAgo')}`;
    return `${days} ${t('daysAgo')}`;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'spot_approved':
        return '🥳';
      case 'new_review':
        return '⭐';
      case 'new_like':
        return '❤️';
      case 'new_pending_spot':
        return '🛡️';
      default:
        return '📢';
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Notification Bell Button - Top Left */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed z-[1500] p-3 rounded-full 
          active:scale-95 transition-all duration-200 shadow-glass-lg
          bg-slate-800/90 backdrop-blur-xl border-2 border-white/20 hover:bg-slate-700/90
          touch-manipulation select-none"
        style={{
          top: 'max(1rem, env(safe-area-inset-top))',
          left: 'max(1rem, env(safe-area-inset-left))'
        }}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-white" strokeWidth={2} />
        
        {/* Unread Badge - Red Dot */}
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold 
            rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5
            shadow-lg">
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>

      {/* Notification Modal - Centered */}
      {isOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 animate-fade-in">
          {/* Backdrop - Click to close */}
          <div 
            role="button"
            tabIndex={0}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
            onKeyDown={(e) => e.key === 'Escape' && handleClose()}
            aria-label="Close notifications"
          />
          
          {/* Modal Content */}
          <div className="relative bg-slate-900 w-[90%] max-w-md rounded-3xl shadow-2xl 
            border-2 border-white/20 overflow-hidden animate-scale-in
            max-h-[80vh] flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 
              bg-slate-800/50 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-white" strokeWidth={2} />
                <h3 className="text-white font-semibold text-lg">
                  {t('notifications')}
                </h3>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              
              <button
                onClick={handleClose}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-white" strokeWidth={2} />
              </button>
            </div>

            {/* Actions */}
            {notifications.length > 0 && (
              <div className="flex gap-2 px-4 py-3 border-b border-white/10 bg-slate-800/30">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium 
                      text-white/80 hover:text-white bg-white/5 hover:bg-white/10 
                      rounded-lg transition-all"
                  >
                    <Check className="w-3.5 h-3.5" strokeWidth={2} />
                    {t('markAllRead')}
                  </button>
                )}
                
                <button
                  onClick={clearAll}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium 
                    text-white/80 hover:text-white bg-white/5 hover:bg-white/10 
                    rounded-lg transition-all"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2} />
                  {t('clearAll')}
                </button>
              </div>
            )}

            {/* Notifications List - Scrollable */}
            <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[60vh]">
              {notifications.length === 0 ? (
                // Empty State
                <div className="flex flex-col items-center justify-center py-16 px-6">
                  <div className="bg-slate-800/50 backdrop-blur-xl p-6 rounded-full mb-4">
                    <Bell className="w-12 h-12 text-white/40" strokeWidth={1.5} />
                  </div>
                  <p className="text-white font-medium text-center mb-2">
                    {t('noNotifications')}
                  </p>
                  <p className="text-white/60 text-sm text-center max-w-xs">
                    {t('noNotificationsDesc')}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification.id)}
                      className={`
                        w-full text-left p-4 transition-all
                        hover:bg-white/5 active:scale-[0.99]
                        ${notification.read ? 'bg-transparent' : 'bg-white/5'}
                      `}
                    >
                      <div className="flex gap-3">
                        {/* Icon */}
                        <div className="flex-shrink-0 text-2xl">
                          {getNotificationIcon(notification.type)}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className={`
                              font-semibold text-sm leading-tight
                              ${notification.read ? 'text-white/80' : 'text-white'}
                            `}>
                              {notification.title}
                            </h4>
                            
                            {/* Unread dot */}
                            {!notification.read && (
                              <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1" />
                            )}
                          </div>
                          
                          <p className="text-white/70 text-xs leading-relaxed mb-2">
                            {notification.body}
                          </p>
                          
                          <p className="text-white/50 text-xs">
                            {formatTimestamp(notification.timestamp)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
