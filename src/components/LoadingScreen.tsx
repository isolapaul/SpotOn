'use client';

import { useEffect, useState } from 'react';

interface LoadingScreenProps {
  isLoading: boolean;
}

export default function LoadingScreen({ isLoading }: Readonly<LoadingScreenProps>) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (!isLoading) {
      // Wait a bit before starting fade out
      const timer = setTimeout(() => {
        setShow(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (!show && !isLoading) {
    return null;
  }

  return (
    <div 
      className={`fixed inset-0 z-[9999] bg-slate-900 flex flex-col items-center justify-center transition-opacity duration-500 ${
        isLoading ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* App Name */}
      <h1 className="text-5xl md:text-6xl font-bold text-white mb-8 tracking-tight animate-fade-in">
        SpotOn
      </h1>
      
      {/* Dots Loading Animation */}
      <div className="flex space-x-2">
        <div 
          className="w-3 h-3 bg-white rounded-full animate-bounce"
          style={{ animationDelay: '0ms', animationDuration: '1s' }}
        />
        <div 
          className="w-3 h-3 bg-white rounded-full animate-bounce"
          style={{ animationDelay: '150ms', animationDuration: '1s' }}
        />
        <div 
          className="w-3 h-3 bg-white rounded-full animate-bounce"
          style={{ animationDelay: '300ms', animationDuration: '1s' }}
        />
      </div>
    </div>
  );
}
