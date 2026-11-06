import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShoppingBag,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  Package,
  Calendar,
  Clock,
  Coins,
  Search,
  Upload,
  Link as LinkIcon,
  X,
  History,
  Lock,
  Unlock,
  ShieldCheck,
  User,
  GraduationCap
} from 'lucide-react';
import {
  StoreItem,
  StorePurchase,
  StoreSettings,
  DEFAULT_STORE_SETTINGS,
  QuranComplex,
  Student,
  Halaqah,
  TeacherAccount,
  ComplexThemeConfig
} from '../../types';
import { OmranDataService } from '../../lib/firebase';
import { compressImageToDataUrl } from '../../lib/imageCompressor';
import { toArabicDigits } from '../ParentPortalView';

interface StoreTabProps {
  isSupervisor: boolean;
  isDeveloper: boolean;
  currentTeacher?: TeacherAccount | null;
  activeComplex?: QuranComplex | null;
  complexTheme?: ComplexThemeConfig | null;
  students: Student[];
  halaqahs: Halaqah[];
}

export const StoreTab: React.FC<StoreTabProps> = ({
  isSupervisor,
  isDeveloper,
  currentTeacher,
  activeComplex,
  complexTheme,
  students: _students,
  halaqahs: _halaqahs
}) => {
  const canManage = isSupervisor || isDeveloper;
  const complexId = activeComplex?.id || '';

  // Theme colors
  const primaryColor = complexTheme?.primaryColor || '#022c22';
  const secondaryColor = complexTheme?.secondaryColor || '#064e3b';
  const accentColor = complexTheme?.accentColor || '#fbbf24';
  const surfaceColor = complexTheme?.surfaceColor || '#064e3b';
  const cardColor = complexTheme?.cardColor || '#0f3a2f';

  // Live Real-Time State
  const [items, setItems] = useState<StoreItem[]>([]);
  const [purchases, setPurchases] = useState<StorePurchase[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [purchasesSearch, setPurchasesSearch] = useState('');

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StoreItem | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    imageUrl: string;
    imageType: 'upload' | 'url';
    pointsRequired: number;
    quantity: number;
    description: string;
    isImmediate: boolean;
    startsAt: string;
    isForever: boolean;
    endsAt: string;
  }>({
    name: '',
    imageUrl: '',
    imageType: 'upload',
    pointsRequired: 50,
    quantity: 5,
    description: '',
    isImmediate: true,
    startsAt: '',
    isForever: true,
    endsAt: ''
  });

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Real-Time Subscriptions
  useEffect(() => {
    setLoading(true);

    const unsubItems = OmranDataService.subscribeStoreItems((liveItems) => {
      setItems(liveItems);
      setLoading(false);
    }, complexId);

    const unsubPurchases = OmranDataService.subscribeStorePurchases((livePurchases) => {
      setPurchases(livePurchases);
    }, complexId);

    const unsubSettings = OmranDataService.subscribeStoreSettings((liveSettings) => {
      setSettings(liveSettings);
    }, complexId);

    return () => {
      try { unsubItems(); } catch {}
      try { unsubPurchases(); } catch {}
      try { unsubSettings(); } catch {}
    };
  }, [complexId]);

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  // Toggle Store Open / Closed
  const handleToggleStoreStatus = async () => {
    if (!canManage) return;
    const nextState = !settings.isOpen;
    try {
      const updated: StoreSettings = {
        ...settings,
        isOpen: nextState,
        updatedAt: new Date().toISOString(),
        updatedBy: currentTeacher?.name || 'المشرف'
      };
      setSettings(updated);
      await OmranDataService.saveStoreSettings(updated, complexId);
      showNotice(nextState ? 'تم فتح المتجر للطلاب بنجاح ✅' : 'تم إغلاق المتجر مؤقتاً بأمر المشرف ⛔');
    } catch {
      showNotice('حدث خطأ أثناء تعديل حالة المتجر');
    }
  };

  // Open modal for new item
  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      imageUrl: '',
      imageType: 'upload',
      pointsRequired: 50,
      quantity: 5,
      description: '',
      isImmediate: true,
      startsAt: '',
      isForever: true,
      endsAt: ''
    });
    setIsModalOpen(true);
  };

  // Open modal for editing existing item
  const handleOpenEditModal = (item: StoreItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      imageUrl: item.imageUrl || '',
      imageType: item.imageUrl?.startsWith('data:') ? 'upload' : 'url',
      pointsRequired: item.pointsRequired || 10,
      quantity: item.quantity || 1,
      description: item.description || '',
      isImmediate: !item.startsAt,
      startsAt: item.startsAt ? item.startsAt.substring(0, 16) : '',
      isForever: !item.endsAt,
      endsAt: item.endsAt ? item.endsAt.substring(0, 16) : ''
    });
    setIsModalOpen(true);
  };

  // Handle image upload with auto-compression
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const compressedDataUrl = await compressImageToDataUrl(file, 600, 600, 0.85);
      setFormData(prev => ({ ...prev, imageUrl: compressedDataUrl, imageType: 'upload' }));
      showNotice('تم ضغط ورفع صورة الجائزة بنجاح ✓');
    } catch {
      showNotice('فشل في معالجة الصورة، يرجى اختيار صورة أخرى');
    } finally {
      setIsUploading(false);
    }
  };

  // Save Store Item
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    if (!formData.name.trim()) {
      showNotice('يرجى كتابة اسم الجائزة / المشترى');
      return;
    }

    try {
      setIsSaving(true);
      const nowIso = new Date().toISOString();
      const itemId = editingItem?.id || `store-item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      const itemToSave: StoreItem = {
        id: itemId,
        complexId,
        name: formData.name.trim(),
        imageUrl: formData.imageUrl.trim() || undefined,
        pointsRequired: Math.max(1, Number(formData.pointsRequired) || 10),
        quantity: Math.max(0, Number(formData.quantity) || 0),
        initialQuantity: editingItem?.initialQuantity ?? Math.max(0, Number(formData.quantity) || 0),
        startsAt: formData.isImmediate ? undefined : (formData.startsAt ? new Date(formData.startsAt).toISOString() : undefined),
        endsAt: formData.isForever ? undefined : (formData.endsAt ? new Date(formData.endsAt).toISOString() : undefined),
        isImmediate: formData.isImmediate,
        isForever: formData.isForever,
        description: formData.description.trim() || undefined,
        createdAt: editingItem?.createdAt || nowIso,
        updatedAt: nowIso,
        createdBy: currentTeacher?.name || 'المشرف'
      };

      await OmranDataService.saveStoreItem(itemToSave);
      setIsModalOpen(false);
      showNotice(editingItem ? 'تم تعديل الجائزة وتحديثها مباشرة عند الطلاب ✨' : 'تمت إضافة الجائزة ونشرها في المتجر بنجاح 🎁');
    } catch {
      showNotice('حدث خطأ أثناء حفظ الجائزة');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Store Item
  const handleDeleteItem = async (itemId: string, name: string) => {
    if (!canManage) return;
    if (!confirm(`هل أنت متأكد من حذف الجائزة "${name}" نهائياً من المتجر؟`)) return;

    try {
      await OmranDataService.deleteStoreItem(itemId);
      showNotice(`تم حذف الجائزة "${name}" واختفاؤها من المتجر بنجاح 🗑️`);
    } catch {
      showNotice('حدث خطأ أثناء حذف الجائزة');
    }
  };

  // Filter purchases
  const filteredPurchases = useMemo(() => {
    const q = purchasesSearch.trim().toLowerCase();
    if (!q) return purchases;
    return purchases.filter(p =>
      p.studentName?.toLowerCase().includes(q) ||
      p.itemName?.toLowerCase().includes(q) ||
      p.halaqahName?.toLowerCase().includes(q)
    );
  }, [purchases, purchasesSearch]);

  const totalPointsRedeemed = useMemo(() => {
    return purchases.reduce((sum, p) => sum + (p.pointsCost || 0), 0);
  }, [purchases]);

  return (
    <div className="space-y-8 animate-fade-in pb-12 font-sans" dir="rtl">
      {/* Toast Notice */}
      {actionNotice && (
        <div className="fixed bottom-6 left-6 z-50 bg-slate-900/95 text-white border-2 border-emerald-500/80 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md animate-bounce">
          <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="font-bold text-sm">{actionNotice}</span>
        </div>
      )}

      {/* Top Banner (Header with Duolingo 3D styling & complex theme) */}
      <div
        className="rounded-3xl p-6 sm:p-8 border-2 border-b-4 shadow-xl transition-all relative overflow-hidden"
        style={{
          backgroundColor: surfaceColor,
          borderColor: `${accentColor}40`,
          borderBottomColor: accentColor
        }}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 border-2 border-b-4 shadow-lg text-white"
              style={{
                backgroundColor: primaryColor,
                borderColor: accentColor,
                borderBottomColor: accentColor
              }}
            >
              <ShoppingBag className="w-8 h-8 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black text-white font-heading tracking-tight">
                  المتجر القرآني وجوائز النقاط
                </h1>
                <span
                  className="px-3 py-1 rounded-full text-xs font-black border flex items-center gap-1.5 shadow-sm"
                  style={{
                    backgroundColor: `${accentColor}25`,
                    borderColor: `${accentColor}80`,
                    color: accentColor
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  مزامنة حية ومباشرة
                </span>
              </div>
              <p className="text-slate-300 text-sm sm:text-base mt-1.5 leading-relaxed">
                تحفيز طلاب الحلقات واستبدال نقاط التسميع والاختبارات بجوائز وهدايا عينية قيمة وفورية
              </p>
            </div>
          </div>

          {/* Right Controls: Store Switch & Add Item Button */}
          <div className="flex flex-wrap items-center gap-3.5">
            {/* Store Status Toggle */}
            {canManage ? (
              <button
                type="button"
                onClick={handleToggleStoreStatus}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm border-2 border-b-4 transition-all shadow-md active:translate-y-1 active:border-b-0 ${
                  settings.isOpen
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-800'
                    : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-800'
                }`}
                title={settings.isOpen ? 'المتجر مفتوح للطلاب - اضغط للإغلاق' : 'المتجر مغلق حالياً - اضغط للفتح'}
              >
                {settings.isOpen ? (
                  <>
                    <Unlock className="w-4 h-4 text-emerald-200" />
                    <span>المتجر مفتوح للطلاب</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-200 animate-ping inline-block" />
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-rose-200" />
                    <span>المتجر مغلق بأمر المشرف</span>
                  </>
                )}
              </button>
            ) : (
              <div
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black border ${
                  settings.isOpen
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}
              >
                {settings.isOpen ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                <span>{settings.isOpen ? 'المتجر متاح للطلاب' : 'المتجر مغلق'}</span>
              </div>
            )}

            {/* Add New Item Button (Supervisor/Developer only) */}
            {canManage && (
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-sm text-slate-950 border-2 border-b-4 transition-all shadow-lg active:translate-y-1 active:border-b-0 hover:brightness-105"
                style={{
                  backgroundColor: accentColor,
                  borderColor: '#b45309',
                  borderBottomColor: '#78350f'
                }}
              >
                <Plus className="w-5 h-5 stroke-[3]" />
                <span>إضافة مشترى / جائزة</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-black/20 rounded-2xl p-3 border border-white/5">
            <span className="text-xs text-slate-400 block font-bold">الجوائز المعروضة</span>
            <span className="text-xl sm:text-2xl font-black text-white font-mono">
              {toArabicDigits(items.length)}
            </span>
          </div>
          <div className="bg-black/20 rounded-2xl p-3 border border-white/5">
            <span className="text-xs text-slate-400 block font-bold">القطع المتوفرة</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
              {toArabicDigits(items.reduce((acc, i) => acc + (i.quantity || 0), 0))}
            </span>
          </div>
          <div className="bg-black/20 rounded-2xl p-3 border border-white/5">
            <span className="text-xs text-slate-400 block font-bold">إجمالي المشتريات</span>
            <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
              {toArabicDigits(purchases.length)}
            </span>
          </div>
          <div className="bg-black/20 rounded-2xl p-3 border border-white/5">
            <span className="text-xs text-slate-400 block font-bold">النقاط المستبدلة</span>
            <span className="text-xl sm:text-2xl font-black text-sky-400 font-mono">
              {toArabicDigits(totalPointsRedeemed)}
            </span>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SECTION 1: قسم المشتريات المعروضة (Available Store Items) */}
      {/* ==================================================================== */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Package className="w-6 h-6 text-amber-400" />
            <h2 className="text-xl sm:text-2xl font-black text-white font-heading">
              قسم المشتريات والجوائز المتاحة
            </h2>
            <span className="bg-white/10 text-slate-300 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold">
              {toArabicDigits(items.length)}
            </span>
          </div>
          {!canManage && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              وضع المشاهدة (التعديل متاح للمشرف فقط)
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 bg-white/5 rounded-3xl border-2 border-white/5 animate-pulse">
            جاري تحميل معروضات المتجر القرآني...
          </div>
        ) : items.length === 0 ? (
          <div
            className="rounded-3xl p-10 sm:p-14 text-center border-2 border-dashed border-white/15 transition-all"
            style={{ backgroundColor: `${cardColor}60` }}
          >
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/10">
              <ShoppingBag className="w-10 h-10 text-slate-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">قسم المشتريات فارغ حالياً</h3>
            <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
              لم تتم إضافة أي جوائز أو مشتريات بعد. بادر بإضافة مصاحف، ساعات، أو هدايا عينية لتحفيز الطلاب على التسميع والمنافسة!
            </p>
            {canManage && (
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm text-slate-950 border-2 border-b-4 transition-all shadow-lg active:translate-y-1 active:border-b-0 hover:brightness-105"
                style={{
                  backgroundColor: accentColor,
                  borderColor: '#b45309',
                  borderBottomColor: '#78350f'
                }}
              >
                <Plus className="w-5 h-5 stroke-[3]" />
                <span>إضافة أول مشترى في المتجر</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {items.map(item => {
              const isAvailable = (item.quantity || 0) > 0;
              const hasStart = Boolean(item.startsAt);
              const hasEnd = Boolean(item.endsAt);

              return (
                <div
                  key={item.id}
                  className="rounded-3xl border-2 border-b-4 overflow-hidden transition-all duration-200 flex flex-col justify-between shadow-lg hover:shadow-2xl hover:-translate-y-1 group"
                  style={{
                    backgroundColor: cardColor,
                    borderColor: `${accentColor}30`,
                    borderBottomColor: isAvailable ? accentColor : '#64748b'
                  }}
                >
                  {/* Item Image with Badges */}
                  <div className="relative aspect-video sm:aspect-square w-full bg-black/40 overflow-hidden flex items-center justify-center">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-gradient-to-b from-white/5 to-transparent">
                        <ShoppingBag className="w-16 h-16 opacity-40 mb-2" />
                        <span className="text-xs font-bold text-slate-400">جائزة قرآنية</span>
                      </div>
                    )}

                    {/* Points Badge (Top Right) */}
                    <div
                      className="absolute top-3 right-3 px-3 py-1.5 rounded-xl font-black text-xs sm:text-sm font-mono flex items-center gap-1.5 shadow-md border-2 border-b-2"
                      style={{
                        backgroundColor: '#78350f',
                        borderColor: accentColor,
                        color: accentColor
                      }}
                    >
                      <Coins className="w-4 h-4 text-amber-300" />
                      <span>{toArabicDigits(item.pointsRequired)} نقطة</span>
                    </div>

                    {/* Stock Quantity Badge (Top Left) */}
                    <div
                      className={`absolute top-3 left-3 px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1 shadow-md border ${
                        isAvailable
                          ? (item.quantity || 0) <= 2
                            ? 'bg-amber-600/90 text-white border-amber-400'
                            : 'bg-emerald-600/90 text-white border-emerald-400'
                          : 'bg-rose-600/90 text-white border-rose-400'
                      }`}
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>
                        {isAvailable
                          ? `المتبقي: ${toArabicDigits(item.quantity)}`
                          : 'نفد من المتجر'}
                      </span>
                    </div>
                  </div>

                  {/* Item Content */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h3 className="font-black text-white text-base sm:text-lg leading-snug line-clamp-2">
                        {item.name}
                      </h3>
                      {item.description && (
                        <p className="text-slate-400 text-xs mt-1.5 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Timing Badges if scheduled */}
                    {(hasStart || hasEnd) && (
                      <div className="text-[11px] text-slate-400 space-y-1 bg-black/20 p-2 rounded-xl border border-white/5">
                        {hasStart && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-sky-400" />
                            <span>البدء: {toArabicDigits(new Date(item.startsAt!).toLocaleDateString('ar-SA'))}</span>
                          </div>
                        )}
                        {hasEnd && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-amber-400" />
                            <span>الانتهاء: {toArabicDigits(new Date(item.endsAt!).toLocaleDateString('ar-SA'))}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Supervisor Actions */}
                    {canManage && (
                      <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(item)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/15 transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-sky-300" />
                          <span>تعديل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id, item.name)}
                          className="flex items-center justify-center p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-all"
                          title="حذف الجائزة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* SECTION 2: قسم تم شراؤه (Purchased Records / Audit Log) */}
      {/* ==================================================================== */}
      <div className="space-y-4 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <History className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl sm:text-2xl font-black text-white font-heading">
              قسم تم شراؤه (سجل المشتريات والجوائز الممنوحة)
            </h2>
            <span className="bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border border-emerald-500/30">
              {toArabicDigits(purchases.length)} عملية
            </span>
          </div>

          {/* Search Purchases */}
          {purchases.length > 0 && (
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={purchasesSearch}
                onChange={e => setPurchasesSearch(e.target.value)}
                placeholder="بحث باسم الطالب أو الجائزة..."
                className="w-full bg-black/30 border border-white/15 rounded-2xl pr-10 pl-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            </div>
          )}
        </div>

        {purchases.length === 0 ? (
          <div
            className="rounded-3xl p-10 text-center border-2 border-dashed border-white/10"
            style={{ backgroundColor: `${cardColor}40` }}
          >
            <History className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-60" />
            <h3 className="text-lg font-bold text-white mb-1">لم يقم أي طالب بالشراء بعد</h3>
            <p className="text-slate-400 text-xs">
              سجل الشراء فارغ حالياً. بمجرد قيام الطلاب باستبدال نقاطهم، ستظهر هنا جميع العمليات بدقة عالية تشمل الأجزاء من الثانية والفيمتو ثانية.
            </p>
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="p-8 text-center text-slate-400 bg-white/5 rounded-3xl">
            لا توجد نتائج مطابقة لبحثك "{purchasesSearch}"
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPurchases.map(purchase => (
              <div
                key={purchase.id}
                className="rounded-2xl p-4 sm:p-5 border-2 border-b-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:bg-white/[0.03]"
                style={{
                  backgroundColor: surfaceColor,
                  borderColor: `${accentColor}25`,
                  borderBottomColor: `${accentColor}50`
                }}
              >
                {/* Left/Main Info: Item and Student */}
                <div className="flex items-center gap-4">
                  {/* Item Image Thumbnail */}
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-black/40 overflow-hidden shrink-0 border border-white/10 flex items-center justify-center">
                    {purchase.itemImage ? (
                      <img
                        src={purchase.itemImage}
                        alt={purchase.itemName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ShoppingBag className="w-7 h-7 text-amber-400 opacity-70" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-white text-base sm:text-lg">
                        {purchase.itemName}
                      </span>
                      <span
                        className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-black border flex items-center gap-1 shadow-sm"
                        style={{
                          backgroundColor: '#78350f',
                          borderColor: accentColor,
                          color: accentColor
                        }}
                      >
                        <Coins className="w-3 h-3 text-amber-300" />
                        {toArabicDigits(purchase.pointsCost)} نقطة
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-300 flex-wrap">
                      <span className="flex items-center gap-1 text-emerald-300 font-bold">
                        <User className="w-3.5 h-3.5" />
                        الطالب: {purchase.studentName}
                      </span>
                      {purchase.halaqahName && (
                        <span className="flex items-center gap-1 text-slate-400">
                          <GraduationCap className="w-3.5 h-3.5 text-sky-400" />
                          {purchase.halaqahName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Info: Ultra-Precise Timestamp with femtoseconds */}
                <div className="bg-black/30 px-3.5 py-2.5 rounded-xl border border-white/10 text-right md:text-left shrink-0">
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-black justify-end md:justify-start">
                    <Clock className="w-3.5 h-3.5 text-amber-300" />
                    <span>توقيت الشراء الموثق فائق الدقة:</span>
                  </div>
                  <div className="text-[11px] sm:text-xs font-mono font-bold text-slate-200 mt-1 dir-ltr text-left">
                    {purchase.preciseTimestampText || purchase.purchasedAt}
                  </div>
                  {purchase.preciseSubsecond && (
                    <div className="text-[10px] font-mono text-emerald-400 mt-0.5 dir-ltr text-left">
                      فيمتو ثانية: {purchase.preciseSubsecond}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* MODAL: إضافة / تعديل جائزة في المتجر */}
      {/* ==================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div
            className="w-full max-w-xl rounded-3xl p-6 sm:p-8 border-2 border-b-4 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-6"
            style={{
              backgroundColor: surfaceColor,
              borderColor: accentColor,
              borderBottomColor: '#b45309'
            }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center border-2 border-b-4 text-white"
                  style={{
                    backgroundColor: primaryColor,
                    borderColor: accentColor,
                    borderBottomColor: '#b45309'
                  }}
                >
                  <Package className="w-6 h-6 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white font-heading">
                    {editingItem ? 'تعديل جائزة في المتجر' : 'إضافة مشترى / جائزة جديدة'}
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    تظهر مباشرة لجميع طلاب المجمع القرآني لحظياً
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveItem} className="space-y-5">
              {/* Item Name */}
              <div>
                <label className="block text-xs font-black text-slate-200 mb-1.5">
                  اسم الجائزة / المشترى <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: مصحف المدينة مذهب، ساعة الفجر، درع تفوق..."
                  className="w-full bg-black/40 border border-white/15 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 font-bold"
                />
              </div>

              {/* Item Image (Upload or URL) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-200">صورة الجائزة</label>
                  <div className="flex items-center gap-1 bg-black/30 p-1 rounded-xl border border-white/10 text-xs">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, imageType: 'upload' }))}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        formData.imageType === 'upload'
                          ? 'bg-amber-400 text-slate-950 font-black'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5 inline ml-1" />
                      رفع من جهازك
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, imageType: 'url' }))}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        formData.imageType === 'url'
                          ? 'bg-amber-400 text-slate-950 font-black'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <LinkIcon className="w-3.5 h-3.5 inline ml-1" />
                      رابط مباشر
                    </button>
                  </div>
                </div>

                {formData.imageType === 'upload' ? (
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full py-4 px-4 rounded-2xl border-2 border-dashed border-white/20 hover:border-amber-400 bg-black/20 text-center transition-all flex flex-col items-center justify-center gap-2 group"
                    >
                      <Upload className="w-6 h-6 text-slate-400 group-hover:text-amber-400 transition-colors" />
                      <span className="text-xs font-bold text-slate-300 group-hover:text-white">
                        {isUploading ? 'جاري ضغط ومعالجة الصورة...' : 'اضغط لاختيار صورة من جهازك (يتم ضغطها تلقائياً)'}
                      </span>
                    </button>
                  </div>
                ) : (
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="https://example.com/item.png"
                    className="w-full bg-black/40 border border-white/15 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 dir-ltr text-left"
                  />
                )}

                {/* Image Preview */}
                {formData.imageUrl && (
                  <div className="relative w-32 h-32 rounded-2xl overflow-hidden border-2 border-amber-400/50 mx-auto mt-2">
                    <img
                      src={formData.imageUrl}
                      alt="معاينة الجائزة"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, imageUrl: '' })}
                      className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-1 shadow-md hover:bg-rose-500"
                      title="إزالة الصورة"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Grid: Points and Stock Quantity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Points Required */}
                <div>
                  <label className="block text-xs font-black text-slate-200 mb-1.5">
                    النقاط المطلوبة من الطالب <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={1}
                      max={99999}
                      value={formData.pointsRequired}
                      onChange={e => setFormData({ ...formData, pointsRequired: Number(e.target.value) })}
                      className="w-full bg-black/40 border border-white/15 rounded-2xl pr-10 pl-4 py-3 text-sm text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                    />
                    <Coins className="w-5 h-5 text-amber-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Stock Quantity */}
                <div>
                  <label className="block text-xs font-black text-slate-200 mb-1.5">
                    الكمية المتوفرة في المخزن <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={0}
                      max={9999}
                      value={formData.quantity}
                      onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })}
                      className="w-full bg-black/40 border border-white/15 rounded-2xl pr-10 pl-4 py-3 text-sm text-white font-mono font-bold focus:outline-none focus:border-emerald-400"
                    />
                    <Package className="w-5 h-5 text-emerald-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              {/* Visibility and Schedule */}
              <div className="bg-black/30 p-4 rounded-2xl border border-white/10 space-y-3">
                <span className="text-xs font-black text-white block">مواعيد الظهور والانتهاء</span>

                {/* Start Date */}
                <div className="flex items-center justify-between text-xs">
                  <label className="text-slate-300 font-bold">موعد الظهور:</label>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="startsAtChoice"
                        checked={formData.isImmediate}
                        onChange={() => setFormData(prev => ({ ...prev, isImmediate: true, startsAt: '' }))}
                        className="text-amber-500"
                      />
                      <span className="text-white">فوري الآن</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="startsAtChoice"
                        checked={!formData.isImmediate}
                        onChange={() => setFormData(prev => ({ ...prev, isImmediate: false }))}
                        className="text-amber-500"
                      />
                      <span className="text-white">جدولة لاحقة</span>
                    </label>
                  </div>
                </div>
                {!formData.isImmediate && (
                  <input
                    type="datetime-local"
                    value={formData.startsAt}
                    onChange={e => setFormData({ ...formData, startsAt: e.target.value })}
                    className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                  />
                )}

                {/* End Date */}
                <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5">
                  <label className="text-slate-300 font-bold">موعد الانتهاء:</label>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="endsAtChoice"
                        checked={formData.isForever}
                        onChange={() => setFormData(prev => ({ ...prev, isForever: true, endsAt: '' }))}
                        className="text-amber-500"
                      />
                      <span className="text-white">للأبد حتى نفاد الكمية</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="endsAtChoice"
                        checked={!formData.isForever}
                        onChange={() => setFormData(prev => ({ ...prev, isForever: false }))}
                        className="text-amber-500"
                      />
                      <span className="text-white">موعد محدد</span>
                    </label>
                  </div>
                </div>
                {!formData.isForever && (
                  <input
                    type="datetime-local"
                    value={formData.endsAt}
                    onChange={e => setFormData({ ...formData, endsAt: e.target.value })}
                    className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                  />
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-black text-slate-200 mb-1.5">
                  وصف إضافي أو شروط الجائزة (اختياري)
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="مثال: تسلّم الجائزة في الحلقة بعد صلاة العصر، مخصصة للمتفوقين..."
                  className="w-full bg-black/40 border border-white/15 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-2xl font-black text-sm text-slate-950 border-2 border-b-4 transition-all shadow-lg active:translate-y-1 active:border-b-0 hover:brightness-105 disabled:opacity-50"
                  style={{
                    backgroundColor: accentColor,
                    borderColor: '#b45309',
                    borderBottomColor: '#78350f'
                  }}
                >
                  {isSaving ? (
                    <span>جاري الحفظ...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                      <span>{editingItem ? 'حفظ التعديلات' : 'نشر الجائزة في المتجر'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
