

import { useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { financeService } from '../services/financeService';
import { FunctionCall } from '@google/genai';

export const useAIProcessor = () => {
  const { 
    sales, customers, purchases, vouchers, suppliers, categories, exchangeRates,
    addSale, addPurchase, addVoucher, returnSale, returnPurchase, 
    addCustomer, addSupplier, deleteCustomer, deleteSupplier,
    updateExchangeRates, addNotification,
    addCategory, deleteCategory
  } = useApp();

  const [pendingAction, setPendingAction] = useState<FunctionCall | null>(null);
  const [ambiguityMatches, setAmbiguityMatches] = useState<any[]>([]);
  const [debtWarning, setDebtWarning] = useState<number | null>(null);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const validateToolCall = useCallback((name: string, args: any) => {
    setErrorInfo(null); // Clear previous errors
    setDebtWarning(null);
    setAmbiguityMatches([]);

    if (name === 'recordSale') {
      const searchName = (args.customer_name || "").trim();
      const matches = customers.filter(c => c.name.includes(searchName));
      
      if (matches.length === 0) {
        setErrorInfo(`العميل "${searchName}" غير موجود. يرجى إضافته أولاً.`);
        return false;
      }
      if (matches.length > 1) {
        setAmbiguityMatches(matches);
        return true; 
      }
      
      const debts = financeService.getCustomerBalances(matches[0].id, sales, vouchers);
      const yerDebt = debts.find(b => b.currency === (args.currency || 'YER'))?.amount || 0;
      if (yerDebt > 0) setDebtWarning(yerDebt);
    }

    if (name === 'recordVoucher') {
      const list = args.type === 'قبض' ? customers : suppliers;
      const searchName = (args.person_name || "").trim();
      const matches = list.filter(p => p.name.includes(searchName));
      if (matches.length === 0) {
        setErrorInfo(`الاسم "${args.person_name}" غير مسجل في القائمة.`);
        return false;
      }
      if (matches.length > 1) {
        setAmbiguityMatches(matches);
        return true;
      }
    }

    if (name === 'recordReturn') {
        const searchName = (args.person_name || "").trim();
        const list = args.operation_type === 'بيع' ? sales : purchases;
        const personField = args.operation_type === 'بيع' ? 'customer_name' : 'supplier_name';
        
        const exists = list.some(op => op[personField].includes(searchName) && !op.is_returned);
        if (!exists) {
            setErrorInfo(`لم يتم العثور على أي فاتورة ${args.operation_type} غير مرتجعة لـ "${searchName}"`);
            return false;
        }
    }

    return true;
  }, [customers, suppliers, sales, purchases, vouchers]);

  const executeAction = useCallback(async (forcedId?: string) => {
    if (!pendingAction || isExecuting) return;
    
    const actionName = pendingAction.name;
    const actionArgs = pendingAction.args;

    setIsExecuting(true);
    try {
      switch (actionName) {
        case 'recordSale': {
          const target = forcedId ? customers.find(c => c.id === forcedId) : customers.find(c => c.name.includes(actionArgs.customer_name));
          if (!target) throw new Error("العميل غير موجود");
          await addSale({ ...actionArgs, customer_id: target.id, customer_name: target.name, total: (Number(actionArgs.quantity) || 0) * (Number(actionArgs.unit_price) || 0), date: new Date().toISOString() });
          break;
        }
        case 'recordVoucher': {
          const list = actionArgs.type === 'قبض' ? customers : suppliers;
          const target = forcedId ? list.find(p => p.id === forcedId) : list.find(p => p.name.includes(actionArgs.person_name));
          if (!target) throw new Error("الشخص غير موجود");
          await addVoucher({ ...actionArgs, person_id: target.id, person_name: target.name, person_type: actionArgs.type === 'قبض' ? 'عميل' : 'مورد', date: new Date().toISOString() });
          break;
        }
        case 'recordReturn': {
          if (actionArgs.operation_type === 'بيع') {
            const sale = sales.find(s => s.customer_name.includes(actionArgs.person_name) && !s.is_returned);
            if (!sale) throw new Error("لم يتم العثور على الفاتورة النشطة");
            await returnSale(sale.id);
          } else {
            const pur = purchases.find(p => p.supplier_name.includes(actionArgs.person_name) && !p.is_returned);
            if (!pur) throw new Error("لم يتم العثور على فاتورة المشتريات النشطة");
            await returnPurchase(pur.id);
          }
          break;
        }
        case 'managePerson': {
          if (actionArgs.action === 'إضافة') {
            if (actionArgs.type === 'عميل') await addCustomer({ name: actionArgs.name, phone: actionArgs.phone || '', address: actionArgs.address_region || '' });
            else await addSupplier({ name: actionArgs.name, phone: actionArgs.phone || '', region: actionArgs.address_region || '' });
          } else if (actionArgs.action === 'حذف') {
             if (actionArgs.type === 'عميل') {
                const target = customers.find(c => c.name.includes(actionArgs.name));
                if (target) await deleteCustomer(target.id);
             } else {
                const target = suppliers.find(s => s.name.includes(actionArgs.name));
                if (target) await deleteSupplier(target.id);
             }
          }
          break;
        }
      }

      addNotification("تم التنفيذ بنجاح ⚡", "تمت معالجة الطلب سحابياً.", "success");
      setPendingAction(null);
      setAmbiguityMatches([]);
      return true;
    } catch (err: any) {
      addNotification("عذراً يا مدير ⚠️", err.message || "فشل التنفيذ، حاول ثانية.", "warning");
      return false;
    } finally {
      setIsExecuting(false);
    }
  }, [pendingAction, isExecuting, customers, suppliers, sales, purchases, addSale, addVoucher, addNotification, addCustomer, addSupplier, deleteCustomer, deleteSupplier, returnSale, returnPurchase]);

  return {
    pendingAction, setPendingAction,
    ambiguityMatches, setAmbiguityMatches,
    debtWarning, errorInfo, setErrorInfo,
    isExecuting, validateToolCall, executeAction
  };
};