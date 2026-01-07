
import React, { useState, useEffect } from 'react';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { PageLayout } from './ui/Layout';
import { indexedDbService } from '../services/indexedDbService';
import { Theme } from '../types';
import { exportService } from '../services/exportService'; 
import { logger } from '../services/loggerService'; 
import { BaseButton } from './ui/atoms/BaseButton'; 
import { dataService } from '../services/dataService'; 

type SettingsTab = 'general' | 'appearance' | 'accounting' | 'finance' | 'integrations' | 'data';

const SettingsPage: React.FC = () => {
  const { navigate, theme, setTheme, addNotification, resolvedTheme } = useUI();
  const { user, updateUser } = useAuth();
  const { exchangeRates, updateExchangeRates, loadAllData, lastBackupDate, isSyncing } = useData(); 

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isBackupLoading, setIsBackupLoading] = useState(false); 
  
  const [localFormData, setLocalFormData] = useState({
    agency_name: '',
    full_name: '',
    whatsapp_number: '',
    telegram_username: '',
    enable_voice_ai: false,
    appearance_settings: {
      theme: 'system' as Theme, 
      accent_color: '#4ade80'
    },
    accounting_settings: {
        allow_negative_stock: false,
        auto_share_whatsapp: true,
        show_debt_alerts: true,
        hide_zero_balances: false,
        decimal_precision: 0,
        backup_frequency: 'daily' as 'daily' | '12h'
    }
  });

  const [localRates, setLocalRates] = useState({
    SAR_TO_YER: 430,
    OMR_TO_YER: 425
  });

  useEffect(() => {
    if (user) {
      setLocalFormData({
        agency_name: user.agency_name || '',
        full_name: user.full_name || '',
        whatsapp_number: user.whatsapp_number || '',
        telegram_username: user.telegram_username || '',
        enable_voice_ai: user.enable_voice_ai || false,
        appearance_settings: {
          theme: user.appearance_settings?.theme || (localStorage.getItem('theme') as Theme) || 'system', 
          accent_color: user.appearance_settings?.accent_color || '#4ade80'
        },
        accounting_settings: {
          allow_negative_stock: user.accounting_settings?.allow_negative_stock ?? false,
          auto_share_whatsapp: user.accounting_settings?.auto_share_whatsapp ?? true,
          show_debt_alerts: user.accounting_settings?.show_debt_alerts ?? true,
          hide_zero_balances: user.accounting_settings?.hide_zero_balances ?? false,
          decimal_precision: user.accounting_settings?.decimal_precision ?? 0,
          backup_frequency: user.accounting_settings?.backup_frequency || 'daily'
        }
      });
    }
    if (exchangeRates) {
      setLocalRates(exchangeRates);
    }
  }, [user, exchangeRates]);

  const handleInputChange = (updater: (prev: any) => any) => {
    setLocalFormData(updater);
    setHasChanges(true);
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    handleInputChange(p => ({
      ...p,
      appearance_settings: { ...p.appearance_settings, theme: newTheme }
    }));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await updateUser(localFormData);
      if (activeTab === 'finance') {
        await updateExchangeRates(localRates);
      }
      addNotification('تم التحديث 💾', 'تم حفظ الإعدادات سحابياً بنجاح.', 'success');
      setHasChanges(false);
    } catch (e: any) {
      addNotification('خطأ ⚠️', e.message || 'تعذر حفظ البيانات.', 'warning');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearCache = async () => {
    if (window.confirm('⚠️ مسح التخزين المؤقت؟ سيتم إجبار التطبيق على إعادة تحميل البيانات من السيرفر.')) {
      await indexedDbService.clearCache();
      window.location.reload();
    }
  };

  const handleManualBackup = async () => {
    if (!user?.id) return;
    setIsBackupLoading(true);
    try {
      // Corrected call from exportAllData to prepareBackupPackage
      const allData = await dataService.prepareBackupPackage(user.id);
      const nowISO = new Date().toISOString();
      const fileName = `alshwaia_manual_backup_${nowISO.replace(/:/g, '-')}`; 
      exportService.exportToJson(allData, fileName);
      addNotification("نسخ احتياطي يدوي ✅", "تم حفظ نسخة احتياطية من بياناتك محلياً.", "success");
      dataService.logActivity(user.id, "نسخ احتياطي يدوي", `تم حفظ نسخة احتياطية يدوية من البيانات.`, 'data');
      localStorage.setItem(`last_daily_backup_${user.id}`, nowISO); 
    } catch (e: any) {
      addNotification("خطأ ❌", "فشل النسخ الاحتياطي اليدوي.", "warning");
    } finally {
      setIsBackupLoading(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'البروفايل', icon: '👤' },
    { id: 'appearance', label: 'المظهر', icon: '🎨' },
    { id: 'accounting', label: 'المحاسبة', icon: '📊' },
    { id: 'finance', label: 'المالية', icon: '💱' },
    { id: 'integrations', label: 'الربط', icon: '🔗' },
    { id: 'data', label: 'البيانات', icon: '💾' },
  ];

  return (
    <PageLayout title="إعدادات النظام" onBack={() => navigate('dashboard')}>
      <div className="max-w-3xl mx-auto w-full px-2 pb-48 space-y-6 page-enter">
        
        <div className={`p-1.5 rounded-[1.8rem] shadow-lg border overflow-x-auto no-scrollbar flex items-center gap-1 sticky top-2 z-30 ${resolvedTheme === 'dark' ? 'bg-slate-900/90 backdrop-blur-md border-white/5' : 'bg-white/90 backdrop-blur-md border-slate-200'}`}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`flex-1 min-w-[70px] flex flex-col items-center justify-center gap-1 py-3 rounded-2xl font-black text-[9px] transition-all relative ${
                activeTab === tab.id 
                ? 'bg-indigo-600 text-white shadow-lg' 
                : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="space-y-6">
          {activeTab === 'general' && (
            <div className="space-y-4">
               <SettingsCard icon="🏢" title="معلومات الوكالة" theme={resolvedTheme}>
                  <InputGroup label="اسم الوكالة التجاري" value={localFormData.agency_name} onChange={(v: string) => handleInputChange(p => ({...p, agency_name: v}))} />
                  <InputGroup label="اسم المدير المسؤول" value={localFormData.full_name} onChange={(v: string) => handleInputChange(p => ({...p, full_name: v}))} />
               </SettingsCard>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-4">
               <SettingsCard icon="🎨" title="تخصيص المظهر" theme={resolvedTheme}>
                  <div className="p-4 space-y-6">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">اختر وضع النظام</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'light', label: 'نهاري', icon: '☀️' },
                        { id: 'dark', label: 'ليلي', icon: '🌙' },
                        { id: 'system', label: 'تلقائي', icon: '📱' }
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleThemeChange(t.id as Theme)}
                          className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                            theme === t.id 
                            ? 'bg-indigo-600 text-white border-transparent shadow-lg' 
                            : 'bg-slate-50 dark:bg-white/5 border-transparent text-slate-400'
                          }`}
                        >
                          <span className="text-2xl">{t.icon}</span>
                          <span className="font-black text-[9px]">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
               </SettingsCard>
            </div>
          )}

          {activeTab === 'accounting' && (
            <div className="space-y-4">
               <SettingsCard icon="⚖️" title="قواعد المحاسبة" theme={resolvedTheme}>
                  <ToggleOption 
                    icon="🚫" label="منع البيع بالسالب" desc="عدم السماح بالفواتير إذا نفد المخزون"
                    value={!localFormData.accounting_settings.allow_negative_stock}
                    onChange={(v: boolean) => handleInputChange(p => ({...p, accounting_settings: {...p.accounting_settings, allow_negative_stock: !v}}))}
                  />
                  <ToggleOption 
                    icon="🔔" label="تنبيهات الديون" desc="تحذير عند تجاوز العميل لسقف المديونية"
                    value={localFormData.accounting_settings.show_debt_alerts}
                    onChange={(v: boolean) => handleInputChange(p => ({...p, accounting_settings: {...p.accounting_settings, show_debt_alerts: v}}))}
                  />
               </SettingsCard>
            </div>
          )}

          {activeTab === 'finance' && (
            <div className="space-y-4">
               <SettingsCard icon="💱" title="أسعار الصرف" theme={resolvedTheme}>
                  <div className="grid grid-cols-1 gap-4 p-2">
                     <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border-2 border-emerald-500/20">
                        <p className="text-[10px] font-black text-emerald-600 mb-1">🇸🇦 الريال السعودي مقابل اليمني</p>
                        <input 
                           type="number" 
                           className="w-full bg-transparent font-black text-4xl outline-none text-emerald-700 dark:text-emerald-400 tabular-nums"
                           value={localRates.SAR_TO_YER}
                           onChange={(e) => { setLocalRates({...localRates, SAR_TO_YER: parseFloat(e.target.value)}); setHasChanges(true); }}
                        />
                     </div>
                  </div>
               </SettingsCard>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-4">
               <SettingsCard icon="☁️" title="إدارة البيانات والنسخ الاحتياطي" theme={resolvedTheme}>
                  <div className="p-4 space-y-6">
                     
                     <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">وتيرة النسخ الاحتياطي التلقائي</label>
                        <div className="grid grid-cols-2 gap-3">
                           {[
                              { id: 'daily', label: 'مرة كل 24 ساعة', icon: '📅' },
                              { id: '12h', label: 'مرة كل 12 ساعة', icon: '⏰' }
                           ].map(freq => (
                              <button
                                 key={freq.id}
                                 onClick={() => handleInputChange(p => ({...p, accounting_settings: {...p.accounting_settings, backup_frequency: freq.id}}))}
                                 className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${localFormData.accounting_settings.backup_frequency === freq.id ? 'bg-indigo-600 text-white border-transparent' : 'bg-slate-50 dark:bg-white/5 border-transparent text-slate-400'}`}
                              >
                                 <span className="text-xl">{freq.icon}</span>
                                 <span className="font-black text-[10px]">{freq.label}</span>
                              </button>
                           ))}
                        </div>
                     </div>

                     <div className="p-4 rounded-2xl border-2 border-dashed border-indigo-500/20 flex flex-col items-start gap-3 bg-indigo-500/5">
                        <div className="flex items-center gap-3">
                           <span className="text-xl">💾</span>
                           <div>
                              <p className="font-black text-xs">آخر نسخ احتياطي تم:</p>
                              <p className="text-[10px] text-indigo-500 font-bold tabular-nums">
                                 {lastBackupDate ? new Date(lastBackupDate).toLocaleString('ar-YE') : 'لم يتم بعد'}
                              </p>
                           </div>
                        </div>
                        <BaseButton
                           variant="primary"
                           size="md"
                           onClick={handleManualBackup}
                           loading={isBackupLoading}
                           className="w-full mt-2"
                        >
                           تصدير نسخة احتياطية الآن 📥
                        </BaseButton>
                     </div>

                     <button onClick={handleClearCache} className="w-full border-2 border-rose-500/20 text-rose-500 p-4 rounded-2xl font-black text-xs flex items-center justify-between hover:bg-rose-500/10">
                        <span>مسح ذاكرة الكاش 🗑️</span>
                        <span className="opacity-50">إصلاح المشاكل البرمجية</span>
                     </button>
                  </div>
               </SettingsCard>
            </div>
          )}
        </div>

        {hasChanges && (
          <div className="fixed bottom-24 left-0 right-0 px-4 z-40">
             <button 
              onClick={handleSaveAll}
              disabled={isSaving}
              className={`w-full max-w-2xl mx-auto p-5 rounded-[2rem] font-black text-lg shadow-xl transition-all flex items-center justify-center gap-4 ${isSaving ? 'bg-slate-400' : 'bg-emerald-600 text-white active:scale-95'}`}
             >
               {isSaving ? <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div> : 'حفظ الإعدادات النهائية ✅'}
             </button>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

const SettingsCard = ({ icon, title, children, theme }: any) => (
  <div className={`rounded-[2.2rem] border overflow-hidden shadow-sm transition-all ${theme === 'dark' ? 'bg-[var(--color-background-card)] border-[var(--color-border-subtle)]' : 'bg-white border-slate-200'}`}>
     <div className={`px-6 py-4 flex items-center gap-3 border-b ${theme === 'dark' ? 'border-white/5 bg-white/5' : 'bg-slate-50 border-slate-200'}`}>
        <span className="text-xl">{icon}</span>
        <h3 className="font-black text-xs uppercase tracking-tighter opacity-80">{title}</h3>
     </div>
     <div className="p-4 space-y-4">
        {children}
     </div>
  </div>
);

const InputGroup = ({ label, value, onChange, placeholder = "" }: any) => (
  <div className="space-y-1.5 p-2">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{label}</label>
    <input 
      type="text" 
      className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-white/5 font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition-all text-sm"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

const ToggleOption = ({ icon, label, desc, value, onChange }: any) => (
  <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
    <div className="flex items-center gap-4">
       <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center text-xl shadow-sm">{icon}</div>
       <div className="text-right">
         <p className="font-black text-xs">{label}</p>
         <p className="text-[9px] text-slate-400 font-bold">{desc}</p>
       </div>
    </div>
    <button 
      onClick={() => onChange(!value)}
      className={`w-12 h-6 rounded-full relative transition-all ${value ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
    >
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all ${value ? 'right-7' : 'right-1'}`}></div>
    </button>
  </div>
);

export default SettingsPage;
