import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Printer,
  Search,
  Calendar,
  Layers,
  Plus,
  Trash2,
  ExternalLink,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  FolderArchive,
  FolderOpen,
  HardDrive,
  Link2,
  Unlink,
  ShieldCheck,
  Award,
  ClipboardCheck,
  Upload,
  Building2,
  X
} from 'lucide-react';
import {
  LibraryDocument,
  LibraryDocumentType,
  LibraryDriveSection,
  Student,
  Halaqah,
  Exam,
  AttendanceRecord,
  StudentEvaluation,
  QuranComplex,
  GoogleOAuthConfig
} from '../../types';
import { GoogleWorkspaceService, DRIVE_SECTION_NAMES } from '../../lib/googleWorkspace';
import { triggerComplexThemePulse } from '../../utils/highlightHelper';

interface LibraryTabProps {
  libraryDocs: LibraryDocument[];
  students: Student[];
  halaqahs: Halaqah[];
  teacherHalaqahs?: Halaqah[];
  exams: Exam[];
  attendance: AttendanceRecord[];
  evaluations: StudentEvaluation[];
  currentUserName: string;
  isSupervisor: boolean;
  isDeveloper?: boolean;
  activeComplex?: QuranComplex | null;
  googleAuthConfig?: GoogleOAuthConfig;
  driveUploadVersion?: number;
  onRefreshGoogleAuth?: () => Promise<void>;
  onSaveDocument: (
    doc: LibraryDocument,
    options?: {
      blob?: Blob;
      htmlContent?: string;
      mimeType?: string;
      fileExtension?: string;
    }
  ) => Promise<void>;
  onDeleteDocument: (docId: string, driveFileId?: string) => Promise<void>;
  initialHighlightId?: string;
  initialSearchQuery?: string;
}

export const LibraryTab: React.FC<LibraryTabProps> = ({
  libraryDocs = [],
  students = [],
  halaqahs = [],
  teacherHalaqahs = [],
  exams = [],
  attendance = [],
  currentUserName,
  isSupervisor = false,
  isDeveloper = false,
  activeComplex,
  googleAuthConfig,
  driveUploadVersion = 0,
  onRefreshGoogleAuth,
  onSaveDocument,
  onDeleteDocument,
  initialHighlightId,
  initialSearchQuery
}) => {
  const [activeSectionFilter, setActiveSectionFilter] = useState<'all' | LibraryDriveSection>('all');
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('');
  const [selectedHalaqahFilter, setSelectedHalaqahFilter] = useState<string>('all');

  // Drive live state
  const [driveDocs, setDriveDocs] = useState<LibraryDocument[]>([]);
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [needsSessionRefresh, setNeedsSessionRefresh] = useState(false);
  const [isLinkingAccount, setIsLinkingAccount] = useState(false);
  const [isUnlinkingAccount, setIsUnlinkingAccount] = useState(false);
  const [confirmUnlinkModal, setConfirmUnlinkModal] = useState(false);

  // Preview Modal
  const [previewDoc, setPreviewDoc] = useState<LibraryDocument | null>(null);
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);

  // New Document / Upload Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docSection, setDocSection] = useState<LibraryDriveSection>('reports');
  const [docDescription, setDocDescription] = useState('');
  const [docHalaqahId, setDocHalaqahId] = useState('all');
  const [docContent, setDocContent] = useState('');
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [isSavingDoc, setIsSavingDoc] = useState(false);

  // Delete Confirmation Modal
  const [docToDelete, setDocToDelete] = useState<LibraryDocument | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);

  // Status Toast
  const [statusToast, setStatusToast] = useState<{
    type: 'success' | 'error';
    text: string;
    link?: string;
  } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', text: string, link?: string) => {
    setStatusToast({ type, text, link });
    setTimeout(() => setStatusToast(null), 6000);
  }, []);

  const complexId = activeComplex?.id || 'default-complex';
  const complexName = activeComplex?.name || 'المجمع القرآني';

  const isComplexGoogleLinked = Boolean(
    googleAuthConfig?.isLinked &&
      (!googleAuthConfig.complexId || googleAuthConfig.complexId === complexId)
  );

  useEffect(() => {
    if (initialSearchQuery) {
      setSearchQuery(initialSearchQuery);
    }
    if (initialHighlightId) {
      setTimeout(() => {
        triggerComplexThemePulse(initialHighlightId);
      }, 350);
    }
  }, [initialHighlightId, initialSearchQuery]);

  // Refs to guarantee zero infinite refresh loops:
  // Only fetch once when opening a linked complex, OR when THIS user uploads a new file (driveUploadVersion increments), OR manual click.
  const isFetchingDriveRef = useRef(false);
  const loadedDriveComplexKeyRef = useRef<string>('');
  const lastHandledUploadVersionRef = useRef<number>(driveUploadVersion);

  const syncFromComplexGoogleDrive = useCallback(
    async (interactiveIfNeeded = false) => {
      if (!isComplexGoogleLinked) {
        setDriveDocs([]);
        return;
      }
      if (isFetchingDriveRef.current) return;

      isFetchingDriveRef.current = true;
      setIsSyncingDrive(true);
      try {
        if (interactiveIfNeeded) {
          await GoogleWorkspaceService.linkGoogleAccount(complexId, complexName);
          if (onRefreshGoogleAuth) await onRefreshGoogleAuth();
        }
        const res = await GoogleWorkspaceService.fetchComplexDriveLibraryDocuments(
          complexId,
          complexName
        );
        setDriveDocs(res.driveDocs || []);
        setNeedsSessionRefresh(Boolean(res.needsSessionAuth));
      } catch (err: any) {
        showToast('error', err?.message || 'تعذر مزامنة ملفات Google Drive الخاصة بالمجمع.');
      } finally {
        isFetchingDriveRef.current = false;
        setIsSyncingDrive(false);
      }
    },
    [isComplexGoogleLinked, complexId, complexName, onRefreshGoogleAuth, showToast]
  );

  // 1. Initial load ONLY ONCE per linked complex (no polling, no state-update loop)
  const linkedAccountIdentity = isComplexGoogleLinked
    ? `${complexId}:${googleAuthConfig?.connectedEmail || 'linked'}`
    : '';

  useEffect(() => {
    if (!linkedAccountIdentity) {
      loadedDriveComplexKeyRef.current = '';
      setDriveDocs([]);
      setNeedsSessionRefresh(false);
      return;
    }
    if (loadedDriveComplexKeyRef.current === linkedAccountIdentity) {
      return;
    }
    loadedDriveComplexKeyRef.current = linkedAccountIdentity;
    syncFromComplexGoogleDrive(false);
  }, [linkedAccountIdentity, syncFromComplexGoogleDrive]);

  // 2. Refresh ONLY for this user when they upload/save a new file
  useEffect(() => {
    if (driveUploadVersion > lastHandledUploadVersionRef.current) {
      lastHandledUploadVersionRef.current = driveUploadVersion;
      if (isComplexGoogleLinked) {
        syncFromComplexGoogleDrive(false);
      }
    }
  }, [driveUploadVersion, isComplexGoogleLinked, syncFromComplexGoogleDrive]);

  const handleLinkComplexLibrary = async () => {
    setIsLinkingAccount(true);
    try {
      const res = await GoogleWorkspaceService.linkGoogleAccount(complexId, complexName);
      loadedDriveComplexKeyRef.current = `${complexId}:${res.email || 'linked'}`;
      if (onRefreshGoogleAuth) await onRefreshGoogleAuth();
      const driveRes = await GoogleWorkspaceService.fetchComplexDriveLibraryDocuments(
        complexId,
        complexName
      );
      setDriveDocs(driveRes.driveDocs || []);
      setNeedsSessionRefresh(false);
      showToast(
        'success',
        `تم ربط مكتبة (${complexName}) بحساب Google (${res.email}) وإنشاء مجلدات الأقسام على Google Drive بنجاح!`,
        res.config.driveRootFolderUrl
      );
    } catch (err: any) {
      showToast('error', err?.message || 'لم يكتمل ربط حساب Google للمجمع.');
    } finally {
      setIsLinkingAccount(false);
    }
  };

  const handleConfirmUnlinkComplex = async () => {
    setIsUnlinkingAccount(true);
    try {
      await GoogleWorkspaceService.disconnectGoogleAccount(complexId);
      setDriveDocs([]);
      setConfirmUnlinkModal(false);
      if (onRefreshGoogleAuth) await onRefreshGoogleAuth();
      showToast('success', `تم إلغاء ربط حساب Google عن (${complexName}) بشكل مستقل دون التأثير على أي مجمع آخر.`);
    } catch (err: any) {
      showToast('error', err?.message || 'تعذر إلغاء ربط الحساب.');
    } finally {
      setIsUnlinkingAccount(false);
    }
  };

  // Teacher specific halaqahs
  const effectiveTeacherHalaqahs = useMemo(() => {
    if (isSupervisor || isDeveloper) return halaqahs;
    return teacherHalaqahs && teacherHalaqahs.length > 0 ? teacherHalaqahs : halaqahs;
  }, [isSupervisor, isDeveloper, teacherHalaqahs, halaqahs]);

  const teacherHalaqahIds = useMemo(() => {
    return new Set(effectiveTeacherHalaqahs.map(h => h.id));
  }, [effectiveTeacherHalaqahs]);

  // Combine live Google Drive files + Firestore Complex Library metadata (deduplicated by driveFileId)
  const combinedDocuments = useMemo(() => {
    if (!isComplexGoogleLinked) return [];

    const byDriveId = new Map<string, LibraryDocument>();
    const standaloneDocs: LibraryDocument[] = [];

    // 1. Live Google Drive files (authoritative Drive links & folders)
    driveDocs.forEach(dDoc => {
      if (dDoc.driveFileId) {
        byDriveId.set(dDoc.driveFileId, dDoc);
      }
    });

    // 2. Enrich with Firestore metadata (halaqahName, studentName, htmlContent, createdBy) strictly for this complex
    libraryDocs
      .filter(doc => !doc.complexId || doc.complexId === complexId)
      .forEach(metaDoc => {
        const key =
          metaDoc.driveFileId ||
          metaDoc.googleSpreadsheetId ||
          metaDoc.googleFormId;
        if (key && byDriveId.has(key)) {
          const driveEntry = byDriveId.get(key)!;
          byDriveId.set(key, {
            ...driveEntry,
            ...metaDoc,
            driveFileId: driveEntry.driveFileId,
            driveFolderId: driveEntry.driveFolderId || metaDoc.driveFolderId,
            driveFolderName: driveEntry.driveFolderName || metaDoc.driveFolderName,
            driveWebViewLink: driveEntry.driveWebViewLink || metaDoc.driveWebViewLink || metaDoc.googleUrl,
            googleUrl: driveEntry.driveWebViewLink || metaDoc.googleUrl,
            sectionCategory:
              metaDoc.sectionCategory ||
              driveEntry.sectionCategory ||
              GoogleWorkspaceService.resolveDocSection(metaDoc)
          });
        } else if (key) {
          byDriveId.set(key, {
            ...metaDoc,
            sectionCategory:
              metaDoc.sectionCategory || GoogleWorkspaceService.resolveDocSection(metaDoc)
          });
        } else {
          standaloneDocs.push({
            ...metaDoc,
            sectionCategory:
              metaDoc.sectionCategory || GoogleWorkspaceService.resolveDocSection(metaDoc)
          });
        }
      });

    // 3. Also surface Complex Exams linked to Google Sheets inside 'الاختبارات'
    exams
      .filter(ex => (!ex.complexId || ex.complexId === complexId) && ex.googleSpreadsheetId)
      .forEach(ex => {
        if (ex.googleSpreadsheetId && !byDriveId.has(ex.googleSpreadsheetId)) {
          byDriveId.set(ex.googleSpreadsheetId, {
            id: `auto-sheet-${ex.id}`,
            complexId,
            title: `جدول نتائج: ${ex.title}`,
            type: 'google_sheet',
            sectionCategory: 'exams',
            driveFileId: ex.googleSpreadsheetId,
            driveFolderName: DRIVE_SECTION_NAMES.exams,
            halaqahId: ex.targetHalaqat?.[0] || 'all',
            description: 'جدول بيانات Google Sheets لدرجات الطلاب في الاختبار',
            googleSpreadsheetId: ex.googleSpreadsheetId,
            googleUrl: ex.googleSpreadsheetUrl,
            driveWebViewLink: ex.googleSpreadsheetUrl,
            createdBy: ex.createdByName || 'النظام الآلي',
            createdAt: ex.createdAt
          });
        }
      });

    const all = [...Array.from(byDriveId.values()), ...standaloneDocs];

    // Role-based visibility
    const scoped =
      isSupervisor || isDeveloper
        ? all
        : all.filter(doc => {
            if (!doc.halaqahId || doc.halaqahId === 'all') return true;
            return teacherHalaqahIds.has(doc.halaqahId);
          });

    return scoped.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [
    isComplexGoogleLinked,
    driveDocs,
    libraryDocs,
    exams,
    complexId,
    isSupervisor,
    isDeveloper,
    teacherHalaqahIds
  ]);

  // Section counts
  const sectionCounts = useMemo(() => {
    const counts: Record<'all' | LibraryDriveSection, number> = {
      all: combinedDocuments.length,
      certificates: 0,
      attendance: 0,
      exams: 0,
      reports: 0,
      general: 0
    };
    combinedDocuments.forEach(doc => {
      const sec = doc.sectionCategory || GoogleWorkspaceService.resolveDocSection(doc);
      counts[sec] = (counts[sec] || 0) + 1;
    });
    return counts;
  }, [combinedDocuments]);

  // Filtered Documents
  const filteredDocs = useMemo(() => {
    return combinedDocuments.filter(doc => {
      const sec = doc.sectionCategory || GoogleWorkspaceService.resolveDocSection(doc);
      if (activeSectionFilter !== 'all' && sec !== activeSectionFilter) {
        return false;
      }
      if (selectedHalaqahFilter !== 'all') {
        if (doc.halaqahId && doc.halaqahId !== 'all' && doc.halaqahId !== selectedHalaqahFilter) {
          return false;
        }
      }
      if (selectedDateFilter) {
        const docDate = (doc.createdAt || '').split('T')[0];
        if (docDate !== selectedDateFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = doc.title.toLowerCase().includes(q);
        const matchDesc = (doc.description || '').toLowerCase().includes(q);
        const matchFolder = (doc.driveFolderName || '').toLowerCase().includes(q);
        const matchStudent = (doc.studentName || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchFolder && !matchStudent) return false;
      }
      return true;
    });
  }, [
    combinedDocuments,
    activeSectionFilter,
    selectedHalaqahFilter,
    selectedDateFilter,
    searchQuery
  ]);

  const sectionTypeFromCategory = (sec: LibraryDriveSection): LibraryDocumentType => {
    switch (sec) {
      case 'certificates':
        return 'certificate';
      case 'attendance':
        return 'attendance_sheet';
      case 'exams':
        return 'exam_archive';
      case 'reports':
        return 'pdf_report';
      default:
        return 'custom_note';
    }
  };

  // Save / Upload new file into Library & Google Drive section folder
  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedTitle = docTitle.trim() || selectedUploadFile?.name?.replace(/\.[^/.]+$/, '') || '';
    if (!resolvedTitle) {
      showToast('error', 'يرجى كتابة اسم الملف أو اختيار ملف للرفع.');
      return;
    }

    setIsSavingDoc(true);
    try {
      const selectedHalaqah = effectiveTeacherHalaqahs.find(h => h.id === docHalaqahId);
      const newDoc: LibraryDocument = {
        id: `lib-${Date.now()}`,
        complexId,
        title: resolvedTitle,
        type: sectionTypeFromCategory(docSection),
        sectionCategory: docSection,
        halaqahId: docHalaqahId,
        halaqahName: docHalaqahId === 'all' ? 'جميع الحلقات' : selectedHalaqah?.name,
        description: docDescription.trim() || `محفوظ في مجلد (${DRIVE_SECTION_NAMES[docSection]})`,
        htmlContent: !selectedUploadFile ? docContent.trim() || docDescription.trim() || resolvedTitle : undefined,
        createdBy: currentUserName,
        createdAt: new Date().toISOString()
      };

      const fileExt = selectedUploadFile?.name?.includes('.')
        ? `.${selectedUploadFile.name.split('.').pop()}`
        : undefined;

      await onSaveDocument(newDoc, {
        blob: selectedUploadFile || undefined,
        htmlContent: !selectedUploadFile ? newDoc.htmlContent : undefined,
        mimeType: selectedUploadFile?.type || undefined,
        fileExtension: fileExt
      });

      setDocTitle('');
      setDocDescription('');
      setDocContent('');
      setSelectedUploadFile(null);
      setIsAddModalOpen(false);
      showToast('success', `تم حفظ الملف في المكتبة ومجلد (${DRIVE_SECTION_NAMES[docSection]}) على Google Drive بنجاح!`);
    } catch (err: any) {
      if (err?.message !== 'LIBRARY_NOT_LINKED') {
        showToast('error', err?.message || 'تعذر حفظ الملف في Google Drive.');
      }
    } finally {
      setIsSavingDoc(false);
    }
  };

  // Export Attendance directly to Complex Google Drive 'الحضور والغياب' folder
  const [isExportingAttendance, setIsExportingAttendance] = useState(false);
  const handleExportAttendanceToDrive = async () => {
    setIsExportingAttendance(true);
    try {
      const res = await GoogleWorkspaceService.exportAttendanceToGoogleSheet(
        attendance,
        students,
        undefined,
        complexId,
        complexName
      );

      const sheetDoc: LibraryDocument = {
        id: `lib-att-${Date.now()}`,
        complexId,
        title: `الحضور والغياب - ${complexName} (${new Date().toLocaleDateString('ar-SA')})`,
        type: 'attendance_sheet',
        sectionCategory: 'attendance',
        halaqahId: 'all',
        halaqahName: 'جميع الحلقات',
        description: `كشف حضور وغياب إلكتروني محفوظ في مجلد (الحضور والغياب) على Google Drive`,
        googleSpreadsheetId: res.spreadsheetId,
        driveFileId: res.spreadsheetId,
        driveFolderName: DRIVE_SECTION_NAMES.attendance,
        googleUrl: res.spreadsheetUrl,
        driveWebViewLink: res.spreadsheetUrl,
        createdBy: currentUserName,
        createdAt: new Date().toISOString()
      };

      await onSaveDocument(sheetDoc);
      showToast('success', 'تم حفظ كشف الحضور والغياب في مجلد (الحضور والغياب) على Google Drive!', res.spreadsheetUrl);
    } catch (err: any) {
      if (err?.message !== 'LIBRARY_NOT_LINKED') {
        showToast('error', err?.message || 'تعذر تصدير وحفظ كشف الحضور في Google Drive.');
      }
    } finally {
      setIsExportingAttendance(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!docToDelete) return;
    setIsDeletingDoc(true);
    try {
      await onDeleteDocument(docToDelete.id, docToDelete.driveFileId);
      setDriveDocs(prev =>
        prev.filter(
          d =>
            d.id !== docToDelete.id &&
            (!docToDelete.driveFileId || d.driveFileId !== docToDelete.driveFileId)
        )
      );
      setDocToDelete(null);
      showToast('success', 'تم حذف الملف من المكتبة ومن Google Drive بنجاح.');
    } catch (err: any) {
      showToast('error', err?.message || 'حدث خطأ أثناء حذف الملف.');
    } finally {
      setIsDeletingDoc(false);
    }
  };

  const handlePrintPreview = () => {
    const win = previewIframeRef.current?.contentWindow;
    if (win) {
      win.focus();
      win.print();
    }
  };

  const getSectionBadgeMeta = (sec: LibraryDriveSection) => {
    switch (sec) {
      case 'certificates':
        return {
          label: 'مجلد الشهادات',
          icon: Award,
          badgeCls: 'bg-[#ffc800]/20 text-[#ffc800] border-[#ffc800]/50'
        };
      case 'attendance':
        return {
          label: 'مجلد الحضور والغياب',
          icon: ClipboardCheck,
          badgeCls: 'bg-[#58cc02]/20 text-[#58cc02] border-[#58cc02]/50'
        };
      case 'exams':
        return {
          label: 'مجلد الاختبارات',
          icon: FileSpreadsheet,
          badgeCls: 'bg-[#ce82ff]/20 text-[#ce82ff] border-[#ce82ff]/50'
        };
      case 'reports':
        return {
          label: 'مجلد التقارير الدورية',
          icon: FileText,
          badgeCls: 'bg-[#1cb0f6]/20 text-[#1cb0f6] border-[#1cb0f6]/50'
        };
      default:
        return {
          label: 'مجلد ملفات عامة',
          icon: FolderOpen,
          badgeCls: 'bg-slate-500/20 text-slate-200 border-slate-400/40'
        };
    }
  };

  // ============================================================================
  // LOCKED STATE: COMPLEX GOOGLE ACCOUNT NOT LINKED YET (DUOLINGO 3D + COMPLEX THEME)
  // ============================================================================
  if (!isComplexGoogleLinked) {
    return (
      <div className="space-y-6 pb-12" dir="rtl">
        {statusToast && (
          <div
            className={`p-4 rounded-2xl border-2 border-b-4 flex items-center justify-between gap-3 ${
              statusToast.type === 'success'
                ? 'bg-[#58cc02]/15 border-[#58cc02]/60 text-white'
                : 'bg-[#ff4b4b]/15 border-[#ff4b4b]/60 text-rose-100'
            }`}
          >
            <div className="flex items-center gap-3 text-sm font-extrabold">
              {statusToast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-[#58cc02] shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-[#ff4b4b] shrink-0" />
              )}
              <span>{statusToast.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusToast(null)}
              className="text-slate-300 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="rounded-[36px] bg-[var(--complex-card,#203843)] border-2 border-b-[8px] border-[var(--complex-accent,#ffc800)] p-6 sm:p-10 shadow-2xl text-[var(--complex-text,#ffffff)]">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[var(--complex-secondary,#1b2e35)] border-2 border-b-4 border-[var(--complex-border,#2b4550)] text-[var(--complex-accent,#ffc800)] text-xs sm:text-sm font-black">
              <Building2 className="w-4 h-4" />
              <span>{complexName} • حساب Google مستقل ومعزول لهذا المجمع</span>
            </div>

            <div className="w-24 h-24 mx-auto rounded-[28px] bg-[var(--complex-accent,#ffc800)] text-slate-950 border-2 border-b-[6px] border-amber-600/70 flex items-center justify-center shadow-xl">
              <FolderArchive className="w-12 h-12 stroke-[2.4]" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                يرجى ربط المكتبة بحساب Google للمجمع
              </h2>
              <p className="text-sm sm:text-base font-bold text-slate-300 leading-relaxed max-w-2xl mx-auto">
                تعمل المكتبة السحابية حصرياً عند ربط حساب Google الخاص بـ ({complexName})، وهو نفس الربط المعتمد لقسم الاختبارات ونماذج وجداول Google في هذا المجمع دون أي تداخل مع المجمعات الأخرى.
              </p>
            </div>

            {/* Automatic Drive Folders Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-right pt-2">
              <div className="rounded-2xl bg-[var(--complex-secondary,#1b2e35)] border-2 border-b-4 border-[var(--complex-border,#2b4550)] p-4">
                <div className="w-10 h-10 rounded-xl bg-[#ffc800]/20 text-[#ffc800] flex items-center justify-center mb-2.5">
                  <Award className="w-5 h-5" />
                </div>
                <h4 className="font-black text-sm text-white">مجلد الشهادات</h4>
                <p className="text-xs font-bold text-slate-400 mt-1">
                  حفظ كافة الشهادات بأسماء الطلاب ومناسباتهم على Google Drive
                </p>
              </div>

              <div className="rounded-2xl bg-[var(--complex-secondary,#1b2e35)] border-2 border-b-4 border-[var(--complex-border,#2b4550)] p-4">
                <div className="w-10 h-10 rounded-xl bg-[#58cc02]/20 text-[#58cc02] flex items-center justify-center mb-2.5">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <h4 className="font-black text-sm text-white">مجلد الحضور والغياب</h4>
                <p className="text-xs font-bold text-slate-400 mt-1">
                  حفظ كشوف حضور الطلاب وتحضير المعلمين بالتاريخ والحلقة
                </p>
              </div>

              <div className="rounded-2xl bg-[var(--complex-secondary,#1b2e35)] border-2 border-b-4 border-[var(--complex-border,#2b4550)] p-4">
                <div className="w-10 h-10 rounded-xl bg-[#ce82ff]/20 text-[#ce82ff] flex items-center justify-center mb-2.5">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h4 className="font-black text-sm text-white">مجلد الاختبارات</h4>
                <p className="text-xs font-bold text-slate-400 mt-1">
                  حفظ كشوف وجداول الدرجات ونتائج الاختبارات تلقائياً
                </p>
              </div>

              <div className="rounded-2xl bg-[var(--complex-secondary,#1b2e35)] border-2 border-b-4 border-[var(--complex-border,#2b4550)] p-4">
                <div className="w-10 h-10 rounded-xl bg-[#1cb0f6]/20 text-[#1cb0f6] flex items-center justify-center mb-2.5">
                  <FileText className="w-5 h-5" />
                </div>
                <h4 className="font-black text-sm text-white">مجلد التقارير الدورية</h4>
                <p className="text-xs font-bold text-slate-400 mt-1">
                  حفظ تقارير الإنجاز القرآني وتقارير المساعد الذكي والـ PDF
                </p>
              </div>
            </div>

            <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                type="button"
                onClick={handleLinkComplexLibrary}
                disabled={isLinkingAccount}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#58cc02] hover:bg-[#61e002] text-white font-black text-base border-2 border-b-[6px] border-[#46a302] active:translate-y-[2px] active:border-b-2 transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-60 cursor-pointer"
              >
                {isLinkingAccount ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>جاري ربط حساب Google وتجهيز مجلدات Drive...</span>
                  </>
                ) : (
                  <>
                    <Link2 className="w-5 h-5 stroke-[2.6]" />
                    <span>ربط حساب Google وتفعيل مكتبة المجمع الآن</span>
                  </>
                )}
              </button>
            </div>

            <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-400">
              <ShieldCheck className="w-4 h-4 text-[#58cc02]" />
              <span>كل مجمع يحتفظ بحساب Google ومجلد Drive مستقل تماماً 100%</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ACTIVE STATE: COMPLEX GOOGLE ACCOUNT IS LINKED — LIVE GOOGLE DRIVE LIBRARY
  // ============================================================================
  const sectionFoldersMeta = googleAuthConfig?.driveSectionFolders;
  const rootFolderUrl =
    googleAuthConfig?.driveRootFolderUrl ||
    (googleAuthConfig?.driveRootFolderId
      ? `https://drive.google.com/drive/folders/${googleAuthConfig.driveRootFolderId}`
      : undefined);

  const sectionCards: {
    id: 'all' | LibraryDriveSection;
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    accentBorder: string;
    iconBg: string;
    driveUrl?: string;
  }[] = [
    {
      id: 'all',
      title: 'كافة ملفات المكتبة',
      subtitle: 'جميع الأقسام على Drive',
      icon: FolderArchive,
      accentBorder: 'border-[var(--complex-accent,#ffc800)]',
      iconBg: 'bg-[var(--complex-accent,#ffc800)] text-slate-950',
      driveUrl: rootFolderUrl
    },
    {
      id: 'certificates',
      title: 'الشهادات',
      subtitle: 'بأسماء الطلاب والمناسبات',
      icon: Award,
      accentBorder: 'border-[#ffc800]',
      iconBg: 'bg-[#ffc800]/20 text-[#ffc800]',
      driveUrl: sectionFoldersMeta?.certificates?.webViewLink
    },
    {
      id: 'attendance',
      title: 'الحضور والغياب',
      subtitle: 'حضور الطلاب والمعلمين',
      icon: ClipboardCheck,
      accentBorder: 'border-[#58cc02]',
      iconBg: 'bg-[#58cc02]/20 text-[#58cc02]',
      driveUrl: sectionFoldersMeta?.attendance?.webViewLink
    },
    {
      id: 'exams',
      title: 'الاختبارات',
      subtitle: 'كشوف وجداول الدرجات',
      icon: FileSpreadsheet,
      accentBorder: 'border-[#ce82ff]',
      iconBg: 'bg-[#ce82ff]/20 text-[#ce82ff]',
      driveUrl: sectionFoldersMeta?.exams?.webViewLink
    },
    {
      id: 'reports',
      title: 'التقارير الدورية',
      subtitle: 'تقارير الحلقات والـ PDF',
      icon: FileText,
      accentBorder: 'border-[#1cb0f6]',
      iconBg: 'bg-[#1cb0f6]/20 text-[#1cb0f6]',
      driveUrl: sectionFoldersMeta?.reports?.webViewLink
    }
  ];

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Status Toast */}
      {statusToast && (
        <div
          className={`p-4 rounded-2xl border-2 border-b-4 flex flex-wrap items-center justify-between gap-3 ${
            statusToast.type === 'success'
              ? 'bg-[#58cc02]/15 border-[#58cc02]/60 text-white'
              : 'bg-[#ff4b4b]/15 border-[#ff4b4b]/60 text-rose-100'
          }`}
        >
          <div className="flex items-center gap-3 text-sm font-extrabold">
            {statusToast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-[#58cc02] shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-[#ff4b4b] shrink-0" />
            )}
            <span>{statusToast.text}</span>
          </div>
          <div className="flex items-center gap-2">
            {statusToast.link && (
              <a
                href={statusToast.link}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-[#58cc02] text-white font-black text-xs border-b-2 border-[#46a302] flex items-center gap-1.5"
              >
                <span>فتح في Google Drive</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              type="button"
              onClick={() => setStatusToast(null)}
              className="text-slate-300 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Session Re-auth Notice if browser restarted */}
      {needsSessionRefresh && (
        <div className="rounded-2xl bg-[var(--complex-secondary,#1b2e35)] border-2 border-b-4 border-[var(--complex-accent,#ffc800)] p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs sm:text-sm font-extrabold text-white">
            <HardDrive className="w-5 h-5 text-[var(--complex-accent,#ffc800)] shrink-0" />
            <span>
              لتحديث أحدث الملفات مباشرة من Google Drive ({googleAuthConfig?.connectedEmail})، اضغط لتنشيط الجلسة السحابية:
            </span>
          </div>
          <button
            type="button"
            onClick={() => syncFromComplexGoogleDrive(true)}
            disabled={isSyncingDrive}
            className="px-4 py-2 rounded-xl bg-[var(--complex-accent,#ffc800)] text-slate-950 font-black text-xs border-2 border-b-4 border-amber-600/70 active:translate-y-[2px] transition-all flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncingDrive ? 'animate-spin' : ''}`} />
            <span>تنشيط ومزامنة Google Drive الآن</span>
          </button>
        </div>
      )}

      {/* Top Header Banner with Connected Complex Google Drive Controls */}
      <div className="rounded-[32px] bg-[var(--complex-card,#203843)] border-2 border-b-[6px] border-[var(--complex-border,#2b4550)] p-6 sm:p-7 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-15 h-15 rounded-2xl bg-[var(--complex-accent,#ffc800)] text-slate-950 border-2 border-b-4 border-amber-600/70 flex items-center justify-center shrink-0 p-3.5 shadow-md">
              <FolderArchive className="w-8 h-8 stroke-[2.3]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  المكتبة والأرشيف السحابي (Google Drive)
                </h2>
                <span className="px-3 py-1 rounded-xl bg-[#58cc02]/20 border border-[#58cc02]/50 text-[#58cc02] text-xs font-black flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>مربوط بـ {googleAuthConfig?.connectedEmail || 'Google Drive'}</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-300">
                مكتبة مستقلة خاصة بـ <span className="text-[var(--complex-accent,#ffc800)] font-black">{complexName}</span> — تُحفظ كافة الملفات وتُجلب مباشرة من مجلدات Google Drive الخاصة بهذا المجمع.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {rootFolderUrl && (
              <a
                href={rootFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-2xl bg-[var(--complex-secondary,#1b2e35)] hover:brightness-110 text-[var(--complex-accent,#ffc800)] font-black text-xs border-2 border-b-4 border-[var(--complex-border,#2b4550)] active:translate-y-[2px] transition-all flex items-center gap-2"
              >
                <HardDrive className="w-4 h-4" />
                <span>فتح مجلد المجمع في Drive</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <button
              type="button"
              onClick={() => syncFromComplexGoogleDrive(needsSessionRefresh)}
              disabled={isSyncingDrive}
              className="px-4 py-2.5 rounded-2xl bg-[#1cb0f6] hover:brightness-105 text-white font-black text-xs border-2 border-b-4 border-[#1899d6] active:translate-y-[2px] transition-all flex items-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingDrive ? 'animate-spin' : ''}`} />
              <span>{isSyncingDrive ? 'جاري الجلب من Drive...' : 'تحديث من Drive'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportAttendanceToDrive}
              disabled={isExportingAttendance}
              className="px-4 py-2.5 rounded-2xl bg-[#58cc02] hover:bg-[#61e002] text-white font-black text-xs border-2 border-b-4 border-[#46a302] active:translate-y-[2px] transition-all flex items-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {isExportingAttendance ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              <span>حفظ كشف الحضور في المكتبة</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-[var(--complex-accent,#ffc800)] hover:brightness-105 text-slate-950 font-black text-xs border-2 border-b-4 border-amber-600/70 active:translate-y-[2px] transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.6]" />
              <span>حفظ ملف جديد في المكتبة</span>
            </button>

            {(isSupervisor || isDeveloper) && (
              <button
                type="button"
                onClick={() => setConfirmUnlinkModal(true)}
                className="px-3.5 py-2.5 rounded-2xl bg-[#ff4b4b]/15 hover:bg-[#ff4b4b]/25 text-[#ff4b4b] font-black text-xs border-2 border-b-4 border-[#ff4b4b]/40 active:translate-y-[2px] transition-all flex items-center gap-1.5 cursor-pointer"
                title="إلغاء ربط حساب Google عن هذا المجمع فقط"
              >
                <Unlink className="w-4 h-4" />
                <span>إلغاء الربط</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Organized Google Drive Section Folders (Duolingo 3D Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {sectionCards.map(card => {
          const IconComp = card.icon;
          const isSelected = activeSectionFilter === card.id;
          return (
            <div
              key={card.id}
              onClick={() => setActiveSectionFilter(card.id)}
              className={`group rounded-3xl p-4 border-2 border-b-[5px] transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? `bg-[var(--complex-secondary,#1b2e35)] ${card.accentBorder} shadow-lg -translate-y-0.5`
                  : 'bg-[var(--complex-card,#203843)] border-[var(--complex-border,#2b4550)] hover:brightness-105'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${card.iconBg}`}>
                  <IconComp className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-[var(--complex-primary,#131f24)] text-white font-black text-xs border border-[var(--complex-border,#2b4550)]">
                  {sectionCounts[card.id] || 0} ملف
                </span>
              </div>

              <div className="mt-3">
                <h3 className="font-black text-sm text-white">{card.title}</h3>
                <p className="text-[11px] font-bold text-slate-400 mt-0.5">{card.subtitle}</p>
              </div>

              {card.driveUrl && (
                <div className="mt-3 pt-2.5 border-t border-[var(--complex-border,#2b4550)] flex items-center justify-between">
                  <a
                    href={card.driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-[11px] font-black text-[var(--complex-accent,#ffc800)] hover:underline flex items-center gap-1"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>فتح المجلد في Drive</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Search & Filters Bar */}
      <div className="rounded-3xl bg-[var(--complex-card,#203843)] border-2 border-b-4 border-[var(--complex-border,#2b4550)] p-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-[var(--complex-accent,#ffc800)] absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم الشهادة، الطالب، كشف الحضور، الاختبار، أو التقرير..."
              className="w-full rounded-2xl py-2.5 pr-10 pl-4 text-xs sm:text-sm font-bold bg-[var(--complex-primary,#131f24)] text-white border-2 border-[var(--complex-border,#2b4550)] focus:outline-none focus:border-[var(--complex-accent,#ffc800)]"
            />
          </div>

          <div className="md:col-span-4 relative">
            <Layers className="w-4 h-4 text-[var(--complex-accent,#ffc800)] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedHalaqahFilter}
              onChange={e => setSelectedHalaqahFilter(e.target.value)}
              className="w-full rounded-2xl py-2.5 pr-10 pl-4 text-xs sm:text-sm font-bold bg-[var(--complex-primary,#131f24)] text-white border-2 border-[var(--complex-border,#2b4550)] focus:outline-none focus:border-[var(--complex-accent,#ffc800)] appearance-none"
            >
              <option value="all">جميع الحلقات المتاحة</option>
              {effectiveTeacherHalaqahs.map(h => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Calendar className="w-4 h-4 text-[var(--complex-accent,#ffc800)] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={selectedDateFilter}
                onChange={e => setSelectedDateFilter(e.target.value)}
                className="w-full rounded-2xl py-2.5 pr-10 pl-3 text-xs font-bold bg-[var(--complex-primary,#131f24)] text-white border-2 border-[var(--complex-border,#2b4550)] focus:outline-none focus:border-[var(--complex-accent,#ffc800)]"
              />
            </div>
            {selectedDateFilter && (
              <button
                type="button"
                onClick={() => setSelectedDateFilter('')}
                className="px-3 py-2.5 rounded-2xl bg-[#ff4b4b]/20 text-[#ff4b4b] text-xs font-black border border-[#ff4b4b]/40 cursor-pointer"
              >
                مسح
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Documents Grid */}
      {isSyncingDrive && filteredDocs.length === 0 ? (
        <div className="rounded-3xl bg-[var(--complex-card,#203843)] border-2 border-b-4 border-[var(--complex-border,#2b4550)] p-12 text-center">
          <RefreshCw className="w-10 h-10 text-[var(--complex-accent,#ffc800)] animate-spin mx-auto mb-3" />
          <h3 className="text-lg font-black text-white">جاري جلب ملفات المكتبة من Google Drive...</h3>
          <p className="text-xs font-bold text-slate-400 mt-1">
            يتم فحص مجلدات الشهادات، الحضور والغياب، الاختبارات، والتقارير الدورية
          </p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="rounded-3xl bg-[var(--complex-card,#203843)] border-2 border-b-4 border-[var(--complex-border,#2b4550)] p-12 text-center space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-[var(--complex-secondary,#1b2e35)] border-2 border-[var(--complex-border,#2b4550)] flex items-center justify-center mx-auto text-[var(--complex-accent,#ffc800)]">
            <FolderOpen className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-white">لا توجد ملفات محفوظة في هذا القسم حالياً</h3>
          <p className="text-xs sm:text-sm font-bold text-slate-400 max-w-md mx-auto">
            أي شهادة، كشف حضور وغياب، اختبار، أو تقرير تضغط عليه «حفظ في المكتبة» سيُرفع فوراً إلى مجلده المخصص في Google Drive ويظهر هنا تلقائياً.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map(doc => {
            const sec = doc.sectionCategory || GoogleWorkspaceService.resolveDocSection(doc);
            const secBadge = getSectionBadgeMeta(sec);
            const BadgeIcon = secBadge.icon;
            const driveHref = doc.driveWebViewLink || doc.googleUrl;
            const isAutoExam = doc.id.startsWith('auto-');

            return (
              <div
                key={doc.id}
                id={`item-${doc.id}`}
                data-highlight-id={doc.id}
                className="rounded-3xl bg-[var(--complex-card,#203843)] border-2 border-b-[5px] border-[var(--complex-border,#2b4550)] hover:border-[var(--complex-accent,#ffc800)] p-5 flex flex-col justify-between transition-all shadow-lg"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-black border ${secBadge.badgeCls}`}
                    >
                      <BadgeIcon className="w-3.5 h-3.5" />
                      <span>{doc.driveFolderName ? `مجلد ${doc.driveFolderName}` : secBadge.label}</span>
                    </span>

                    {!isAutoExam && (
                      <button
                        type="button"
                        onClick={() => setDocToDelete(doc)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-[#ff4b4b] hover:bg-[#ff4b4b]/10 transition-colors cursor-pointer"
                        title="حذف الملف من المكتبة و Google Drive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <h3 className="font-black text-base text-white leading-snug mb-1.5 line-clamp-2">
                    {doc.title}
                  </h3>

                  {doc.description && (
                    <p className="text-xs font-bold text-slate-300 line-clamp-2 mb-3 leading-relaxed">
                      {doc.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-300 mb-4">
                    {doc.halaqahName && (
                      <span className="px-2.5 py-1 rounded-lg bg-[var(--complex-primary,#131f24)] border border-[var(--complex-border,#2b4550)]">
                        الحلقة: {doc.halaqahName}
                      </span>
                    )}
                    <span className="px-2.5 py-1 rounded-lg bg-[var(--complex-primary,#131f24)] border border-[var(--complex-border,#2b4550)]">
                      {new Date(doc.createdAt).toLocaleDateString('ar-SA')}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--complex-border,#2b4550)] flex items-center gap-2">
                  {driveHref && (
                    <a
                      href={driveHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 px-3 rounded-2xl bg-[#58cc02] hover:bg-[#61e002] text-white font-black text-xs border-2 border-b-4 border-[#46a302] active:translate-y-[2px] transition-all flex items-center justify-center gap-1.5"
                    >
                      <HardDrive className="w-3.5 h-3.5" />
                      <span>فتح في Google Drive</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}

                  {doc.htmlContent && (
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(doc)}
                      className="py-2.5 px-3 rounded-2xl bg-[var(--complex-secondary,#1b2e35)] hover:brightness-110 text-[var(--complex-accent,#ffc800)] font-black text-xs border-2 border-b-4 border-[var(--complex-border,#2b4550)] active:translate-y-[2px] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>معاينة</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Modal (In-App Safe Iframe without window.open) */}
      {previewDoc && (
        <div className="fixed inset-0 z-[200] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-4xl rounded-[32px] bg-[var(--complex-card,#203843)] border-2 border-b-[6px] border-[var(--complex-accent,#ffc800)] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-[var(--complex-secondary,#1b2e35)] border-b-2 border-[var(--complex-border,#2b4550)] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-black text-base sm:text-lg text-white truncate">
                  {previewDoc.title}
                </h3>
                <p className="text-xs font-bold text-slate-400">
                  {previewDoc.driveFolderName ? `مجلد ${previewDoc.driveFolderName} • ` : ''}
                  {new Date(previewDoc.createdAt).toLocaleString('ar-SA')}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handlePrintPreview}
                  className="px-4 py-2 rounded-xl bg-[var(--complex-accent,#ffc800)] text-slate-950 font-black text-xs border-2 border-b-4 border-amber-600/70 flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 rounded-xl bg-[var(--complex-card,#203843)] text-slate-300 hover:text-white border border-[var(--complex-border,#2b4550)] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-white overflow-hidden min-h-[420px]">
              <iframe
                ref={previewIframeRef}
                title={previewDoc.title}
                srcDoc={previewDoc.htmlContent || `<html dir="rtl"><body><h2>${previewDoc.title}</h2><p>${previewDoc.description || ''}</p></body></html>`}
                className="w-full h-[65vh] border-0"
              />
            </div>
          </div>
        </div>
      )}

      {/* Add / Upload File to Library & Google Drive Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-[32px] bg-[var(--complex-card,#203843)] border-2 border-b-[6px] border-[var(--complex-accent,#ffc800)] overflow-hidden shadow-2xl">
            <div className="px-6 py-4 bg-[var(--complex-secondary,#1b2e35)] border-b-2 border-[var(--complex-border,#2b4550)] flex items-center justify-between">
              <h3 className="font-black text-lg text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-[var(--complex-accent,#ffc800)]" />
                <span>حفظ ملف جديد في المكتبة و Google Drive</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDocument} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-[var(--complex-accent,#ffc800)] mb-1.5">
                  اختر مجلد القسم في Google Drive *
                </label>
                <select
                  value={docSection}
                  onChange={e => setDocSection(e.target.value as LibraryDriveSection)}
                  className="w-full rounded-2xl p-3 text-sm font-bold bg-[var(--complex-primary,#131f24)] text-white border-2 border-[var(--complex-border,#2b4550)] focus:outline-none focus:border-[var(--complex-accent,#ffc800)]"
                >
                  <option value="certificates">مجلد الشهادات</option>
                  <option value="attendance">مجلد الحضور والغياب</option>
                  <option value="exams">مجلد الاختبارات</option>
                  <option value="reports">مجلد التقارير الدورية</option>
                  <option value="general">مجلد ملفات عامة</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-[var(--complex-accent,#ffc800)] mb-1.5">
                  اسم الملف في المكتبة و Google Drive *
                </label>
                <input
                  type="text"
                  required={!selectedUploadFile}
                  value={docTitle}
                  onChange={e => setDocTitle(e.target.value)}
                  placeholder="مثال: شهادة الطالب عبدالله أحمد / كشف حضور حلقة الفجر..."
                  className="w-full rounded-2xl p-3 text-sm font-bold bg-[var(--complex-primary,#131f24)] text-white border-2 border-[var(--complex-border,#2b4550)] focus:outline-none focus:border-[var(--complex-accent,#ffc800)]"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[var(--complex-accent,#ffc800)] mb-1.5">
                  رفع ملف مباشر إلى Google Drive (اختياري: PDF، صورة، جدول، مستند)
                </label>
                <label className="w-full rounded-2xl p-3.5 bg-[var(--complex-primary,#131f24)] border-2 border-dashed border-[var(--complex-border,#2b4550)] hover:border-[var(--complex-accent,#ffc800)] flex items-center justify-between gap-3 cursor-pointer transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Download className="w-4 h-4 text-[var(--complex-accent,#ffc800)] shrink-0" />
                    <span className="text-xs font-bold text-slate-300 truncate">
                      {selectedUploadFile
                        ? `تم اختيار: ${selectedUploadFile.name}`
                        : 'اضغط لاختيار ملف من جهازك لرفعه إلى المجلد'}
                    </span>
                  </div>
                  <input
                    type="file"
                    onChange={e => {
                      const f = e.target.files?.[0] || null;
                      setSelectedUploadFile(f);
                      if (f && !docTitle.trim()) {
                        setDocTitle(f.name.replace(/\.[^/.]+$/, ''));
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-[var(--complex-accent,#ffc800)] mb-1.5">
                    الحلقة المرتبطة
                  </label>
                  <select
                    value={docHalaqahId}
                    onChange={e => setDocHalaqahId(e.target.value)}
                    className="w-full rounded-2xl p-2.5 text-xs font-bold bg-[var(--complex-primary,#131f24)] text-white border-2 border-[var(--complex-border,#2b4550)]"
                  >
                    <option value="all">جميع الحلقات</option>
                    {effectiveTeacherHalaqahs.map(h => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-[var(--complex-accent,#ffc800)] mb-1.5">
                    وصف مختصر
                  </label>
                  <input
                    type="text"
                    value={docDescription}
                    onChange={e => setDocDescription(e.target.value)}
                    placeholder="ملاحظة توضيحية..."
                    className="w-full rounded-2xl p-2.5 text-xs font-bold bg-[var(--complex-primary,#131f24)] text-white border-2 border-[var(--complex-border,#2b4550)]"
                  />
                </div>
              </div>

              {!selectedUploadFile && (
                <div>
                  <label className="block text-xs font-black text-[var(--complex-accent,#ffc800)] mb-1.5">
                    محتوى المستند النصي (إن لم ترفع ملفاً جاهزاً)
                  </label>
                  <textarea
                    rows={3}
                    value={docContent}
                    onChange={e => setDocContent(e.target.value)}
                    placeholder="اكتب محتوى التقرير أو البيان ليتم حفظه كملف منسق داخل مجلد Google Drive..."
                    className="w-full rounded-2xl p-3 text-xs font-bold bg-[var(--complex-primary,#131f24)] text-white border-2 border-[var(--complex-border,#2b4550)]"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSavingDoc}
                  className="px-5 py-2.5 rounded-2xl bg-[var(--complex-secondary,#1b2e35)] text-slate-300 font-extrabold text-xs border-2 border-b-4 border-[var(--complex-border,#2b4550)]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingDoc}
                  className="px-6 py-2.5 rounded-2xl bg-[#58cc02] hover:bg-[#61e002] text-white font-black text-xs sm:text-sm border-2 border-b-4 border-[#46a302] active:translate-y-[2px] flex items-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {isSavingDoc ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري الحفظ في Drive...</span>
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4" />
                      <span>حفظ في المكتبة و Drive</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mandatory Confirmation Modal: Delete File from Library & Google Drive */}
      {docToDelete && (
        <div className="fixed inset-0 z-[210] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-[32px] bg-[var(--complex-card,#203843)] border-2 border-b-[6px] border-[#ff4b4b] p-6 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-3xl bg-[#ff4b4b]/15 border-2 border-[#ff4b4b]/40 text-[#ff4b4b] flex items-center justify-center mx-auto">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-white">تأكيد حذف الملف نهائياً</h3>
            <p className="text-xs sm:text-sm font-bold text-slate-300 leading-relaxed">
              هل أنت متأكد من حذف الملف <span className="text-[var(--complex-accent,#ffc800)]">«{docToDelete.title}»</span> من المكتبة ومن مجلد Google Drive الخاص بالمجمع؟
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeletingDoc}
                className="flex-1 py-3 rounded-2xl bg-[#ff4b4b] hover:brightness-105 text-white font-black text-xs sm:text-sm border-2 border-b-4 border-[#ea2b2b] active:translate-y-[2px] flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {isDeletingDoc ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>نعم، حذف من المكتبة و Drive</span>
              </button>
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                disabled={isDeletingDoc}
                className="flex-1 py-3 rounded-2xl bg-[var(--complex-secondary,#1b2e35)] text-slate-300 font-extrabold text-xs sm:text-sm border-2 border-b-4 border-[var(--complex-border,#2b4550)] cursor-pointer"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Confirmation Modal: Unlink Complex Google Account */}
      {confirmUnlinkModal && (
        <div className="fixed inset-0 z-[210] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-[32px] bg-[var(--complex-card,#203843)] border-2 border-b-[6px] border-[#ff4b4b] p-6 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-3xl bg-[#ff4b4b]/15 border-2 border-[#ff4b4b]/40 text-[#ff4b4b] flex items-center justify-center mx-auto">
              <Unlink className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-white">تأكيد إلغاء ربط حساب Google للمجمع</h3>
            <p className="text-xs sm:text-sm font-bold text-slate-300 leading-relaxed">
              سيتم فصل حساب Google ({googleAuthConfig?.connectedEmail}) عن <span className="text-[var(--complex-accent,#ffc800)]">{complexName}</span> فقط، وستتوقف المكتبة ونماذج Google في هذا المجمع لحين ربط حساب جديد (دون حذف ملفاتك الموجودة في Google Drive).
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleConfirmUnlinkComplex}
                disabled={isUnlinkingAccount}
                className="flex-1 py-3 rounded-2xl bg-[#ff4b4b] text-white font-black text-xs sm:text-sm border-2 border-b-4 border-[#ea2b2b] active:translate-y-[2px] flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {isUnlinkingAccount ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Unlink className="w-4 h-4" />
                )}
                <span>نعم، إلغاء ربط هذا المجمع</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmUnlinkModal(false)}
                disabled={isUnlinkingAccount}
                className="flex-1 py-3 rounded-2xl bg-[var(--complex-secondary,#1b2e35)] text-slate-300 font-extrabold text-xs sm:text-sm border-2 border-b-4 border-[var(--complex-border,#2b4550)] cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
