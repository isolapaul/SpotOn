'use client';

import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const colors = {
  success: 'from-green-500 to-emerald-600',
  error: 'from-red-500 to-rose-600',
  info: 'from-blue-500 to-cyan-600',
};

export default function Toast({ message, type, onClose, duration = 3000 }: Readonly<ToastProps>) {
  const Icon = icons[type];

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[4000] animate-slide-down">
      <div className={`glass-card px-6 py-4 flex items-center gap-3 shadow-2xl min-w-[280px] max-w-[400px]`}>
        <div className={`p-2 rounded-full bg-gradient-to-r ${colors[type]}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        
        <p className="flex-1 text-white font-medium text-sm">{message}</p>
        
        <button
          onClick={onClose}
          className="glass-button p-2.5 rounded-full flex-shrink-0 touch-manipulation min-w-[44px] min-h-[44px]"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}
