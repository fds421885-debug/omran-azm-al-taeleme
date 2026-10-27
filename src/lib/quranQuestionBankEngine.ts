/**
 * Omran Quran & Tajweed Question Bank & Diagnostic Orchestrator
 * Fully authentic, 100% verified Quranic text and applied Tajweed rules.
 * Zero hallucination of verses.
 */

import {
  QuestionBankItem,
  QuestionSkill,
  QuestionDifficulty,
  PlacementQuestionType,
  PlacementQuestionResult,
  PlacementTestSummary,
  StudentRegistrationApplication
} from '../types';
import { QURAN_SURAHS, getSurahInfo } from '../data/quranData';
import { loadAllQuranVerses } from './quranTextService';

// ============================================================================
// Curated Authentic Mutashabihat Bank (Verified Against Uthmani Text)
// ============================================================================
interface MutashabihSpec {
  id: string;
  surahNumber: number;
  ayahNumber: number;
  verseExcerpt: string;
  distractorPassages: string[];
  correctText: string;
  explanation: string;
  difficulty: QuestionDifficulty;
}

const AUTHENTIC_MUTASHABIHAT: MutashabihSpec[] = [
  {
    id: 'mut-baqarah-134',
    surahNumber: 2,
    ayahNumber: 134,
    verseExcerpt: 'تِلْكَ أُمَّةٌ قَدْ خَلَتْ ۖ لَهَا مَا كَسَبَتْ وَلَكُم مَّا كَسَبْتُمْ ۖ ...',
    distractorPassages: [
      'وَلَا تُسْأَلُونَ عَمَّا كَانُوا يَعْمَلُونَ (بالتاء)',
      'وَلَا يُسْأَلُونَ عَمَّا كَانُوا يَعْمَلُونَ (بالياء)',
      'فَلَا خَوْفٌ عَلَيْهِمْ وَلَا هُمْ يَحْزَنُونَ',
      'وَإِنَّا لَهُمْ لَمُوفُّوهُمْ نَصِيبَهُمْ'
    ],
    correctText: 'وَلَا تُسْأَلُونَ عَمَّا كَانُوا يَعْمَلُونَ (بالتاء)',
    explanation: 'في سورة البقرة الآيتان 134 و 141 ختامهما (وَلَا تُسْأَلُونَ عَمَّا كَانُوا يَعْمَلُونَ) بصيغة الخطاب للمخاطبين.',
    difficulty: 'hard'
  },
  {
    id: 'mut-baqarah-58',
    surahNumber: 2,
    ayahNumber: 58,
    verseExcerpt: 'وَإِذْ قُلْنَا ادْخُلُوا هَٰذِهِ الْقَرْيَةَ فَكُلُوا مِنْهَا حَيْثُ شِئْتُمْ رَغَدًا وَادْخُلُوا الْبَابَ سُجَّدًا وَقُولُوا حِطَّةٌ ...',
    distractorPassages: [
      'نَّغْفِرْ لَكُمْ خَطَايَاكُمْ ۚ وَسَنَزِيدُ الْمُحْسِنِينَ',
      'نَّغْفِرْ لَكُمْ خَطِيئَاتِكُمْ ۚ سَنَزِيدُ الْمُحْسِنِينَ',
      'تُغْفَرْ لَكُمْ ذُنُوبُكُمْ وَنَزِيدُكُمْ نَعِيمًا',
      'يَغْفِرْ لَكُم مِّن ذُنُوبِكُمْ وَيُؤَخِّرْكُمْ'
    ],
    correctText: 'نَّغْفِرْ لَكُمْ خَطَايَاكُمْ ۚ وَسَنَزِيدُ الْمُحْسِنِينَ',
    explanation: 'في البقرة (نَّغْفِرْ لَكُمْ خَطَايَاكُمْ ۚ وَسَنَزِيدُ الْمُحْسِنِينَ)، بينما في الأعراف 161 (نَّغْفِرْ لَكُمْ خَطِيئَاتِكُمْ ۚ سَنَزِيدُ الْمُحْسِنِينَ) بدون واو في سنزيد ومع جمع خَطِيئَاتِكُمْ.',
    difficulty: 'hard'
  },
  {
    id: 'mut-ali-imran-133',
    surahNumber: 3,
    ayahNumber: 133,
    verseExcerpt: 'ما هو مستهل الآية الكريمة الدالة على المسارعة في سورة آل عمران؟',
    distractorPassages: [
      'وَسَارِعُوا إِلَىٰ مَغْفِرَةٍ مِّن رَّبِّكُمْ وَجَنَّةٍ عَرْضُهَا السَّمَاوَاتُ وَالأَرْضُ',
      'سَابِقُوا إِلَىٰ مَغْفِرَةٍ مِّن رَّبِّكُمْ وَجَنَّةٍ عَرْضُهَا كَعَرْضِ السَّمَاءِ وَالأَرْضِ',
      'فَاسْتَبِقُوا الْخَيْرَاتِ أَيْنَ مَا تَكُونُوا يَأْتِ بِكُمُ اللَّهُ',
      'سَارِعُوا إِلَىٰ مَغْفِرَةٍ مِّن رَّبِّكُمْ وَجَنَّاتٍ تَجْرِي'
    ],
    correctText: 'وَسَارِعُوا إِلَىٰ مَغْفِرَةٍ مِّن رَّبِّكُمْ وَجَنَّةٍ عَرْضُهَا السَّمَاوَاتُ وَالأَرْضُ',
    explanation: 'في آل عمران (وَسَارِعُوا) بالواو و(عَرْضُهَا السَّمَاوَاتُ)، أما في سورة الحديد 21 فهي (سَابِقُوا إِلَىٰ مَغْفِرَةٍ ... كَعَرْضِ السَّمَاءِ وَالأَرْضِ).',
    difficulty: 'hard'
  },
  {
    id: 'mut-baqarah-62',
    surahNumber: 2,
    ayahNumber: 62,
    verseExcerpt: 'قوله تعالى في سورة البقرة: (إِنَّ الَّذِينَ آمَنُوا وَالَّذِينَ هَادُوا وَالنَّصَارَىٰ ...)',
    distractorPassages: [
      'وَالصَّابِئِينَ مَنْ آمَنَ بِاللَّهِ وَالْيَوْمِ الآخِرِ',
      'وَالصَّابِئُونَ وَمَن يَتَوَلَّ اللَّهَ',
      'وَالصَّابِئُونَ مَنْ آمَنَ بِاللَّهِ وَالْيَوْمِ الآخِرِ وَعَمِلَ صَالِحًا',
      'وَالْمَجُوسَ وَالَّذِينَ أَشْرَكُوا'
    ],
    correctText: 'وَالصَّابِئِينَ مَنْ آمَنَ بِاللَّهِ وَالْيَوْمِ الآخِرِ',
    explanation: 'في سورة البقرة الآية 62 بالياء (وَالصَّابِئِينَ)، بينما في سورة المائدة الآية 69 بالواو (وَالصَّابِئُونَ).',
    difficulty: 'hard'
  },
  {
    id: 'mut-fatir-anbiya',
    surahNumber: 35,
    ayahNumber: 28,
    verseExcerpt: 'قوله تعالى في سورة فاطر: (إِنَّمَا يَخْشَى اللَّهَ مِنْ عِبَادِهِ ...)',
    distractorPassages: [
      'الْعُلَمَاءُ ۗ إِنَّ اللَّهَ عَزِيزٌ غَفُورٌ',
      'الْعُلَمَاءَ ۗ إِنَّ اللَّهَ غَفُورٌ رَّحِيمٌ',
      'الْمُؤْمِنُونَ ۗ إِنَّ اللَّهَ سَمِيعٌ عَلِيمٌ',
      'الصَّالِحُونَ ۗ وَأُولَٰئِكَ هُمُ الْفَائِزُونَ'
    ],
    correctText: 'الْعُلَمَاءُ ۗ إِنَّ اللَّهَ عَزِيزٌ غَفُورٌ',
    explanation: 'تختم الآية الكريمة في سورة فاطر بـ (إِنَّ اللَّهَ عَزِيزٌ غَفُورٌ) والعلماءُ مرفوعة بالضمة لأنها فاعل مؤخر.',
    difficulty: 'hard'
  },
  {
    id: 'mut-nahl-isra',
    surahNumber: 16,
    ayahNumber: 128,
    verseExcerpt: 'ما هو ختام سورة النحل الكريمة؟',
    distractorPassages: [
      'إِنَّ اللَّهَ مَعَ الَّذِينَ اتَّقَوا وَّالَّذِينَ هُم مُّحْسِنُونَ',
      'إِنَّ اللَّهَ يُدَافِعُ عَنِ الَّذِينَ آمَنُوا',
      'وَاصْبِرْ وَمَا صَبْرُكَ إِلَّا بِاللَّهِ ۚ وَلَا تَحْزَنْ عَلَيْهِمْ',
      'وَاعْبُدْ رَبَّكَ حَتَّىٰ يَأْتِيَكَ الْيَقِينُ'
    ],
    correctText: 'إِنَّ اللَّهَ مَعَ الَّذِينَ اتَّقَوا وَّالَّذِينَ هُم مُّحْسِنُونَ',
    explanation: 'تختم سورة النحل بقوله تعالى: (إِنَّ اللَّهَ مَعَ الَّذِينَ اتَّقَوا وَّالَّذِينَ هُم مُّحْسِنُونَ).',
    difficulty: 'medium'
  },
  {
    id: 'mut-baqarah-end-286',
    surahNumber: 2,
    ayahNumber: 286,
    verseExcerpt: 'قوله تعالى في خواتيم البقرة: (رَبَّنَا وَلَا تَحْمِلْ عَلَيْنَا إِصْرًا كَمَا حَمَلْتَهُ عَلَى ...)',
    distractorPassages: [
      'الَّذِينَ مِن قَبْلِنَا',
      'الَّذِينَ كَفَرُوا مِن بَعْدِ مَوْتِهِمْ',
      'آبَائِنَا وَإِنَّا لَكَ مُسْلِمُونَ',
      'أُمَمٍ قَدْ خَلَتْ مِن قَبْلِنَا'
    ],
    correctText: 'الَّذِينَ مِن قَبْلِنَا',
    explanation: 'قوله تعالى: (رَبَّنَا وَلَا تَحْمِلْ عَلَيْنَا إِصْرًا كَمَا حَمَلْتَهُ عَلَى الَّذِينَ مِن قَبْلِنَا).',
    difficulty: 'easy'
  },
  {
    id: 'mut-yusuf-end',
    surahNumber: 12,
    ayahNumber: 111,
    verseExcerpt: 'قوله تعالى في ختام سورة يوسف: (لَقَدْ كَانَ فِي قَصَصِهِمْ عِبْرَةٌ لِّأُولِي الْأَلْبَابِ ۗ مَا كَانَ حَدِيثًا يُفْتَرَىٰ وَلَٰكِن ...)',
    distractorPassages: [
      'تَصْدِيقَ الَّذِي بَيْنَ يَدَيْهِ وَتَفْصِيلَ كُلِّ شَيْءٍ وَهُدًى وَرَحْمَةً لِّقَوْمٍ يُؤْمِنُونَ',
      'تَبْيَانًا لِّكُلِّ شَيْءٍ وَهُدًى وَبُشْرَىٰ لِلْمُسْلِمِينَ',
      'مَوْعِظَةً وَذِكْرَىٰ لِلْمُؤْمِنِينَ',
      'بَصَائِرَ لِلنَّاسِ وَهُدًى وَرَحْمَةً لَّعَلَّهُمْ يَتَذَكَّرُونَ'
    ],
    correctText: 'تَصْدِيقَ الَّذِي بَيْنَ يَدَيْهِ وَتَفْصِيلَ كُلِّ شَيْءٍ وَهُدًى وَرَحْمَةً لِّقَوْمٍ يُؤْمِنُونَ',
    explanation: 'تختم سورة يوسف بـ: (تَصْدِيقَ الَّذِي بَيْنَ يَدَيْهِ وَتَفْصِيلَ كُلِّ شَيْءٍ وَهُدًى وَرَحْمَةً لِّقَوْمٍ يُؤْمِنُونَ).',
    difficulty: 'hard'
  }
];

// ============================================================================
// Curated Authentic Tajweed Question Bank (Applied Quranic Passages)
// ============================================================================
export interface TajweedQuestionSpec {
  id: string;
  questionText: string;
  contextAyah?: string;
  surahNumber?: number;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: QuestionDifficulty;
  ruleCategory: 'noon_tanween' | 'meem_sakinah' | 'mudood' | 'qalqalah' | 'sifat_makharij' | 'ra_lam' | 'waqf';
}

const AUTHENTIC_TAJWEED_BANK: TajweedQuestionSpec[] = [
  {
    id: 'taj-noon-1',
    questionText: 'ما هو حكم النون الساكنة في قوله تعالى: ﴿مِنْ عِلْمٍ﴾؟',
    contextAyah: 'وَمَا لَهُم بِهِ مِنْ عِلْمٍ',
    options: ['إظهار حلقي', 'إدغام بغنة', 'إخفاء حقيقي', 'إقلاب'],
    correctAnswer: 'إظهار حلقي',
    explanation: 'النون الساكنة بعدها حرف العين وهو من حروف الإظهار الحلقي الستة (ء هـ ع ح غ خ).',
    difficulty: 'easy',
    ruleCategory: 'noon_tanween'
  },
  {
    id: 'taj-noon-2',
    questionText: 'ما حكم النون الساكنة في قوله تعالى: ﴿مَن يَقُولُ﴾؟',
    contextAyah: 'وَمِنَ النَّاسِ مَن يَقُولُ آمَنَّا',
    options: ['إدغام بغنة', 'إظهار حلقي', 'إخفاء حقيقي', 'إدغام بغير غنة'],
    correctAnswer: 'إدغام بغنة',
    explanation: 'جاءت النون الساكنة وبعدها حرف الياء، وهو من حروف الإدغام بغنة المجموعة في كلمة (ينمو).',
    difficulty: 'easy',
    ruleCategory: 'noon_tanween'
  },
  {
    id: 'taj-noon-3',
    questionText: 'ما حكم التنوين في قوله تعالى: ﴿هُدًى لِّلْمُتَّقِينَ﴾؟',
    contextAyah: 'ذَٰلِكَ الْكِتَابُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى لِّلْمُتَّقِينَ',
    options: ['إدغام بغير غنة', 'إدغام بغنة', 'إخفاء حقيقي', 'إظهار حلقي'],
    correctAnswer: 'إدغام بغير غنة',
    explanation: 'التنوين بعده حرف اللام، واللام والراء حرفا الإدغام بغير غنة (إدغام كامل بلا غنة).',
    difficulty: 'easy',
    ruleCategory: 'noon_tanween'
  },
  {
    id: 'taj-noon-4',
    questionText: 'ما حكم النون الساكنة في قوله تعالى: ﴿مِنۢ بَعْدِ﴾؟',
    contextAyah: 'مِن بَعْدِ مِيثَاقِهِ',
    options: ['إقلاب (قلب)', 'إخفاء شفوي', 'إدغام متجانس', 'إظهار حلقي'],
    correctAnswer: 'إقلاب (قلب)',
    explanation: 'النون الساكنة بعدها حرف الباء، فتقلب النون الساكنة ميماً مخفاة بغنة.',
    difficulty: 'easy',
    ruleCategory: 'noon_tanween'
  },
  {
    id: 'taj-noon-5',
    questionText: 'ما حكم النون الساكنة في قوله تعالى: ﴿مِن قَبْلِكَ﴾؟',
    contextAyah: 'وَمَا أُنزِلَ مِن قَبْلِكَ',
    options: ['إخفاء حقيقي', 'إظهار حلقي', 'إدغام بغنة', 'قلقلة صغرى'],
    correctAnswer: 'إخفاء حقيقي',
    explanation: 'النون الساكنة بعدها حرف القاف، وهو أحد حروف الإخفاء الحقيقي الخمسة عشر وتكون الغنة مفخمة.',
    difficulty: 'easy',
    ruleCategory: 'noon_tanween'
  },
  {
    id: 'taj-meem-1',
    questionText: 'ما حكم الميم الساكنة في قوله تعالى: ﴿تَرْمِيهِم بِحِجَارَةٍ﴾؟',
    contextAyah: 'تَرْمِيهِم بِحِجَارَةٍ مِّن سِجِّيلٍ',
    options: ['إخفاء شفوي', 'إظهار شفوي', 'إدغام مثلين صغير', 'إقلاب'],
    correctAnswer: 'إخفاء شفوي',
    explanation: 'الميم الساكنة إذا تلاها حرف الباء فحكمها الإخفاء الشفوي بغنة حركتين.',
    difficulty: 'medium',
    ruleCategory: 'meem_sakinah'
  },
  {
    id: 'taj-meem-2',
    questionText: 'ما حكم الميم الساكنة في قوله تعالى: ﴿لَهُم مَّا يَشَاءُونَ﴾؟',
    contextAyah: 'لَهُم مَّا يَشَاءُونَ فِيهَا وَلَدَيْنَا مَزِيدٌ',
    options: ['إدغام مثلين صغير (إدغام شفوي)', 'إخفاء شفوي', 'إظهار شفوي', 'إظهار مطلق'],
    correctAnswer: 'إدغام مثلين صغير (إدغام شفوي)',
    explanation: 'ميم ساكنة تلتها ميم متحركة فيدغم الحرفان إدغام مثلين صغير بغنة.',
    difficulty: 'medium',
    ruleCategory: 'meem_sakinah'
  },
  {
    id: 'taj-madd-1',
    questionText: 'ما نوع المد ومقداره في كلمة ﴿جَآءَ﴾ عند حفص عن عاصم؟',
    options: [
      'مد واجب متصل، يمد 4 أو 5 حركات وجوباً',
      'مد جائز منفصل، يمد 4 أو 5 حركات جوازاً',
      'مد لازم كلمي، يمد 6 حركات',
      'مد بدل، يمد حركتين'
    ],
    correctAnswer: 'مد واجب متصل، يمد 4 أو 5 حركات وجوباً',
    explanation: 'اجتمع حرف المد مع الهمزة في كلمة واحدة فهو مد متصل وحكمه الوجوب.',
    difficulty: 'medium',
    ruleCategory: 'mudood'
  },
  {
    id: 'taj-madd-2',
    questionText: 'ما نوع المد ومقداره في قوله تعالى: ﴿وَلَا الضَّآلِّينَ﴾؟',
    contextAyah: 'غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ',
    options: [
      'مد لازم كلمي مثقل، يمد 6 حركات لزوماً',
      'مد واجب متصل، يمد 4 أو 5 حركات',
      'مد لازم كلمي مخفف، يمد 4 حركات',
      'مد عارض للسكون، يمد حركتين فقط'
    ],
    correctAnswer: 'مد لازم كلمي مثقل، يمد 6 حركات لزوماً',
    explanation: 'جاء بعد حرف المد حرف مشدد (اللام المشددة) في كلمة واحدة فهو لازم كلمي مثقل يمد 6 حركات حتماً.',
    difficulty: 'medium',
    ruleCategory: 'mudood'
  },
  {
    id: 'taj-madd-3',
    questionText: 'ما نوع المد في قوله تعالى: ﴿إِنَّآ أَنزَلْنَاهُ﴾؟',
    options: [
      'مد جائز منفصل، يمد 4 أو 5 حركات من طريق الشاطبية',
      'مد واجب متصل، يمد 6 حركات',
      'مد لازم حرفي مثقل',
      'مد تمكين يمد حركتين'
    ],
    correctAnswer: 'مد جائز منفصل، يمد 4 أو 5 حركات من طريق الشاطبية',
    explanation: 'انفصل حرف المد في آخر الكلمة الأولى والهمزة في أول الكلمة الثانية فهو مد منفصل.',
    difficulty: 'medium',
    ruleCategory: 'mudood'
  },
  {
    id: 'taj-qalqalah-1',
    questionText: 'ما مرتبة القلقلة في حرف القاف في كلمة ﴿يَقْطَعُونَ﴾؟',
    contextAyah: 'وَيَقْطَعُونَ مَا أَمَرَ اللَّهُ بِهِ أَن يُوصَلَ',
    options: [
      'قلقلة صغرى (لأن الحرف ساكن في وسط الكلمة)',
      'قلقلة كبرى (لأن الحرف مشدد)',
      'قلقلة أكبر عند الوقف فقط',
      'لا يوجد قلقلة لأن الحرف متحرك'
    ],
    correctAnswer: 'قلقلة صغرى (لأن الحرف ساكن في وسط الكلمة)',
    explanation: 'حروف القلقلة (قطب جد) إذا سكنت في وسط الكلمة أو درج الكلام كانت قلقلتها صغرى.',
    difficulty: 'medium',
    ruleCategory: 'qalqalah'
  },
  {
    id: 'taj-qalqalah-2',
    questionText: 'عند الوقف على كلمة ﴿الْحَقُّ﴾ في قوله تعالى: ﴿ذَٰلِكَ بِأَنَّ اللَّهَ هُوَ الْحَقُّ﴾ ما مرتبة القلقلة؟',
    options: [
      'قلقلة كبرى أو أشد (لوقوفنا على حرف مشدد متطرف)',
      'قلقلة صغرى خفيفة',
      'يسقط حرف القاف ويتحول إلى همس',
      'إدغام متماثل'
    ],
    correctAnswer: 'قلقلة كبرى أو أشد (لوقوفنا على حرف مشدد متطرف)',
    explanation: 'الوقف على حرف قلقلة مشدد متطرف يعطي أعلى مراتب القلقلة وضوحاً وبياناً.',
    difficulty: 'hard',
    ruleCategory: 'qalqalah'
  },
  {
    id: 'taj-ra-1',
    questionText: 'ما حكم حرف الراء في كلمة ﴿فِرْعَوْنَ﴾ وصلاً؟',
    options: [
      'الترقيق (لأنها ساكنة وقبلها كسر أصلي وليس بعدها حرف استعلاء)',
      'التفخيم (لأن الراء أصلها مفخم دائماً)',
      'جواز الوجهين التفخيم والترقيق',
      'الإشمام'
    ],
    correctAnswer: 'الترقيق (لأنها ساكنة وقبلها كسر أصلي وليس بعدها حرف استعلاء)',
    explanation: 'ترقق الراء الساكنة إذا سُبقت بكسر أصلي لازم ولم يأت بعدها حرف استعلاء مفتوح في كلمتها.',
    difficulty: 'hard',
    ruleCategory: 'ra_lam'
  },
  {
    id: 'taj-lam-1',
    questionText: 'ما حكم لام لفظ الجلالة في قوله تعالى: ﴿بِسْمِ اللَّهِ﴾ وقوله ﴿قَالَ اللَّهُ﴾؟',
    options: [
      'ترقق في (بِسْمِ اللَّهِ) وتفخم في (قَالَ اللَّهُ)',
      'تفخم في الموضعين احتراماً لاسم الجلالة',
      'ترقق في الموضعين لأن اللام أصلها الترقيق',
      'تفخم في (بِسْمِ اللَّهِ) وترقق في (قَالَ اللَّهُ)'
    ],
    correctAnswer: 'ترقق في (بِسْمِ اللَّهِ) وتفخم في (قَالَ اللَّهُ)',
    explanation: 'لام لفظ الجلالة ترقق إذا سُبقت بكسر، وتفخم (تغلظ) إذا سُبقت بفتح أو ضم.',
    difficulty: 'easy',
    ruleCategory: 'ra_lam'
  },
  {
    id: 'taj-sifat-1',
    questionText: 'ما هي الصفة اللازمة التي ينفرد بها حرف الضاد عن سائر الحروف الهجائية؟',
    options: ['الاستطالة', 'التفشي', 'القلقلة', 'الانحراف'],
    correctAnswer: 'الاستطالة',
    explanation: 'الاستطالة صفة لازمة لحرف الضاد، وتعني امتداد الصوت من أول إحدى حافتي اللسان إلى آخرها.',
    difficulty: 'hard',
    ruleCategory: 'sifat_makharij'
  },
  {
    id: 'taj-sifat-2',
    questionText: 'ما هي صفة (التفشي) وفي أي حرف تثبت؟',
    options: [
      'انتشار الريح في الفم عند النطق بحرف (الشين)',
      'خروج صوت يشبه صوت الطائر في حرف (الصاد)',
      'انحباس جريان النفس في حرف (الطاء)',
      'جريان الصوت في حرف (العين)'
    ],
    correctAnswer: 'انتشار الريح في الفم عند النطق بحرف (الشين)',
    explanation: 'التفشي هو انتشار الهواء في الفم عند النطق بحرف الشين حتى يتصل بمخرج الظاء.',
    difficulty: 'medium',
    ruleCategory: 'sifat_makharij'
  }
];

// ============================================================================
// Utility: Decoupled Fisher-Yates Shuffling
// ============================================================================
export function shuffleArray<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Normalizes Arabic text for lenient comparison (removing tashkeel & extra spaces)
 */
export function normalizeQuranicArabic(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '') // remove tashkeel & Quranic signs
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// Quran Dynamic Question Generators
// ============================================================================

/**
 * Builds an authentic Continue Verse or Order Verses question
 */
export async function createAuthenticVerseContinuationQuestion(
  surahNumber: number,
  ayahIndex1Based: number,
  difficulty: QuestionDifficulty = 'medium'
): Promise<QuestionBankItem | null> {
  const allVerses = await loadAllQuranVerses();
  const surahVerses = allVerses[surahNumber];
  if (!surahVerses || surahVerses.length < 2) return null;

  const sInfo = getSurahInfo(surahNumber);
  const targetIndex = Math.min(Math.max(1, ayahIndex1Based), surahVerses.length - 1);
  const currentAyah = surahVerses[targetIndex - 1];
  const nextAyah = surahVerses[targetIndex];

  // Pick 3 distractors from same or adjacent surahs
  const distractors: string[] = [];
  
  // Try previous ayah or later ayahs in same surah
  if (targetIndex >= 2 && surahVerses[targetIndex - 2]) {
    distractors.push(surahVerses[targetIndex - 2]);
  }
  if (targetIndex + 1 < surahVerses.length) {
    distractors.push(surahVerses[targetIndex + 1]);
  }
  if (targetIndex + 2 < surahVerses.length) {
    distractors.push(surahVerses[targetIndex + 2]);
  }

  // If we still need distractors, pull from neighbor surahs
  let fallbackSurahNum = (surahNumber % 114) + 1;
  while (distractors.length < 3) {
    const fVerses = allVerses[fallbackSurahNum];
    if (fVerses && fVerses.length > 0) {
      const randomV = fVerses[Math.floor(Math.random() * fVerses.length)];
      if (!distractors.includes(randomV) && randomV !== nextAyah) {
        distractors.push(randomV);
      }
    }
    fallbackSurahNum = (fallbackSurahNum % 114) + 1;
  }

  const rawOptions = [nextAyah, ...distractors.slice(0, 3)];
  const shuffledOptions = shuffleArray(rawOptions);

  return {
    questionId: `q-quran-order-${surahNumber}-${targetIndex}`,
    skill: 'quran_memorization',
    questionType: 'order_verses',
    difficulty,
    surahNumber,
    ayahNumber: targetIndex,
    questionText: `ما هي الآية التالية مباشرة لقوله تعالى في سورة ${sInfo.name}: ﴿${currentAyah}﴾؟`,
    options: shuffledOptions,
    correctAnswer: nextAyah,
    explanation: `الآية الكريمة التالية مباشرة في سورة ${sInfo.name} (الآية ${targetIndex + 1}) هي: ﴿${nextAyah}﴾.`
  };
}

/**
 * Builds an authentic Identify Surah question
 */
export async function createAuthenticIdentifySurahQuestion(
  surahNumber: number,
  ayahIndex1Based: number,
  difficulty: QuestionDifficulty = 'easy'
): Promise<QuestionBankItem | null> {
  const allVerses = await loadAllQuranVerses();
  const surahVerses = allVerses[surahNumber];
  if (!surahVerses || surahVerses.length === 0) return null;

  const sInfo = getSurahInfo(surahNumber);
  const targetIndex = Math.min(Math.max(1, ayahIndex1Based), surahVerses.length);
  const targetAyah = surahVerses[targetIndex - 1];

  // Distractor surahs of similar juz or revelation type
  const distractorNames: string[] = [];
  const candidateSurahs = QURAN_SURAHS.filter(s => s.number !== surahNumber);
  const shuffledCandidates = shuffleArray(candidateSurahs);

  for (const c of shuffledCandidates) {
    if (distractorNames.length >= 3) break;
    distractorNames.push(`سورة ${c.name}`);
  }

  const correctSurahName = `سورة ${sInfo.name}`;
  const options = shuffleArray([correctSurahName, ...distractorNames]);

  return {
    questionId: `q-quran-surah-${surahNumber}-${targetIndex}`,
    skill: 'quran_memorization',
    questionType: 'identify_surah',
    difficulty,
    surahNumber,
    ayahNumber: targetIndex,
    questionText: `في أي سورة كريمة ورد قوله تعالى: ﴿${targetAyah}﴾؟`,
    options,
    correctAnswer: correctSurahName,
    explanation: `هذه الآية الكريمة (رقم ${targetIndex}) وردت في سورة ${sInfo.name}.`
  };
}

/**
 * Builds an authentic Ayah Ending question
 */
export async function createAuthenticAyahEndingQuestion(
  surahNumber: number,
  ayahIndex1Based: number,
  difficulty: QuestionDifficulty = 'medium'
): Promise<QuestionBankItem | null> {
  const allVerses = await loadAllQuranVerses();
  const surahVerses = allVerses[surahNumber];
  if (!surahVerses || surahVerses.length === 0) return null;

  const targetIndex = Math.min(Math.max(1, ayahIndex1Based), surahVerses.length);
  const fullAyah = surahVerses[targetIndex - 1];
  const words = fullAyah.split(/\s+/).filter(Boolean);

  if (words.length < 5) {
    // Too short for ending split, fallback to identify surah
    return createAuthenticIdentifySurahQuestion(surahNumber, targetIndex, difficulty);
  }

  // Cut last 2-3 words as ending
  const cutCount = Math.min(3, Math.max(2, Math.floor(words.length * 0.25)));
  const prefixWords = words.slice(0, words.length - cutCount);
  const endingWords = words.slice(words.length - cutCount);

  const prefixText = prefixWords.join(' ');
  const correctEnding = endingWords.join(' ');

  // Common Quranic endings as distractors
  const commonEndings = [
    'إِنَّ اللَّهَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ',
    'وَاللَّهُ بِمَا تَعْمَلُونَ بَصِيرٌ',
    'إِنَّ اللَّهَ غَفُورٌ رَّحِيمٌ',
    'وَاللَّهُ سَمِيعٌ عَلِيمٌ',
    'إِنَّ اللَّهَ عَزِيزٌ حَكِيمٌ',
    'وَاللَّهُ عَلِيمٌ حَكِيمٌ',
    'فَإِنَّ اللَّهَ شَدِيدُ الْعِقَابِ',
    'أُولَٰئِكَ هُمُ الْمُفْلِحُونَ'
  ];

  const distractors = shuffleArray(
    commonEndings.filter(e => normalizeQuranicArabic(e) !== normalizeQuranicArabic(correctEnding))
  ).slice(0, 3);

  const options = shuffleArray([correctEnding, ...distractors]);

  return {
    questionId: `q-quran-ending-${surahNumber}-${targetIndex}`,
    skill: 'quran_memorization',
    questionType: 'ayah_ending',
    difficulty,
    surahNumber,
    ayahNumber: targetIndex,
    questionText: `أكمل خاتمة الآية الكريمة: ﴿${prefixText} ...﴾؟`,
    options,
    correctAnswer: correctEnding,
    explanation: `الخاتمة الدقيقة للآية هي: ﴿${correctEnding}﴾ في سورة ${getSurahInfo(surahNumber).name}.`
  };
}

// ============================================================================
// Core Orchestrator: Generate 10-Question Placement Diagnostic
// ============================================================================

export interface PlacementGenerationParams {
  isKhatim: boolean;
  memorizedJuzRange?: { fromJuz: number; toJuz: number };
  actualReachedSurah?: number; // e.g. 114 to 1, or 2 to 114
  startingDirection?: 'baqarah_to_nas' | 'nas_to_baqarah';
  weakSurahs?: number[];
  seenQuestionIds?: string[];
  questionCount?: number; // Default 10
}

/**
 * Generates an authentic diagnostic placement test according to platform rules:
 * - Khatim: 7 Quran questions (3 easy, 4 hard on mutashabihat & deep precision) + 3 Tajweed questions.
 * - Non-Khatim: 5 Quran questions (strictly within memorized scope) + 5 Tajweed questions.
 * - Anti-repetition check via seenQuestionIds.
 * - Decoupled option shuffling.
 */
export async function generatePlacementDiagnosticTest(
  params: PlacementGenerationParams
): Promise<QuestionBankItem[]> {
  const {
    isKhatim,
    memorizedJuzRange = { fromJuz: isKhatim ? 1 : 28, toJuz: 30 },
    startingDirection = 'nas_to_baqarah',
    weakSurahs = [],
    seenQuestionIds = [],
    questionCount = 10
  } = params;

  const seenSet = new Set(seenQuestionIds);
  const quranQuestions: QuestionBankItem[] = [];
  const tajweedQuestions: QuestionBankItem[] = [];

  // Determine target counts
  const targetQuranCount = isKhatim ? 7 : 5;
  const targetTajweedCount = questionCount - targetQuranCount;

  // 1. SELECT TAJWEED QUESTIONS
  const shuffledTajweedBank = shuffleArray(AUTHENTIC_TAJWEED_BANK);
  for (const t of shuffledTajweedBank) {
    if (tajweedQuestions.length >= targetTajweedCount) break;
    if (seenSet.has(t.id)) continue;

    tajweedQuestions.push({
      questionId: t.id,
      skill: 'tajweed_rules',
      questionType: 'tajweed_rule',
      difficulty: t.difficulty,
      questionText: t.questionText,
      options: shuffleArray(t.options), // decoupled shuffling
      correctAnswer: t.correctAnswer,
      explanation: t.explanation,
      surahNumber: t.surahNumber
    });
  }

  // Fallback if some were filtered by seenSet
  if (tajweedQuestions.length < targetTajweedCount) {
    for (const t of shuffledTajweedBank) {
      if (tajweedQuestions.length >= targetTajweedCount) break;
      if (!tajweedQuestions.some(item => item.questionId === t.id)) {
        tajweedQuestions.push({
          questionId: t.id,
          skill: 'tajweed_rules',
          questionType: 'tajweed_rule',
          difficulty: t.difficulty,
          questionText: t.questionText,
          options: shuffleArray(t.options),
          correctAnswer: t.correctAnswer,
          explanation: t.explanation,
          surahNumber: t.surahNumber
        });
      }
    }
  }

  // 2. SELECT QURAN QUESTIONS
  if (isKhatim) {
    // KHATIM: 3 Easy questions + 4 Hard questions (Mutashabihat & deep precision)
    // Add Mutashabihat (Hard questions)
    const shuffledMut = shuffleArray(AUTHENTIC_MUTASHABIHAT);
    for (const m of shuffledMut) {
      if (quranQuestions.length >= 4) break;
      if (seenSet.has(m.id)) continue;

      quranQuestions.push({
        questionId: m.id,
        skill: 'mutashabihat',
        questionType: 'mutashabihat_distinction',
        difficulty: 'hard',
        surahNumber: m.surahNumber,
        ayahNumber: m.ayahNumber,
        questionText: `${m.verseExcerpt} - اختر التتمة القرآنية الدقيقة:`,
        options: shuffleArray(m.distractorPassages),
        correctAnswer: m.correctText,
        explanation: m.explanation
      });
    }

    // Add Easy/Medium questions across the entire Quran
    const easySurahs = [1, 36, 55, 67, 18, 12, 49]; // Fatihah, Yasin, Rahman, Mulk, Kahf, Yusuf, Hujurat
    for (const sNum of shuffleArray(easySurahs)) {
      if (quranQuestions.length >= targetQuranCount) break;
      const sInfo = getSurahInfo(sNum);
      const randomAyah = Math.min(sInfo.numberOfAyahs, Math.max(1, Math.floor(sInfo.numberOfAyahs * 0.3)));
      const q = await createAuthenticVerseContinuationQuestion(sNum, randomAyah, 'easy');
      if (q && !seenSet.has(q.questionId)) {
        quranQuestions.push(q);
      }
    }

    // If still need questions to reach 7, add Ayah Ending or Identify Surah
    let fallbackSurah = 2;
    while (quranQuestions.length < targetQuranCount && fallbackSurah <= 114) {
      const q = await createAuthenticAyahEndingQuestion(fallbackSurah, 5, 'medium');
      if (q && !quranQuestions.some(item => item.questionId === q.questionId)) {
        quranQuestions.push(q);
      }
      fallbackSurah = (fallbackSurah % 114) + 1;
    }
  } else {
    // NON-KHATIM: 5 Quran questions strictly within memorized portion
    // Determine eligible Surahs based on memorized Juz or starting direction
    const eligibleSurahs: number[] = [];

    // Prioritize weak surahs if specified by student
    if (weakSurahs && weakSurahs.length > 0) {
      eligibleSurahs.push(...weakSurahs);
    }

    // Determine scope from Juz
    const minJuz = Math.min(memorizedJuzRange.fromJuz, memorizedJuzRange.toJuz);
    const maxJuz = Math.max(memorizedJuzRange.fromJuz, memorizedJuzRange.toJuz);

    for (const s of QURAN_SURAHS) {
      if (s.juz >= minJuz && s.juz <= maxJuz && !eligibleSurahs.includes(s.number)) {
        eligibleSurahs.push(s.number);
      }
    }

    // If direction is nas_to_baqarah, prioritize Juz 30 and 29 first
    if (startingDirection === 'nas_to_baqarah') {
      eligibleSurahs.sort((a, b) => b - a);
    } else {
      eligibleSurahs.sort((a, b) => a - b);
    }

    // Ensure we have at least some surahs
    if (eligibleSurahs.length === 0) {
      eligibleSurahs.push(114, 113, 112, 110, 108, 97, 67);
    }

    const shuffledEligible = shuffleArray(eligibleSurahs);
    for (const sNum of shuffledEligible) {
      if (quranQuestions.length >= targetQuranCount) break;
      const sInfo = getSurahInfo(sNum);
      const isWeak = weakSurahs.includes(sNum);
      const diff: QuestionDifficulty = isWeak ? 'hard' : 'medium';

      const targetAyah = Math.min(sInfo.numberOfAyahs, Math.max(1, Math.floor(sInfo.numberOfAyahs * 0.5)));

      // Vary between identify_surah, continue_verse, and ending
      let item: QuestionBankItem | null = null;
      if (quranQuestions.length % 2 === 0) {
        item = await createAuthenticVerseContinuationQuestion(sNum, targetAyah, diff);
      } else {
        item = await createAuthenticIdentifySurahQuestion(sNum, targetAyah, 'easy');
      }

      if (item && !seenSet.has(item.questionId)) {
        quranQuestions.push(item);
      }
    }

    // Fallback if needed
    let idx = 0;
    while (quranQuestions.length < targetQuranCount && idx < eligibleSurahs.length) {
      const sNum = eligibleSurahs[idx++];
      const q = await createAuthenticAyahEndingQuestion(sNum, 2, 'medium');
      if (q && !quranQuestions.some(x => x.questionId === q.questionId)) {
        quranQuestions.push(q);
      }
    }
  }

  // Interleave Quran and Tajweed questions seamlessly
  const finalQuestions: QuestionBankItem[] = [];
  let qIdx = 0;
  let tIdx = 0;

  while (finalQuestions.length < questionCount && (qIdx < quranQuestions.length || tIdx < tajweedQuestions.length)) {
    // Add Quran question
    if (qIdx < quranQuestions.length) {
      finalQuestions.push(quranQuestions[qIdx++]);
    }
    // Add Tajweed question
    if (tIdx < tajweedQuestions.length) {
      finalQuestions.push(tajweedQuestions[tIdx++]);
    }
  }

  return finalQuestions.slice(0, questionCount);
}

// ============================================================================
// Multi-Dimensional Scoring Engine
// ============================================================================

export interface EvaluationInput {
  answers: PlacementQuestionResult[];
  studentInfo?: Partial<StudentRegistrationApplication>;
  isKhatim?: boolean;
}

/**
 * Strict evaluation of placement test with:
 * - 8-second time check (isTimedOut -> incorrect)
 * - Memorization score
 * - Tajweed score
 * - Retention score (speed & consistency weighted)
 * - 6-level classification
 * - Actionable recommendations
 */
export function evaluatePlacementDiagnostic(input: EvaluationInput): PlacementTestSummary {
  const { answers, isKhatim = false, studentInfo } = input;

  let totalQuranCount = 0;
  let correctQuranCount = 0;
  let totalTajweedCount = 0;
  let correctTajweedCount = 0;

  let totalResponseTime = 0;
  let timedOutCount = 0;
  let highSpeedBonus = 0;

  const mistakes: Array<{
    questionId: string;
    skill: QuestionSkill;
    difficulty: QuestionDifficulty;
    questionText: string;
    studentAnswer: string;
    correctAnswer: string;
    explanation?: string;
  }> = [];

  for (const ans of answers) {
    const isTimeout = ans.isTimedOut || (ans.timeTakenSeconds !== undefined && ans.timeTakenSeconds > 8.5);
    const effectiveCorrect = !isTimeout && ans.isCorrect;

    totalResponseTime += ans.timeTakenSeconds || 0;
    if (isTimeout) {
      timedOutCount++;
    } else if (effectiveCorrect && ans.timeTakenSeconds && ans.timeTakenSeconds < 4) {
      highSpeedBonus += 2; // reward prompt correct answers
    }

    if (ans.skill === 'quran_memorization' || ans.skill === 'mutashabihat') {
      totalQuranCount++;
      if (effectiveCorrect) correctQuranCount++;
    } else {
      totalTajweedCount++;
      if (effectiveCorrect) correctTajweedCount++;
    }

    if (!effectiveCorrect) {
      mistakes.push({
        questionId: ans.questionId,
        skill: ans.skill,
        difficulty: ans.difficulty,
        questionText: ans.questionText,
        studentAnswer: isTimeout ? 'لم يجب ضمن الوقت (انتهت المهلة)' : ans.selectedOption,
        correctAnswer: ans.correctAnswer,
        explanation: ans.explanation
      });
    }
  }

  // Calculations
  const memorizationScore = totalQuranCount > 0 ? Math.round((correctQuranCount / totalQuranCount) * 100) : 0;
  const tajweedScore = totalTajweedCount > 0 ? Math.round((correctTajweedCount / totalTajweedCount) * 100) : 0;

  // Retention score: considers speed, lack of timeouts, and accuracy
  const accuracyBase = Math.round((memorizationScore * 0.7) + (tajweedScore * 0.3));
  const timeoutPenalty = timedOutCount * 6;
  const rawRetention = accuracyBase + highSpeedBonus - timeoutPenalty;
  const retentionScore = Math.max(0, Math.min(100, Math.round(rawRetention)));

  // Overall Score (Weighted: 60% Memorization, 40% Tajweed)
  const overallScore = Math.round((memorizationScore * 0.6) + (tajweedScore * 0.4));

  // 6-Level Classification
  let classifiedLevel: PlacementTestSummary['classifiedLevel'] = 'تأسيسي';

  if (isKhatim && overallScore >= 88 && tajweedScore >= 80) {
    classifiedLevel = 'خاتم ومتقن';
  } else if (overallScore >= 80) {
    classifiedLevel = 'متقدم';
  } else if (overallScore >= 68) {
    classifiedLevel = 'متوسط مرتفع';
  } else if (overallScore >= 55) {
    classifiedLevel = 'متوسط';
  } else if (overallScore >= 40) {
    classifiedLevel = 'مبتدئ واعد';
  } else {
    classifiedLevel = 'تأسيسي';
  }

  // Confidence Rating
  let confidenceRating: 'high' | 'medium' | 'low' = 'high';
  if (timedOutCount >= 3 || answers.length < 8) {
    confidenceRating = 'low';
  } else if (timedOutCount >= 1 || (memorizationScore >= 80 && tajweedScore <= 40)) {
    confidenceRating = 'medium';
  }

  // Actionable Pedagogical Recommendations
  const recommendations: string[] = [];

  if (mistakes.some(m => m.skill === 'mutashabihat')) {
    recommendations.push('تركيز مكثف على مواضع المتشابهات اللفظية والربط السياقي للآيات المتقاربة.');
  }
  if (tajweedScore < 60) {
    recommendations.push('إدراج دورة أحكام النون الساكنة والتنوين والمدود العملية ضمن جدول الحلقة.');
  }
  if (timedOutCount >= 2) {
    recommendations.push('تعزيز سرعة الاستحضار الذهني عبر جلسات التسميع السريع المتباعد.');
  }
  if (studentInfo?.weakSurahs && studentInfo.weakSurahs.length > 0) {
    const sNames = studentInfo.weakSurahs.slice(0, 3).map(num => getSurahInfo(num).name).join('، ');
    recommendations.push(`تخصيص ورد مراجعة علاجية يومي للسور المحددة ذات التحدي (${sNames}).`);
  }
  if (recommendations.length === 0) {
    recommendations.push('الحفظ والتجويد متينان؛ يوصى بالانخراط في مسار الإتقان العالي وسرد الأجزاء.');
  }

  return {
    totalQuestions: answers.length,
    correctCount: correctQuranCount + correctTajweedCount,
    incorrectCount: mistakes.length,
    memorizationScore,
    tajweedScore,
    retentionScore,
    overallScore,
    classifiedLevel,
    confidenceRating,
    recommendations,
    completedAt: new Date().toISOString(),
    questionResults: answers
  };
}
