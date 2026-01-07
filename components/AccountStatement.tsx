

import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { PageLayout } from './ui/Layout';
import { shareToWhatsApp, formatCustomerStatement, formatSupplierStatement } from '../services/shareService';
import { financeService } from '../services/financeService';

const AccountStatement: React.FC = () => {
  const { 
    navigationParams, navigate, sales, purchases, vouchers, 
    customers, suppliers, theme, user 
  } = useApp();
  
  const [selectedPerson, setSelectedPerson] = useState<{id: string, type: 'عميل' | 'مورد'} | null>(
    navigationParams?.personId ? { id: navigationParams.personId, type: navigationParams.personType } : null
  );
  
  const [selectedCurrency, setSelectedCurrency] = useState<'YER' | 'SAR' | 'OMR'>('YER');
  const [showPicker, setShowPicker] = useState(!selectedPerson);
  const [pickerSearch, setPickerSearch] = useState('');

  const person = useMemo(() => {
    if (!selectedPerson) return null;
    if (selectedPerson.type === 'عميل') return customers.find((c: any) => c.id === selectedPerson.id);
    return suppliers.find((s: any) => s.id === selectedPerson.id);
  }, [selectedPerson, customers, suppliers]);

  const statementData = useMemo(() => {
    if (!person || !selectedPerson) return [];
    let transactions: any[] = [];

    if (selectedPerson.type === 'عميل') {
      const customerSales = sales.filter((s: any) => s.customer_id === selectedPerson.id && s.currency === selectedCurrency && !s.is_returned);
      customerSales.forEach((s: any) => {
        transactions.push({ id: s.id, date: s.date, type: 'بيع', details: `${s.qat_type} (${s.quantity})`, debit: s.status === 'آجل' ? s.total : 0, credit: s.status === 'نقدي' ? s.total : 0, original: s });
      });
      const customerVouchers = vouchers.filter((v: any) => v.person_id === selectedPerson.id && v.person_type === 'عميل' && v.currency === selectedCurrency);
      customerVouchers.forEach((v: any) => {
        transactions.push({ id: v.id, date: v.date, type: `سند ${v.type}`, details: v.notes || 'سند مالي', debit: v.type === 'دفع' ? v.amount : 0, credit: v.type === 'قبض' ? v.amount : 0, original: v });
      });
    } else {
      const supplierPurchases = purchases.filter((p: any) => p.supplier_id === selectedPerson.id && p.currency === selectedCurrency && !p.is_returned);
      supplierPurchases.forEach((p: any) => {
        transactions.push({ id: p.id, date: p.date, type: 'شراء', details: `${p.qat_type} (${p.quantity})`, debit: p.status === 'نقدي' ? p.total : 0, credit: p.status === 'آجل' ? p.total : 0, original: p });
      });
      const supplierVouchers = vouchers.filter((v: any) => v.person_id === selectedPerson.id && v.person_type === 'مورد' && v.currency === selectedCurrency);
      supplierVouchers.forEach((v: any) => {
        transactions.push({ id: v.id, date: v.date, type: `سند ${v.type}`, details: v.notes || 'سداد حساب', debit: v.type === 'دفع' ? v.amount : 0, credit: v.type === 'قبض' ? v.amount : 0, original: v });
      });
    }

    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let runningBalance = 0;
    return transactions.map(t => {
      if (selectedPerson.type === 'عميل') runningBalance += (t.debit - t.credit);
      else runningBalance += (t.credit - t.debit);
      return { ...t, balance: runningBalance };
    });
  }, [person, selectedPerson, sales, purchases, vouchers, selectedCurrency]);

  const currentBalance = useMemo(() => {
    if (!person || !selectedPerson) return 0;
    const balances = selectedPerson.type === 'عميل' 
      ? financeService.getCustomerBalances(selectedPerson.id, sales, vouchers)
      : financeService.getSupplierBalances(selectedPerson.id, purchases, vouchers);
    return balances.find(b => b.currency === selectedCurrency)?.amount || 0;
  }, [person, selectedPerson, sales, purchases, vouchers, selectedCurrency]);

  const handleShare = () => {
    if (!person) return;
    const balances = [{ currency: selectedCurrency, amount: currentBalance }];
    const text = selectedPerson?.type === 'عميل' 
      ? formatCustomerStatement(person, sales, vouchers, balances)
      : formatSupplierStatement(person, purchases, vouchers, balances);
    shareToWhatsApp(text, person.phone);
  };

  const totals = useMemo(() => {
    return statementData.reduce((acc, t) => ({
      debit: acc.debit + t.debit,
      credit: acc.credit + t.credit
    }), { debit: 0, credit: 0 });
  }, [statementData]);

  if (showPicker) {
    return (
      <PageLayout title="اختيار الحساب" onBack={() => selectedPerson ? setShowPicker(false) : navigate('dashboard')}>
        <div className="p-4 space-y-6 max-w-2xl mx-auto page-enter pb-44">
          <div className="relative group">
            <input 
              type="text" placeholder="ابحث عن اسم العميل أو المورد..."
              className={`w-full p-6 pr-14 rounded-[2.5rem] border-2 font-black outline-none transition-all shadow-2xl ${theme === 'dark' ? 'bg-slate-800 border-white/5 focus:border-sky-500' : 'bg-white border-slate-100 focus:border-indigo-500'}`}
              value={pickerSearch} onChange={e => setPickerSearch(e.target.value)}
            />
            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-2xl opacity-30">🔍</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section>
              <h3 className="text-xs font-black text-indigo-500 dark:text-sky-400 uppercase tracking-[0.2em] mb-4 px-2 flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                 دليل العملاء
              </h3>
              <div className="space-y-2">
                {customers.filter(c => c.name.toLowerCase().includes(pickerSearch.toLowerCase())).slice(0, 15).map(c => (
                  <button key={c.id} onClick={() => { setSelectedPerson({id: c.id, type: 'عميل'}); setShowPicker(false); }} className={`w-full flex items-center justify-between p-5 rounded-2xl border transition-all active:scale-95 text-right ${theme === 'dark' ? 'bg-slate-800/50 border-white/5 hover:bg-slate-800' : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md'}`}>
                    <div className="flex items-center gap-3">
                       <span className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-2xl shadow-inner">👤</span>
                       <span className="font-black text-base">{c.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
            <section>
              <h3 className="text-xs font-black text-orange-500 uppercase tracking-[0.2em] mb-4 px-2 flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                 دليل الموردين
              </h3>
              <div className="space-y-2">
                {suppliers.filter(s => s.name.toLowerCase().includes(pickerSearch.toLowerCase())).slice(0, 15).map(s => (
                  <button key={s.id} onClick={() => { setSelectedPerson({id: s.id, type: 'مورد'}); setShowPicker(false); }} className={`w-full flex items-center justify-between p-5 rounded-2xl border transition-all active:scale-95 text-right ${theme === 'dark' ? 'bg-slate-800/50 border-white/5 hover:bg-slate-800' : 'bg-white border-slate-100 hover:border-orange-200 hover:shadow-md'}`}>
                    <div className="flex items-center gap-3">
                       <span className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center text-2xl shadow-inner">🚛</span>
                       <span className="font-black text-base">{s.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={`كشف حساب: ${person.name}`} onBack={() => navigate('debts')}>
      <div className="space-y-6 page-enter pb-44 max-w-6xl mx-auto w-full px-2">
        
        {/* Header and Summary Card */}
        <div className={`p-8 rounded-[3rem] shadow-2xl relative overflow-hidden border-2 ${
          theme === 'dark' ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100'
        }`}>
          <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-10">
            <div className="flex items-center gap-5">
              <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center text-4xl shadow-2xl ${
                selectedPerson?.type === 'عميل' ? 'bg-indigo-500 text-white' : 'bg-orange-500 text-white'
              }`}>
                {selectedPerson?.type === 'عميل' ? '👤' : '🚛'}
              </div>
              <div className="text-right">
                <h3 className="font-black text-3xl text-[var(--color-text-primary)] leading-tight">{person.name}</h3>
                <p className="text-sm font-bold text-slate-400 mt-1 tabular-nums tracking-widest">📱 {person.phone || 'رقم هاتف غير مضاف'}</p>
                <div className="flex gap-2 mt-2">
                   <span className={`text-[9px] px-3 py-1 rounded-full font-black ${theme === 'dark' ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{selectedPerson?.type} نظامي</span>
                   <button onClick={() => setShowPicker(true)} className="text-[9px] px-3 py-1 rounded-full font-black bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all">تغيير الحساب 🔄</button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-8 px-8 py-6 bg-[var(--color-background-tertiary)] rounded-[2.5rem] border border-[var(--color-border-primary)] shadow-inner">
               <div className="text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">الرصيد الجاري</p>
                  <h2 className={`text-4xl font-black tabular-nums tracking-tighter ${currentBalance > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {Math.abs(currentBalance).toLocaleString()}
                  </h2>
                  <small className="text-[9px] font-black opacity-30 uppercase">{selectedCurrency}</small>
               </div>
               <div className="w-px h-12 bg-[var(--color-border-primary)]"></div>
               <div className="text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">حالة القيد</p>
                  <p className={`text-sm font-black ${currentBalance > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                     {currentBalance > 0 ? (selectedPerson?.type === 'عميل' ? 'مدين (لنا)' : 'دائن (له)') : 'مصفى / مسترد'}
                  </p>
                  <span className="text-lg">{currentBalance > 0 ? '⚖️' : '✅'}</span>
               </div>
            </div>
          </div>
          
          <div className="flex bg-[var(--color-background-tertiary)] p-1 rounded-2xl gap-1 w-fit mx-auto mb-8 border border-[var(--color-border-primary)] shadow-sm">
            {(['YER', 'SAR', 'OMR'] as const).map(cur => (
              <button key={cur} onClick={() => setSelectedCurrency(cur)} className={`px-8 py-2.5 rounded-xl font-black text-xs transition-all ${selectedCurrency === cur ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 opacity-60 hover:opacity-100'}`}>{cur}</button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
              onClick={() => handleShare()}
              className="bg-emerald-500 text-white p-5 rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-xl active:scale-95 hover:brightness-110 transition-all"
            >
              <span>إرسال كشف الحساب للواتساب</span><span>💬</span>
            </button>
            <button 
              onClick={() => navigate('add-voucher', { 
                type: selectedPerson?.type === 'عميل' ? 'قبض' : 'دفع', 
                personId: person.id, 
                personType: selectedPerson?.type, 
                currency: selectedCurrency 
              })}
              className={`p-5 rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all text-white ${selectedPerson?.type === 'عميل' ? 'bg-indigo-600' : 'bg-orange-600'}`}
            >
              <span>{selectedPerson?.type === 'عميل' ? 'تسجيل سند قبض مبلغ' : 'تسجيل سند سداد مورد'}</span>
              <span>{selectedPerson?.type === 'عميل' ? '📥' : '📤'}</span>
            </button>
          </div>
        </div>

        {/* Transactions Table Section */}
        <div className={`overflow-hidden rounded-[3rem] shadow-2xl border-2 ${theme === 'dark' ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100'}`}>
          <div className="p-6 border-b border-[var(--color-border-primary)] flex justify-between items-center bg-slate-500/[0.03]">
             <h4 className="font-black text-xs uppercase tracking-widest opacity-60 italic">Detailed Transaction Journal</h4>
             <button onClick={() => window.print()} className="w-9 h-9 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm border border-[var(--color-border-primary)] active:scale-90 transition-all">📄</button>
          </div>
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-right border-collapse min-w-[750px]">
              <thead>
                <tr className={`text-[10px] font-black uppercase tracking-widest border-b-2 ${theme === 'dark' ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500'}`}>
                  <th className="p-5 text-center w-16">#</th>
                  <th className="p-5 border-l border-[var(--color-border-primary)]/30">التاريخ</th>
                  <th className="p-5 border-l border-[var(--color-border-primary)]/30">نوع العملية والبيان</th>
                  <th className="p-5 text-center border-l border-[var(--color-border-primary)]/30 w-32">مدين (+)</th>
                  <th className="p-5 text-center border-l border-[var(--color-border-primary)]/30 w-32">دائن (-)</th>
                  <th className="p-5 text-center border-l border-[var(--color-border-primary)]/30 w-40">الرصيد التراكمي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-primary)]/50">
                {statementData.length > 0 ? statementData.map((t, idx) => (
                  <tr key={t.id + idx} className="text-xs hover:bg-sky-500/[0.03] transition-colors group">
                    <td className="p-5 text-center font-black tabular-nums opacity-30 group-hover:opacity-100">{idx + 1}</td>
                    <td className="p-5 border-l border-[var(--color-border-primary)]/20 tabular-nums font-bold text-slate-400">
                       {new Date(t.date).toLocaleDateString('ar-YE', {day:'2-digit', month:'2-digit', year:'2-digit'})}
                    </td>
                    <td className="p-5 border-l border-[var(--color-border-primary)]/20">
                       <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shadow-sm ${
                             t.type.includes('بيع') ? 'bg-emerald-50 text-emerald-600' : 
                             t.type.includes('شراء') ? 'bg-orange-50 text-orange-600' : 
                             'bg-indigo-50 text-indigo-600'
                          }`}>{t.type.includes('بيع') ? '💰' : t.type.includes('شراء') ? '📦' : '📥'}</span>
                          <div>
                             <p className="font-black text-[var(--color-text-primary)]">{t.type}</p>
                             <p className="text-[10px] font-bold text-slate-400 line-clamp-1 italic">{t.details}</p>
                          </div>
                       </div>
                    </td>
                    <td className="p-5 text-center border-l border-[var(--color-border-primary)]/20 font-black tabular-nums text-rose-500">
                       {t.debit > 0 ? t.debit.toLocaleString() : '-'}
                    </td>
                    <td className="p-5 text-center border-l border-[var(--color-border-primary)]/20 font-black tabular-nums text-emerald-500">
                       {t.credit > 0 ? t.credit.toLocaleString() : '-'}
                    </td>
                    <td className={`p-5 text-center border-l border-[var(--color-border-primary)]/20 font-black tabular-nums ${t.balance > 0 ? 'text-rose-600 bg-rose-500/5' : 'text-emerald-600 bg-emerald-500/5'}`}>
                        {Math.abs(t.balance).toLocaleString()}
                    </td>
                  </tr>
                )) : (
                  <tr>
                     <td colSpan={6} className="p-20 text-center opacity-30 font-black text-lg">لا توجد عمليات مسجلة لهذا الحساب بهذه العملة.</td>
                  </tr>
                )}
              </tbody>
              {statementData.length > 0 && (
                <tfoot>
                  <tr className={`text-sm font-black ${theme === 'dark' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-800'}`}>
                    <td colSpan={3} className="p-6 text-center border-t-4 border-indigo-500/30">إجمالي كشف الحساب الموحد</td>
                    <td className="p-6 text-center text-rose-500 border-t-4 border-indigo-500/30 tabular-nums">{totals.debit.toLocaleString()}</td>
                    <td className="p-6 text-center text-emerald-500 border-t-4 border-indigo-500/30 tabular-nums">{totals.credit.toLocaleString()}</td>
                    <td className={`p-6 text-center border-t-4 border-indigo-500/30 tabular-nums ${currentBalance > 0 ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
                       {Math.abs(currentBalance).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default AccountStatement;
