
import { supabase } from './supabaseClient';
import { logger } from './loggerService';
import { 
  Sale, Customer, Purchase, Supplier, QatCategory, 
  Voucher, Expense, Waste, ExpenseTemplate, AppNotification, ActivityLog, User
} from "../types";
import { indexedDbService } from './indexedDbService';
import { syncService } from './syncService';
import { authService } from './authService';

const CACHE_TTL = 30000; 
const l1Cache: Record<string, { data: any, timestamp: number }> = {};

const cleanPayload = (payload: any) => {
  if (!payload || typeof payload !== 'object') return payload;
  const cleaned = { ...payload };
  const keysToRemove = ['image_base64_data', 'image_mime_type', 'image_file_name', 'record_type_for_image', 'tempId', 'originalId', 'created_at', 'updated_at'];
  keysToRemove.forEach(key => delete cleaned[key]);
  return cleaned;
};

/**
 * وظيفة محسنة تجلب البيانات مع معالجة ذكية للأخطاء وتقليل التحذيرات غير الضرورية
 */
async function withRetry<T>(fn: () => Promise<{ data: T | null, error: any }>, key: string, forceFresh = false): Promise<T> {
  // 1. التحقق من الكاش السريع (Memory)
  if (!forceFresh && l1Cache[key] && (Date.now() - l1Cache[key].timestamp < CACHE_TTL)) {
    return l1Cache[key].data as T;
  }
  
  // 2. محاولة الجلب من السحابة إذا كان المتصفح يشير للاتصال
  if (navigator.onLine) {
    try {
      const { data, error } = await fn();
      if (!error && data) {
        l1Cache[key] = { data, timestamp: Date.now() };
        // تحديث قاعدة البيانات المحلية في الخلفية
        indexedDbService.saveData(key, data).catch(() => {});
        return data;
      }
      if (error) throw error;
    } catch (err: any) {
      // إذا كان الخطأ هو فشل جلب (TypeError: Failed to fetch) لا نظهر تحذيراً مزعجاً
      // لأنه متوقع في البيئات ذات الشبكة المتقطعة
      const isNetworkError = err.name === 'TypeError' || err.message?.includes('fetch');
      if (!isNetworkError) {
        logger.warn(`Cloud fetch error for ${key}:`, err);
      }
    }
  }
  
  // 3. العودة للقاعدة المحلية (Fallback)
  const localData = await indexedDbService.getData(key);
  return (localData || []) as T;
}

export const dataService = {
  onOfflineQueueCountChange: (count: number) => {},
  
  async updateOfflineQueueCount() {
    const count = await indexedDbService.getQueueCount();
    this.onOfflineQueueCountChange(count);
  },

  getUserId: authService.getUserId,
  ensureUserExists: authService.ensureUserExists,
  getFullProfile: authService.getFullProfile,
  updateProfile: authService.updateProfile,

  async processOfflineQueue() {
    const uid = await this.getUserId();
    if (!uid) return;
    
    const actions = {
      saveSale: this.saveSale.bind(this),
      savePurchase: this.savePurchase.bind(this),
      saveCustomer: this.saveCustomer.bind(this),
      saveSupplier: this.saveSupplier.bind(this),
      saveVoucher: this.saveVoucher.bind(this),
      saveExpense: this.saveExpense.bind(this),
      saveCategory: this.saveCategory.bind(this),
      deleteRecord: this.deleteRecord.bind(this),
      returnSale: this.returnSale.bind(this),
      returnPurchase: this.returnPurchase.bind(this),
      updateSettings: this.updateSettings.bind(this),
      saveWaste: this.saveWaste.bind(this),
      saveOpeningBalance: this.saveOpeningBalance.bind(this),
      saveExpenseTemplate: this.saveExpenseTemplate.bind(this),
      saveNotification: this.saveNotification.bind(this)
    };

    await syncService.processQueue(uid, actions);
    this.updateOfflineQueueCount();
  },

  async getCategories(f = false) { return withRetry<QatCategory[]>(() => supabase.from('categories').select('*').order('name'), 'cats', f); },
  async getSales(f = false) { return withRetry<Sale[]>(() => supabase.from('sales').select('*').order('date', { ascending: false }).limit(200), 'sales', f); },
  async getCustomers(f = false) { return withRetry<Customer[]>(() => supabase.from('customers').select('*').order('name'), 'custs', f); },
  async getSuppliers(f = false) { return withRetry<Supplier[]>(() => supabase.from('suppliers').select('*').order('name'), 'supps', f); },
  async getPurchases(f = false) { return withRetry<Purchase[]>(() => supabase.from('purchases').select('*').order('date', { ascending: false }).limit(200), 'purchs', f); },
  async getVouchers(f = false) { return withRetry<Voucher[]>(() => supabase.from('vouchers').select('*').order('date', { ascending: false }), 'vchs', f); },
  async getExpenses(f = false) { return withRetry<Expense[]>(() => supabase.from('expenses').select('*').order('date', { ascending: false }), 'exps', f); },
  async getNotifications(f = false) { return withRetry<AppNotification[]>(() => supabase.from('notifications').select('*').order('date', {ascending: false}).limit(50), 'notifs', f); },
  async getActivityLogs() { return withRetry<ActivityLog[]>(() => supabase.from('activity_log').select('*').order('timestamp', { ascending: false }).limit(50), 'logs', true); },
  async getExpenseTemplates(f = false) { return withRetry<ExpenseTemplate[]>(() => supabase.from('expense_templates').select('*').order('title'), 'exp_templates', f); },
  async getWaste(f = false) { return withRetry<Waste[]>(() => supabase.from('waste').select('*').order('date', { ascending: false }), 'waste', f); },

  async safeUpsert(table: string, payload: any, actionName: string, skipQueue = false) {
    const uid = await this.getUserId();
    if (!uid) throw new Error("Unauthenticated");

    if (!navigator.onLine && !skipQueue) {
      return this.queueOffline(uid, actionName, payload);
    }

    try {
      const { data, error } = await supabase.from(table).upsert({ ...cleanPayload(payload), user_id: uid }).select().single();
      if (error) throw error;
      return data;
    } catch (e: any) {
      const isNetworkError = e.name === 'TypeError' || e.message?.includes('fetch') || !navigator.onLine;
      if (isNetworkError && !skipQueue) {
        return this.queueOffline(uid, actionName, payload);
      }
      throw e;
    }
  },

  async queueOffline(uid: string, action: string, payload: any) {
    const tempId = payload.id || crypto.randomUUID();
    await indexedDbService.addOperation({ 
      userId: uid, 
      action: action as any, 
      tempId, 
      payload: { ...payload, id: tempId, user_id: uid } 
    });
    this.updateOfflineQueueCount();
    return { ...payload, id: tempId, created_at: new Date().toISOString(), _offline: true };
  },

  async saveSale(sale: any, skipQueue = false) { return this.safeUpsert('sales', sale, 'saveSale', skipQueue); },
  async saveCustomer(c: any, skipQueue = false) { return this.safeUpsert('customers', c, 'saveCustomer', skipQueue); },
  async saveSupplier(s: any, skipQueue = false) { return this.safeUpsert('suppliers', s, 'saveSupplier', skipQueue); },
  async saveVoucher(v: any, skipQueue = false) { return this.safeUpsert('vouchers', v, 'saveVoucher', skipQueue); },
  async saveExpense(e: any, skipQueue = false) { return this.safeUpsert('expenses', e, 'saveExpense', skipQueue); },
  async savePurchase(purchase: any, skipQueue = false) { return this.safeUpsert('purchases', purchase, 'savePurchase', skipQueue); },
  async saveCategory(cat: any, skipQueue = false) { return this.safeUpsert('categories', cat, 'saveCategory', skipQueue); },
  async saveWaste(w: any, skipQueue = false) { return this.safeUpsert('waste', w, 'saveWaste', skipQueue); },
  async saveOpeningBalance(b: any, skipQueue = false) { return this.safeUpsert('opening_balances', b, 'saveOpeningBalance', skipQueue); },
  async saveExpenseTemplate(t: any, skipQueue = false) { return this.safeUpsert('expense_templates', t, 'saveExpenseTemplate', skipQueue); },
  async saveNotification(n: any, skipQueue = false) { return this.safeUpsert('notifications', n, 'saveNotification', skipQueue); },

  async deleteRecord(table: string, id: string, imageUrl?: string, recordTypeForImage?: string, skipQueue = false) {
    const uid = await this.getUserId();
    if (!uid) throw new Error("Unauthenticated");

    if (!navigator.onLine && !skipQueue) {
      await indexedDbService.addOperation({ userId: uid!, action: 'deleteRecord', tableName: table, originalId: id, payload: { id, imageUrl, record_type_for_image: recordTypeForImage } });
      this.updateOfflineQueueCount();
      return true;
    }
    const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', uid);
    if (error) throw error;
    return true;
  },

  async updateSettings(userId: string, settings: any, skipQueue = false) {
    if (!navigator.onLine && !skipQueue) {
      await indexedDbService.addOperation({ userId, action: 'updateSettings', payload: settings });
      this.updateOfflineQueueCount();
      return settings;
    }
    const { data, error } = await supabase.from('user_settings').upsert({ user_id: userId, accounting_settings: settings }, { onConflict: 'user_id' }).select().single();
    if (error) throw error;
    return data;
  },

  async returnSale(id: string, skipQueue = false) {
    const uid = await this.getUserId();
    if (!uid) throw new Error("Unauthenticated");
    if (!navigator.onLine && !skipQueue) {
      await indexedDbService.addOperation({ userId: uid!, action: 'returnSale', originalId: id, payload: { id } });
      this.updateOfflineQueueCount();
      return true;
    }
    const { error } = await supabase.rpc('return_sale', { sale_uuid: id, user_uuid: uid });
    if (error) throw error;
    return true;
  },

  async returnPurchase(id: string, skipQueue = false) {
    const uid = await this.getUserId();
    if (!uid) throw new Error("Unauthenticated");
    if (!navigator.onLine && !skipQueue) {
      await indexedDbService.addOperation({ userId: uid!, action: 'returnPurchase', originalId: id, payload: { id } });
      this.updateOfflineQueueCount();
      return true;
    }
    const { error } = await supabase.rpc('return_purchase', { purchase_uuid: id, user_uuid: uid });
    if (error) throw error;
    return true;
  },

  async markAllNotificationsRead() {
    const uid = await this.getUserId();
    if (!uid) return;
    try {
      await supabase.from('notifications').update({ read: true }).eq('user_id', uid).eq('read', false);
    } catch (e) { logger.error("Failed to mark notifications read", e); }
  },

  async deleteAllNotificationsOlderThan(days: number) {
    const uid = await this.getUserId();
    if (!uid) throw new Error("Unauthenticated");
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    try {
      const { error } = await supabase.from('notifications').delete().eq('user_id', uid).lt('date', cutoffDate);
      if (error) throw error;
    } catch (e) { logger.error("Failed to delete old notifications", e); }
  },

  async logActivity(userId: string, action: string, details: string, type: ActivityLog['type']) {
    try {
      await supabase.from('activity_log').insert({ user_id: userId, action, details, type, timestamp: new Date().toISOString() });
    } catch (e) { logger.error(`Error in logActivity:`, e); }
  },

  base64ToBytes(base64: string): Uint8Array {
    const binary_string = window.atob(base64.split(',')[1] || base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) { bytes[i] = binary_string.charCodeAt(i); }
    return bytes;
  },

  async prepareBackupPackage(userId: string, currentData?: any): Promise<any> {
    if (!userId) throw new Error("User ID required for backup");
    const backup = {
      timestamp: new Date().toISOString(),
      metadata: { app: "Al-Shwaia Smart System", version: "3.1.0" },
      userProfile: currentData?.profile || await this.getFullProfile(userId),
      customers: currentData?.customers || await this.getCustomers(true),
      suppliers: currentData?.suppliers || await this.getSuppliers(true),
      categories: currentData?.categories || await this.getCategories(true),
      sales: currentData?.sales || await this.getSales(true),
      purchases: currentData?.purchases || await this.getPurchases(true),
      vouchers: currentData?.vouchers || await this.getVouchers(true),
      expenses: currentData?.expenses || await this.getExpenses(true),
      waste: currentData?.waste || await this.getWaste(true),
      notifications: currentData?.notifications || await this.getNotifications(true),
      expenseTemplates: currentData?.expenseTemplates || await this.getExpenseTemplates(true),
    };
    return backup;
  },
};
