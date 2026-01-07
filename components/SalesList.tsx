
import React, { useState, useMemo, useCallback, memo } from 'react';
import { useApp } from '../context/AppContext';
import { PageLayout } from './ui/Layout';
import { Sale } from '../types';
import { formatSaleInvoice, shareToWhatsApp } from '../services/shareService';

const SalesList: React.FC = memo(() => {
  const { sales, navigate, returnSale, user, theme, loadAllData, isSyncing, addNotification, deleteSale } = useApp(); // Added deleteSale
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  const filteredSales = useMemo(() => {
    return sales.filter(s => 
      s.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.qat_type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sales, searchTerm]);

  const handleReturn = useCallback(async (sale: Sale) => {
    if (sale.is_returned) return;
    if (window.confirm(`هل أنت متأكد من إرجاع فاتورة ${sale.customer_name}؟ سيتم خصم المبلغ من حسابه وإعادة القات للمخزون آلياً.`)) {
      try {
        await returnSale(sale.id); // returnSale now handles notifications and logging
      } catch (err: any) {
        addNotification("خطأ ⚠️", err.message || "فشل إرجاع الفاتورة. حدث خطأ غير متوقع.", "warning");
      }
    }
  }, [returnSale, addNotification]);

  const handleDelete = useCallback(async (sale: Sale) => {
    if (window.confirm(`هل أنت متأكد من حذف فاتورة البيع رقم ${sale.id.slice(-6).toUpperCase()} للعميل ${sale.customer_name}؟`)) {
      try {
        await deleteSale(sale.id); // deleteSale now handles notifications and logging
      } catch (err: any) {
        addNotification("خطأ ⚠️", err.message || "فشل حذف فاتورة البيع.", "warning");
      }
    }
  }, [deleteSale, addNotification]);

  const handleRefreshData = useCallback(() => {
    if (user?.id) {
      loadAllData(user.id, false);
    }
  }, [user?.id, loadAllData]);

  const fab = (
    <button 
      onClick={() => navigate('add-sale')} 
      aria-label="إضافة فاتورة بيع جديدة"
      className="w-16 h-16 lg:w-20 lg:h-20 bg-[var(--color-accent-sky)] text-[var(--color-text-inverse)] rounded-[1.8rem] shadow-[0_15px_40px_rgba(14,165,233,0.4)] flex items-center justify-center text-4xl border-4 border-white dark:border-[var(--color-background-input)] active:scale-90 transition-all z-50"
    >
      💰＋
    </button>
  );

  return (
    <PageLayout 
      title="سجل المبيعات" 
      onBack={() => navigate('dashboard')}
      floatingButton={fab}
      headerExtra={
        <button 
          onClick={handleRefreshData}
          aria-label="تحديث سجل المبيعات"
          className={`w-10 h-10 rounded-xl bg-[var(--color-background-card)]/10 flex items-center justify-center text-lg transition-all ${isSyncing ? 'animate-spin' : 'active:scale-90'}`}
        >🔄</button>
      }
    >
      <div className="space-y-4 pb-44 max-w-7xl mx-auto w-full px-2">
        
        <div className="flex items-center gap-3">
          <div className="relative flex-1 group">
            <input 
              type="text" 
              placeholder="ابحث باسم العميل أو الصنف..."
              className="w-full bg-[var(--color-background-card)] border-2 border-[var(--color-border-default)] focus:border-[var(--color-accent-sky)] rounded-2xl p-4 pr-12 font-bold text-sm shadow-sm transition-all"
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="البحث باسم العميل أو الصنف في سجل المبيعات"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl opacity-30 text-[var(--color-text-muted)]">🔍</span>
          </div>
          <div className="flex bg-[var(--color-background-tertiary)] p-1 rounded-xl border border-[var(--color-border-default)]">
            <button 
              onClick={() => setViewMode('grid')} 
              className={`p-2 rounded-lg text-sm transition-all ${viewMode === 'grid' ? 'bg-[var(--color-accent-sky)] text-[var(--color-text-inverse)] shadow-md' : 'opacity-40 text-[var(--color-text-muted)]'}`}
              aria-label="عرض المبيعات كشبكة"
              aria-pressed={viewMode === 'grid'}
            >🎴</button>
            <button 
              onClick={() => setViewMode('list')} 
              className={`p-2 rounded-lg text-sm transition-all ${viewMode === 'list' ? 'bg-[var(--color-accent-sky)] text-[var(--color-text-inverse)] shadow-md' : 'opacity-40 text-[var(--color-text-muted)]'}`}
              aria-label="عرض المبيعات كقائمة"
              aria-pressed={viewMode === 'list'}
            >📜</button>
          </div>
        </div>

        {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSales.map((sale) => (
                <div 
                  key={sale.id} 
                  className={`p-6 rounded-[2.5rem] border-2 transition-all relative overflow-hidden cursor-pointer hover:shadow-2xl active:scale-98 ${sale.is_returned ? 'opacity-60 grayscale' : ''} ${theme === 'dark' ? 'bg-[var(--color-background-card)] border-[var(--color-border-default)]' : 'bg-[var(--color-background-card)] shadow-xl border-[var(--color-border-subtle)]'}`}
                  onClick={() => navigate('invoice-view', { sale })}
                  role="listitem"
                >
                  {sale.is_returned && (
                    <div className="absolute top-4 -left-8 bg-[var(--color-status-danger)] text-[var(--color-text-inverse)] py-1 px-10 -rotate-45 text-[8px] font-black uppercase tracking-widest z-10" aria-label="فاتورة مرتجعة">مرتجع</div>
                  )}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="font-black text-lg text-[var(--color-text-default)] truncate max-w-[180px]">{sale.customer_name}</h3>
                        <p className="text-[10px] font-bold text-[var(--color-text-muted)] mt-1 uppercase tracking-widest leading-none">{sale.qat_type} • {sale.quantity} حبة</p>
                    </div>
                    <div className="text-left">
                        <p className={`text-xl font-black tabular-nums leading-none ${sale.is_returned ? 'line-through text-[var(--color-status-danger)]' : 'text-[var(--color-status-success)]'}`}>{sale.total.toLocaleString()}</p>
                        <small className="text-[8px] font-black opacity-30 text-[var(--color-text-muted)] block mt-1">YER</small>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-[var(--color-border-default)]/50" onClick={e => e.stopPropagation()}>
                    <button onClick={() => shareToWhatsApp(formatSaleInvoice(sale, user?.agency_name || 'الوكالة'))} className="w-9 h-9 bg-[var(--color-status-success-bg)] text-[var(--color-status-success)] rounded-xl flex items-center justify-center shadow-sm hover:bg-[var(--color-status-success)] hover:text-[var(--color-text-inverse)] transition-all" aria-label={`مشاركة فاتورة بيع ${sale.customer_name} عبر واتساب`}>💬</button>
                    <button onClick={() => handleReturn(sale)} className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm transition-all ${sale.is_returned ? 'bg-[var(--color-background-tertiary)] text-[var(--color-text-muted)]' : 'bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger)] hover:bg-[var(--color-status-danger)] hover:text-[var(--color-text-inverse)]'}`} aria-label={`إرجاع فاتورة ${sale.customer_name}`} disabled={sale.is_returned}>🔄</button>
                    <button onClick={() => navigate('invoice-view', { sale })} className="w-9 h-9 bg-[var(--color-status-info-bg)] text-[var(--color-status-info)] rounded-xl flex items-center justify-center shadow-sm hover:bg-[var(--color-status-info)] hover:text-[var(--color-text-inverse)] transition-all" aria-label={`عرض فاتورة ${sale.customer_name}`}>📄</button>
                    <button onClick={() => handleDelete(sale)} className="w-9 h-9 bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger)] rounded-xl flex items-center justify-center shadow-sm hover:bg-[var(--color-status-danger)] hover:text-[var(--color-text-inverse)] transition-all" aria-label={`حذف فاتورة ${sale.customer_name}`}>🗑️</button>
                  </div>
                </div>
            ))}
            </div>
        ) : (
            <div className={`overflow-hidden rounded-[2rem] shadow-2xl border-2 ${theme === 'dark' ? 'bg-[var(--color-background-card)] border-[var(--color-border-default)]' : 'bg-[var(--color-background-card)] border-[var(--color-border-default)]'}`}>
                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-right border-collapse min-w-[700px]">
                        <thead>
                            <tr className={`text-[10px] font-black uppercase tracking-widest border-b-2 ${theme === 'dark' ? 'bg-[var(--color-background-input)] text-[var(--color-text-muted)] border-[var(--color-border-default)]' : 'bg-[var(--color-background-tertiary)] text-[var(--color-text-muted)] border-[var(--color-border-default)]'}`}>
                                <th scope="col" className="p-4 text-center w-12">#</th>
                                <th scope="col" className="p-4 border-l border-[var(--color-border-default)]/50">العميل</th>
                                <th scope="col" className="p-4 text-center border-l border-[var(--color-border-default)]/50 w-24">الصنف</th>
                                <th scope="col" className="p-4 text-center border-l border-[var(--color-border-default)]/50 w-24">كمية</th>
                                <th scope="col" className="p-4 text-center border-l border-[var(--color-border-default)]/50 w-32">الإجمالي</th>
                                <th scope="col" className="p-4 text-center border-l border-[var(--color-border-default)]/50 w-24">حالة</th>
                                <th scope="col" className="p-4 text-center border-l border-[var(--color-border-default)]/50 w-48">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border-default)]/50">
                            {filteredSales.map((sale, idx) => (
                                <tr 
                                  key={sale.id} 
                                  className={`text-xs hover:bg-[var(--color-accent-sky)]/5 transition-colors cursor-pointer ${sale.is_returned ? 'opacity-50 bg-[var(--color-status-danger-bg)]/5' : ''}`}
                                  onClick={() => navigate('invoice-view', { sale })}
                                >
                                    <td className="p-4 text-center font-black tabular-nums opacity-30 text-[var(--color-text-muted)]">{(filteredSales.length - idx)}</td>
                                    <td className={`p-4 font-black border-l border-[var(--color-border-default)]/30 ${sale.is_returned ? 'line-through text-[var(--color-status-danger)]' : 'text-[var(--color-text-default)]'}`}>{sale.customer_name}</td>
                                    <td className="p-4 text-center border-l border-[var(--color-border-default)]/30 font-bold text-[var(--color-text-default)]">{sale.qat_type}</td>
                                    <td className="p-4 text-center border-l border-[var(--color-border-default)]/30 font-black tabular-nums text-[var(--color-text-default)]">{sale.quantity} حبه</td>
                                    <td className={`p-4 text-center border-l border-[var(--color-border-default)]/30 font-black tabular-nums ${sale.is_returned ? 'text-[var(--color-status-danger)]' : 'text-[var(--color-status-success)]'}`}>{sale.total.toLocaleString()}</td>
                                    <td className="p-4 text-center border-l border-[var(--color-border-default)]/30">
                                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black ${sale.status === 'نقدي' ? 'bg-[var(--color-status-success-bg)] text-[var(--color-status-success)]' : 'bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning)]'}`}>{sale.status}</span>
                                    </td>
                                    <td className="p-4 text-center border-l border-[var(--color-border-default)]/30" onClick={e => e.stopPropagation()}>
                                        <div className="flex items-center justify-center gap-1.5">
                                            <button onClick={() => shareToWhatsApp(formatSaleInvoice(sale, user?.agency_name || 'الوكالة'))} className="p-2 hover:bg-[var(--color-status-success-bg)] text-[var(--color-status-success)] rounded-lg transition-all" aria-label={`مشاركة فاتورة بيع ${sale.customer_name} عبر واتساب`}>💬</button>
                                            <button onClick={() => handleReturn(sale)} className={`p-2 rounded-lg transition-all ${sale.is_returned ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-status-danger)] hover:bg-[var(--color-status-danger-bg)]'}`} aria-label={`إرجاع فاتورة ${sale.customer_name}`} disabled={sale.is_returned}>🔄</button>
                                            <button onClick={() => navigate('invoice-view', { sale })} className="p-2 hover:bg-[var(--color-status-info-bg)] text-[var(--color-status-info)] rounded-lg transition-all" aria-label={`عرض فاتورة ${sale.customer_name}`}>📄</button>
                                            <button onClick={() => handleDelete(sale)} className="p-2 hover:bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger)] rounded-lg transition-all" aria-label={`حذف فاتورة ${sale.customer_name}`}>🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
        
        {filteredSales.length === 0 && (
          <div className="text-center py-40 opacity-20 flex flex-col items-center gap-8 text-[var(--color-text-muted)]">
            <span className="text-9xl">💰</span>
            <p className="font-black text-2xl uppercase tracking-[0.2em]">لا توجد مبيعات مسجلة</p>
          </div>
        )}
      </div>
    </PageLayout>
  );
});

export default SalesList;
