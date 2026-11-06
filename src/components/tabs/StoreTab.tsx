import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingBag,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
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
  GraduationCap,
  Sparkles,
  Zap,
  Award,
  Gift,
  RotateCcw,
  AlertTriangle,
  Loader2,
  PackageX,
  Ban
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
import {
  formatDateTimeArabicWithSeconds,
  toLocalDatetimeInputValue,
  parseStoreDateMs,
  getItemScheduleStatus
} from '../../lib/storeTimeUtils';
import { CountdownTimer } from '../CountdownTimer';

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

  // Complex Theme Colors
  const primaryColor = complexTheme?.primaryColor || '#022c22';
  const secondaryColor = complexTheme?.secondaryColor || '#064e3b';
  const accentColor = complexTheme?.accentColor || '#fbbf24';
  const surfaceColor = complexTheme?.surfaceColor || '#064e3b';
  const cardColor = complexTheme?.cardColor || '#0f3a2f';

  // Live Real-Time Data from Firestore
  const [items, setItems] = useState<StoreItem[]>([]);
  const [purchases, setPurchases] = useState<StorePurchase[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [purchasesSearch, setPurchasesSearch] = useState('');
  const [itemsFilter, setItemsFilter] = useState<'available' | 'all'>('all');

  // Track previous item quantities to trigger the "-1" Duolingo badge animation & vanish/reappear on sell-out
  const prevQuantitiesRef = useRef<Map<string, number>>(new Map());
  const [animatedMinusOneItemIds, setAnimatedMinusOneItemIds] = useState<Set<string>>(new Set());
  const [temporarilyHiddenSoldOutIds, setTemporarilyHiddenSoldOutIds] = useState<Set<string>>(new Set());

  // High-precision synchronized clock ticker (updates every 250ms for sub-second synchronization)
  const [syncedCurrentTime, setSyncedCurrentTime] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setSyncedCurrentTime(Date.now());
    }, 250);
    return () => clearInterval(timer);
  }, []);

  // Track previous expired states to trigger vanish-then-reappear animation when scheduled time ends
  const prevExpiredItemMapRef = useRef<Map<string, boolean>>(new Map());

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

  // Quick Time Extension Modal state
  const [extendingItem, setExtendingItem] = useState<StoreItem | null>(null);
  const [extensionPreset, setExtensionPreset] = useState<number | 'forever' | 'custom'>(24);
  const [customExtensionDatetime, setCustomExtensionDatetime] = useState<string>('');
  const [isExtendingTime, setIsExtendingTime] = useState(false);

  // In-App Duolingo 3D Confirmation Modal (replaces browser confirm() which is blocked in iframes)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    details?: string[];
    confirmText: string;
    cancelText?: string;
    variant: 'danger' | 'warning' | 'primary';
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    variant: 'danger',
    onConfirm: () => {}
  });
  const [isExecutingAction, setIsExecutingAction] = useState(false);

  // Real-Time Firestore Subscriptions
  useEffect(() => {
    setLoading(true);

    const unsubItems = OmranDataService.subscribeStoreItems((liveItems) => {
      // Detect quantity decreases for the "-1" animation badge and sold-out vanish/reappear transition
      const prevMap = prevQuantitiesRef.current;
      const decrementedIds: string[] = [];
      const newlySoldOutIds: string[] = [];

      liveItems.forEach(item => {
        const prevQty = prevMap.get(item.id);
        const currQty = item.quantity || 0;
        if (prevQty !== undefined && currQty < prevQty) {
          decrementedIds.push(item.id);
        }
        // Detect transition to sold out: item was previously in stock (> 0) and now reaches 0
        if (prevQty !== undefined && prevQty > 0 && currQty <= 0) {
          newlySoldOutIds.push(item.id);
        }
        prevMap.set(item.id, currQty);
      });

      if (decrementedIds.length > 0) {
        setAnimatedMinusOneItemIds(prev => {
          const next = new Set(prev);
          decrementedIds.forEach(id => next.add(id));
          return next;
        });

        // Clear "-1" animation badge after 2.5 seconds
        setTimeout(() => {
          setAnimatedMinusOneItemIds(prev => {
            const next = new Set(prev);
            decrementedIds.forEach(id => next.delete(id));
            return next;
          });
        }, 2500);
      }

      // If an item just ran out of stock, it vanishes briefly from view, then pops back in anew in gray "منتهي" state!
      if (newlySoldOutIds.length > 0) {
        setTemporarilyHiddenSoldOutIds(prev => {
          const next = new Set(prev);
          newlySoldOutIds.forEach(id => next.add(id));
          return next;
        });

        setTimeout(() => {
          setTemporarilyHiddenSoldOutIds(prev => {
            const next = new Set(prev);
            newlySoldOutIds.forEach(id => next.delete(id));
            return next;
          });
        }, 550);
      }

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

  // Real-Time Time Expiration Detection:
  // When an item's scheduled end time arrives, it momentarily vanishes and reappears in the gray "انتهى وقت المنتج" state
  useEffect(() => {
    const newlyExpiredIds: string[] = [];
    items.forEach(item => {
      if (!item.endsAt) return;
      const endsMs = parseStoreDateMs(item.endsAt);
      if (!endsMs) return;
      const isNowExpired = syncedCurrentTime >= endsMs;
      const wasExpired = prevExpiredItemMapRef.current.get(item.id);

      if (wasExpired === false && isNowExpired) {
        newlyExpiredIds.push(item.id);
      }
      prevExpiredItemMapRef.current.set(item.id, isNowExpired);
    });

    if (newlyExpiredIds.length > 0) {
      setTemporarilyHiddenSoldOutIds(prev => {
        const next = new Set(prev);
        newlyExpiredIds.forEach(id => next.add(id));
        return next;
      });

      setTimeout(() => {
        setTemporarilyHiddenSoldOutIds(prev => {
          const next = new Set(prev);
          newlyExpiredIds.forEach(id => next.delete(id));
          return next;
        });
      }, 550);
    }
  }, [items, syncedCurrentTime]);

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

  // Open modal for editing existing item - smoothly without vanishing or hanging
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
      startsAt: item.startsAt ? toLocalDatetimeInputValue(item.startsAt) : '',
      isForever: !item.endsAt,
      endsAt: item.endsAt ? toLocalDatetimeInputValue(item.endsAt) : ''
    });
    setIsModalOpen(true);
  };

  // Cancel edit modal
  const handleCancelModal = () => {
    setEditingItem(null);
    setIsModalOpen(false);
  };

  // Confirm and execute time extension with instant Firestore synchronization
  const handleConfirmTimeExtension = async () => {
    if (!extendingItem || !canManage) return;
    setIsExtendingTime(true);
    try {
      const nowMs = Date.now();
      let newEndsAt: string | undefined = undefined;
      let isForever = false;

      if (extensionPreset === 'forever') {
        isForever = true;
        newEndsAt = undefined;
      } else if (extensionPreset === 'custom') {
        if (!customExtensionDatetime) {
          showNotice('يرجى تحديد تاريخ ووقت الانتهاء الجديد');
          setIsExtendingTime(false);
          return;
        }
        newEndsAt = new Date(customExtensionDatetime).toISOString();
        isForever = false;
      } else {
        // Base from either current endsAt (if still in the future) or from nowMs (if already expired)
        const currentEndsMs = parseStoreDateMs(extendingItem.endsAt);
        const baseMs = (currentEndsMs && currentEndsMs > nowMs) ? currentEndsMs : nowMs;
        const extendedMs = baseMs + Number(extensionPreset) * 60 * 60 * 1000;
        newEndsAt = new Date(extendedMs).toISOString();
        isForever = false;
      }

      const updatedItem: StoreItem = {
        ...extendingItem,
        endsAt: newEndsAt,
        isForever,
        isUnderEdit: false,
        updatedAt: new Date().toISOString()
      };

      await OmranDataService.saveStoreItem(updatedItem);
      setExtendingItem(null);
      showNotice(
        isForever
          ? `تم تمديد وقت "${extendingItem.name}" ليصبح دائماً وتحديثه عند الجميع بالتزامن بنجاح ✓`
          : `تم تمديد وقت "${extendingItem.name}" وتحديثه عند الجميع بالتزامن بنجاح ✓`
      );
    } catch {
      showNotice('حدث خطأ أثناء تمديد وقت المنتج');
    } finally {
      setIsExtendingTime(false);
    }
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

  // Save Store Item (Add or Edit)
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    if (!formData.name.trim()) {
      showNotice('يرجى كتابة أسم المشترى');
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
        isUnderEdit: false, // Ensure visibility restores upon save
        description: formData.description.trim() || undefined,
        createdAt: editingItem?.createdAt || nowIso,
        updatedAt: nowIso,
        createdBy: currentTeacher?.name || 'المشرف'
      };

      await OmranDataService.saveStoreItem(itemToSave);
      setIsModalOpen(false);
      setEditingItem(null);
      showNotice(
        editingItem
          ? 'تم حفظ التعديل وإعادة ظهور الجائزة مباشرة عند الطلاب'
          : 'تمت إضافة المشترى ونشره مباشرة في قسم المشتريات'
      );
    } catch {
      showNotice('حدث خطأ أثناء حفظ الجائزة');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Store Item
  const handleDeleteItem = (itemId: string, name: string) => {
    if (!canManage) return;
    setConfirmModal({
      isOpen: true,
      title: 'حذف الجائزة من المتجر',
      message: `هل أنت متأكد من حذف الجائزة "${name}" نهائياً من المتجر؟`,
      details: [
        'ستختفي الجائزة فوراً وبشكل متزامن من متجر الطلاب والمشرفين.',
        'لن يتمكن أي طالب من طلبها أو شراؤها بعد الآن.'
      ],
      confirmText: 'نعم، احذف الجائزة نهائياً',
      cancelText: 'تراجع',
      variant: 'danger',
      onConfirm: async () => {
        setIsExecutingAction(true);
        try {
          setItems(prev => prev.filter(i => i.id !== itemId));
          await OmranDataService.deleteStoreItem(itemId);
          showNotice(`تم حذف الجائزة "${name}" واختفاؤها من المتجر بنجاح`);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch {
          showNotice('حدث خطأ أثناء حذف الجائزة');
        } finally {
          setIsExecutingAction(false);
        }
      }
    });
  };

  // Mark purchase as delivered with instant optimistic sync
  const handleMarkDelivered = async (purchaseId: string, itemName: string, studentName: string) => {
    if (!canManage) return;
    const nowIso = new Date().toISOString();
    const deliverer = currentTeacher?.name || 'المشرف';

    // Instant optimistic update for the supervisor UI
    setPurchases(prev =>
      prev.map(p =>
        p.id === purchaseId
          ? { ...p, status: 'delivered', deliveredAt: nowIso, deliveredBy: deliverer }
          : p
      )
    );

    try {
      await OmranDataService.markStorePurchaseDelivered(purchaseId, deliverer);
      showNotice(`تم تأكيد تسليم جائزة "${itemName}" للطالب ${studentName} بنجاح`);
    } catch {
      showNotice('حدث خطأ أثناء تحديث حالة التسليم');
    }
  };

  // Refund purchase (استرجاع المشترى وإعادة النقاط واستعادة المنتج في المتجر)
  const handleRefundPurchase = (purchase: StorePurchase) => {
    if (!canManage) return;
    setConfirmModal({
      isOpen: true,
      title: 'تأكيد استرجاع المشترى',
      message: `هل أنت متأكد من استرجاع جائزة "${purchase.itemName}" المشتراة للطالب "${purchase.studentName}"؟`,
      details: [
        `سيتم إعادة (${toArabicDigits(purchase.pointsCost)}) نقطة كاملة إلى رصيد الطالب "${purchase.studentName}".`,
        `سيتم إرجاع المنتج "${purchase.itemName}" (+1) للمتجر تلقائياً ليصبح متاحاً للطلاب فوراً.`,
        `تحديث حالة المشترى إلى "تم الاسترجاع" وإظهاره فوراً عند الجميع بالتزامن.`
      ],
      confirmText: 'نعم، استرجاع المشترى وإعادة النقاط',
      cancelText: 'تراجع',
      variant: 'warning',
      onConfirm: async () => {
        setIsExecutingAction(true);
        try {
          // Instant optimistic local update
          setPurchases(prev =>
            prev.map(p =>
              p.id === purchase.id
                ? {
                    ...p,
                    status: 'refunded',
                    refundedAt: new Date().toISOString(),
                    refundedBy: currentTeacher?.name || 'المشرف',
                    refundRole: 'supervisor'
                  }
                : p
            )
          );
          setItems(prev =>
            prev.map(i =>
              i.id === purchase.itemId ? { ...i, quantity: (i.quantity || 0) + 1 } : i
            )
          );

          const res = await OmranDataService.refundStorePurchase({
            purchaseId: purchase.id,
            refundedBy: currentTeacher?.name || 'المشرف',
            role: 'supervisor'
          });
          showNotice(res.message);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch {
          showNotice('حدث خطأ أثناء استرجاع المشترى');
        } finally {
          setIsExecutingAction(false);
        }
      }
    });
  };

  // Delete purchase record (حذف سجل الشراء نهائياً)
  const handleDeletePurchase = (purchaseId: string, itemName: string, studentName: string) => {
    if (!canManage) return;
    setConfirmModal({
      isOpen: true,
      title: 'حذف سجل الشراء نهائياً',
      message: `هل أنت متأكد من حذف سجل شراء "${itemName}" للطالب "${studentName}" نهائياً من القائمة؟`,
      details: [
        'سيتم حذف هذا السجل نهائياً واختفاؤه من قائمة "تم شراؤه" عند الجميع.',
        'ملاحظة هامة: هذا الإجراء يحذف السجل فقط ولا يقوم بإرجاع النقاط (إذا أردت إعادة النقاط استخدم زر "استرجاع").'
      ],
      confirmText: 'نعم، احذف السجل نهائياً',
      cancelText: 'إلغاء',
      variant: 'danger',
      onConfirm: async () => {
        setIsExecutingAction(true);
        try {
          // Instant optimistic remove
          setPurchases(prev => prev.filter(p => p.id !== purchaseId));
          await OmranDataService.deleteStorePurchase(purchaseId);
          showNotice(`تم حذف سجل الشراء واختفاؤه بنجاح`);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch {
          showNotice('حدث خطأ أثناء حذف سجل الشراء');
        } finally {
          setIsExecutingAction(false);
        }
      }
    });
  };

  // Filtered displayed items: Available (in-stock and active) vs All (with momentary vanish on sell-out / expiration)
  const displayedItems = useMemo(() => {
    let list = items;
    if (itemsFilter === 'available') {
      list = list.filter(i => {
        const status = getItemScheduleStatus(i, syncedCurrentTime);
        return status.canPurchase;
      });
    }
    return list.filter(i => !temporarilyHiddenSoldOutIds.has(i.id));
  }, [items, itemsFilter, temporarilyHiddenSoldOutIds, syncedCurrentTime]);

  // Filter purchases by search query
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
      <AnimatePresence>
        {actionNotice && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 left-6 z-50 bg-slate-900/95 text-white border-2 border-emerald-500/80 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md"
          >
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0 animate-spin" />
            <span className="font-bold text-sm">{actionNotice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Banner (Duolingo 3D Styling with complex theme colors) */}
      <div
        className="rounded-3xl p-6 sm:p-8 border-2 border-b-[6px] shadow-2xl transition-all relative overflow-hidden"
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
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  مزامنة لحظية مباشرة
                </span>
              </div>
              <p className="text-slate-300 text-sm sm:text-base mt-1.5 leading-relaxed font-bold">
                تحفيز طلاب الحلقات واستبدال نقاط التسميع والاختبارات بجوائز وهدايا عينية قيمة ومباشرة
              </p>
            </div>
          </div>

          {/* Right Controls: Store Switch & Add Item Button */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Store Status Toggle */}
            {canManage ? (
              <button
                type="button"
                onClick={handleToggleStoreStatus}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm border-2 border-b-4 transition-all shadow-md active:translate-y-1 active:border-b-0 cursor-pointer ${
                  settings.isOpen
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-800'
                    : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-800'
                }`}
                title={settings.isOpen ? 'المتجر متاح للطلاب - اضغط للإغلاق' : 'المتجر مغلق حالياً - اضغط للفتح'}
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
                <span>{settings.isOpen ? 'المتجر مفتوح للطلاب' : 'المتجر مغلق بأمر المشرف'}</span>
              </div>
            )}

            {/* Add New Item Button (Supervisor/Developer only) - Duolingo 3D Button */}
            {canManage && (
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-sm text-slate-950 border-2 border-b-4 transition-all shadow-lg active:translate-y-1 active:border-b-0 hover:brightness-105 cursor-pointer"
                style={{
                  backgroundColor: accentColor,
                  borderColor: '#b45309',
                  borderBottomColor: '#78350f'
                }}
              >
                <Plus className="w-5 h-5 stroke-[3]" />
                <span>إضافة مشترى</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-black/20 rounded-2xl p-3 border border-white/5">
            <span className="text-xs text-slate-400 block font-bold">الجوائز المعروضة</span>
            <span className="text-xl sm:text-2xl font-black text-white font-mono">
              {toArabicDigits(items.filter(i => (i.quantity || 0) > 0).length)}
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
      {/* SECTION 1: قسم المشتريات (Available Store Items) */}
      {/* ==================================================================== */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Package className="w-6 h-6 text-amber-400" />
            <h2 className="text-xl sm:text-2xl font-black text-white font-heading">
              قسم المشتريات
            </h2>
            <span className="bg-white/10 text-slate-300 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold">
              {toArabicDigits(displayedItems.length)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Toggle for Supervisor */}
            {canManage && items.some(i => (i.quantity || 0) === 0) && (
              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-2xl border border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => setItemsFilter('available')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                    itemsFilter === 'available'
                      ? 'bg-amber-400 text-slate-950 font-black shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  المتوفر فقط ({toArabicDigits(items.filter(i => (i.quantity || 0) > 0).length)})
                </button>
                <button
                  type="button"
                  onClick={() => setItemsFilter('all')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                    itemsFilter === 'all'
                      ? 'bg-amber-400 text-slate-950 font-black shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  الكل بما فيها المنتهية ({toArabicDigits(items.length)})
                </button>
              </div>
            )}

            {!canManage && (
              <span className="text-xs text-slate-300 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1 font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                وضع المشاهدة للمعلم (التعديل مخصص للمشرف فقط)
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 bg-white/5 rounded-3xl border-2 border-white/5 animate-pulse font-bold">
            جاري مزامنة معروضات المتجر القرآني لحظياً...
          </div>
        ) : displayedItems.length === 0 ? (
          /* Empty state for Purchases Section as requested by user */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl p-10 sm:p-14 text-center border-2 border-dashed border-white/15 transition-all shadow-inner"
            style={{ backgroundColor: `${cardColor}60` }}
          >
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/10">
              <ShoppingBag className="w-10 h-10 text-slate-500" />
            </div>
            <h3 className="text-xl font-black text-white mb-2 font-heading">قسم المشتريات فارغ حالياً</h3>
            <p className="text-slate-400 text-xs sm:text-sm max-w-md mx-auto mb-6 leading-relaxed">
              لا توجد أي معروضات أو جوائز في المتجر حالياً. بادر بالضغط على "إضافة مشترى" أعلاه لإضافة جوائز وهدايا لتحفيز الطلاب على الحفظ والمنافسة!
            </p>
            {canManage && (
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm text-slate-950 border-2 border-b-4 transition-all shadow-lg active:translate-y-1 active:border-b-0 hover:brightness-105 cursor-pointer"
                style={{
                  backgroundColor: accentColor,
                  borderColor: '#b45309',
                  borderBottomColor: '#78350f'
                }}
              >
                <Plus className="w-5 h-5 stroke-[3]" />
                <span>إضافة مشترى الآن</span>
              </button>
            )}
          </motion.div>
        ) : (
          /* Items Grid with Duolingo animations */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            <AnimatePresence>
              {displayedItems.map(item => {
                const status = getItemScheduleStatus(item, syncedCurrentTime);
                const isAvailable = status.canPurchase;
                const isSoldOut = status.isSoldOut;
                const isTimeExpired = status.isTimeExpired;
                const isUpcoming = status.isUpcoming;
                const isInactive = isSoldOut || isTimeExpired;
                const hasStart = Boolean(item.startsAt);
                const hasEnd = Boolean(item.endsAt);
                const showMinusOne = animatedMinusOneItemIds.has(item.id);

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.85, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.75, y: -20, filter: 'blur(3px)' }}
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                    className={`rounded-3xl border-2 border-b-[5px] overflow-hidden transition-all duration-200 flex flex-col justify-between shadow-lg group relative ${
                      isInactive
                        ? 'bg-slate-900/90 border-slate-700/80 border-b-slate-800 shadow-slate-950/50'
                        : isUpcoming
                          ? 'bg-sky-950/40 border-sky-500/40 border-b-sky-600'
                          : 'hover:shadow-2xl hover:-translate-y-1'
                    }`}
                    style={{
                      backgroundColor: isInactive ? '#141923' : isUpcoming ? '#0c1a2e' : cardColor,
                      borderColor: isInactive ? '#334155' : isUpcoming ? '#0284c7' : `${accentColor}35`,
                      borderBottomColor: isInactive ? '#1e293b' : isUpcoming ? '#0369a1' : accentColor
                    }}
                  >
                    {/* Item Image with Badges */}
                    <div className="relative aspect-video sm:aspect-square w-full bg-black/40 overflow-hidden flex items-center justify-center">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className={`w-full h-full object-cover transition-transform duration-300 ${
                            isInactive ? 'grayscale contrast-90 opacity-60' : 'group-hover:scale-105'
                          }`}
                        />
                      ) : (
                        <div className={`w-full h-full flex flex-col items-center justify-center ${isInactive ? 'text-slate-600 bg-slate-950/40' : 'text-slate-500 bg-gradient-to-b from-white/5 to-transparent'}`}>
                          <ShoppingBag className="w-16 h-16 opacity-40 mb-2" />
                          <span className="text-xs font-bold text-slate-400">جائزة قرآنية</span>
                        </div>
                      )}

                      {/* Centered Duolingo 3D Overlay Badge for Inactive or Upcoming State */}
                      {isTimeExpired ? (
                        <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[1px] flex items-center justify-center p-3 z-20 pointer-events-none">
                          <div className="px-5 py-2.5 rounded-2xl bg-slate-800/95 border-2 border-b-4 border-slate-600 shadow-2xl flex items-center gap-2 transform -rotate-2 text-amber-300 select-none">
                            <Clock className="w-5 h-5 text-amber-400 stroke-[2.5]" />
                            <span className="font-black text-sm tracking-wide">انتهى وقت المنتج</span>
                          </div>
                        </div>
                      ) : isSoldOut ? (
                        <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[1px] flex items-center justify-center p-3 z-20 pointer-events-none">
                          <div className="px-5 py-2.5 rounded-2xl bg-slate-800/95 border-2 border-b-4 border-slate-600 shadow-2xl flex items-center gap-2 transform -rotate-2 text-slate-200 select-none">
                            <PackageX className="w-5 h-5 text-slate-300 stroke-[2.5]" />
                            <span className="font-black text-sm tracking-wide">منتهي</span>
                          </div>
                        </div>
                      ) : isUpcoming ? (
                        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1px] flex items-center justify-center p-3 z-20 pointer-events-none">
                          <div className="px-4 py-2 rounded-2xl bg-sky-950/90 border-2 border-b-4 border-sky-600 shadow-2xl flex items-center gap-2 text-sky-200 select-none">
                            <Clock className="w-4 h-4 text-sky-400 animate-spin" />
                            <span className="font-black text-xs">قيد الانتظار حتى موعد الظهور</span>
                          </div>
                        </div>
                      ) : null}

                      {/* Points Badge (Top Right) - Duolingo 3D style */}
                      <div
                        className={`absolute top-3 right-3 px-3 py-1.5 rounded-xl font-black text-xs sm:text-sm font-mono flex items-center gap-1.5 shadow-md border-2 border-b-2 z-10 ${
                          isInactive ? 'bg-slate-800/90 border-slate-700 text-slate-400' : ''
                        }`}
                        style={
                          !isInactive
                            ? {
                                backgroundColor: '#78350f',
                                borderColor: accentColor,
                                color: accentColor
                              }
                            : undefined
                        }
                      >
                        <Coins className={`w-4 h-4 ${isInactive ? 'text-slate-500' : 'text-amber-300'}`} />
                        <span>{toArabicDigits(item.pointsRequired)} نقطة</span>
                      </div>

                      {/* Stock Quantity / Status Badge (Top Left) */}
                      <div className="absolute top-3 left-3 z-10 flex items-center">
                        <div
                          className={`px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1 shadow-md border ${
                            isTimeExpired
                              ? 'bg-slate-800/95 text-amber-300 border-slate-600 border-b-2'
                              : isSoldOut
                                ? 'bg-slate-800/95 text-slate-300 border-slate-600 border-b-2'
                                : isUpcoming
                                  ? 'bg-sky-900/95 text-sky-200 border-sky-600 border-b-2'
                                  : (item.quantity || 0) <= 2
                                    ? 'bg-amber-600/90 text-white border-amber-400'
                                    : 'bg-emerald-600/90 text-white border-emerald-400'
                          }`}
                        >
                          {isTimeExpired ? (
                            <>
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              <span>انتهى وقت المنتج</span>
                            </>
                          ) : isSoldOut ? (
                            <>
                              <PackageX className="w-3.5 h-3.5 text-slate-400" />
                              <span>منتهي</span>
                            </>
                          ) : isUpcoming ? (
                            <>
                              <Clock className="w-3.5 h-3.5 text-sky-400" />
                              <span>قيد الانتظار (Pending)</span>
                            </>
                          ) : (
                            <>
                              <Package className="w-3.5 h-3.5" />
                              <span>المتبقي: {toArabicDigits(item.quantity)}</span>
                            </>
                          )}
                        </div>

                        {/* Floating "-1" Duolingo animated badge when a purchase occurs */}
                        <AnimatePresence>
                          {showMinusOne && (
                            <motion.span
                              initial={{ opacity: 0, scale: 0.5, y: 0 }}
                              animate={{ opacity: 1, scale: 1.25, y: -26 }}
                              exit={{ opacity: 0, scale: 0.8, y: -40 }}
                              transition={{ duration: 0.8, ease: 'easeOut' }}
                              className="absolute -top-3 left-0 bg-emerald-400 text-slate-950 font-black text-xs px-2 py-0.5 rounded-full border-2 border-white shadow-xl pointer-events-none"
                            >
                              -١
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Floating Live Countdown Badge on Image */}
                      {isUpcoming && item.startsAt ? (
                        <div className="absolute bottom-2.5 right-2.5 z-10">
                          <CountdownTimer
                            targetDate={item.startsAt}
                            mode="appearance"
                            variant="compact"
                            accentColor={accentColor}
                            showSyncBadge={false}
                          />
                        </div>
                      ) : !isInactive && item.endsAt ? (
                        <div className="absolute bottom-2.5 right-2.5 z-10">
                          <CountdownTimer
                            targetDate={item.endsAt}
                            mode="expiration"
                            variant="compact"
                            accentColor={accentColor}
                            showSyncBadge={false}
                          />
                        </div>
                      ) : null}
                    </div>

                    {/* Item Content */}
                    <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <h3 className={`font-black text-base sm:text-lg leading-snug line-clamp-2 ${
                          isInactive ? 'text-slate-300' : 'text-white'
                        }`}>
                          {item.name}
                        </h3>
                        {item.description && (
                          <p className="text-slate-400 text-xs mt-1.5 line-clamp-2 leading-relaxed font-normal">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Status notice banner */}
                      {isUpcoming ? (
                        <div className="w-full py-2 px-3 rounded-2xl font-black text-xs text-sky-200 bg-sky-950/80 border-2 border-b-4 border-sky-600 flex items-center justify-between gap-2 select-none shadow-sm">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-sky-400 stroke-[2.5]" />
                            <span>حالة المنتج: قيد الانتظار (Pending)</span>
                          </div>
                          <span className="text-[10px] text-sky-300 font-mono">لم يحن وقت الظهور بعد</span>
                        </div>
                      ) : isTimeExpired ? (
                        <div className="w-full py-2 px-3 rounded-2xl font-black text-xs text-amber-200 bg-amber-950/80 border-2 border-b-4 border-amber-600 flex items-center justify-between gap-2 select-none shadow-sm">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-400 stroke-[2.5]" />
                            <span>المنتج انتهى وقته (Expired)</span>
                          </div>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => {
                                setExtendingItem(item);
                                setExtensionPreset(24);
                                setCustomExtensionDatetime(
                                  toLocalDatetimeInputValue(item.endsAt || new Date(Date.now() + 86400000).toISOString())
                                );
                              }}
                              className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black transition-all cursor-pointer shadow-xs active:scale-95"
                            >
                              تمديد الوقت
                            </button>
                          )}
                        </div>
                      ) : isSoldOut ? (
                        <div className="w-full py-2 px-3 rounded-2xl font-black text-xs text-slate-300 bg-slate-800/90 border-2 border-b-4 border-slate-700 flex items-center justify-center gap-2 select-none">
                          <Ban className="w-3.5 h-3.5 text-slate-400 stroke-[2.5]" />
                          <span>منتهي (نفدت الكمية)</span>
                        </div>
                      ) : null}

                      {/* Live Synchronized Countdown Timer (for appearance or expiration) */}
                      {isUpcoming && item.startsAt ? (
                        <div className="pt-0.5">
                          <CountdownTimer
                            targetDate={item.startsAt}
                            mode="appearance"
                            variant="card"
                            accentColor={accentColor}
                            showSyncBadge={false}
                          />
                        </div>
                      ) : !isInactive && item.endsAt ? (
                        <div className="pt-0.5">
                          <CountdownTimer
                            targetDate={item.endsAt}
                            mode="expiration"
                            variant="card"
                            accentColor={accentColor}
                            showSyncBadge={false}
                          />
                        </div>
                      ) : null}

                      {/* Timing Badges: Explicit display of Start Time and Expiration Time for supervisor */}
                      {(hasStart || hasEnd) && (
                        <div className="text-[11px] text-slate-300 space-y-2 bg-black/40 p-3 rounded-2xl border border-white/10 font-bold">
                          {hasStart && (
                            <div className="flex items-center justify-between gap-1.5 flex-wrap">
                              <span className="flex items-center gap-1.5 text-sky-300 font-black">
                                <Clock className="w-3.5 h-3.5 text-sky-400" />
                                <span>وقت الظهور التلقائي (البداية):</span>
                              </span>
                              <span className="text-white font-mono bg-sky-950/80 px-2.5 py-1 rounded-xl border border-sky-500/30 text-[10px] sm:text-[11px] font-black">
                                {formatDateTimeArabicWithSeconds(item.startsAt).full}
                              </span>
                            </div>
                          )}
                          {hasEnd && (
                            <div className="flex items-center justify-between gap-1.5 flex-wrap">
                              <span className={`flex items-center gap-1.5 font-black ${isTimeExpired ? 'text-rose-400' : 'text-amber-300'}`}>
                                <Calendar className={`w-3.5 h-3.5 ${isTimeExpired ? 'text-rose-400' : 'text-amber-400'}`} />
                                <span>وقت الانتهاء للمشرف:</span>
                              </span>
                              <div className="flex items-center gap-1.5">
                                {isTimeExpired && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-black">
                                    انتهى وقته
                                  </span>
                                )}
                                <span className={`font-mono px-2.5 py-1 rounded-xl border text-[10px] sm:text-[11px] font-black ${
                                  isTimeExpired
                                    ? 'text-rose-200 bg-rose-950/80 border-rose-500/40'
                                    : 'text-white bg-amber-950/80 border-amber-500/30'
                                }`}>
                                  {formatDateTimeArabicWithSeconds(item.endsAt).full}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Supervisor Actions */}
                      {canManage && (
                        <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setExtendingItem(item);
                              setExtensionPreset(24);
                              setCustomExtensionDatetime(
                                toLocalDatetimeInputValue(item.endsAt || new Date(Date.now() + 86400000).toISOString())
                              );
                            }}
                            className="flex-1 flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs border border-amber-500/40 transition-all cursor-pointer shadow-xs active:scale-95"
                            title="تمديد وقت انتهاء المنتج فوراً"
                          >
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <span>تمديد الوقت</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            className="flex-1 flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/15 transition-all cursor-pointer active:scale-95"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-sky-300" />
                            <span>تعديل</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id, item.name)}
                            className="flex items-center justify-center p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-all cursor-pointer active:scale-95"
                            title="حذف الجائزة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* SECTION 2: قسم تم شراءه (Purchased Records / Audit Log) */}
      {/* ==================================================================== */}
      <div className="space-y-4 pt-4 border-t-2 border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <History className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl sm:text-2xl font-black text-white font-heading">
              قسم تم شراءه
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
          /* Empty state for Purchased section as requested by user */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl p-10 text-center border-2 border-dashed border-white/10 shadow-inner"
            style={{ backgroundColor: `${cardColor}40` }}
          >
            <History className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-60" />
            <h3 className="text-lg font-black text-white mb-1 font-heading">قسم تم شراءه فارغ حالياً</h3>
            <p className="text-slate-400 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
              لم يقم أي طالب بشراء جوائز بعد. بمجرد قيام الطلاب باستبدال نقاطهم، سيتم توثيق كل عملية هنا بدقة فائقة متناهية تشمل التاريخ، الساعة، الدقيقة، الثانية، وأجزاء الفيمتو ثانية.
            </p>
          </motion.div>
        ) : filteredPurchases.length === 0 ? (
          <div className="p-8 text-center text-slate-400 bg-white/5 rounded-3xl">
            لا توجد نتائج مطابقة لبحثك "{purchasesSearch}"
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filteredPurchases.map((purchase, idx) => (
                <motion.div
                  key={purchase.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="rounded-2xl p-4 sm:p-5 border-2 border-b-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:bg-white/[0.03] shadow-md relative"
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

                        {idx === 0 && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl text-[10px] font-black bg-amber-400/20 text-amber-300 border-2 border-b-2 border-amber-400/50 shadow-xs">
                            <Award className="w-3 h-3 text-amber-400" />
                            <span>أحدث عملية شراء</span>
                          </span>
                        )}
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

                  {/* Right Info: Status, Ultra-Precise Timestamp, and Actions */}
                  <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-start sm:items-center md:items-end lg:items-center gap-3 shrink-0">
                    {/* Status Badge (Duolingo 3D styling with theme colors) */}
                    <div className="flex items-center gap-2">
                      {purchase.status === 'delivered' ? (
                        <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border-2 border-b-3 border-emerald-500/60 text-xs font-black flex items-center gap-1.5 shadow-sm">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                          <span>تم تسليم الجائزة للطالب</span>
                        </span>
                      ) : purchase.status === 'refunded' ? (
                        <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border-2 border-b-3 border-amber-500/60 text-xs font-black flex items-center gap-1.5 shadow-sm">
                          <RotateCcw className="w-3.5 h-3.5 text-amber-400 stroke-[2.5]" />
                          <span>تم استرجاع المشترى</span>
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-xl bg-sky-500/20 text-sky-300 border-2 border-b-3 border-sky-500/60 text-xs font-black flex items-center gap-1.5 shadow-sm">
                          <Clock className="w-3.5 h-3.5 text-sky-400 stroke-[2.5]" />
                          <span>بانتظار التسليم للطالب</span>
                        </span>
                      )}
                    </div>

                    {/* Ultra-Precise Timestamp with femtoseconds */}
                    <div className="bg-black/30 px-3.5 py-2 rounded-xl border border-white/10 text-right md:text-left">
                      <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-black justify-end md:justify-start">
                        <Clock className="w-3 h-3 text-amber-300" />
                        <span>التوقيت الموثق فائق الدقة:</span>
                      </div>
                      <div className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-200 mt-0.5 dir-ltr text-left">
                        {purchase.preciseTimestampText || purchase.purchasedAt}
                      </div>
                      {purchase.preciseSubsecond && (
                        <div className="text-[9px] font-mono text-emerald-400 mt-0.5 dir-ltr text-left font-bold">
                          فيمتو ثانية: {purchase.preciseSubsecond}
                        </div>
                      )}
                    </div>

                    {/* Supervisor Actions (Duolingo 3D Buttons) */}
                    {canManage && (
                      <div className="flex items-center gap-2 flex-wrap pt-1 sm:pt-0">
                        {/* Mark Delivered Button */}
                        {purchase.status !== 'delivered' && purchase.status !== 'refunded' && (
                          <button
                            type="button"
                            onClick={() => handleMarkDelivered(purchase.id, purchase.itemName, purchase.studentName)}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:translate-y-1 active:border-b-0 text-white font-black text-xs border-2 border-b-4 border-emerald-800 transition-all flex items-center gap-1.5 shadow-md cursor-pointer hover:brightness-105"
                            title="تأكيد تسليم الجائزة للطالب"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>تأكيد التسليم</span>
                          </button>
                        )}

                        {/* Refund Button */}
                        {purchase.status !== 'refunded' && (
                          <button
                            type="button"
                            onClick={() => handleRefundPurchase(purchase)}
                            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:translate-y-1 active:border-b-0 text-slate-950 font-black text-xs border-2 border-b-4 border-amber-700 transition-all flex items-center gap-1.5 shadow-md cursor-pointer hover:brightness-105"
                            title="استرجاع المشترى وإعادة النقاط للطالب وإرجاع المنتج للمتجر"
                          >
                            <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>استرجاع النقاط</span>
                          </button>
                        )}

                        {/* Delete Record Button */}
                        <button
                          type="button"
                          onClick={() => handleDeletePurchase(purchase.id, purchase.itemName, purchase.studentName)}
                          className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:translate-y-1 active:border-b-0 text-white font-black text-xs border-2 border-b-4 border-rose-800 transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                          title="حذف هذا السجل نهائياً من المشتريات"
                        >
                          <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>حذف السجل</span>
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* MODAL: إضافة / تعديل مشترى في المتجر (Duolingo 3D Styling) */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-xl rounded-3xl p-6 sm:p-8 border-2 border-b-[6px] shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-6"
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
                    className="w-12 h-12 rounded-2xl flex items-center justify-center border-2 border-b-4 text-white shadow-md"
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
                      {editingItem ? 'تعديل مشترى / جائزة' : 'إضافة مشترى جديد'}
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5 font-bold">
                      يضاف ويتحدث مباشرة عند جميع طلاب المجمع القرآني
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancelModal}
                  className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveItem} className="space-y-5">
                {/* Item Name */}
                <div>
                  <label className="block text-xs font-black text-slate-200 mb-1.5">
                    أسم المشترى <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="اكتب أسم المشترى (مثال: مصحف المدينة الفاخر، ساعة الفجر، قسيمة شراء...)"
                    className="w-full bg-black/40 border border-white/15 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 font-bold"
                  />
                </div>

                {/* Item Image (Upload or URL) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-200">صورة المشترى</label>
                    <div className="flex items-center gap-1 bg-black/30 p-1 rounded-xl border border-white/10 text-xs">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, imageType: 'upload' }))}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                          formData.imageType === 'upload'
                            ? 'bg-amber-400 text-slate-950 font-black'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5 inline ml-1" />
                        رفع صورة
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, imageType: 'url' }))}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                          formData.imageType === 'url'
                            ? 'bg-amber-400 text-slate-950 font-black'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <LinkIcon className="w-3.5 h-3.5 inline ml-1" />
                        رابط صورة
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
                        className="w-full py-4 px-4 rounded-2xl border-2 border-dashed border-white/20 hover:border-amber-400 bg-black/20 text-center transition-all flex flex-col items-center justify-center gap-2 group cursor-pointer"
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
                      placeholder="https://example.com/reward.jpg"
                      className="w-full bg-black/40 border border-white/15 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 dir-ltr text-left"
                    />
                  )}

                  {/* Image Preview */}
                  {formData.imageUrl && (
                    <div className="relative w-32 h-32 rounded-2xl overflow-hidden border-2 border-amber-400/50 mx-auto mt-2 shadow-md">
                      <img
                        src={formData.imageUrl}
                        alt="معاينة الجائزة"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, imageUrl: '' })}
                        className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-1 shadow-md hover:bg-rose-500 cursor-pointer"
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
                      كم النقاط المطلوبة من الطالب <span className="text-rose-400">*</span>
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
                      العدد المتوفر (مثلاً ٥ أو ٣) <span className="text-rose-400">*</span>
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
                        <span className="text-white font-bold">تظهر الآن</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="startsAtChoice"
                          checked={!formData.isImmediate}
                          onChange={() => setFormData(prev => ({ ...prev, isImmediate: false }))}
                          className="text-amber-500"
                        />
                        <span className="text-white font-bold">موعد ظهور لاحق</span>
                      </label>
                    </div>
                  </div>
                  {!formData.isImmediate && (
                    <div className="space-y-1.5">
                      <input
                        type="datetime-local"
                        step="1"
                        value={formData.startsAt}
                        onChange={e => setFormData({ ...formData, startsAt: e.target.value })}
                        className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-amber-400 focus:outline-none"
                      />
                      {formData.startsAt && (
                        <div className="text-[11px] text-sky-300 font-bold flex items-center justify-between gap-2 bg-sky-950/60 p-2 rounded-xl border border-sky-500/30">
                          <span className="flex items-center gap-1 font-black">
                            <Clock className="w-3.5 h-3.5 text-sky-400" />
                            توقيت البداية المعتمد (بالثواني):
                          </span>
                          <span className="font-mono text-white">
                            {formatDateTimeArabicWithSeconds(formData.startsAt).full}
                          </span>
                        </div>
                      )}
                    </div>
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
                        <span className="text-white font-bold">تبقى للأبد (حتى نفادها)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="endsAtChoice"
                          checked={!formData.isForever}
                          onChange={() => setFormData(prev => ({ ...prev, isForever: false }))}
                          className="text-amber-500"
                        />
                        <span className="text-white font-bold">موعد نهاية محدد</span>
                      </label>
                    </div>
                  </div>
                  {!formData.isForever && (
                    <div className="space-y-1.5">
                      <input
                        type="datetime-local"
                        step="1"
                        value={formData.endsAt}
                        onChange={e => setFormData({ ...formData, endsAt: e.target.value })}
                        className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-amber-400 focus:outline-none"
                      />
                      {formData.endsAt && (
                        <div className="text-[11px] text-amber-300 font-bold flex items-center justify-between gap-2 bg-amber-950/60 p-2 rounded-xl border border-amber-500/30">
                          <span className="flex items-center gap-1 font-black">
                            <Calendar className="w-3.5 h-3.5 text-amber-400" />
                            توقيت النهاية المعتمد (بالثواني):
                          </span>
                          <span className="font-mono text-white">
                            {formatDateTimeArabicWithSeconds(formData.endsAt).full}
                          </span>
                        </div>
                      )}
                    </div>
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

                {/* Modal Buttons - Duolingo 3D Button "أضف" */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={handleCancelModal}
                    className="px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-2xl font-black text-sm text-slate-950 border-2 border-b-4 transition-all shadow-lg active:translate-y-1 active:border-b-0 hover:brightness-105 disabled:opacity-50 cursor-pointer"
                    style={{
                      backgroundColor: accentColor,
                      borderColor: '#b45309',
                      borderBottomColor: '#78350f'
                    }}
                  >
                    {isSaving ? (
                      <span>جاري الحفظ والمزامنة...</span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                        <span>{editingItem ? 'حفظ التعديل' : 'أضف'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* IN-APP MODAL: تأكيد الإجراءات (استرجاع / حذف) بثيم دولنجو وألوان المجمع */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-lg rounded-3xl p-6 sm:p-7 border-2 border-b-[6px] shadow-2xl relative space-y-5"
              style={{
                backgroundColor: surfaceColor,
                borderColor: confirmModal.variant === 'warning'
                  ? '#f59e0b'
                  : confirmModal.variant === 'danger'
                  ? '#f43f5e'
                  : accentColor,
                borderBottomColor: confirmModal.variant === 'warning'
                  ? '#b45309'
                  : confirmModal.variant === 'danger'
                  ? '#9f1239'
                  : '#b45309'
              }}
            >
              {/* Header */}
              <div className="flex items-start gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border-2 border-b-4 shadow-lg text-white"
                  style={{
                    backgroundColor: confirmModal.variant === 'warning'
                      ? '#b45309'
                      : confirmModal.variant === 'danger'
                      ? '#9f1239'
                      : primaryColor,
                    borderColor: confirmModal.variant === 'warning'
                      ? '#f59e0b'
                      : confirmModal.variant === 'danger'
                      ? '#f43f5e'
                      : accentColor,
                    borderBottomColor: '#00000040'
                  }}
                >
                  {confirmModal.variant === 'warning' ? (
                    <RotateCcw className="w-7 h-7 text-amber-300 animate-spin-slow" />
                  ) : confirmModal.variant === 'danger' ? (
                    <Trash2 className="w-7 h-7 text-rose-200" />
                  ) : (
                    <AlertTriangle className="w-7 h-7 text-amber-300" />
                  )}
                </div>

                <div className="space-y-1 flex-1">
                  <h3 className="text-xl font-black text-white font-heading">
                    {confirmModal.title}
                  </h3>
                  <p className="text-sm text-slate-200 font-bold leading-relaxed">
                    {confirmModal.message}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => !isExecutingAction && setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  disabled={isExecutingAction}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Bullet Details */}
              {confirmModal.details && confirmModal.details.length > 0 && (
                <div className="bg-black/35 rounded-2xl p-4 border border-white/10 space-y-2">
                  <div className="text-xs font-black text-amber-300 mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>ماذا سيحدث بعد التأكيد؟</span>
                  </div>
                  {confirmModal.details.map((detail, dIdx) => (
                    <div key={dIdx} className="flex items-start gap-2 text-xs font-bold text-slate-200">
                      <span className="text-emerald-400 font-black">•</span>
                      <span>{detail}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons with 3D Duolingo bounce */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  disabled={isExecutingAction}
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border-2 border-b-4 border-white/20 active:border-b-0 active:translate-y-1 transition-all cursor-pointer disabled:opacity-50"
                >
                  {confirmModal.cancelText || 'تراجع'}
                </button>

                <button
                  type="button"
                  disabled={isExecutingAction}
                  onClick={() => confirmModal.onConfirm()}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl font-black text-sm text-white border-2 border-b-4 transition-all shadow-lg active:translate-y-1 active:border-b-0 hover:brightness-105 disabled:opacity-50 cursor-pointer ${
                    confirmModal.variant === 'warning'
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-700'
                      : confirmModal.variant === 'danger'
                      ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-800'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-800'
                  }`}
                >
                  {isExecutingAction ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري التنفيذ والمزامنة...</span>
                    </>
                  ) : (
                    <>
                      {confirmModal.variant === 'warning' && <RotateCcw className="w-4 h-4 stroke-[2.5]" />}
                      {confirmModal.variant === 'danger' && <Trash2 className="w-4 h-4 stroke-[2.5]" />}
                      <span>{confirmModal.confirmText}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* MODAL: تمديد وقت انتهاء المنتج (Supervisor Quick Time Extension) */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {extendingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-lg rounded-3xl p-6 sm:p-7 border-2 border-b-[6px] shadow-2xl relative space-y-5"
              style={{
                backgroundColor: surfaceColor,
                borderColor: accentColor,
                borderBottomColor: '#b45309'
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center text-amber-400">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white font-heading">
                      تمديد وقت المنتج
                    </h3>
                    <p className="text-xs text-amber-300 font-bold truncate max-w-xs">
                      {extendingItem.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !isExtendingTime && setExtendingItem(null)}
                  disabled={isExtendingTime}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Current Status Info */}
              <div className="bg-black/40 rounded-2xl p-3.5 border border-white/10 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="font-bold">حالة المنتج الحالية:</span>
                  <span className="font-black text-white">
                    {extendingItem.endsAt && syncedCurrentTime >= (parseStoreDateMs(extendingItem.endsAt) || 0) ? (
                      <span className="text-rose-400">انتهى وقته (Expired)</span>
                    ) : (
                      <span className="text-emerald-400">نشط ومتاح</span>
                    )}
                  </span>
                </div>
                {extendingItem.endsAt && (
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="font-bold">وقت الانتهاء الحالي:</span>
                    <span className="font-mono text-amber-300 font-black">
                      {formatDateTimeArabicWithSeconds(extendingItem.endsAt).full}
                    </span>
                  </div>
                )}
              </div>

              {/* Presets Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-200">
                  اختر مدة التمديد السريعة:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: '+12 ساعة', value: 12 },
                    { label: '+24 ساعة (يوم)', value: 24 },
                    { label: '+3 أيام', value: 72 },
                    { label: '+أسبوع (7 أيام)', value: 168 }
                  ].map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setExtensionPreset(p.value)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-black border-2 transition-all cursor-pointer text-center ${
                        extensionPreset === p.value
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md scale-102'
                          : 'bg-black/30 hover:bg-black/50 text-slate-200 border-white/15'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setExtensionPreset('forever')}
                    className={`py-2 px-3 rounded-xl text-xs font-black border-2 transition-all cursor-pointer text-center ${
                      extensionPreset === 'forever'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
                        : 'bg-black/30 hover:bg-black/50 text-slate-200 border-white/15'
                    }`}
                  >
                    متاح بلا نهاية (دائم)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExtensionPreset('custom')}
                    className={`py-2 px-3 rounded-xl text-xs font-black border-2 transition-all cursor-pointer text-center ${
                      extensionPreset === 'custom'
                        ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-md'
                        : 'bg-black/30 hover:bg-black/50 text-slate-200 border-white/15'
                    }`}
                  >
                    تحديد تاريخ ووقت مخصص
                  </button>
                </div>
              </div>

              {/* Custom Date/Time input if selected */}
              {extensionPreset === 'custom' && (
                <div className="space-y-1.5 pt-1">
                  <label className="block text-xs font-black text-sky-300">
                    حدد تاريخ ووقت الانتهاء الجديد بالثانية:
                  </label>
                  <input
                    type="datetime-local"
                    step="1"
                    value={customExtensionDatetime}
                    onChange={e => setCustomExtensionDatetime(e.target.value)}
                    className="w-full bg-black/50 border border-sky-400/50 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-sky-400 font-mono"
                  />
                </div>
              )}

              {/* Real-time Notice */}
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>
                  يتم حفظ التمديد مباشرة في السيرفر ويحدث عند جميع الطلاب فوراً بالتزامن دون أي تعليق.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  disabled={isExtendingTime}
                  onClick={() => setExtendingItem(null)}
                  className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/15 cursor-pointer disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={isExtendingTime}
                  onClick={handleConfirmTimeExtension}
                  className="px-6 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs border-2 border-b-4 border-amber-700 active:border-b-0 active:translate-y-1 transition-all cursor-pointer shadow-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {isExtendingTime ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري التمديد والمزامنة...</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4" />
                      <span>حفظ وتمديد الوقت فوراً</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
