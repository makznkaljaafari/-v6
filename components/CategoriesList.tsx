
import React, { useState, useMemo, useCallback, memo } from 'react';
import { useApp } from '../context/AppContext';
import { PageLayout } from './ui/Layout';
import { QatCategory } from '../types';

const CategoriesList: React.FC = memo(() => {
  const { categories, navigate, deleteCategory, addNotification, theme, sales } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredCategories = useMemo(() => {
    return categories.filter(cat => cat.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [categories, searchTerm]);

  const getCategoryStats = useCallback((catName: string) => {
    const catSales = sales.filter(s => s.qat_type === catName && !s.is_returned);
    const totalSold = catSales.reduce((sum, s) => sum + s.quantity, 0);
    return { totalSold, salesCount: catSales.length };
  }, [sales]);

  const handleDelete = useCallback(async (cat: QatCategory) => {
    if (window.confirm(`⚠️ تحذير: هل أنت متأكد من حذف صنف "${cat.name}"؟`)) {
      try {
        await deleteCategory(cat.id);
        addNotification("تم الحذف ✅", `تم إزالة ${cat.name} من النظام.`, "success");
      } catch (err: any) { 
        addNotification("عذراً ⚠️", "لا يمكن حذف الصنف لوجود عمليات مرتبطة به.", "warning"); 
      }
    }
  }, [deleteCategory, addNotification]);

  return (
    <PageLayout title="إدارة المخزون" onBack={() => navigate('dashboard')}>
      <div className="space-y-6 pb-44 max-w-7xl mx-auto w-full px-2">
        
        <div className="flex items-center gap-3">
          <div className="relative flex-1 group">
            <input 
              type="text" 
              placeholder="ابحث عن صنف..."
              className="w-full bg-[var(--color-background-card)] border-2 border-[var(--color-border-default)] focus:border-[var(--color-accent-emerald)] rounded-2xl p-4 pr-12 font-bold text-sm shadow-lg transition-all"
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="البحث عن صنف القات"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl opacity-30 text-[var(--color-text-muted)]">🔍</span>
          </div>
          <div className="flex bg-[var(--color-background-tertiary)] p-1 rounded-xl border-2 border-[var(--color-border-default)] shadow-md">
            <button 
              onClick={() => setViewMode('grid')} 
              className={`p-2 rounded-lg text-sm transition-all ${viewMode === 'grid' ? 'bg-[var(--color-accent-emerald)] text-[var(--color-text-inverse)] shadow-md' : 'opacity-40 text-[var(--color-text-muted)]'}`}
              aria-label="عرض الأصناف كشبكة"
              aria-pressed={viewMode === 'grid'}
            >🎴</button>
            <button 
              onClick={() => setViewMode('list')} 
              className={`p-2 rounded-lg text-sm transition-all ${viewMode === 'list' ? 'bg-[var(--color-accent-emerald)] text-[var(--color-text-inverse)] shadow-md' : 'opacity-40 text-[var(--color-text-muted)]'}`}
              aria-label="عرض الأصناف كقائمة"
              aria-pressed={viewMode === 'list'}
            >📜</button>
          </div>
        </div>

        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCategories.map((cat) => {
              const stats = getCategoryStats(cat.name);
              const isLow = cat.stock <= (cat.low_stock_threshold || 5);
              return (
                <div 
                  key={cat.id} 
                  className={`p-6 rounded-[2.5rem] border-2 transition-all hover:shadow-2xl group relative overflow-hidden ${
                    isLow ? 'border-[var(--color-status-danger)]/30 bg-[var(--color-status-danger-bg)]/[0.02]' : theme === 'dark' ? 'bg-[var(--color-background-card)] border-[var(--color-border-default)]' : 'bg-[var(--color-background-card)] border-[var(--color-border-default)] shadow-xl'
                  }`}
                  role="listitem"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-4xl shadow-inner group-hover:scale-110 transition-transform ${isLow ? 'bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger)]' : 'bg-[var(--color-status-success-bg)] text-[var(--color-status-success)]'}`} aria-hidden="true">🌿</div>
                      <div>
                        <h3 className="font-black text-xl text-[var(--color-text-default)]">{cat.name}</h3>
                        <p className="text-[10px] font-bold text-[var(--color-text-muted)] mt-1 uppercase tracking-widest">السعر: {cat.price.toLocaleString()} {cat.currency}</p>
                      </div>
                    </div>
                    <div className="text-left">
                       <span className={`text-3xl font-black tabular-nums tracking-tighter ${isLow ? 'text-[var(--color-status-danger)] animate-pulse' : 'text-[var(--color-status-success)]'}`}>{cat.stock}</span>
                       <p className="text-[8px] font-black text-[var(--color-text-muted)] uppercase">حبه متوفر</p>
                    </div>
                  </div>

                  <div className={`rounded-2xl p-4 mb-6 flex justify-around items-center border ${theme === 'dark' ? 'bg-[var(--color-background-input)]/50 border-[var(--color-border-subtle)]' : 'bg-[var(--color-background-tertiary)] border-[var(--color-border-default)]'}`}>
                     <div className="text-center">
                        <p className="text-[8px] font-black text-[var(--color-text-muted)] uppercase mb-1">إجمالي المبيعات</p>
                        <p className="font-black text-sm tabular-nums text-[var(--color-text-default)]">{stats.totalSold} حبه</p>
                     </div>
                     <div className="w-px h-8 bg-[var(--color-border-default)]" aria-hidden="true"></div>
                     <div className="text-center">
                        <p className="text-[8px] font-black text-[var(--color-text-muted)] uppercase mb-1">عدد الفواتير</p>
                        <p className="font-black text-sm tabular-nums text-[var(--color-text-default)]">{stats.salesCount}</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                     <button onClick={() => navigate('add-sale', { qatType: cat.name })} className="bg-[var(--color-accent-sky)] text-[var(--color-text-inverse)] py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-[var(--color-accent-sky)]/80 transition-all shadow-md active:scale-95" aria-label={`تسجيل عملية بيع سريعة لصنف ${cat.name}`}>💰 بيع سريع</button>
                     <button onClick={() => navigate('add-category', { categoryId: cat.id })} className="bg-[var(--color-background-tertiary)] text-[var(--color-text-muted)] py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-[var(--color-background-tertiary)]/80 transition-all active:scale-95" aria-label={`تعديل صنف ${cat.name}`}>📝 تعديل</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
            <div className={`overflow-hidden rounded-[2rem] shadow-2xl border-2 ${theme === 'dark' ? 'bg-[var(--color-background-card)] border-[var(--color-border-default)]' : 'bg-[var(--color-background-card)] border-[var(--color-border-default)]'}`}>
                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-right border-collapse min-w-[500px]">
                        <thead>
                            <tr className={`text-[10px] font-black uppercase tracking-widest border-b-2 ${theme === 'dark' ? 'bg-[var(--color-background-input)] text-[var(--color-text-muted)] border-[var(--color-border-default)]' : 'bg-[var(--color-background-tertiary)] text-[var(--color-text-muted)] border-[var(--color-border-default)]'}`}>
                                <th scope="col" className="p-4 text-center w-12">#</th>
                                <th scope="col" className="p-4 border-l">الصنف</th>
                                <th scope="col" className="p-4 text-center border-l w-32">الرصيد الحالي</th>
                                <th scope="col" className="p-4 text-center border-l w-32">سعر البيع</th>
                                <th scope="col" className="p-4 text-center border-l w-48">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border-default)]/50">
                            {filteredCategories.map((cat, idx) => (
                                <tr key={cat.id} className="text-xs hover:bg-[var(--color-background-tertiary)]/50 transition-colors">
                                    <td className="p-4 text-center font-black opacity-30 tabular-nums text-[var(--color-text-muted)]">{filteredCategories.length - idx}</td>
                                    <td className="p-4 font-black border-l text-[var(--color-text-default)] flex items-center gap-2"><span aria-hidden="true">🌿</span> {cat.name}</td>
                                    <td className={`p-4 text-center border-l font-black tabular-nums ${cat.stock < 5 ? 'text-[var(--color-status-danger)]' : 'text-[var(--color-status-success)]'}`}>{cat.stock} حبه</td>
                                    <td className="p-4 text-center border-l font-bold tabular-nums text-[var(--color-text-muted)]">{cat.price.toLocaleString()} {cat.currency}</td>
                                    <td className="p-4 text-center border-l">
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={() => navigate('add-sale', { qatType: cat.name })} className="p-2 hover:bg-[var(--color-status-info-bg)] text-[var(--color-status-info)] rounded-lg transition-all" aria-label={`تسجيل بيع لصنف ${cat.name}`}>💰</button>
                                            <button onClick={() => navigate('add-category', { categoryId: cat.id })} className="p-2 hover:bg-[var(--color-background-tertiary)] text-[var(--color-text-muted)] rounded-lg transition-all" aria-label={`تعديل صنف ${cat.name}`}>📝</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
      </div>
      
      <button 
        onClick={() => navigate('add-category')} 
        aria-label="إضافة صنف قات جديد"
        className="fixed bottom-24 right-6 w-16 h-16 bg-[var(--color-accent-emerald)] text-[var(--color-text-inverse)] rounded-[1.5rem] shadow-2xl flex items-center justify-center text-4xl border-4 border-white dark:border-[var(--color-background-input)] active:scale-90 transition-all z-40"
      >＋</button>
    </PageLayout>
  );
});

export default CategoriesList;
