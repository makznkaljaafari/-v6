
import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { PageLayout } from './ui/Layout';
import { shareToWhatsApp, formatPurchaseInvoice } from '../services/shareService';
import ImageUploadInput from './ui/ImageUploadInput';
import { BaseInput } from './ui/atoms/BaseInput';
import { BaseSelect } from './ui/atoms/BaseSelect';
import { BaseButton } from './ui/atoms/BaseButton';
import { CurrencySwitcher } from './ui/molecules/CurrencySwitcher';

const AddPurchase: React.FC = () => {
  const { purchases, addPurchase, navigate, suppliers, categories, user, addNotification, navigationParams, theme, formatValue } = useApp();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const editingPurchase = useMemo(() => 
    navigationParams?.purchaseId ? purchases.find(p => p.id === navigationParams.purchaseId) : null
  , [purchases, navigationParams?.purchaseId]);

  const [formData, setFormData] = useState({
    supplier_id: editingPurchase?.supplier_id || navigationParams?.supplierId || '',
    // FIX: Replaced editingSale with editingPurchase
    qat_type: editingPurchase?.qat_type || '',
    quantity: editingPurchase?.quantity || '' as number | '',
    unit_price: editingPurchase?.unit_price || '' as number | '',
    status: editingPurchase?.status || 'نقدي' as 'نقدي' | 'آجل',
    currency: editingPurchase?.currency || 'YER' as 'YER' | 'SAR' | 'OMR',
    notes: editingPurchase?.notes || '',
    image_url: editingPurchase?.image_url,
    image_base64_data: undefined as string | undefined,
    image_mime_type: undefined as string | undefined,
    image_file_name: undefined as string | undefined,
  });

  useEffect(() => {
    if (!formData.qat_type && categories.length > 0) {
      setFormData(prev => ({ ...prev, qat_type: categories[0].name }));
    }
  }, [categories, formData.qat_type]);

  const totalAmount = useMemo(() => 
    formatValue((Number(formData.quantity) || 0) * (Number(formData.unit_price) || 0))
  , [formData.quantity, formData.unit_price, formatValue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const supplier = suppliers.find(s => s.id === formData.supplier_id);
    if (!supplier) return addNotification("تنبيه ⚠️", "يرجى اختيار المورد أولاً", "warning");

    setIsSubmitting(true);
    try {
      const purchaseData = { 
        ...formData,
        id: editingPurchase?.id,
        supplier_name: supplier.name,
        total: totalAmount,
        date: editingPurchase?.date || new Date().toISOString(),
      };

      const addedPurchase = await addPurchase(purchaseData);
      const autoShare = user?.accounting_settings?.auto_share_whatsapp ?? true;
      if (autoShare) shareToWhatsApp(formatPurchaseInvoice(addedPurchase || (purchaseData as any), user?.agency_name || 'الوكالة'), supplier.phone);
      navigate('purchases');
    } catch (err: any) {
      console.error(err);
      addNotification("خطأ ❌", err.message || "تعذر حفظ البيانات. حدث خطأ غير متوقع.", "warning");
    } finally {
      setIsSubmitting(false);
    }
  };

  const supplierOptions = useMemo(() => 
    [{ value: '', label: '-- اختر المورد --' }, ...suppliers.map(s => ({ value: s.id, label: s.name }))]
  , [suppliers]);

  const qatOptions = useMemo(() => 
    categories.map(cat => ({ value: cat.name, label: cat.name }))
  , [categories]);

  return (
    <PageLayout title={editingPurchase ? "تعديل شراء" : "فاتورة مشتريات"} onBack={() => navigate('purchases')}>
      <form onSubmit={handleSubmit} className="space-y-6 page-enter pb-44 max-w-2xl mx-auto w-full px-2">
        <div className={`p-6 sm:p-8 rounded-[2.5rem] border-2 shadow-2xl space-y-6 ${theme === 'dark' ? 'bg-[var(--color-background-card)] border-[var(--color-border-default)]' : 'bg-[var(--color-background-card)] border-[var(--color-border-default)]'}`}>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BaseSelect 
              label="المورد / المزارع" icon="🚛" 
              options={supplierOptions}
              value={formData.supplier_id}
              onChange={e => setFormData({ ...formData, supplier_id: e.target.value })}
              required
            />
            <BaseSelect 
              label="نوع القات" icon="🌿" 
              options={qatOptions}
              value={formData.qat_type}
              onChange={e => setFormData({ ...formData, qat_type: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest px-2">العملة</label>
                <CurrencySwitcher value={formData.currency} onChange={v => setFormData({...formData, currency: v})} activeColor="bg-[var(--color-accent-orange)]" />
             </div>
             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest px-2">نوع القيد</label>
                <div className="bg-[var(--color-background-tertiary)] p-1 rounded-2xl flex gap-1 border border-[var(--color-border-default)] shadow-inner w-full">
                  {['نقدي', 'آجل'].map(s => (
                    <button
                      key={s} type="button"
                      onClick={() => setFormData({...formData, status: s as any})}
                      className={`flex-1 py-3 rounded-xl font-black text-[10px] transition-all ${
                        formData.status === s ? (s === 'آجل' ? 'bg-[var(--color-status-danger)] text-[var(--color-text-inverse)]' : 'bg-[var(--color-accent-orange)] text-[var(--color-text-inverse)]') : 'text-[var(--color-text-muted)]'
                      }`}
                    >{s}</button>
                  ))}
                </div>
             </div>
          </div>

          <BaseInput 
            label="ملاحظات الشراء" icon="📝" 
            placeholder="مثلاً: بضاعة درجة أولى..."
            value={formData.notes}
            onChange={e => setFormData({...formData, notes: e.target.value})}
          />

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--color-border-default)]/50">
             <div className="text-center space-y-2">
                <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">الكمية (بالكيس)</p>
                <input 
                   type="number" step="0.1"
                   className="w-full bg-transparent text-center font-black text-5xl outline-none text-[var(--color-text-default)] tabular-nums"
                   value={formData.quantity}
                   onChange={e => setFormData({...formData, quantity: e.target.value === '' ? '' : parseFloat(e.target.value)})}
                />
             </div>
             <div className="text-center space-y-2 border-r border-[var(--color-border-default)]/50">
                <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">تكلفة الكيس</p>
                <input 
                   type="number" 
                   className="w-full bg-transparent text-center font-black text-5xl outline-none text-[var(--color-accent-orange)] tabular-nums"
                   value={formData.unit_price}
                   onChange={e => setFormData({...formData, unit_price: e.target.value === '' ? '' : parseFloat(e.target.value)})}
                />
             </div>
          </div>
        </div>

        {user?.id && (
          <ImageUploadInput
            userId={user.id} recordType="purchases" recordId={editingPurchase?.id || 'new'}
            currentImageUrl={formData.image_url} onImageUploadSuccess={info => {
              if (typeof info === 'string') setFormData(p => ({...p, image_url: info}));
              else setFormData(p => ({...p, image_base64_data: info.base64, image_mime_type: info.mimeType, image_file_name: info.fileName}));
            }}
            onImageDelete={() => setFormData(p => ({ ...p, image_url: undefined, image_base64_data: undefined }))}
            currentImageBase64={formData.image_base64_data}
            currentImageMimeType={formData.image_mime_type}
          />
        )}

        <div className="fixed bottom-24 left-0 right-0 px-4 z-40">
            <div className={`max-w-2xl mx-auto p-4 rounded-3xl shadow-2xl flex items-center justify-between gap-4 border-2 ${theme === 'dark' ? 'bg-[var(--color-accent-orange)] border-[var(--color-border-subtle)]' : 'bg-[var(--color-background-card)] border-[var(--color-border-subtle)]'}`}>
               <div className="text-right pl-4">
                  <p className="text-[8px] font-black uppercase opacity-60 text-[var(--color-text-muted)]">إجمالي التكلفة</p>
                  <h2 className={`text-2xl font-black tabular-nums ${theme === 'dark' ? 'text-[var(--color-text-inverse)]' : 'text-[var(--color-accent-orange)]'}`}>
                    {totalAmount.toLocaleString()} 
                    <small className="text-xs opacity-50 mr-1 text-[var(--color-text-inverse)]">{formData.currency}</small>
                  </h2>
               </div>
               <BaseButton 
                 variant={theme === 'dark' ? 'ghost' : 'primary'} 
                 size="lg" 
                 onClick={handleSubmit} 
                 loading={isSubmitting}
                 className={theme === 'dark' ? 'bg-[var(--color-text-inverse)] text-[var(--color-accent-orange)] border-none' : 'bg-[var(--color-accent-orange)]'}
               >
                 {editingPurchase ? 'تحديث الشراء' : 'حفظ الشراء 📦'}
               </BaseButton>
            </div>
        </div>
      </form>
    </PageLayout>
  );
};

export default AddPurchase;
