
import React, { useMemo, useState, useCallback, memo } from 'react';
import { useApp } from '../context/AppContext';
import { PageLayout } from './ui/Layout';
import { shareToWhatsApp, formatBudgetSummary, formatOverdueReminder } from '../services/shareService';
import { financeService } from '../services/financeService';

type TabType = 'all' | 'customer_debts' | 'supplier_debts' | 'critical';

const DebtsReport: React.FC = memo(() => {
  const { customers, suppliers, sales, purchases, vouchers, expenses, navigate, theme, user } = useApp();
  const [activeCurrency, setActiveCurrency] = useState<'YER' | 'SAR' | 'OMR'>('YER');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const budgetSummary = useMemo(() => {
    return financeService.getGlobalBudgetSummary(customers, suppliers, sales, purchases, vouchers, expenses);
  }, [customers, suppliers, sales, purchases, vouchers, expenses]);

  const currentSummary = useMemo(() => {
    return budgetSummary.find(s => s.currency === activeCurrency) || { 
      assets: 0, liabilities: 0, cash: 0, net: 0, currency: activeCurrency,
      customerDebts: 0, supplierDebts: 0, customerCredits: 0, supplierCredits: 0, collectionRatio: 0
    };
  }, [budgetSummary, activeCurrency]);

  const detailedBalances = useMemo(() => {
    const list: any[] = [];
    
    customers.forEach(c => {
      const bal = financeService.getCustomerBalances(c.id, sales, vouchers).find(b => b.currency === activeCurrency);
      if (bal && bal.amount !== 0) {
        list.push({
          id: c.id,
          name: c.name,
          type: 'عميل',
          amount: bal.amount,
          lastDate: bal.lastDate,
          days: bal.daysSinceLastOp,
          pending: bal.pendingCount,
          status: bal.status,
          phone: c.phone
        });
      }
    });

    suppliers.forEach(s => {
      const bal = financeService.getSupplierBalances(s.id, purchases, vouchers).find(b => b.currency === activeCurrency);
      if (bal && bal.amount !== 0) {
        list.push({
          id: s.id,
          name: s.name,
          type: 'مورد',
          amount: -bal.amount, 
          lastDate: bal.lastDate,
          days: bal.daysSinceLastOp,
          pending: bal.pendingCount,
          status: bal.status,
          phone: s.phone
        });
      }
    });

    return list.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }, [customers, suppliers, sales, purchases, vouchers, activeCurrency, searchTerm]);

  const filteredBalances = useMemo(() => {
    if (activeTab === 'customer_debts') return detailedBalances.filter(b => b.type === 'عميل' && b.amount > 0);
    if (activeTab === 'supplier_debts') return detailedBalances.filter(b => b.type === 'مورد' && b.amount < 0);
    if (activeTab === 'critical') return detailedBalances.filter(b => b.status.level === 'critical' && Math.abs(b.amount) > 0);
    return detailedBalances;
  }, [detailedBalances, activeTab]);

  const handleShareOverdue = useCallback((item: any) => {
    const text = formatOverdueReminder(item.name, Math.abs(item.amount), activeCurrency, item.days);
    shareToWhatsApp(text, item.phone);
  }, [activeCurrency]);

  const handleShareSummary = useCallback(() => {
    const activeStats = budgetSummary.filter(s => s.assets > 0 || s.liabilities > 0 || s.cash !== 0);
    const text = formatBudgetSummary(activeStats as any);
    shareToWhatsApp(text);
  }, [budgetSummary]);

  return (
    <PageLayout 
      title="الميزانية والديون الذكية" 
      onBack={() => navigate('dashboard')} 
      headerExtra={
        <div className="flex gap-2">
            <button 
              onClick={() => navigate('add-opening-balance')} 
              aria-label="تسجيل رصيد افتتاحي سابق"
              className="w-9 h-9 sm:w-10 sm:h-10 bg-[var(--color-primary)] text-[var(--color-text-inverse)] rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-all font-black"
            >＋📜</button>
            <button 
              onClick={handleShareSummary} 
              aria-label="مشاركة ملخص الميزانية"
              className="w-9 h-9 sm:w-10 sm:h-10 bg-[var(--color-background-card)]/10 rounded-xl flex items-center justify-center text-xl shadow-lg border border-[var(--color-border-default)] active:scale-90 transition-all"
            >📤</button>
        </div>
      }
    >
      <div className="space-y-4 pt-2 page-enter pb-44 max-w-lg mx-auto w-full px-2">
        
        <div className="flex bg-[var(--color-background-tertiary)] p-1 rounded-2xl gap-1 border border-[var(--color-border-default)] shadow-inner" role="tablist" aria-label="تحديد عملة التقارير">
           {(['YER', 'SAR', 'OMR'] as const).map(cur => (
             <button
               key={cur} onClick={() => setActiveCurrency(cur)}
               className={`flex-1 py-2.5 rounded-xl font-black text-xs transition-all ${activeCurrency === cur ? 'bg-[var(--color-accent-sky)] text-[var(--color-text-inverse)] shadow-lg' : 'text-[var(--color-text-muted)]'}`}
               aria-label={`تحديد العملة ${cur === 'YER' ? 'اليمني' : cur === 'SAR' ? 'السعودي' : 'العماني'}`}
               aria-pressed={activeCurrency === cur}
             >
               {cur === 'YER' ? 'يمني' : cur === 'SAR' ? 'سعودي' : 'عماني'}
             </button>
           ))}
        </div>

        <div className={`rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden border ${
          theme === 'dark' ? 'bg-[var(--color-background-card)] border-[var(--color-border-default)] text-[var(--color-text-default)]' : 'bg-[var(--color-background-card)] border-[var(--color-border-default)] text-[var(--color-text-default)]'
        }`}>
          <p className="text-[9px] font-black opacity-50 uppercase tracking-[0.2em] mb-1 text-[var(--color-text-muted)]">صافي القيمة التقديرية (Net)</p>
          <div className="flex items-baseline gap-2">
             <h2 className={`text-4xl font-black tabular-nums tracking-tighter ${currentSummary.net >= 0 ? 'text-[var(--color-status-success)]' : 'text-[var(--color-status-danger)]'}`}>
                {currentSummary.net.toLocaleString()}
             </h2>
             <span className="text-[10px] font-bold opacity-30 text-[var(--color-text-muted)] uppercase">{activeCurrency}</span>
          </div>
          <button 
            onClick={() => navigate('add-opening-balance')}
            className="absolute top-6 left-6 bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-3 py-1.5 rounded-lg text-[9px] font-black border border-[var(--color-primary)]/20 active:scale-95"
            aria-label="تسجيل رصيد افتتاحي سابق"
          >
            دين سابق 📜
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 px-1" role="tablist" aria-label="تصفية الديون">
           {[
             { id: 'all', label: 'الكل' },
             { id: 'customer_debts', label: 'ديون لنا' },
             { id: 'supplier_debts', label: 'ديون علينا' },
             { id: 'critical', label: 'المتأخرين ⚠️' }
           ].map(tab => (
             <button
               key={tab.id} onClick={() => setActiveTab(tab.id as any)}
               className={`flex-shrink-0 px-5 py-2.5 rounded-full font-black text-xs transition-all border-2 ${
                 activeTab === tab.id 
                 ? 'bg-[var(--color-accent-sky)] text-[var(--color-text-inverse)] border-transparent shadow-lg' 
                 : 'bg-[var(--color-background-card)] text-[var(--color-text-muted)] border-[var(--color-border-default)]'
               }`}
               role="tab"
               aria-selected={activeTab === tab.id}
               aria-controls={`${tab.id}-panel`}
               aria-label={`عرض ${tab.label}`}
             >
               {tab.label}
             </button>
           ))}
        </div>

        <div className="relative">
           <input 
             type="text" 
             placeholder="ابحث عن شخص..."
             className="w-full bg-[var(--color-background-card)] border-2 border-[var(--color-border-default)] rounded-2xl p-4 pr-12 font-black text-sm outline-none shadow-sm focus:border-[var(--color-accent-sky)] transition-all"
             value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
             aria-label="البحث عن عميل أو مورد"
           />
           <span className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 text-xl text-[var(--color-text-muted)]" aria-hidden="true">🔍</span>
        </div>

        <div className="space-y-3" id={`${activeTab}-panel`} role="tabpanel" aria-labelledby={`${activeTab}-tab`}>
           {filteredBalances.map((item) => (
             <div 
               key={item.id} 
               className={`p-5 rounded-[2rem] border-2 transition-all group relative overflow-hidden ${
               item.status.level === 'critical' 
                 ? 'border-[var(--color-status-danger)]/50 bg-[var(--color-status-danger-bg)]/[0.03]' 
                 : theme === 'dark' ? 'bg-[var(--color-background-card)] border-[var(--color-border-default)]' : 'bg-[var(--color-background-card)] border-[var(--color-border-default)] shadow-md'
             }`}
             role="listitem"
             aria-label={`رصيد ${item.name}`}
             >
               <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                     <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner ${
                       item.type === 'عميل' ? 'bg-[var(--color-status-info-bg)] text-[var(--color-status-info)]' : 'bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning)]'
                     }`} aria-hidden="true">
                       {item.type === 'عميل' ? '👤' : '🚛'}
                     </div>
                     <div>
                        <h4 className="font-black text-base text-[var(--color-text-default)] leading-tight">{item.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                           <span className={`${item.status.color} text-[9px] font-black flex items-center gap-1`}>
                              <span aria-hidden="true">{item.status.icon}</span>
                              {item.status.label}
                           </span>
                           <span className="text-[9px] font-bold text-[var(--color-text-muted)] tabular-nums">{item.days} يوم</span>
                        </div>
                     </div>
                  </div>
                  <div className="text-left">
                     <p className={`text-xl font-black tabular-nums tracking-tighter ${item.amount > 0 ? 'text-[var(--color-status-danger)]' : 'text-[var(--color-status-success)]'}`}>
                        {Math.abs(item.amount).toLocaleString()}
                     </p>
                     <p className="text-[8px] font-black text-[var(--color-text-muted)] uppercase">{item.amount > 0 ? 'لنا' : 'علينا'}</p>
                  </div>
               </div>

               <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={() => navigate('account-statement', { personId: item.id, personType: item.type })}
                    className="bg-[var(--color-background-tertiary)] text-[var(--color-text-muted)] py-2.5 rounded-xl font-black text-[10px] active:scale-95"
                    aria-label={`عرض كشف حساب ${item.name}`}
                  >📑 كشف</button>
                  
                  <button 
                    onClick={() => handleShareOverdue(item)}
                    className="bg-[var(--color-status-success-bg)] text-[var(--color-status-success)] border border-[var(--color-status-success)]/20 py-2.5 rounded-xl font-black text-[10px] active:scale-95"
                    aria-label={`إرسال تذكير بالدين لـ ${item.name} عبر واتساب`}
                  >💬 تذكير</button>

                  <button 
                    onClick={() => navigate('add-voucher', { 
                      type: item.amount > 0 ? (item.type === 'عميل' ? 'قبض' : 'دفع') : (item.type === 'عميل' ? 'دفع' : 'قبض'), 
                      personId: item.id, personType: item.type, amount: Math.abs(item.amount), currency: activeCurrency 
                    })}
                    className="bg-[var(--color-status-success)] text-[var(--color-text-inverse)] py-2.5 rounded-xl font-black text-[10px] shadow-lg active:scale-95"
                    aria-label={`تسجيل عملية تصفية حساب لـ ${item.name}`}
                  >✅ تصفية</button>
               </div>
             </div>
           ))}
        </div>
      </div>
    </PageLayout>
  );
});

export default DebtsReport;
