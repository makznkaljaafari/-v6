
import React, { createContext, useContext, useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { useInventory } from './InventoryContext'; 
import { useBusiness } from './BusinessContext';   
import { useFinance } from './FinanceContext';     
import { useSystem } from './SystemContext';       
import { dataService } from '../services/dataService';
import { useUI } from './UIContext';
import { useAuth } from './AuthContext';
import { logger } from '../services/loggerService';
import { supabase } from '../services/supabaseClient';
import { exportService } from '../services/exportService';

const DataContext = createContext<any>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setNotifications, addNotification, isOnline } = useUI();
  const { user, setUser } = useAuth();
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);
  
  const invContext = useInventory();
  const busContext = useBusiness();
  const finContext = useFinance();
  const sysContext = useSystem();

  const { setCategories, categories } = invContext;
  const { setCustomers, customers, setSuppliers, suppliers, setSales, sales, setPurchases, purchases } = busContext;
  const { setVouchers, vouchers, setExpenses, expenses, setWasteRecords, wasteRecords, setExpenseTemplates, expenseTemplates } = finContext;
  const { setConnectionError } = sysContext; 

  const syncIntervalRef = useRef<any>(null);
  const hasCheckedBackupThisSession = useRef(false);

  const loadAllData = useCallback(async (userId: string, isSilent = false) => {
    if (!userId) return;
    if (!isSilent) setIsDataLoaded(false);
    setIsSyncing(true);
    
    try {
      await dataService.ensureUserExists(userId);
      const profile = await dataService.getFullProfile(userId);
      if (profile) setUser(profile);

      const [custs, supps, cats, sls, purchs, vchs, exps, wst, notifs, expTemplates] = await Promise.all([
        dataService.getCustomers(),
        dataService.getSuppliers(),
        dataService.getCategories(),
        dataService.getSales(),
        dataService.getPurchases(),
        dataService.getVouchers(),
        dataService.getExpenses(),
        dataService.getWaste(),
        dataService.getNotifications(),
        dataService.getExpenseTemplates()
      ]);

      setCustomers(custs);
      setSuppliers(supps);
      setCategories(cats);
      setSales(sls);
      setPurchases(purchs);
      setVouchers(vchs);
      setExpenses(exps);
      setWasteRecords(wst);
      setExpenseTemplates(expTemplates);
      setNotifications(notifs);

      setIsDataLoaded(true);
      setConnectionError(null);

      if (isOnline) {
        await dataService.processOfflineQueue();
        await dataService.updateOfflineQueueCount();
      }

    } catch (e: any) {
      logger.error("Global Data Sync Error:", e);
      if (!isSilent) addNotification("تنبيه 📡", "حدث خطأ أثناء مزامنة البيانات.", "warning");
    } finally {
      setIsSyncing(false);
      dataService.updateOfflineQueueCount(); 
    }
  }, [setUser, setNotifications, addNotification, isOnline, setCategories, setCustomers, setSuppliers, setSales, setPurchases, setVouchers, setExpenses, setWasteRecords, setExpenseTemplates, setConnectionError]);

  // منطق النسخ الاحتياطي التلقائي النظيف
  useEffect(() => {
    if (!isDataLoaded || !user?.id || !isOnline || hasCheckedBackupThisSession.current) return;

    const runAutoBackup = async () => {
      const lastBackupKey = `last_daily_backup_${user.id}`;
      const storedLastBackup = localStorage.getItem(lastBackupKey);
      const frequency = user?.accounting_settings?.backup_frequency || 'daily';
      const now = new Date();
      
      let shouldBackup = false;
      if (!storedLastBackup) {
        shouldBackup = true;
      } else {
        const lastDate = new Date(storedLastBackup);
        const hoursDiff = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
        if (frequency === '12h' && hoursDiff >= 12) shouldBackup = true;
        else if (frequency === 'daily' && hoursDiff >= 24) shouldBackup = true;
      }

      if (shouldBackup) {
        hasCheckedBackupThisSession.current = true; // نمنع التكرار في هذه الجلسة
        try {
          const backupData = await dataService.prepareBackupPackage(user.id, {
            profile: user, customers, suppliers, categories, sales, purchases, vouchers, expenses, waste: wasteRecords, expenseTemplates
          });
          
          const success = exportService.exportToJson(backupData, `alshwaia_auto_backup_${frequency}`);
          if (success) {
            const nowISO = now.toISOString();
            localStorage.setItem(lastBackupKey, nowISO);
            setLastBackupDate(nowISO);
            addNotification("نسخ احتياطي ناجح 💾", "تم حفظ نسخة من بياناتك محلياً.", "success");
            dataService.logActivity(user.id, "نسخ احتياطي تلقائي", `تم بنجاح (وتيرة: ${frequency})`, 'data');
          }
        } catch (e) {
          logger.error("Auto-backup sequence failed:", e);
        }
      } else {
        setLastBackupDate(storedLastBackup);
        hasCheckedBackupThisSession.current = true;
      }
    };

    // تأخير طفيف لضمان عدم تداخل التصدير مع عمليات التحميل الأولية
    const timeout = setTimeout(runAutoBackup, 5000);
    return () => clearTimeout(timeout);
  }, [isDataLoaded, user, isOnline, customers, suppliers, categories, sales, purchases, vouchers, expenses, wasteRecords, expenseTemplates, addNotification]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        loadAllData(session.user.id, true);
        if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = setInterval(() => loadAllData(session.user.id, true), 300000); 
      }
    });
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      subscription.unsubscribe();
    };
  }, [loadAllData]);

  const value = useMemo(() => ({
    ...invContext, ...busContext, ...finContext, ...sysContext,
    isDataLoaded, isSyncing, loadAllData, lastBackupDate
  }), [invContext, busContext, finContext, sysContext, isDataLoaded, isSyncing, loadAllData, lastBackupDate]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) throw new Error('useData must be used within a DataProvider');
  return context;
};
