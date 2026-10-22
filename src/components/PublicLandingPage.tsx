import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Sparkles,
  ShieldCheck,
  Award,
  Users,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  HardDrive,
  ArrowLeft,
  Lock,
  ExternalLink,
  ChevronLeft,
  ChevronDown,
  GraduationCap,
  HeartHandshake,
  Layers,
  HelpCircle,
  Database,
  Languages,
  Trophy,
  Medal,
  Volume2,
  Play,
  RotateCcw,
  MessageCircle,
  Send,
  Printer,
  Sliders,
  Star,
  Flame,
  ShieldAlert,
  Building2,
  Headphones,
  Check,
  Palette,
  Video,
  UserPlus,
  BarChart3,
  Search,
  MapPin,
  QrCode,
  Clock,
  Zap,
  LayoutGrid,
  ListFilter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PublicLandingPageProps {
  onOpenLogin: () => void;
  onOpenPrivacyPolicy: () => void;
  onOpenParentPortal?: () => void;
  appName?: string;
}

interface LandingFeature {
  id: string;
  category: 'core' | 'teaching' | 'eval' | 'ai_meet' | 'admin' | 'family';
  title: string;
  icon: React.ElementType;
  tag: string;
  color: string;
  badge: string;
  headline: string;
  description: string;
  highlights: string[];
  previewSnippet?: {
    badgeText: string;
    subText: string;
    stat1: { label: string; val: string };
    stat2: { label: string; val: string };
  };
}

export const PublicLandingPage: React.FC<PublicLandingPageProps> = ({
  onOpenLogin,
  onOpenPrivacyPolicy,
  onOpenParentPortal,
  appName = 'منظومة عُمْرَان لإدارة الحلقات والمجمعات القرآنية'
}) => {
  const [showEnglishOverview, setShowEnglishOverview] = useState(false);
  const [activeFeatureTab, setActiveFeatureTab] = useState<number>(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [featureSearch, setFeatureSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'tabs' | 'grid'>('tabs');

  // Complete 17-Pillar Features Directory
  const featureTabs: LandingFeature[] = [
    {
      id: 'theme',
      category: 'admin',
      title: 'تخصيص الثيم والهوية البصرية',
      icon: Palette,
      tag: 'ألوان وهوية لكل مجمع',
      color: 'from-amber-400 to-amber-600',
      badge: 'تخصيص كامل 100%',
      headline: 'تخصيص متقدم للثيم والألوان والشعار والوضع الليلي لكل مجمع قرآني',
      description: 'تمنح المنظومة كل مجمع قرآني استقلالية بصرية كاملة عبر محرك ألوان ديناميكي يتيح اختيار اللون الأساسي، الثانوي، لون التمييز (Accent)، ولون البطاقات مع نمط داكن (Dark Theme) فائق الفخامة والراحة للعين أثناء الحلقات القرآنية في المساجد.',
      highlights: [
        'تخصيص فوري لألوان المنظومة الأربعة مع معاينة حية ومباشرة بدون الحاجة لإعادة تحميل الصفحة.',
        'وضع داكن فخم (Dark Theme) مصمم بعناية فائقة لراحة العين في إضاءة المساجد والحلقات القرآنية.',
        'إدراج وتخصيص شعار المجمع واسم الشيخ والمشرف ليظهر في كشوفات الحضور الرسمية والشهادات.',
        'مزامنة سحابية فورية للثيم بحيث يظهر موحداً لدى كافة معلمي وطلاب المجمع تلقائياً بمجرد اعتماده.'
      ],
      previewSnippet: {
        badgeText: 'هوية مجمع الفرقان لتحفيظ القرآن',
        subText: 'اللون التميزي: ذهبي إسلامي • نمط ليلي هادئ',
        stat1: { label: 'تخصيص الواجهة', val: 'شامل بالكامل' },
        stat2: { label: 'المزامنة السحابية', val: 'متزامنة لحظياً' }
      }
    },
    {
      id: 'complexes',
      category: 'admin',
      title: 'إدارة المجمعات والفصل السحابي',
      icon: Building2,
      tag: 'الهيكل التنظيمي والصلاحيات',
      color: 'from-amber-500 to-amber-600',
      badge: 'متعدد المجمعات',
      headline: 'إدارة مركزية مستقلة لكل مجمع قرآني مع صلاحيات متدرجة ودقيقة',
      description: 'توفر المنظومة بيئة تشغيل سحابية مرنة تعزل قواعد بيانات كل مجمع قرآني وتتيح إدارة الحلقات، توزيع الطلاب، وتعيين المعلمين والمشرفين بمرونة كاملة.',
      highlights: [
        'عزل أو دمج بيانات المجمعات القرآنية مع التبديل الفوري بنقرة واحدة للمشرف العام.',
        'ميزة الفصل السحابي لقواعد البيانات (Database Isolation) لربط كل مجمع بقاعدة بيانات Firebase مستقلة.',
        'مستويات صلاحيات دقيقة: المشرف العام، مشرف المجمع، معلم الحلقة، المعلم المساعد، ولي الأمر، والطالب.',
        'سجل شامل للمشرفين والمعلمين مع إمكانية ربط كل معلم بعدة مجمعات وحلقات بسهولة.'
      ],
      previewSnippet: {
        badgeText: 'نظام المجمعات المتعددة',
        subText: '٥ مجمعات نشطة • إدارة سحابية مركزية موحدة',
        stat1: { label: 'عزل قواعد البيانات', val: 'Firebase Independent' },
        stat2: { label: 'التبديل بين المجمعات', val: 'فوري بنقرة واحدة' }
      }
    },
    {
      id: 'online_halaqahs',
      category: 'ai_meet',
      title: 'الحلقات أونلاين عبر Google Meet',
      icon: Video,
      tag: 'فصول افتراضية وبث مباشر',
      color: 'from-blue-500 to-indigo-600',
      badge: 'Google Meet رسمي',
      headline: 'حلقات تحفيظ افتراضية متزامنة سحابياً مع Google Meet ومواعيد يومية محددة',
      description: 'منظومة فصول وقاعات افتراضية متزامنة في الوقت الحقيقي بين المشرف والمعلم والطلاب، تتيح الانضمام للاجتماع بنقرة زر وفق جدول مواعيد منظم وبث مباشر لحظي دون الحاجة لتحديث الصفحة.',
      highlights: [
        'مزامنة حية لروابط Google Meet المعتمدة وتحديثها في Firestore لجميع الأطراف فورياً.',
        'تحديد مواعيد الحلقات اليومية بوقت البداية والانتهاء وتحديد أيام الأسبوع النشطة بدقة.',
        'مؤشر البث المباشر (LIVE الآن) وعداد تنازلي يوضح الوقت المتبقي على بدء الحلقة للطلاب والمعلمين.',
        'صلاحية إنشاء وتعديل الحلقات متاحة للمشرف والمعلم والمبرمج مع حفظ الرابط المتزامن تلقائياً.'
      ],
      previewSnippet: {
        badgeText: 'حلقة الإتقان المسائية - Google Meet',
        subText: 'الموعد: ٥:٠٠ م - ٦:٣٠ م • رابط مباشر متزامن',
        stat1: { label: 'حالة البث', val: 'مباشر الآن (LIVE)' },
        stat2: { label: 'الحضور المتزامن', val: '١٨ طالباً' }
      }
    },
    {
      id: 'ai_assistant',
      category: 'ai_meet',
      title: 'المساعد القرآني والذكاء الاصطناعي',
      icon: Sparkles,
      tag: 'محرك Gemini 3.8 Flash',
      color: 'from-purple-500 to-pink-600',
      badge: 'ذكاء اصطناعي قرآني',
      headline: 'مساعد صوتي ونصي متطور يفهم العربية ويستخرج المتشابهات والتفاسير',
      description: 'أقوى نموذج ذكاء اصطناعي قرآني تفاعلي مسخر لخدمة كتاب الله وإدارة الحلقات بالصوت والنص وتقديم استعلامات ذكية فورية عن أي طالب وتوليد أسئلة وخطط علاجية.',
      highlights: [
        'استعلام ذكي فوري عن سجلات أي طالب وحضوره ودرجاته ونقاطه بالمحادثة الطبيعية باللغة العربية.',
        'استخراج دقيق لمتشابهات الآيات القرآنية ومواضعها والفروق اللفظية الدقيقة بين السور.',
        'تفسير الآيات، معاني غريب القرآن، وأسباب النزول الموثوقة لتغذية الطالب معرفياً أثناء الحلقة.',
        'توليد خطط دراسية وعلاجية مخصصة للطلاب المتعثرين وتوليد أسئلة اختبارات ذكية بنقرة زر.'
      ],
      previewSnippet: {
        badgeText: 'المساعد القرآني الذكي',
        subText: 'استعلام: كم عدد أوجه الحفظ للطالب عمر هذا الشهر؟',
        stat1: { label: 'زمن الاستجابة', val: '٠.٣ ثانية' },
        stat2: { label: 'الدقة اللغوية', val: 'فصحى متقنة' }
      }
    },
    {
      id: 'students',
      category: 'core',
      title: 'إدارة الطلاب وخطط الختم وQR',
      icon: Users,
      tag: 'شامل للطلاب والملفات',
      color: 'from-emerald-500 to-teal-600',
      badge: 'إدارة متكاملة',
      headline: 'ملفات تفاعلية للطلاب، استيراد إكسل جماعي، وخطط ختم قرآنية دقيقة',
      description: 'منظومة متقدمة لإدارة سجلات الطلاب، تصنيفهم حسب المستويات، وإصدار بطاقات باركود QR ذكية تحسب تاريخ الختم المستهدف تلقائياً وتوزيعهم بين الحلقات.',
      highlights: [
        'استيراد جماعي سريع (Bulk Import) للطلاب من ملفات Excel بضغطة زر واحدة وتوزيعهم على الحلقات.',
        'بطاقة رقمية تفاعلية لكل طالب تحتوي على رمز QR لمسحه واستعراض ملفه فوراً ومشاركة رابطه.',
        'تصنيف الطلاب لثلاثة مستويات علمية (قوي، متوسط، ضعيف) لمراعاة الفروق الفردية في المنهج.',
        'خطة ختم مخصصة تحسب تلقائياً موعد الختم المتوقع بناءً على معدل الحفظ اليومي ومتابعة الأوجه.'
      ],
      previewSnippet: {
        badgeText: 'ملف الطالب: عبد الرحمن السعيد',
        subText: 'المستوى: متقدم • الخطة: ختم القرآن خلال ١٤ شهراً',
        stat1: { label: 'الأوجه المنجزة', val: '٣٤٠ وجهاً' },
        stat2: { label: 'موعد الختم المتوقع', val: '١٥ رمضان القادم' }
      }
    },
    {
      id: 'attendance',
      category: 'teaching',
      title: 'التحضير الذكي والسياج الجغرافي (GPS)',
      icon: CheckCircle2,
      tag: 'باركود • GPS • Streaks',
      color: 'from-green-500 to-emerald-600',
      badge: 'انضباط فائق',
      headline: 'تسجيل حضور فوري، تحضير بالكاميرا، وسياج جغرافي للمسجد بنظام النقاط',
      description: 'أحدث نظام تحضير ذكي يدمج بين التحضير بضغطة زر، المسح السريع لرموز QR، وتقييد التحضير جغرافياً داخل حدود المسجد مع شعلات المواظبة ونقاط XP.',
      highlights: [
        'تسجيل الحضور لأربع حالات (حاضر، غائب، متأخر، معتذر) مع رصد وقت التسجيل الدقيق بالثواني.',
        'التحضير الذاتي بمسح رمز QR الخاص بالطالب عبر كاميرا الجوال في ثانية واحدة بدون لمس الشاشة.',
        'التحضير الجغرافي المقيد (Geofencing GPS) لمنع التحضير إلا من داخل حدود ونطاق المسجد المحدد.',
        'شعلات المواظبة اليومية (Daily Streaks) ونقاط XP لمكافأة الطلاب المنتظمين ورفع حماسهم.'
      ],
      previewSnippet: {
        badgeText: 'دفتر التحضير الذكي اليومي',
        subText: 'نسبة الحضور: ٩٨٪ • تم التحقق عبر نطاق GPS للمسجد',
        stat1: { label: 'طريقة التحضير', val: 'مسح QR بالكاميرا' },
        stat2: { label: 'أعلى شعلة مواظبة', val: '🔥 ٤٥ يوماً متواصلاً' }
      }
    },
    {
      id: 'recitation',
      category: 'teaching',
      title: 'سجل التسميع ومعايير التجويد',
      icon: BookOpen,
      tag: 'الحفظ والمراجعة وخطة الغد',
      color: 'from-amber-500 to-yellow-600',
      badge: 'تقييم ثلاثي معتمد',
      headline: 'رصد دقيق للحفظ الجديد والمراجعة الصغرى والكبرى مع أحكام التجويد',
      description: 'المنهجية القرآنية المعتمدة لترسيخ القرآن الكريم عبر تقسيم التسميع إلى حفظ جديد، مراجعة صغرى (أحدث ٥ أجزاء)، ومراجعة كبرى للمحفوظ القديم لمنع التفلت.',
      highlights: [
        'معايير تجويد دقيقة: مخارج الحروف، الغنة، أحكام المدود، الطلاقة والانطلاق، وإعراب الحركات.',
        'رصد أخطاء التشكيل والتردد والتنبيهات وحساب النسبة المئوية آلياً مع التقييم الوصفي.',
        'اقتراح خطة الغد ومقرر الحفظ التالي آلياً بحسب إنجاز الطالب ومستواه التعليمي.',
        'أرشيف تراكمي متكامل لمسيرة تسميع كل طالب منذ اليوم الأول لالتحاقه لمتابعة التطور.'
      ],
      previewSnippet: {
        badgeText: 'سجل التسميع اليومي',
        subText: 'الطالب: عبد الرحمن أحمد • سورة الشعراء (١ - ١٥)',
        stat1: { label: 'معايير التجويد', val: '٤.٩ / ٥' },
        stat2: { label: 'نقاط التميز المكتسبة', val: '+٢٥ نقطة' }
      }
    },
    {
      id: 'listening',
      category: 'teaching',
      title: 'مشغل الآيات والتكرار الصوتي',
      icon: Headphones,
      tag: 'بالرسم العثماني لمجمع الملك فهد',
      color: 'from-sky-400 to-blue-500',
      badge: 'المصحف المعلم',
      headline: 'استماع تفاعلي بالرسم العثماني المعتمد مع عداد تكرار منزلي آلي',
      description: 'نظام استماع صوتي متطور يعرض الآيات القرآنية آية بآية بالخط العثماني لمجمع الملك فهد متزامنة مع تلاوات خاشعة لنخبة من كبار مشايخ العالم الإسلامي.',
      highlights: [
        'تحديد المقطع القرآني بدقة من الآية (أ) إلى الآية (ب) من قبل المعلم دون إمكانية تجاوزه.',
        'تحديد عدد مرات التكرار المطلوبة (من ١ إلى ٢٠ تكرار) واحتساب مرات الاستماع آلياً.',
        'إيداع نقاط التميز تلقائياً في حساب الطالب ولوحة الشرف عند إتمام المقرر كاملاً.',
        'أصوات كبار المشايخ: الحصري، المنشاوي، عبد الباسط، العفاسي، علي جابر، الشاطري.'
      ],
      previewSnippet: {
        badgeText: 'سورة الشعراء - الآيات [٩ - ١٢]',
        subText: 'بصوت الشيخ محمود خليل الحصري (المصحف المعلم)',
        stat1: { label: 'التكرار المطلوب', val: '٥ مرات' },
        stat2: { label: 'الإنجاز المنزلي', val: 'مكتمل بنجاح' }
      }
    },
    {
      id: 'exams',
      category: 'eval',
      title: 'بنك الاختبارات ونماذج Google Forms',
      icon: FileText,
      tag: 'تصحيح آلي وتكامل سحابي',
      color: 'from-rose-500 to-red-600',
      badge: 'Google Forms API',
      headline: 'إنشاء اختبارات قرآنية متقدمة وتوليد نماذج Google Forms وسحب الدرجات',
      description: 'بنك متكامل لاختبارات الحفظ والتجويد والمتشابهات مع تكامل مباشر مع Google Forms لإنشاء النماذج وتصحيحها وسحب نتائج الطلاب لحظياً دون تدخل يدوي.',
      highlights: [
        'بنك أسئلة قرآني ضخم ومتنوع: اختيار من متعدد، إكمال آيات، أحكام التجويد، وأسئلة شفهية.',
        'توليد نماذج Google Forms تلقائياً بنقرة واحدة ورفعها على حساب Google الخاص بالمعلم/المجمع.',
        'تعبئة اسم الطالب ومعرفه تلقائياً في رابط الاختبار لمنع التكرار والأخطاء والالتباس.',
        'رصد فوري لدرجات الاختبار وربطها بسجل الطالب ولوحة الصدارة وإصدار كشوفات الدرجات.'
      ],
      previewSnippet: {
        badgeText: 'اختبار تجويد جزء عمّ',
        subText: '٢٠ سؤالاً قياسياً • تصحيح سحابي فوري عبر Google Forms',
        stat1: { label: 'متوسط الدرجات', val: '٩٦٪' },
        stat2: { label: 'الشهادة الممنوحة', val: 'ممتاز مرتفع' }
      }
    },
    {
      id: 'certificates',
      category: 'eval',
      title: 'الشهادات الرقمية وقوالب التكريم',
      icon: Award,
      tag: 'طباعة فورية A4 وPDF',
      color: 'from-amber-400 to-yellow-500',
      badge: 'مصمم تفاعلي',
      headline: 'مصمم شهادات متطور بالسحب والإفلات وقوالب إسلامية مزخرفة فاخرة',
      description: 'أداة تصميم وطباعة شهادات التكريم القرآنية التي تليق بأهل القرآن مع إمكانية إصدار جماعي وتصدير PDF عالي الدقة جاهز للمطابع بختم المجمع وتوقيع المعلم.',
      highlights: [
        'محرر تفاعلي لتعديل الخطوط والمسافات وإضافة الأختام وشعار المجمع بدقة متناهية.',
        'تعبئة تلقائية لبيانات الطالب، اسم الحلقة، الدرجة، والتاريخ بتوقيع المشرف والمعلم.',
        'تصدير الشهادات بصيغة PDF عالية الدقة (High DPI) وصور PNG للمشاركة عبر الشبكات.',
        'إصدار جماعي لكافة طلاب الحلقة المجتازين للاختبارات بنقرة زر واحدة في ثوانٍ.'
      ],
      previewSnippet: {
        badgeText: 'شهادة إتقان حفظ جزء تبارك',
        subText: 'معتمدة برقم توثيق رسمي وخاتم المجمع القرآني',
        stat1: { label: 'التقدير العام', val: 'ممتاز مع مرتبة الشرف' },
        stat2: { label: 'خيارات التصدير', val: 'طباعة A4 / PDF عالية الدقة' }
      }
    },
    {
      id: 'leaderboard',
      category: 'eval',
      title: 'لوحة الشرف وتصنيف المتصدرين',
      icon: Trophy,
      tag: 'تحفيز وتنافس قرآني شريف',
      color: 'from-amber-400 to-amber-600',
      badge: 'معادلة نقاط عادلة',
      headline: 'لوحة شرف تفاعلية تجمع كافة محاور التميز مع تتويج فرسان الحلقات',
      description: 'نظام تصنيف وتكريم عادل يجمع نقاط التسميع اليومية، نقاط الاختبارات، نقاط الاستماع والتكرار المنزلي، وشعلات المواظبة مع أوسمة وكؤوس للمراكز الأولى.',
      highlights: [
        'معادلة نقاط موحدة ومحدثة لحظياً على مستوى الحلقة وعلى مستوى المجمع كاملاً.',
        'تتويج المراكز الأولى بكؤوس ذهبية وفضية وبرونزية وتأثيرات بصرية احتفالية مشوقة.',
        'إمكانية الضغط على أي طالب لاستعراض أين وكيف جمع نقاطه بالتفصيل الشفاف.',
        'تصنيفات متعددة: متصدرو الشهر، أطول شعلة مواظبة (Streaks)، والأعلى درجات.'
      ],
      previewSnippet: {
        badgeText: 'المتصدر الأول: أسامة البشير',
        subText: 'حلقة الإمام الشاطبي • إجمالي النقاط: ٤٢٠ نقطة',
        stat1: { label: 'نقاط التسميع', val: '+٢٤٠' },
        stat2: { label: 'نقاط الاختبارات', val: '+١٨٠' }
      }
    },
    {
      id: 'whatsapp',
      category: 'family',
      title: 'تقارير الواتساب وبوابة ولي الأمر',
      icon: MessageCircle,
      tag: 'تواصل فوري وشراكة أسرية',
      color: 'from-emerald-500 to-green-600',
      badge: 'بوابة إلكترونية وواتساب',
      headline: 'تقارير إنجاز يومية منمقة بالآيات ترسل بنقرة واحدة عبر الواتساب',
      description: 'تجسير التواصل بين المجمع والمنزل عبر قوالب رسائل واتساب ذكية ترصد الحفظ والغياب وخطة الغد، مع بوابة مستقلة لولي الأمر لمتابعة مسيرة ابنه لحظة بلحظة.',
      highlights: [
        'بوابة إلكترونية سحابية مخصصة لكل طالب يدخل إليها ولي الأمر للاطلاع على الحضور والتسميع.',
        'إرسال تقارير الواتساب اليومية بنقرة زر واحدة بنص منسق واحترافي لأرقام أولياء الأمور.',
        'إشعار فوري لولي الأمر في حال الغياب غير المبرر أو تأخر الطالب عن موعد الحلقة.',
        'تخصيص نماذج الرسائل المعتمدة لكل مناسبة (تقارير يومية، شكر وتقدير، وتنبيهات).'
      ],
      previewSnippet: {
        badgeText: 'تقرير إنجاز يومي - واتساب',
        subText: 'تم إرساله لولي أمر الطالب: تم بحمد الله تسميع ورد اليوم بإتقان',
        stat1: { label: 'حالة الحضور', val: 'حاضر في الموعد' },
        stat2: { label: 'خطة الغد المقررة', val: 'سورة القصص (١ - ١٠)' }
      }
    },
    {
      id: 'behavior',
      category: 'family',
      title: 'السجل السلوكي والتوجيه التربوي',
      icon: ShieldAlert,
      tag: 'غرس القيم والأخلاق',
      color: 'from-orange-500 to-amber-600',
      badge: 'بناء الشخصية القرآنية',
      headline: 'توثيق السلوكيات الإيجابية ورصد المخالفات مع توجيهات وحلول تربوية',
      description: 'أداة تربوية متخصصة لبناء شخصية طالب القرآن والجمع بين حفظ الحروف والتخلق بأخلاق القرآن الكريم مع حلول تربوية علاجية متدرجة.',
      highlights: [
        'توثيق السلوكيات الأخلاقية الحميدة (الأدب، الإيثار، العناية بالمصحف، البكور) ومنح نقاط تعزيزية.',
        'رصد المخالفات السلوكية وتصنيفها لمستويات (بسيطة، متوسطة، جسيمة).',
        'اقتراح توجيهات عملية مستمدة من أساليب التربية النبوية وتجارب المجمعات الرائدة.',
        'توليد تقارير سلوكية دورية يمكن مشاركتها مع إدارة المجمع وولي الأمر للتقويم المشترك.'
      ],
      previewSnippet: {
        badgeText: 'السجل التربوي للطالب',
        subText: 'التعزيز: مبادرة في إعانة زملائه وحسن إنصات وتأدب',
        stat1: { label: 'النقاط الإضافية', val: '+١٥ نقطة تعزيز' },
        stat2: { label: 'الحالة السلوكية', val: 'ممتاز ومثالي' }
      }
    },
    {
      id: 'teacher_attendance',
      category: 'admin',
      title: 'تحضير المعلمين ومناوبات الإشراف',
      icon: Clock,
      tag: 'انضباط الكادر والمناوبات',
      color: 'from-cyan-500 to-blue-600',
      badge: 'إشراف إداري محكم',
      headline: 'سجل حضور وانصراف المعلمين وتوثيق المناوبات الميدانية في المسجد',
      description: 'نظام إداري مخصص لإدارة المجمع لضبط ومتابعة التزام المعلمين والمشرفين، واحتساب ساعات العمل والمناوبات ومكافأة المنضبطين بدقة.',
      highlights: [
        'تسجيل حضور وانصراف المعلمين اليومي بدقة مع رصد وقت الدخول والخروج بالثواني.',
        'جدولة وتوثيق مناوبات الحلقات والإشراف الميداني على سلامة الطلاب في المسجد.',
        'إحصائيات دورية وشهرية لنسب التزام المعلمين وساعات التطوع المنجزة.',
        'تسهيل صرف المكافآت والحوافز التقديرية بناءً على سجلات الحضور المعتمدة رسمياً.'
      ],
      previewSnippet: {
        badgeText: 'سجل حضور الكادر التعليمي',
        subText: 'المعلم: فضيلة الشيخ / أحمد العتيبي • حلقة الفجر',
        stat1: { label: 'ساعة الحضور', val: '٠٤:٤٥ ص (مبكر)' },
        stat2: { label: 'نسبة الانضباط الشهري', val: '١٠٠٪' }
      }
    },
    {
      id: 'applications',
      category: 'family',
      title: 'بوابة القبول والتسجيل الإلكتروني',
      icon: UserPlus,
      tag: 'استقبال الطلاب من المنازل',
      color: 'from-teal-500 to-emerald-600',
      badge: 'قبول وتسكين فوري',
      headline: 'رابط تسجيل عام لاستقبال الطلاب من المنازل مع إشعار صوتي فوري وقبول بنقرة زر',
      description: 'بوابة قبول عصرية تتيح لأولياء الأمور تسجيل أبنائهم في المجمع عن بُعد دون الحاجة لزيارة المسجد ورقياً مع تنبيه لحظي للإدارة.',
      highlights: [
        'رابط تسجيل عام ومستقل لكل مجمع يمكن نشره عبر وسائل التواصل الاجتماعي والواتساب.',
        'نموذج تسجيل إلكتروني يجمع بيانات الطالب، العمر، الجزء المحفوظ، ورقم ولي الأمر.',
        'إشعار صوتي وتنبيه مباشر للإدارة على المنصة فور وصول أي طلب جديد لحظياً.',
        'نافذة فحص واعتماد الطلبات: قبول الطالب وتسكينه في الحلقة المحددة بنقرة زر واحدة.'
      ],
      previewSnippet: {
        badgeText: 'طلب انضمام طالب جديد',
        subText: 'الطالب: يوسف المهدي • الحفظ السابق: ٣ أجزاء',
        stat1: { label: 'حالة الطلب', val: 'بانتظار الاعتماد' },
        stat2: { label: 'التسكين المقترح', val: 'حلقة البراعم' }
      }
    },
    {
      id: 'backup',
      category: 'admin',
      title: 'النسخ الاحتياطي والأرشفة وترحيل البيانات',
      icon: Database,
      tag: 'أمان وتشفير سحابي دائم',
      color: 'from-violet-500 to-purple-600',
      badge: 'حماية كاملة',
      headline: 'تصدير واستيراد النسخ الاحتياطية (JSON) وترحيل البيانات بين المشاريع السحابية',
      description: 'درع حماية وتأمين لكافة مخرجات المجمع يضمن بقاء البيانات للأبد واسترجاعها في ثوانٍ معدودة مع أداة متطورة لترحيل البيانات بين المشاريع.',
      highlights: [
        'تصدير نسخة احتياطية شاملة لكامل المجمع والطلاب والحلقات والحضور بصيغة JSON آمنة.',
        'استيراد واسترجاع النسخ الاحتياطية بضغطة زر مع فحص ومعاينة البيانات قبل الاعتماد.',
        'أداة ترحيل البيانات بين مشاريع وقواعد بيانات Firebase المختلفة بأمان وسرعة.',
        'حفظ النسخ الاحتياطية في Google Drive في مجلد التطبيق المخصص بأعلى معايير الأمان.'
      ],
      previewSnippet: {
        badgeText: 'أرشيف النسخ الاحتياطية السحابية',
        subText: 'النسخة الأخيرة: مكتملة بنجاح ومشفرة بالكامل',
        stat1: { label: 'حجم النسخة', val: '٢.٤ ميجابايت' },
        stat2: { label: 'السجلات المحفوظة', val: '١,٢٥٠ طالباً وحلقة' }
      }
    },
    {
      id: 'reports',
      category: 'admin',
      title: 'التقارير والإحصائيات والتحليلات والطباعة',
      icon: BarChart3,
      tag: 'رسوم بيانية وكشوفات A4',
      color: 'from-rose-500 to-pink-600',
      badge: 'مؤشرات أداء شاملة',
      headline: 'لوحات بيانات تفاعلية، مؤشرات إنجاز، وكشوفات رسمية مجهزة للطباعة وتصدير Excel',
      description: 'غرفة عمليات بيانية وإحصائية تمكّن الإدارة من قياس منجزات الحلقات بدقة، وتصدير كشوفات حضور وتسميع رسمية مجهزة للمطابع والأرشفة الإدارية.',
      highlights: [
        'رسوم بيانية توضح نسب الحضور والغياب اليومية والأسبوعية والشهرية.',
        'متابعة معدلات إنجاز الحفظ والمراجعة وعدد الأوجه المحفوظة لكل حلقة.',
        'تصدير كشوفات حضور وتسميع رسمية مجهزة للطباعة (Print Optimized) A4.',
        'تصدير البيانات بصيغة جداول Excel لمشاركتها مع إدارات الجمعيات والجهات المشرفة.'
      ],
      previewSnippet: {
        badgeText: 'التقرير الإحصائي الشهري للمجمع',
        subText: 'إجمالي الأوجه المحفوظة هذا الشهر: ١,٤٢٠ وجهاً',
        stat1: { label: 'نسبة النجاح العام', val: '٩٧.٢٪' },
        stat2: { label: 'صيغ التصدير', val: 'PDF A4 / Excel' }
      }
    }
  ];

  const categories = [
    { id: 'all', name: 'الكل (جميع المميزات الـ 17)' },
    { id: 'admin', name: 'الهيكل والثيم والسحاب' },
    { id: 'ai_meet', name: 'حلقات Meet والذكاء الاصطناعي' },
    { id: 'core', name: 'الطلاب والخطط وQR' },
    { id: 'teaching', name: 'التحضير والتسميع والمصحف' },
    { id: 'eval', name: 'الاختبارات والشهادات والشرف' },
    { id: 'family', name: 'الولي والواتساب والتسجيل' }
  ];

  const filteredFeatures = useMemo(() => {
    return featureTabs.filter(item => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const query = featureSearch.trim().toLowerCase();
      if (!query) return matchesCategory;

      const matchesSearch =
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.headline.toLowerCase().includes(query) ||
        item.tag.toLowerCase().includes(query) ||
        item.badge.toLowerCase().includes(query) ||
        item.highlights.some(h => h.toLowerCase().includes(query));

      return matchesCategory && matchesSearch;
    });
  }, [featureSearch, selectedCategory, featureTabs]);

  const currentActiveTabFeature = filteredFeatures[activeFeatureTab] || filteredFeatures[0] || featureTabs[0];

  const faqs = [
    {
      q: 'هل تدعم المنظومة تشغيل وتخصيص ثيم وألوان عدة مجمعات وحلقات مستقلة؟',
      a: 'نعم، المنظومة مصممة بهيكل متعدد المجمعات (Multi-Complex) يتيح إنشاء وإدارة مجمعات مستقلة تماماً، وتخصيص هوية بصرية كاملة لكل مجمع (اللون الأساسي، الثانوي، ولون التمييز، والوضع الداكن)، مع خيار عزل قواعد البيانات السحابية (Firebase Database Isolation).'
    },
    {
      q: 'كيف تعمل الحلقات القرآنية أونلاين عبر Google Meet؟',
      a: 'تتيح المنظومة للمشرف والمعلم إنشاء حلقات افتراضية وتحديد جدول مواعيدها اليومية بدقة وربطها برابط Google Meet المعتمد. يتم حفظ ومزامنة الرابط في Firestore فورياً ليظهر للشيخ والطلاب وأولياء الأمور مع مؤشر البث المباشر (LIVE) وزر دخول فوري دون الحاجة لتحديث الصفحة.'
    },
    {
      q: 'ما هو دور المساعد القرآني الذكي ومحرك Gemini 3.8 Flash؟',
      a: 'يوفر المساعد القرآني التفاعلي إمكانية التحدث بالصوت أو الكتابة باللغة العربية للاستعلام عن أي طالب وسجلات حضوره وتقييماته فوراً، إضافة إلى استخراج المتشابهات اللفظية بين الآيات، تفسير غريب القرآن، وصياغة خطط علاجية وتوليد أسئلة اختبارات ذكية.'
    },
    {
      q: 'كيف يعمل نظام التحضير الذكي والسياج الجغرافي للمسجد (GPS)؟',
      a: 'يستطيع المعلم تحضير الطلاب بنقرة زر أو عبر كاميرا الجوال بمسح رمز QR الفريد لبطاقة الطالب في ثانية واحدة. كما توفر المنظومة خيار التحضير الجغرافي (Geofencing) لمنع رصد الحضور إلا إذا كان المعلم أو الطالب متواجداً فعلياً داخل حرم ونطاق المسجد الجغرافي المحدد بالأمتار.'
    },
    {
      q: 'لماذا تطلب المنظومة أذونات Google Workspace (Sheets, Drive, Forms)؟',
      a: 'تطلب المنظومة هذه الأذونات strictly on-demand عند رغبة المعلم أو المشرف بتصدير درجات التسميع وسجلات الحضور إلى جداول Google Sheets الشخصية الخاصة به، أو إنشاء اختبارات Google Forms وسحب درجاتها، أو حفظ نسخ احتياطية مشفرة في مجلد مخصص في Google Drive. لا نصل لأي ملفات شخصية أخرى، وتخضع العملية لسياسة الاستخدام المحدود الصارمة من Google.'
    },
    {
      q: 'أين تُحفظ الشهادات الصادرة وهل يمكن للطالب وولي الأمر استعراضها؟',
      a: 'جميع الشهادات التي تصدر للطلاب تُحفظ تلقائياً في الأرشيف السحابي الدائم للمجمع وتظهر فوراً في حساب الطالب وبوابة ولي الأمر، حيث يمكن استعراضها وطباعتها بجودة فائقة A4 أو حفظها كملف PDF في أي وقت دون أن تُفقد.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#131f24] text-[#ffffff] font-sans selection:bg-[#58cc02] selection:text-[#131f24]" dir="rtl">
      {/* Background Decorative Gradient Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 right-1/4 w-[550px] h-[550px] bg-[#58cc02]/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 -left-40 w-[650px] h-[650px] bg-[#1cb0f6]/12 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-[#ffc800]/10 rounded-full blur-3xl" />
      </div>

      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#131f24]/95 border-b-2 border-[#2b4550] transition-all w-full max-w-full overflow-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand / Logo */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#ffc800] border-b-4 border-[#e5a500] p-0.5 shadow-lg shadow-yellow-500/20 shrink-0 flex items-center justify-center text-[#131f24]">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-[#131f24]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-base sm:text-xl font-black font-heading tracking-tight text-white truncate">
                  منظومة عُمْرَان
                </h1>
                <span className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full bg-[#ffc800]/20 text-[#ffc800] font-black border border-[#ffc800]/40 hidden xs:inline shrink-0">
                  Omran 17 Modules
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-[#ffd233] hidden sm:block truncate font-bold">
                الصرح الرقمي الذكي لإدارة المجمعات والحلقات القرآنية
              </p>
            </div>
          </div>

          {/* Quick Nav Actions */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* English reviewer toggle */}
            <button
              type="button"
              onClick={() => setShowEnglishOverview(!showEnglishOverview)}
              className="text-xs font-bold text-[#ffc800] hover:text-white p-2 sm:px-3 sm:py-2 rounded-xl bg-[#203843] border-2 border-b-4 border-[#2b4550] hover:border-[#ffc800] transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm active:translate-y-0.5"
              title="Toggle English Overview for Google Reviewers"
            >
              <Languages className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden md:inline">{showEnglishOverview ? 'العربية' : 'English'}</span>
              <span className="md:hidden text-[11px]">EN</span>
            </button>

            <button
              type="button"
              onClick={onOpenPrivacyPolicy}
              className="text-xs font-bold text-[#ffd233] hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl bg-[#203843] border-2 border-b-4 border-[#2b4550] hover:border-[#ffc800] active:translate-y-0.5"
              title="وثيقة سياسة الخصوصية"
            >
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#ffc800]" />
              <span className="hidden lg:inline">وثيقة الخصوصية</span>
            </button>

            {onOpenParentPortal && (
              <button
                type="button"
                onClick={onOpenParentPortal}
                className="text-xs font-bold text-[#ffc800] hover:text-white transition-colors cursor-pointer px-3.5 py-2 rounded-xl bg-[#203843] border-2 border-b-4 border-[#2b4550] hover:border-[#ffc800] hidden md:inline-flex items-center gap-1.5 active:translate-y-0.5"
              >
                <GraduationCap className="w-4 h-4 text-[#ffc800]" />
                <span>بوابة ولي الأمر</span>
              </button>
            )}

            {/* Prominent Login Button for all devices */}
            <button
              type="button"
              onClick={onOpenLogin}
              className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-[#ffc800] border-2 border-[#ffc800] border-b-4 border-[#e5a500] hover:brightness-105 text-[#131f24] text-xs sm:text-sm font-black shadow-lg shadow-yellow-500/25 flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer active:translate-y-[2px] active:border-b-2 shrink-0"
            >
              <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#131f24]" />
              <span className="font-heading font-extrabold whitespace-nowrap">تسجيل الدخول</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 space-y-16 sm:space-y-24 pb-20">
        {/* Optional English Overview Banner for Google Reviewers */}
        <AnimatePresence>
          {showEnglishOverview && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-[#1b2e35] border-b-4 border-[#ffc800] px-4 sm:px-6 lg:px-8 py-6 text-left shadow-2xl"
              dir="ltr"
            >
              <div className="max-w-7xl mx-auto space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-[#ffc800] font-bold text-sm">
                    <ShieldCheck className="w-5 h-5" />
                    <span>Google OAuth Verification Quick Reference Guide (English Summary)</span>
                  </div>
                  <button
                    onClick={() => setShowEnglishOverview(false)}
                    className="text-xs text-slate-300 hover:text-white px-3 py-1 rounded-xl bg-white/10 cursor-pointer"
                  >
                    Close English Panel ✕
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-200">
                  <div className="bg-[#203843] p-4 rounded-2xl border-2 border-[#2b4550] space-y-1.5">
                    <strong className="text-white block font-bold">1. Application & Brand Identity</strong>
                    <p className="text-[#ffd233]">
                      <strong>Name:</strong> Omran Quran Platform (منظومة عُمْرَان لإدارة الحلقات والمجمعات القرآنية).
                    </p>
                    <p>
                      A full-featured educational web application dedicated to managing Quran memorization schools, halaqahs, attendance, and student evaluations with 17 integrated modules.
                    </p>
                  </div>

                  <div className="bg-[#203843] p-4 rounded-2xl border-2 border-[#2b4550] space-y-1.5">
                    <strong className="text-white block font-bold">2. Purpose of Google User Data Requests</strong>
                    <p>
                      The app requests Google Workspace permissions (Google Sheets, Google Forms, Google Drive file scope) strictly on-demand when an authorized teacher/supervisor requests:
                    </p>
                    <ul className="list-disc list-inside text-[11px] text-amber-200 space-y-0.5">
                      <li>Exporting attendance & student evaluation grades into personal Google Sheets.</li>
                      <li>Generating Quran assessment quizzes in Google Forms.</li>
                      <li>Saving JSON backup archives in a dedicated Drive app folder.</li>
                    </ul>
                  </div>

                  <div className="bg-[#203843] p-4 rounded-2xl border-2 border-[#2b4550] space-y-1.5">
                    <strong className="text-white block font-bold">3. Privacy, Security & Limited Use</strong>
                    <p>
                      Zero third-party data sharing. Data is never sold, leased, or used for advertising/AI training. Fully complies with Google Limited Use Policy.
                    </p>
                    <div className="pt-2">
                      <button
                        onClick={onOpenPrivacyPolicy}
                        className="text-xs font-bold text-[#ffc800] underline hover:text-white cursor-pointer"
                      >
                        View Full Privacy Policy Document →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* HERO SECTION */}
        <section className="pt-8 sm:pt-14 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6 flex flex-col items-center"
          >
            {/* Complete Quranic Verse Banner */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.65, delay: 0.08 }}
              className="inline-flex items-center justify-center gap-3 px-6 py-3 rounded-full bg-[#1b2e35] border-2 border-[#ffc800]/60 text-[#ffd233] text-xs sm:text-base font-quran shadow-[0_4px_20px_rgba(255,200,0,0.18)] max-w-full flex-wrap"
            >
              <Sparkles className="w-4 h-4 text-[#ffc800] shrink-0 animate-pulse" />
              <span className="text-center font-bold tracking-wide leading-relaxed text-white">
                ﴿ إِنَّ هَٰذَا الْقُرْآنَ يَهْدِي لِلَّتِي هِيَ أَقْوَمُ وَيُبَشِّرُ الْمُؤْمِنِينَ الَّذِينَ يَعْمَلُونَ الصَّالِحَاتِ أَنَّ لَهُمْ أَجْرًا كَبِيرًا ﴾
              </span>
              <span className="text-[11px] font-sans px-2.5 py-0.5 rounded-full bg-[#ffc800]/20 text-[#ffc800] font-black border border-[#ffc800]/40 shrink-0">
                سورة الإسراء: ٩
              </span>
            </motion.div>

            {/* Main Headline */}
            <motion.h2
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.16 }}
              className="text-3xl sm:text-5xl lg:text-6xl font-black font-heading text-white leading-tight tracking-tight"
            >
              المنظومة الرقمية الشاملة لإدارة
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#ffc800] via-[#ffd900] to-[#ff9600] mt-2">
                حلقات ومجمعات القرآن الكريم
              </span>
            </motion.h2>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.24 }}
              className="text-sm sm:text-base text-slate-200 max-w-3xl mx-auto leading-relaxed font-medium"
            >
              بيئة تقنية وتربوية رائدة متكاملة تضم ١٧ محوراً نوعياً: تخصيص الثيم والهوية البصرية لكل مجمع، حلقات Google Meet أونلاين المتزامنة، المساعد القرآني الذكي، التحضير بـ GPS والباركود، التقييم الثلاثي، بنك الاختبارات، أرشيف الشهادات الفاخرة، وبوابات أولياء الأمور والواتساب.
            </motion.p>

            {/* CTA Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.32 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 w-full"
            >
              <button
                type="button"
                onClick={onOpenLogin}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#ffc800] border-2 border-[#ffc800] border-b-4 border-[#e5a500] hover:brightness-105 text-[#131f24] text-base font-black shadow-[0_6px_25px_rgba(255,200,0,0.35)] flex items-center justify-center gap-3 transition-all cursor-pointer group active:translate-y-[2px] active:border-b-2"
              >
                <span>دخول لوحة التحكم والبدء</span>
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1.5 transition-transform text-[#131f24]" />
              </button>

              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('features-explorer');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-[#203843] border-2 border-[#2b4550] border-b-4 border-[#16262e] hover:border-[#ffc800] text-white text-sm font-black flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-md active:translate-y-[2px] active:border-b-2"
              >
                <Sparkles className="w-5 h-5 text-[#ffc800]" />
                <span>استكشاف كافة المميزات الـ ١٧ بالتفصيل الممل</span>
              </button>
            </motion.div>
          </motion.div>

          {/* Quick Metrics / Pillars */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-5 pt-8 text-right">
            {[
              { title: 'تخصيص الثيم', desc: 'ألوان وهوية وشعار لكل مجمع بنمط ليلي', color: 'text-[#ffc800]', icon: Palette },
              { title: 'Google Meet', desc: 'حلقات أونلاين متزامنة وبث مباشر', color: 'text-[#1cb0f6]', icon: Video },
              { title: 'الذكاء الاصطناعي', desc: 'محرك Gemini 3.8 Flash صوتياً ونصياً', color: 'text-[#ff9600]', icon: Sparkles },
              { title: 'التحضير بـ GPS', desc: 'سياج مكاني للمسجد وشعلات تفاعلية', color: 'text-[#ce82ff]', icon: MapPin }
            ].map((pillar, i) => {
              const Icon = pillar.icon;
              return (
                <motion.div
                  key={pillar.title}
                  initial={{ opacity: 0, y: 25, scale: 0.95 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="bg-[#203843] border-2 border-b-4 border-[#2b4550] hover:border-[#ffc800] rounded-2xl p-4 sm:p-5 backdrop-blur-sm transition-all shadow-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`${pillar.color} text-lg sm:text-xl font-black font-heading`}>
                      {pillar.title}
                    </span>
                    <Icon className={`w-5 h-5 ${pillar.color}`} />
                  </div>
                  <div className="text-xs text-slate-300 font-medium">{pillar.desc}</div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* SECTION: INTERACTIVE ALL-FEATURES EXPLORER */}
        <section id="features-explorer" className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8 scroll-mt-24">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#ffc800]/15 border border-[#ffc800]/40 text-[#ffc800] text-xs font-black">
              <Sparkles className="w-4 h-4 text-[#ffc800]" />
              <span>موسوعة مميزات منصة عُمْرَان الكاملة (١٧ نظاماً متكاملاً)</span>
            </div>
            <h3 className="text-2xl sm:text-4xl font-black font-heading text-white">
              كل ما تحتاجه لإدارة الصرح القرآني بالتفصيل الممل
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
              تصفح القدرات والإمكانيات العملية والتقنية المتاحة للمشرف والمعلم والطلاب وأولياء الأمور
            </p>
          </div>

          {/* Search, Categories & View Mode Bar */}
          <div className="bg-[#1b2e35] border-2 border-b-4 border-[#2b4550] rounded-3xl p-4 sm:p-6 space-y-4 shadow-xl">
            {/* Search Input & View Switcher */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:max-w-md">
                <Search className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={featureSearch}
                  onChange={(e) => {
                    setFeatureSearch(e.target.value);
                    setActiveFeatureTab(0);
                  }}
                  placeholder="ابحث في المميزات (تخصيص الثيم، جوجل ميت، باركود، واتساب، ذكاء اصطناعي)..."
                  className="w-full pr-11 pl-8 py-2.5 rounded-xl bg-[#131f24] border-2 border-[#2b4550] text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[#ffc800] font-medium"
                />
                {featureSearch && (
                  <button
                    type="button"
                    onClick={() => setFeatureSearch('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 hover:text-white"
                  >
                    مسح
                  </button>
                )}
              </div>

              {/* View Mode Toggle: Interactive Tabs vs All Grid */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#131f24] border border-[#2b4550] shrink-0 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setViewMode('tabs')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'tabs' ? 'bg-[#ffc800] text-[#131f24] shadow-sm' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <ListFilter className="w-3.5 h-3.5" />
                  <span>العرض التفاعلي</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'grid' ? 'bg-[#ffc800] text-[#131f24] shadow-sm' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>شبكة البطاقات الكاملة</span>
                </button>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => {
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setActiveFeatureTab(0);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all border border-b-2 active:translate-y-0.5 cursor-pointer ${
                      isActive
                        ? 'bg-[#ffc800] text-[#131f24] border-[#ffc800] border-b-[#e5a500] shadow-sm'
                        : 'bg-[#203843] hover:bg-[#274452] text-slate-200 border-[#2b4550] border-b-[#16262e]'
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* VIEW MODE 1: INTERACTIVE TAB SHOWCASE */}
          {viewMode === 'tabs' && (
            <div className="space-y-6">
              {/* Interactive Horizontal Tabs Slider */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none slider-horizontal">
                {filteredFeatures.map((tab, idx) => {
                  const TabIcon = tab.icon;
                  const isActive = activeFeatureTab === idx;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveFeatureTab(idx)}
                      className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-black transition-all shrink-0 cursor-pointer border-2 border-b-4 active:translate-y-0.5 ${
                        isActive
                          ? 'bg-[#ffc800] text-[#131f24] border-[#ffc800] border-b-[#e5a500] shadow-[0_4px_16px_rgba(255,200,0,0.3)] scale-[1.02]'
                          : 'bg-[#203843] hover:bg-[#274452] text-white border-[#2b4550] border-b-[#16262e] hover:border-[#ffc800]'
                      }`}
                    >
                      <TabIcon className={`w-4 h-4 ${isActive ? 'text-[#131f24]' : 'text-[#ffc800]'}`} />
                      <span>{tab.title}</span>
                    </button>
                  );
                })}
              </div>

              {/* Active Tab Detailed Showcase Card */}
              {currentActiveTabFeature && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentActiveTabFeature.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.35 }}
                    className="bg-[#1b2e35] border-2 border-b-4 border-[#2b4550] rounded-[32px] p-6 sm:p-10 shadow-2xl relative overflow-hidden"
                  >
                    <div className="space-y-6 text-right">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-[11px] px-3.5 py-1 rounded-full bg-[#ffc800] text-[#131f24] font-black">
                            {currentActiveTabFeature.badge}
                          </span>
                          <span className="text-xs text-[#ffc800] font-bold">
                            {currentActiveTabFeature.tag}
                          </span>
                        </div>

                        {currentActiveTabFeature.previewSnippet && (
                          <div className="px-3 py-1 rounded-xl bg-[#203843] border border-[#2b4550] text-[11px] text-[#ffd233] font-bold">
                            {currentActiveTabFeature.previewSnippet.badgeText}
                          </div>
                        )}
                      </div>

                      <h4 className="text-xl sm:text-3xl font-black font-heading text-white leading-tight">
                        {currentActiveTabFeature.headline}
                      </h4>

                      <p className="text-xs sm:text-base text-slate-200 leading-relaxed max-w-4xl font-medium">
                        {currentActiveTabFeature.description}
                      </p>

                      <div className="space-y-3 pt-2">
                        <span className="text-xs sm:text-sm font-black text-[#ffc800] block">
                          أبرز الخصائص والقدرات الفنية بالتفصيل الممل:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {currentActiveTabFeature.highlights.map((h, hIdx) => (
                            <div
                              key={hIdx}
                              className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#203843] border-2 border-[#2b4550] text-xs sm:text-sm text-slate-200 font-medium"
                            >
                              <CheckCircle2 className="w-4 h-4 text-[#ffc800] shrink-0 mt-0.5" />
                              <span className="leading-relaxed">{h}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Preview Snippet Box if available */}
                      {currentActiveTabFeature.previewSnippet && (
                        <div className="p-4 rounded-2xl bg-[#131f24] border border-[#2b4550] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div>
                            <span className="text-xs text-slate-400 block">معاينة النظام:</span>
                            <strong className="text-sm text-white font-bold">{currentActiveTabFeature.previewSnippet.subText}</strong>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="px-3 py-1 rounded-xl bg-[#203843] text-xs font-bold text-amber-300 border border-[#2b4550]">
                              {currentActiveTabFeature.previewSnippet.stat1.label}: {currentActiveTabFeature.previewSnippet.stat1.val}
                            </span>
                            <span className="px-3 py-1 rounded-xl bg-[#203843] text-xs font-bold text-emerald-400 border border-[#2b4550]">
                              {currentActiveTabFeature.previewSnippet.stat2.label}: {currentActiveTabFeature.previewSnippet.stat2.val}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="pt-4 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={onOpenLogin}
                          className="px-6 py-3 rounded-2xl bg-[#ffc800] border-2 border-[#ffc800] border-b-4 border-[#e5a500] hover:brightness-105 text-[#131f24] text-xs sm:text-sm font-black shadow-md flex items-center gap-2 cursor-pointer transition-all active:translate-y-0.5"
                        >
                          <Lock className="w-4 h-4 text-[#131f24]" />
                          <span>الدخول لتجربة الميزة الآن</span>
                        </button>
                        <button
                          type="button"
                          onClick={onOpenPrivacyPolicy}
                          className="px-5 py-3 rounded-2xl bg-[#203843] hover:bg-[#274452] text-slate-200 text-xs sm:text-sm font-bold border-2 border-[#2b4550] border-b-4 border-[#16262e] cursor-pointer transition-colors active:translate-y-0.5"
                        >
                          الاطلاع على سياسة الأمان والخصوصية
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          )}

          {/* VIEW MODE 2: FULL ALL-FEATURES GRID */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredFeatures.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <div
                    key={item.id}
                    className="p-6 rounded-[28px] bg-[#1b2e35] border-2 border-b-5 border-[#2b4550] hover:border-[#ffc800] transition-all duration-200 shadow-xl flex flex-col justify-between space-y-5 text-right group"
                  >
                    <div className="space-y-4">
                      {/* Top Row: Icon & Badges */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="w-12 h-12 rounded-2xl bg-[#203843] border-2 border-b-4 border-[#2b4550] flex items-center justify-center text-[#ffc800] shadow-md group-hover:scale-105 transition-transform">
                          <ItemIcon className="w-6 h-6 text-[#ffc800]" />
                        </div>
                        <span className="text-[11px] font-black px-3 py-1 rounded-full bg-[#ffc800]/20 text-[#ffc800] border border-[#ffc800]/40">
                          {item.badge}
                        </span>
                      </div>

                      {/* Title & Tag */}
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 block">{item.tag}</span>
                        <h4 className="text-base sm:text-lg font-black text-white font-heading mt-0.5">
                          {item.title}
                        </h4>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-200 leading-relaxed font-medium">
                        {item.description}
                      </p>

                      {/* Highlights */}
                      <div className="space-y-2 pt-2 border-t border-[#2b4550]/80">
                        <span className="text-[11px] font-black text-[#ffc800] block">أبرز الوظائف:</span>
                        <ul className="space-y-1.5 text-xs text-slate-300 font-medium">
                          {item.highlights.slice(0, 3).map((hl, hlIdx) => (
                            <li key={hlIdx} className="flex items-start gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#58cc02] shrink-0 mt-0.5" />
                              <span className="leading-snug">{hl}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#2b4550]">
                      <button
                        type="button"
                        onClick={onOpenLogin}
                        className="w-full py-2.5 rounded-xl bg-[#203843] hover:bg-[#ffc800] text-slate-200 hover:text-[#131f24] text-xs font-black border-2 border-[#2b4550] hover:border-[#ffc800] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>دخول واستخدام الميزة</span>
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredFeatures.length === 0 && (
            <div className="p-10 rounded-3xl bg-[#1b2e35] border-2 border-b-4 border-[#2b4550] text-center space-y-3">
              <Search className="w-8 h-8 mx-auto text-slate-500" />
              <h4 className="text-base font-black text-white">لم يتم العثور على ميزات مطابقة للبحث</h4>
              <p className="text-xs text-slate-300">جرب البحث بكلمات مثل: ثيم، جوجل ميت، شهادات، درجات، واتساب.</p>
              <button
                type="button"
                onClick={() => {
                  setFeatureSearch('');
                  setSelectedCategory('all');
                }}
                className="px-4 py-2 rounded-xl text-xs font-black bg-[#ffc800] text-[#131f24] cursor-pointer"
              >
                إعادة ضبط الفلاتر
              </button>
            </div>
          )}
        </section>

        {/* SECTION: TRANSPARENT DATA USAGE & GOOGLE WORKSPACE DISCLOSURE */}
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="bg-[#1b2e35] border-2 border-b-4 border-[#2b4550] rounded-[32px] p-6 sm:p-10 space-y-6 shadow-2xl relative overflow-hidden"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-[#2b4550] pb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#ffc800] border-b-4 border-[#e5a500] text-[#131f24] flex items-center justify-center font-black shadow-lg shrink-0">
                  <ShieldCheck className="w-7 h-7 text-[#131f24]" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl sm:text-2xl font-black font-heading text-white">
                      شفافية طلب البيانات واستخدام خدمات Google Workspace
                    </h3>
                    <span className="text-[11px] px-3 py-0.5 rounded-full bg-[#ffc800] text-[#131f24] font-black">
                      معايير الأمان المعتمدة
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 mt-0.5 font-medium">
                    توضيح شفاف لأغراض طلب أذونات Google وكيفية حماية بيانات مستخدمي المنظومة
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenPrivacyPolicy}
                className="px-5 py-2.5 rounded-2xl bg-[#203843] border-2 border-[#2b4550] border-b-4 border-[#16262e] hover:border-[#ffc800] text-white text-xs font-black transition-all cursor-pointer shrink-0 flex items-center gap-1.5 self-start md:self-auto active:translate-y-0.5"
              >
                <span>الاطلاع على سياسة الخصوصية كاملة</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#ffc800]" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Google Sheets Card */}
              <div className="p-5 rounded-2xl bg-[#203843] border-2 border-b-4 border-[#2b4550] space-y-3 shadow-inner hover:border-[#ffc800] transition-colors">
                <div className="flex items-center gap-2.5 text-[#ffc800]">
                  <FileSpreadsheet className="w-6 h-6" />
                  <h4 className="text-base font-bold text-white font-heading">
                    جداول Google Sheets
                  </h4>
                </div>
                <div className="text-xs text-slate-300 space-y-2 leading-relaxed font-medium">
                  <p>
                    <strong className="text-[#ffc800] block font-bold">الغرض من طلب الإذن:</strong>
                    تصدير سجلات درجات تسميع الطلاب، كشوف الحضور والغياب الشهرية، والتقارير الإحصائية إلى جداول بيانات خاصة بحساب المعلم أو المشرف نفسه.
                  </p>
                  <p className="text-[11px] text-[#ffd233] border-t border-white/10 pt-2">
                    ✓ لا يتم القراءة أو الوصول إلى أي جداول أخرى خارج نطاق ما ينشئه المستخدم عبر المنظومة.
                  </p>
                </div>
              </div>

              {/* Google Forms Card */}
              <div className="p-5 rounded-2xl bg-[#203843] border-2 border-b-4 border-[#2b4550] space-y-3 shadow-inner hover:border-[#1cb0f6] transition-colors">
                <div className="flex items-center gap-2.5 text-[#1cb0f6]">
                  <FileText className="w-6 h-6" />
                  <h4 className="text-base font-bold text-white font-heading">
                    نماذج Google Forms
                  </h4>
                </div>
                <div className="text-xs text-slate-300 space-y-2 leading-relaxed font-medium">
                  <p>
                    <strong className="text-[#ffc800] block font-bold">الغرض من طلب الإذن:</strong>
                    تمكين المعلم من إنشاء اختبارات ومسابقات قرآنية إلكترونية تلقائياً للطلاب، واسترجاع درجات الإجابات لعرضها في لوحة المتصدرين.
                  </p>
                  <p className="text-[11px] text-[#1cb0f6] border-t border-white/10 pt-2">
                    ✓ يقتصر الوصول على النماذج التي يصممها المعلم خصيصاً لاختبارات حلقته القرآنية.
                  </p>
                </div>
              </div>

              {/* Google Drive Card */}
              <div className="p-5 rounded-2xl bg-[#203843] border-2 border-b-4 border-[#2b4550] space-y-3 shadow-inner hover:border-[#ffc800] transition-colors">
                <div className="flex items-center gap-2.5 text-[#ffc800]">
                  <HardDrive className="w-6 h-6" />
                  <h4 className="text-base font-bold text-white font-heading">
                    مساحة Google Drive (نطاق مخصص)
                  </h4>
                </div>
                <div className="text-xs text-slate-300 space-y-2 leading-relaxed font-medium">
                  <p>
                    <strong className="text-[#ffc800] block font-bold">الغرض من طلب الإذن:</strong>
                    حفظ أرشيف النسخ الاحتياطية المشفرة (JSON) للمجمع القرآني داخل مجلد مخصص للمنصة في مساحة المستخدم السحابية الشخصية لحفظ البيانات للأبد.
                  </p>
                  <p className="text-[11px] text-[#ffd233] border-t border-white/10 pt-2">
                    ✓ نستخدم النطاق المقيد (drive.file) دون أي إمكانية للاطلاع على أي ملفات أخرى في Drive.
                  </p>
                </div>
              </div>
            </div>

            {/* Zero-Sharing Affirmation */}
            <div className="bg-[#203843] border-2 border-b-4 border-[#2b4550] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#ffc800]/20 text-[#ffc800] flex items-center justify-center shrink-0 border border-[#ffc800]/40">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="text-xs sm:text-sm text-white font-medium">
                  <strong className="text-[#ffc800] block font-bold">تعهد بعدم بيع أو مشاركة البيانات:</strong>
                  تلتزم منظومة عُمران بعدم بيع أو مشاركة بيانات المستخدمين أو الطلاب مع أي طرف ثالث، ولا يتم استخدام بيانات Google لأي غرض غير تشغيل الوظائف القرآنية للمنصة.
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenPrivacyPolicy}
                className="text-xs text-[#ffc800] hover:text-white underline font-bold whitespace-nowrap cursor-pointer"
              >
                قراءة بنود الاستخدام المحدود (Limited Use)
              </button>
            </div>
          </motion.div>
        </section>

        {/* WORKFLOW: STUDENT & TEACHER JOURNEY */}
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <h3 className="text-2xl sm:text-3xl font-black font-heading text-white">
              رحلة الحفظ والتقييم في المنظومة
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 font-medium">
              خطوات متسلسلة ومتكاملة تضمن إتقان الحفظ وبناء الأجيال القرآنية
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { step: '١', title: 'التسجيل وتوزيع الحلقات', desc: 'إضافة بيانات الطالب وتعيين الشيخ وتحديد خطة الحفظ المناسبة.' },
              { step: '٢', title: 'الاستماع المنزلي وتكرار الآيات', desc: 'استماع الطالب لمقرر الغد بالرسم العثماني وإتمام التكرار المطلوب.' },
              { step: '٣', title: 'التسميع وتقييم معايير التجويد', desc: 'رصد الحفظ والمراجعة وتقييم المخارج والأحكام واقتراح خطة الغد.' },
              { step: '٤', title: 'تقرير الواتساب وجداول Sheets', desc: 'إشعار فوري لولي الأمر بالإنجاز ومزامنة السجلات السحابية الدائمة.' },
              { step: '٥', title: 'الاختبارات والتتويج بالشهادات', desc: 'أداء اختبارات Google Forms والتكريم في لوحة الشرف والشهادات.' }
            ].map((step, idx) => (
              <div
                key={step.step}
                className="p-5 rounded-2xl bg-[#203843] border-2 border-b-4 border-[#2b4550] hover:border-[#ffc800] space-y-3 text-right transition-all shadow-md"
              >
                <div className="w-10 h-10 rounded-2xl bg-[#ffc800] border-b-4 border-[#e5a500] text-[#131f24] font-black flex items-center justify-center text-sm shadow-md font-heading">
                  {step.step}
                </div>
                <h4 className="text-sm font-bold text-white font-heading">{step.title}</h4>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* USER ROLES SECTION */}
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="bg-[#1b2e35] border-2 border-b-4 border-[#2b4550] rounded-[32px] p-6 sm:p-8 space-y-6">
            <h3 className="text-xl font-bold font-heading text-white text-center">
              الفئات المستفيدة ومستويات الصلاحيات في المنظومة
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {[
                {
                  icon: Users,
                  color: 'text-[#ffc800]',
                  border: 'border-[#2b4550]',
                  title: 'المشرف العام وإدارة المجمعات',
                  desc: 'إدارة المجمعات والحلقات، تخصيص الثيم، تعيين المعلمين، ضبط إعدادات الربط السحابي ومراقبة الجودة الشاملة.'
                },
                {
                  icon: BookOpen,
                  color: 'text-[#ffd233]',
                  border: 'border-[#2b4550]',
                  title: 'معلمو الحلقات',
                  desc: 'تسجيل الحفظ اليومي، رصد الحضور والتسميع، عقد حلقات Google Meet، وإصدار تقارير الواتساب.'
                },
                {
                  icon: GraduationCap,
                  color: 'text-[#1cb0f6]',
                  border: 'border-[#2b4550]',
                  title: 'الطلاب',
                  desc: 'متابعة الإنجاز القرآني، خوض الاختبارات الذكية، استعراض لوحة الشرف، والاستماع للتلاوات المتقنة.'
                },
                {
                  icon: HeartHandshake,
                  color: 'text-[#ce82ff]',
                  border: 'border-[#2b4550]',
                  title: 'أولياء الأمور',
                  desc: 'الاطلاع الفوري على تقارير الأبناء، متابعة الحضور والغياب، واستلام رسائل الإنجاز الدورية.'
                }
              ].map((role) => {
                const RoleIcon = role.icon;
                return (
                  <div
                    key={role.title}
                    className="p-4 rounded-2xl bg-[#203843] border-2 border-b-4 border-[#2b4550] space-y-1.5 hover:border-[#ffc800] transition-colors shadow-md"
                  >
                    <div className={`flex items-center gap-2 ${role.color} font-bold`}>
                      <RoleIcon className="w-4 h-4" />
                      <span>{role.title}</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed font-medium">
                      {role.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ ACCORDION SECTION */}
        <section className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-2xl sm:text-3xl font-black font-heading text-white">
              الأسئلة الشائعة حول المنظومة
            </h3>
            <p className="text-xs text-slate-300 font-medium">
              إجابات وافية على كافة الاستفسارات الفنية والإدارية
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border-2 border-b-4 border-[#2b4550] bg-[#203843] overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full p-4 sm:p-5 text-right flex items-center justify-between gap-4 text-sm font-bold text-white cursor-pointer hover:bg-[#274452] transition-colors active:translate-y-0.5"
                  >
                    <span className="leading-relaxed">{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-[#ffc800] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="px-5 pb-5 text-xs text-slate-200 leading-relaxed border-t-2 border-[#2b4550] pt-3 font-medium"
                      >
                        {faq.a}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </section>

        {/* CALL TO ACTION BOTTOM BANNER */}
        <section className="px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
          <div className="bg-[#1b2e35] border-2 border-b-4 border-[#2b4550] rounded-[32px] p-6 sm:p-10 space-y-4 text-center sm:text-right flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-2xl">
            <div className="space-y-2">
              <div className="flex items-center justify-center sm:justify-start gap-2 text-[#ffc800] font-bold text-xs">
                <Sparkles className="w-5 h-5 text-[#ffc800]" />
                <span>جاهز للارتقاء بمجمعك وحلقتك القرآنية؟</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white font-heading">
                ابدأ الآن باستخدام منظومة عُمْرَان الرقمية المتكاملة
              </h3>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed font-medium">
                انضم إلى المجمعات والحلقات الرائدة في إدارة تحفيظ القرآن الكريم ومتابعة الحفاظ بدقة وسهولة وأمان سحابي دائم.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={onOpenLogin}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#ffc800] border-2 border-[#ffc800] border-b-4 border-[#e5a500] hover:brightness-105 text-[#131f24] text-xs sm:text-sm font-black transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2 active:translate-y-0.5"
              >
                <span>دخول لوحة التحكم</span>
                <Lock className="w-4 h-4 text-[#131f24]" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-[#2b4550] bg-[#0e171c] py-10 px-4 sm:px-6 lg:px-8 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-right">
            <div className="space-y-1.5">
              <div className="flex items-center justify-center md:justify-start gap-2 text-white font-bold text-sm">
                <BookOpen className="w-4 h-4 text-[#ffc800]" />
                <span>منظومة عُمْرَان لإدارة الحلقات والمجمعات القرآنية</span>
              </div>
              <p className="text-[11px] text-[#ffd233] font-medium">
                خدمة كتاب الله تعالى وأهل القرآن الكريم • إشراف وبرمجة: م. محمد منتصر
              </p>
              <p className="text-[11px] text-slate-400 font-medium">
                الموقع المعتمد لتوثيق المنظومة واعتماد أذونات Google Cloud Console
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap justify-center">
              <button
                type="button"
                onClick={onOpenPrivacyPolicy}
                className="text-[#ffc800] hover:text-white font-bold px-3.5 py-2 rounded-xl bg-[#203843] border-2 border-b-4 border-[#2b4550] cursor-pointer flex items-center gap-1.5 active:translate-y-0.5"
              >
                <ShieldCheck className="w-4 h-4 text-[#ffc800]" />
                <span>سياسة الخصوصية (Privacy Policy)</span>
              </button>

              <button
                type="button"
                onClick={onOpenLogin}
                className="text-[#131f24] font-black px-4 py-2 rounded-xl bg-[#ffc800] border-2 border-[#ffc800] border-b-4 border-[#e5a500] hover:brightness-105 cursor-pointer active:translate-y-0.5"
              >
                تسجيل الدخول للمنظومة
              </button>

              <a
                href="mailto:fds421885@gmail.com"
                className="text-slate-300 hover:text-white transition-colors px-3.5 py-2 rounded-xl bg-[#203843] border-2 border-b-4 border-[#2b4550] font-medium"
                title="بريد الدعم الفني وتواصل المطور"
              >
                الدعم الفني: <span className="font-mono text-[#ffc800]">fds421885@gmail.com</span>
              </a>
            </div>
          </div>

          <div className="pt-4 border-t border-[#2b4550] text-center text-[10px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>© {new Date().getFullYear()} منظومة عُمْرَان - جميع الحقوق محفوظة لخدمة مجمعات القرآن الكريم.</span>
            <span>Omran Quran Platform • Hosted on verified domain • All Google API terms strictly respected.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
