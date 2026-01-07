

import React, { useMemo, useState, useEffect, memo, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { PageLayout } from './ui/Layout';
import { getFinancialForecast } from '../services/geminiService';
import { shareToWhatsApp, formatDailyClosingReport } from '../services/shareService';
import { StatCard } from './ui/atoms/StatCard';
import { ForecastCard } from './ui/molecules/ForecastCard';
import { ReportDetailView } from './ui/organisms/ReportDetailView';
import { useIsMounted } from '../hooks/useIsMounted';
import { AppError } from '../types';

type ReportType = 'sales' | 'purchases' | 'expenses' | 'debts' | 'pl' | null;

const ReportBtn = memo(({ label, icon, onClick }: any) => (
  <button 
    onClick={onClick}
    className="bg-[var(--color-background-card)] p-6 lg:p-8 rounded-[2rem] border-2 border-[var(--color-border-default)] shadow-lg flex flex-col items-center gap-3 transition-all active:scale-95 hover:border-[var(--color-accent-indigo)]/50 group"
  >
     <span className="text-4xl group-hover:scale-110 transition-transform text-[var(--color-text-default)]">{icon}</span>
     <span className="text-xs font-black text-[var(--color-text-default)]">{label}</span>
  </button>
));

const Reports: React.FC = () => {
  const { 
    navigate, theme, user, sales, expenses, categories, purchases, vouchers, addNotification 
  } = useApp();
  
  const [selectedReport, setSelectedReport] = useState<ReportType>(null);
  const [forecast, setForecast] = useState<string>('');
  const [isForecastLoading, setIsForecastLoading] = useState(false);
  const [reportCurrency, setReportCurrency] = useState<'YER' | 'SAR'>('YER');
  const isComponentMounted = useIsMounted();
  const lastSummaryRef = useRef<string>('');

  const metrics = useMemo(() => {
    const fSales = sales.filter((s: any) => !s.is_returned && s.currency === reportCurrency);
    const fPurchases = purchases.filter((p: any) => !p.is_returned && p.currency === reportCurrency);
    const fExpenses = expenses.filter((e: any) => e.currency === reportCurrency);
    
    const totalSales = fSales.reduce((sum: number, s: any) => sum + s.total, 0);
    const totalPurchases = fPurchases.reduce((sum: number, p: any) => sum + p.total, 0);
    const totalExpenses = fExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);
    const netProfit = (totalSales - totalPurchases) - totalExpenses;
    const stockValue = categories.filter((c: any) => c.currency === reportCurrency).reduce((sum: number, cat: any) => sum + (cat.stock * cat.price), 0);

    return { totalSales, totalPurchases, totalExpenses, netProfit, stockValue };
  }, [sales, purchases, expenses, categories, reportCurrency]);

  const fetchForecast = useCallback(async () => {
    if (isForecastLoading) return;
    
    setIsForecastLoading(true);
    try {
      const data = await getFinancialForecast(sales, expenses, categories);
      if (isComponentMounted()) {
        setForecast(data);
      }
    } catch (e: any) {
      if (isComponentMounted()) {
        const errorMessage = e instanceof AppError ? e.message : "فشل جلب التوقعات حالياً.";
        addNotification("خطأ في توقعات AI ❌", errorMessage, "warning");
        setForecast("فشل جلب التوقعات حالياً.");
      }
    } finally {
      if (isComponentMounted()) setIsForecastLoading(false);
    }
  }, [sales, expenses, categories, isComponentMounted, isForecastLoading, addNotification]);

  useEffect(() => {
    const summary = `${sales.length}-${expenses.length}-${categories.length}`;
    if (summary !== lastSummaryRef.current && !forecast) {
      lastSummaryRef.current = summary;
      fetchForecast();
    }
  }, [sales.length, expenses.length, categories.length, forecast, fetchForecast]);

  const reportData = useMemo(() => {
    if (!selectedReport) return null;
    
    switch (selectedReport) {
      case 'sales':
        return {
          title: `سجل المبيعات التفصيلي (${reportCurrency})`,
          headers: ['التاريخ', 'العميل', 'الصنف', 'الكمية', 'الإجمالي'],
          rows: sales.filter((s: any) => !s.is_returned && s.currency === reportCurrency).map((s: any) => [
            new Date(s.date).toLocaleDateString('ar-YE'), s.customer_name, s.qat_type, s.quantity, s.total.toLocaleString()
          ])
        };
      case 'purchases':
        return {
          title: `سجل المشتريات (${reportCurrency})`,
          headers: ['التاريخ', 'المورد', 'الصنف', 'الكمية', 'التكلفة'],
          rows: purchases.filter((p: any) => !p.is_returned && p.currency === reportCurrency).map((p: any) => [
            new Date(p.date).toLocaleDateString('ar-YE'), p.supplier_name, p.qat_type, p.quantity, p.total.toLocaleString()
          ])
        };
      case 'pl':
        return {
          title: `قائمة الأرباح والخسائر - ${reportCurrency}`,
          headers: ['البند المالي', 'القيمة التقديرية'],
          rows: [
            ['(+) إجمالي المبيعات النشطة', `+${metrics.totalSales.toLocaleString()}`],
            ['(-) تكلفة المشتريات', `-${metrics.totalPurchases.toLocaleString()}`],
            ['(-) المصاريف التشغيلية', `-${metrics.totalExpenses.toLocaleString()}`],
            ['(=) صافي الربح التقديري', metrics.netProfit.toLocaleString()]
          ],
          specialColors: true
        };
      default: return null;
    }
  }, [selectedReport, sales, purchases, expenses, metrics, reportCurrency]);

  const handleDailyClosingReport = useCallback(() => {
    if (window.confirm("هل أنت متأكد من مشاركة التقرير اليومي؟")) {
      shareToWhatsApp(formatDailyClosingReport({
        sales, expenses, purchases, vouchers, agencyName: user?.agency_name || "وكالة الشويع"
      }));
    }
  }, [sales, expenses, purchases, vouchers, user?.agency_name]);

  if (selectedReport && reportData) {
    return (
      <ReportDetailView 
        data={reportData} 
        onBack={() => setSelectedReport(null)} 
        onPrint={() => window.print()} 
        theme={theme}
      />
    );
  }

  return (
    <PageLayout title="التقارير والتحليلات" onBack={() => navigate('dashboard')}>
      <div className="space-y-6 pb-44 max-w-7xl mx-auto w-full px-2">
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
           <StatCard 
             title="إجمالي المبيعات" value={metrics.totalSales} currency={reportCurrency} 
             colorClass="text-emerald-500" icon="💰" onClick={() => setSelectedReport('sales')}
           />
           <StatCard 
             title="إجمالي المشتريات" value={metrics.totalPurchases} currency={reportCurrency} 
             colorClass="text-orange-500" icon="📦" onClick={() => setSelectedReport('purchases')}
           />
           <StatCard 
             title="إجمالي المصاريف" value={metrics.totalExpenses} currency={reportCurrency} 
             colorClass="text-rose-500" icon="💸" onClick={() => setSelectedReport('expenses')}
           />
           <StatCard 
             title="صافي الربح التقديري" value={metrics.netProfit} currency={reportCurrency} 
             colorClass={metrics.netProfit >= 0 ? 'text-indigo-500' : 'text-rose-500'} icon="📈" onClick={() => setSelectedReport('pl')}
           />
           <StatCard 
             title="قيمة المخزون" value={metrics.stockValue} currency={reportCurrency} 
             colorClass="text-cyan-500" icon="🌿"
           />
        </div>

        <div className="flex bg-[var(--color-background-tertiary)] p-1 rounded-2xl gap-1 w-fit mx-auto border border-[var(--color-border-default)] shadow-inner">
            {(['YER', 'SAR'] as const).map(cur => (
              <button 
                key={cur} onClick={() => setReportCurrency(cur)} 
                className={`px-6 py-2.5 rounded-xl font-black text-xs transition-all ${reportCurrency === cur ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 opacity-60'}`}
              >{cur}</button>
            ))}
        </div>

        <ForecastCard text={forecast} isLoading={isForecastLoading} />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-8">
          <ReportBtn label="كشف المبيعات" icon="💰" onClick={() => setSelectedReport('sales')} />
          <ReportBtn label="كشف المشتريات" icon="📦" onClick={() => setSelectedReport('purchases')} />
          <ReportBtn label="قائمة الدخل" icon="⚖️" onClick={() => setSelectedReport('pl')} />
          <ReportBtn label="سجل المصروفات" icon="💸" onClick={() => setSelectedReport('expenses')} />
          <ReportBtn label="ملخص الديون" icon="👥" onClick={() => navigate('debts')} />
          <ReportBtn label="إغلاق يومي" icon="📊" onClick={handleDailyClosingReport} />
          <ReportBtn label="سجل التالف" icon="🥀" onClick={() => navigate('waste')} />
          <ReportBtn label="كشف السندات" icon="📥" onClick={() => navigate('vouchers')} />
        </div>
      </div>
    </PageLayout>
  );
};

export default Reports;