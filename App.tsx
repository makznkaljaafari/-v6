
import React, { Suspense, lazy, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ToastContainer } from './components/ui/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import { FeedbackOverlay } from './components/ui/FeedbackOverlay';
import { ToastProps } from './components/ui/Toast';

// Lazy Load Components
const Dashboard = lazy(() => import('./components/Dashboard'));
const SalesList = lazy(() => import('./components/SalesList'));
const AddSale = lazy(() => import('./components/AddSale'));
const PurchasesList = lazy(() => import('./components/PurchasesList'));
const AddPurchase = lazy(() => import('./components/AddPurchase'));
const CustomersList = lazy(() => import('./components/CustomersList'));
const AddCustomer = lazy(() => import('./components/AddCustomer'));
const SuppliersList = lazy(() => import('./components/SuppliersList'));
const AddSupplier = lazy(() => import('./components/AddSupplier'));
const CategoriesList = lazy(() => import('./components/CategoriesList'));
const AddCategory = lazy(() => import('./components/AddCategory'));
const VouchersList = lazy(() => import('./components/VouchersList'));
const AddVoucher = lazy(() => import('./components/AddVoucher'));
const VoucherDetails = lazy(() => import('./components/VoucherDetails'));
const AIAdvisor = lazy(() => import('./components/AIAdvisor'));
const NotificationsPage = lazy(() => import('./components/NotificationsPage'));
const ExpensesList = lazy(() => import('./components/ExpensesList'));
const AddExpense = lazy(() => import('./components/AddExpense'));
const DebtsReport = lazy(() => import('./components/DebtsReport'));
const AddOpeningBalance = lazy(() => import('./components/AddOpeningBalance'));
const Reports = lazy(() => import('./components/Reports'));
const SettingsPage = lazy(() => import('./components/SettingsPage'));
const BarcodeScanner = lazy(() => import('./components/BarcodeScanner'));
const BottomNav = lazy(() => import('./components/BottomNav'));
const Sidebar = lazy(() => import('./components/Sidebar'));
const VoiceAssistant = lazy(() => import('./components/VoiceAssistant'));
const LoginPage = lazy(() => import('./components/LoginPage'));
const VisualInvoice = lazy(() => import('./components/VisualInvoice'));
const VisualPurchaseInvoice = lazy(() => import('./components/VisualPurchaseInvoice'));
const WasteList = lazy(() => import('./components/WasteList'));
const AddWaste = lazy(() => import('./components/AddWaste'));
const ActivitiesList = lazy(() => import('./components/ActivitiesList'));
const ReturnsList = lazy(() => import('./components/ReturnsList'));
const AccountStatement = lazy(() => import('./components/AccountStatement'));

const LoadingFallback = () => (
  <div className="flex-1 flex items-center justify-center bg-[var(--color-background-page)] h-screen">
    <div className="w-10 h-10 border-4 border-[var(--color-accent-indigo)] border-t-transparent rounded-full animate-spin"></div>
  </div>
);

const SplashScreen = () => (
  <div className="fixed inset-0 bg-[var(--color-background-page)] flex flex-col items-center justify-center z-[100] animate-in fade-in duration-700">
    <div className="relative">
      <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full scale-150 animate-pulse"></div>
      <div className="w-32 h-32 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[2.5rem] flex items-center justify-center text-7xl shadow-2xl relative z-10 border-4 border-white/10">🌿</div>
    </div>
    <div className="mt-12 flex flex-col items-center gap-2">
      <h2 className="text-[var(--color-text-default)] font-black text-3xl tracking-tighter">وكالة الشويع الذكية</h2>
      <div className="flex items-center gap-2 mt-4 text-indigo-500 font-bold animate-pulse text-sm">جاري التحميل...</div>
    </div>
  </div>
);

const AppContent = () => {
  const { currentPage, isLoggedIn, isCheckingSession, activeToasts, removeToast } = useApp();

  if (isCheckingSession) return <SplashScreen />;

  const renderPage = () => {
    if (!isLoggedIn) return <LoginPage />;
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'sales': return <SalesList />;
      case 'add-sale': return <AddSale />;
      case 'purchases': return <PurchasesList />;
      case 'add-purchase': return <AddPurchase />;
      case 'customers': return <CustomersList />;
      case 'add-customer': return <AddCustomer />;
      case 'suppliers': return <SuppliersList />;
      case 'add-supplier': return <AddSupplier />;
      case 'categories': return <CategoriesList />;
      case 'add-category': return <AddCategory />;
      case 'vouchers': return <VouchersList />;
      case 'add-voucher': return <AddVoucher />;
      case 'voucher-details': return <VoucherDetails />;
      case 'expenses': return <ExpensesList />;
      case 'add-expense': return <AddExpense />;
      case 'waste': return <WasteList />;
      case 'add-waste': return <AddWaste />;
      case 'returns': return <ReturnsList />;
      case 'debts': return <DebtsReport />;
      case 'add-opening-balance': return <AddOpeningBalance />;
      case 'reports': return <Reports />;
      case 'settings': return <SettingsPage />;
      case 'ai-advisor': return <AIAdvisor />;
      case 'notifications': return <NotificationsPage />;
      case 'scanner': return <BarcodeScanner />;
      case 'invoice-view': return <VisualInvoice />;
      case 'purchase-invoice-view': return <VisualPurchaseInvoice />;
      case 'activity-log': return <ActivitiesList />;
      case 'account-statement': return <AccountStatement />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen flex flex-row relative overflow-hidden w-full transition-colors duration-500 bg-[var(--color-background-page)]">
      <ToastContainer toasts={activeToasts as ToastProps[]} removeToast={removeToast} />
      <FeedbackOverlay />
      <Suspense fallback={<LoadingFallback />}>
        {isLoggedIn && <Sidebar />}
        <div className="flex-1 flex flex-col h-screen overflow-y-auto no-scrollbar relative">
          {renderPage()}
          {isLoggedIn && <BottomNav />}
        </div>
        {isLoggedIn && <VoiceAssistant />}
      </Suspense>
    </div>
  );
};

const App = () => (
  <ErrorBoundary>
    <AppProvider>
      <AppContent />
    </AppProvider>
  </ErrorBoundary>
);

export default App;
