
import React, { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { GlobalSearch } from './molecules/GlobalSearch';
import { BaseButton } from './atoms/BaseButton';

interface LayoutProps {
  title: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  onBack?: () => void;
  floatingButton?: React.ReactNode;
}

export const PageLayout: React.FC<LayoutProps> = memo(({ title, headerExtra, children, onBack, floatingButton }) => {
  const { navigate, notifications, user, theme, toggleTheme } = useApp(); // Use toggleTheme
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  return (
    <div className="flex flex-col h-full bg-[var(--color-background-page)] transition-colors duration-500 w-full relative">
      <GlobalSearch isOpen={isSearchOpen} onClose={useCallback(() => setIsSearchOpen(false), [])} />

      <div className="z-40 w-full flex flex-col items-center px-2 md:px-4 pt-2 lg:pt-8 shrink-0">
        <header className={`w-full max-w-7xl rounded-2xl lg:rounded-[2.5rem] border border-white/10 shadow-xl overflow-hidden ${
          theme === 'dark' ? 'bg-[var(--color-background-card)] border-[var(--color-border-subtle)]' : 'bg-gradient-to-r from-[var(--color-accent-sky)] to-[var(--color-accent-indigo)]'
        }`}>
          <div className="flex items-center justify-between px-2 sm:px-3 lg:px-10 h-14 lg:h-24 gap-1.5">
            
            <div className="flex items-center gap-2 lg:gap-6 shrink-0 max-w-[40%]">
              {onBack && (
                <button 
                  onClick={onBack} 
                  className="w-8 h-8 lg:w-14 lg:h-14 rounded-xl bg-[var(--color-background-card)]/20 flex items-center justify-center text-lg lg:text-2xl text-[var(--color-text-inverse)] active:scale-90 transition-all"
                >
                  →
                </button>
              )}
              <div className="flex flex-col min-w-0">
                <h1 className="text-[10px] lg:text-2xl font-black text-[var(--color-text-inverse)] truncate leading-tight mb-0.5">{title}</h1>
                <div className="flex items-center gap-1 opacity-80 overflow-hidden">
                  <div className="w-1 h-1 rounded-full bg-[var(--color-status-success)] animate-pulse shrink-0"></div>
                  <span className="text-[6px] lg:text-[10px] font-black text-[var(--color-text-inverse)]/90 truncate uppercase tracking-tighter">نظام الشويع المتصل</span>
                </div>
              </div>
            </div>

            <button 
                onClick={() => setIsSearchOpen(true)}
                className="h-9 lg:h-14 bg-[var(--color-background-page)]/10 dark:bg-[var(--color-background-card)]/5 rounded-xl border border-white/10 flex items-center justify-center px-3 gap-2 transition-all hover:bg-[var(--color-background-page)]/20 grow-0 shrink-0 w-10 sm:w-12 lg:w-48"
            >
                <span className="text-lg lg:text-2xl opacity-80 text-[var(--color-text-inverse)]">🔍</span>
                <span className="hidden lg:inline text-base font-bold text-[var(--color-text-inverse)]/40 truncate">بحث سحابي...</span>
            </button>
            
            <div className="flex items-center gap-1 sm:gap-2 lg:gap-4 shrink-0">
              {headerExtra}
              <button 
                onClick={toggleTheme} // Call toggleTheme here
                className="w-8 h-8 sm:w-9 sm:h-9 lg:w-14 lg:h-14 rounded-xl bg-[var(--color-background-card)]/20 flex items-center justify-center text-base lg:text-2xl text-[var(--color-text-inverse)] active:scale-90"
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
              <button 
                onClick={() => navigate('notifications')} 
                className="relative w-8 h-8 sm:w-9 sm:h-9 lg:w-14 lg:h-14 rounded-xl bg-[var(--color-background-card)]/20 flex items-center justify-center text-base lg:text-2xl text-[var(--color-text-inverse)] active:scale-90"
              >
                🔔
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -left-0.5 w-3.5 h-3.5 lg:w-6 lg:h-6 bg-[var(--color-status-danger)] rounded-full border-2 border-white flex items-center justify-center text-[7px] lg:text-[10px] font-black">
                     {unreadCount}
                  </span>
                )}
              </button>
              <button 
                onClick={() => navigate('settings')} 
                className="w-8 h-8 sm:w-9 sm:h-9 lg:w-14 lg:h-14 rounded-xl bg-[var(--color-background-card)]/20 flex items-center justify-center text-base lg:text-2xl text-[var(--color-text-inverse)] active:scale-90"
              >⚙️</button>
            </div>
          </div>
        </header>

        <div className="w-full max-w-7xl px-4 py-2 flex justify-between items-center animate-in fade-in slide-in-from-top-1 text-right">
           <div className="flex items-center gap-2">
              <span className="text-lg">👋</span>
              <p className="text-[10px] lg:text-xs font-black text-[var(--color-text-default)]">أهلاً بك يا <span className="text-[var(--color-accent-indigo)] dark:text-[var(--color-accent-sky)]">{user?.full_name || 'مدير'}</span></p>
           </div>
           <div className="flex items-center gap-3 text-[9px] lg:text-[11px] font-bold text-[var(--color-text-muted)] opacity-70 tabular-nums">
              <span className="hidden sm:flex items-center gap-1">📅 {currentTime.toLocaleDateString('ar-YE', {weekday: 'short', day:'numeric', month:'short'})}</span>
              <span className="w-px h-3 bg-[var(--color-border-default)] dark:bg-[var(--color-border-strong)] hidden sm:block"></span>
              <span className="flex items-center gap-1">🕒 {currentTime.toLocaleTimeString('ar-YE', {hour:'2-digit', minute:'2-digit'})}</span>
           </div>
        </div>
      </div>

      <main className="flex-1 w-full px-2 md:px-4 lg:px-16 pt-2 pb-44 overflow-y-auto no-scrollbar flex flex-col items-center">
        <div className="w-full max-w-7xl page-enter relative">
          {children}
        </div>
      </main>

      {floatingButton && (
        <div className="fixed bottom-24 right-6 lg:right-16 z-[100]">
          {floatingButton}
        </div>
      )}
    </div>
  );
});
