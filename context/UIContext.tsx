
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { Page, Theme, AppNotification } from '../types';
import { dataService } from '../services/dataService';
import { ToastProps } from '../components/ui/Toast';
import { logger } from '../services/loggerService';

interface UIContextType {
  currentPage: Page;
  navigationParams: any;
  theme: Theme;
  resolvedTheme: 'light' | 'dark'; // الوضع الفعلي المطبق حالياً
  activeToasts: ToastProps[];
  notifications: AppNotification[];
  isSidebarCollapsed: boolean;
  feedbackType: 'celebration' | 'debt' | null;
  isOnline: boolean;
  offlineQueueCount: number;
  installPrompt: any;
  navigate: (p: Page, params?: any) => void;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void; // Added toggleTheme
  toggleSidebar: () => void;
  addNotification: (title: string, message: string, type: AppNotification['type']) => Promise<void>;
  removeToast: (id: string) => void;
  markNotificationsAsRead: () => Promise<void>;
  deleteAllOldNotifications: () => Promise<void>; // Added deleteAllOldNotifications
  setNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>>;
  triggerFeedback: (type: 'celebration' | 'debt') => void;
  promptInstall: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [navigationParams, setNavigationParams] = useState<any>(null);
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light'); // Changed default from 'dark' to 'light'
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');
  const [activeToasts, setActiveToasts] = useState<ToastProps[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');
  const [feedbackType, setFeedbackType] = useState<'celebration' | 'debt' | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  const navigate = useCallback((p: Page, params?: any) => {
    setCurrentPage(p);
    setNavigationParams(params || null);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem('theme', t);
  }, []);

  // New function for theme toggling
  const toggleTheme = useCallback(() => {
    setThemeState(prevTheme => {
      // Toggle between light and dark if current is 'system' or specific
      const newTheme = prevTheme === 'dark' ? 'light' : 'dark'; 
      localStorage.setItem('theme', newTheme);
      return newTheme;
    });
  }, []);

  // مراقبة الثيم وتطبيقه
  useEffect(() => {
    const applyTheme = () => {
      let target: 'light' | 'dark' = 'dark'; // Default to dark for system fallback if not explicitly set
      if (theme === 'system') {
        target = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } else {
        target = theme;
      }
      
      setResolvedTheme(target);
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(target);
    };

    applyTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme]);

  const promptInstall = useCallback(async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') setInstallPrompt(null);
    }
  }, [installPrompt]);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => {
      const newState = !prev;
      localStorage.setItem('sidebarCollapsed', String(newState));
      return newState;
    });
  }, []);

  const removeToast = useCallback((id: string) => {
    setActiveToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addNotification = useCallback(async (title: string, message: string, type: AppNotification['type']) => {
    try {
      const saved = await dataService.saveNotification({ title, message, type, date: new Date().toISOString() });
      setNotifications(prev => [saved, ...prev]);
      const toastId = Math.random().toString(36).substr(2, 9);
      setActiveToasts(prev => [...prev, { id: toastId, title, message, type, onClose: () => removeToast(toastId) }]);
    } catch (e) { 
      logger.error("Failed to save notification:", e);
    }
  }, [removeToast, setNotifications, setActiveToasts]);

  const markNotificationsAsRead = useCallback(async () => {
    try {
      await dataService.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) {
      logger.error("Failed to mark notifications as read:", e);
      addNotification("خطأ ⚠️", "فشل تحديث حالة الإشعارات.", "warning");
    }
  }, [setNotifications, addNotification]);

  const deleteAllOldNotifications = useCallback(async () => {
    const daysAgo = 7; // Define "old" as older than 7 days
    try {
      await dataService.deleteAllNotificationsOlderThan(daysAgo);
      setNotifications(prev => prev.filter(n => (Date.now() - new Date(n.date).getTime()) / (1000 * 60 * 60 * 24) <= daysAgo));
      addNotification("تم ✅", "تم حذف التنبيهات القديمة بنجاح.", "success");
    } catch (e) {
      logger.error("Failed to delete old notifications:", e);
      addNotification("خطأ ⚠️", "فشل حذف التنبيهات القديمة. حدث خطأ غير متوقع.", "warning");
    }
  }, [addNotification, setNotifications]);

  const triggerFeedback = useCallback((type: 'celebration' | 'debt') => {
    setFeedbackType(type);
    setTimeout(() => setFeedbackType(null), 4000);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addNotification("تم استعادة الاتصال ✅", "أنت متصل بالإنترنت الآن.", "info");
    };
    const handleOffline = () => {
      setIsOnline(false);
      addNotification("قطع الاتصال ⛔", "أنت تعمل بالوضع المحلي حالياً. سيتم المزامنة لاحقاً.", "warning");
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);

    dataService.onOfflineQueueCountChange = (count) => {
      setOfflineQueueCount(count);
    };

    const handleSWMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'OFFLINE_QUEUE_CLEARED') {
        dataService.updateOfflineQueueCount();
      }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      }
    };
  }, [addNotification, isOnline]);

  const value = useMemo(() => ({
    currentPage, navigationParams, theme, resolvedTheme, activeToasts, notifications, isSidebarCollapsed, feedbackType, isOnline, offlineQueueCount, installPrompt,
    navigate, setTheme, toggleTheme, toggleSidebar, addNotification, removeToast, markNotificationsAsRead, deleteAllOldNotifications, setNotifications, triggerFeedback, promptInstall
  }), [currentPage, navigationParams, theme, resolvedTheme, activeToasts, notifications, isSidebarCollapsed, feedbackType, isOnline, offlineQueueCount, installPrompt, navigate, setTheme, toggleTheme, toggleSidebar, addNotification, removeToast, markNotificationsAsRead, deleteAllOldNotifications, setNotifications, triggerFeedback, promptInstall]);

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used within UIProvider');
  return context;
};
