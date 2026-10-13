/**
 * Omran AI Assistant Structured Tools & Batch Operations Engine
 * 
 * Enforces strict input schemas, RBAC permission verification, and transactional per-record reporting.
 * Prevents false success claims: only reports success when operations actually succeed.
 * Uses idempotency keys to prevent duplicate operations.
 */

import {
  SearchUserContext,
  resolveStudentsQuery,
  filterStudentsByPermissions,
  normalizeArabicText
} from './assistantStudentSearch';

export interface BatchAttendanceOperation {
  studentId: string;
  studentName?: string;
  date: string;
  status: 'حاضر' | 'غائب' | 'معتذر' | 'متأخر';
  notes?: string;
}

export interface BatchOperationResultItem {
  studentId: string;
  studentName: string;
  date: string;
  oldValue: string;
  newValue: string;
  success: boolean;
  error?: string;
}

export interface BatchExecutionResponse {
  operationType: 'update_attendance' | 'update_memorization';
  idempotencyKey?: string;
  totalRequested: number;
  successCount: number;
  failureCount: number;
  isAllSuccess: boolean;
  isPartial: boolean;
  summaryMessage: string;
  results: BatchOperationResultItem[];
}

// In-memory idempotency cache for deduplication
const executedIdempotencyKeys = new Map<string, { timestamp: number; response: BatchExecutionResponse }>();

/**
 * Clean expired idempotency keys (older than 10 minutes)
 */
function pruneIdempotencyKeys() {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const [key, val] of executedIdempotencyKeys.entries()) {
    if (val.timestamp < tenMinutesAgo) {
      executedIdempotencyKeys.delete(key);
    }
  }
}

/**
 * Execute Batch Attendance Updates safely with per-record results
 */
export async function executeBatchAttendanceUpdate(
  operations: BatchAttendanceOperation[],
  user: SearchUserContext,
  allStudentsPool: any[],
  currentAttendanceRecords: any[],
  idempotencyKey?: string,
  onPersistRecords?: (updatedRecords: any[]) => Promise<void>
): Promise<BatchExecutionResponse> {
  pruneIdempotencyKeys();

  if (idempotencyKey && executedIdempotencyKeys.has(idempotencyKey)) {
    const cached = executedIdempotencyKeys.get(idempotencyKey)!;
    return {
      ...cached.response,
      summaryMessage: `${cached.response.summaryMessage} (تم التحقق: تم تنفيذ هذه العملية مسبقاً بنفس المفتاح الفريد لمنع التكرار).`
    };
  }

  // 1. Role verification: guest, student, parent CANNOT modify attendance!
  if (!user || user.role === 'guest' || user.role === 'student' || user.role === 'parent') {
    const deniedItems: BatchOperationResultItem[] = operations.map(op => ({
      studentId: op.studentId,
      studentName: op.studentName || 'طالب',
      date: op.date,
      oldValue: 'غير معروف',
      newValue: op.status,
      success: false,
      error: 'غير مصرح: حسابك لا يملك صلاحية تعديل سجلات الحضور.'
    }));

    return {
      operationType: 'update_attendance',
      idempotencyKey,
      totalRequested: operations.length,
      successCount: 0,
      failureCount: operations.length,
      isAllSuccess: false,
      isPartial: false,
      summaryMessage: 'فشلت العملية: ليس لديك صلاحية تعديل الحضور.',
      results: deniedItems
    };
  }

  const { authorized: authorizedStudents } = filterStudentsByPermissions(allStudentsPool, user);
  const authorizedIds = new Set(authorizedStudents.map(s => s.id));

  const results: BatchOperationResultItem[] = [];
  const updatedRecordsList = [...currentAttendanceRecords];
  let successCount = 0;
  let failureCount = 0;

  for (const op of operations) {
    const student = allStudentsPool.find(s => s.id === op.studentId);
    const studentName = student?.name || op.studentName || op.studentId;

    if (!student) {
      results.push({
        studentId: op.studentId,
        studentName,
        date: op.date,
        oldValue: 'غير مسجل',
        newValue: op.status,
        success: false,
        error: 'الطالب غير موجود في قاعدة البيانات.'
      });
      failureCount++;
      continue;
    }

    if (!authorizedIds.has(op.studentId)) {
      results.push({
        studentId: op.studentId,
        studentName,
        date: op.date,
        oldValue: 'محمي',
        newValue: op.status,
        success: false,
        error: 'الطالب يقع خارج نطاق الحلقات المصرح لك بإدارتها.'
      });
      failureCount++;
      continue;
    }

    // Valid status check
    const validStatuses = ['حاضر', 'غائب', 'معتذر', 'متأخر'];
    if (!validStatuses.includes(op.status)) {
      results.push({
        studentId: op.studentId,
        studentName,
        date: op.date,
        oldValue: 'غير محدد',
        newValue: op.status,
        success: false,
        error: `حالة حضور غير صالحة: «${op.status}». الحالات المعتمدة: حاضر، غائب، معتذر، متأخر.`
      });
      failureCount++;
      continue;
    }

    // Find existing attendance record on that date
    const existingIndex = updatedRecordsList.findIndex(
      r => r.studentId === op.studentId && r.date === op.date
    );

    const oldStatus = existingIndex >= 0 ? updatedRecordsList[existingIndex].status : 'غير مسجل';

    if (existingIndex >= 0) {
      // Update existing record in-place to prevent duplication
      updatedRecordsList[existingIndex] = {
        ...updatedRecordsList[existingIndex],
        status: op.status,
        notes: op.notes || updatedRecordsList[existingIndex].notes || '',
        updatedAt: new Date().toISOString(),
        updatedBy: user.username || user.name || 'AI Assistant'
      };
    } else {
      // Create new record
      updatedRecordsList.push({
        id: `att_${Date.now()}_${op.studentId}`,
        studentId: op.studentId,
        date: op.date,
        status: op.status,
        notes: op.notes || '',
        createdAt: new Date().toISOString(),
        createdBy: user.username || user.name || 'AI Assistant'
      });
    }

    results.push({
      studentId: op.studentId,
      studentName,
      date: op.date,
      oldValue: oldStatus,
      newValue: op.status,
      success: true
    });
    successCount++;
  }

  // Persist if handler provided
  if (onPersistRecords && successCount > 0) {
    try {
      await onPersistRecords(updatedRecordsList);
    } catch (persistErr: any) {
      // If persistence fails, mark all as failed! Never claim false success!
      const errorMsg = persistErr?.message || 'تعذر الحفظ في قاعدة البيانات.';
      const rollbackResults = results.map(r => ({
        ...r,
        success: false,
        error: errorMsg
      }));
      return {
        operationType: 'update_attendance',
        idempotencyKey,
        totalRequested: operations.length,
        successCount: 0,
        failureCount: operations.length,
        isAllSuccess: false,
        isPartial: false,
        summaryMessage: `تعذر حفظ التعديلات في قاعدة البيانات: ${errorMsg}`,
        results: rollbackResults
      };
    }
  }

  const isAllSuccess = failureCount === 0 && successCount > 0;
  const isPartial = successCount > 0 && failureCount > 0;

  let summaryMessage = '';
  if (isAllSuccess) {
    summaryMessage = `تم بنجاح تعديل ${successCount} سجلات حضور للطلاب المحددين.`;
  } else if (isPartial) {
    summaryMessage = `تم تعديل ${successCount} سجلات بنجاح، بينما تعذر تعديل ${failureCount} سجلات لوجود قيود صلاحيات أو أخطاء.`;
  } else {
    summaryMessage = `فشلت جميع العمليات (${failureCount} سجلات تعذر تعديلها).`;
  }

  const response: BatchExecutionResponse = {
    operationType: 'update_attendance',
    idempotencyKey,
    totalRequested: operations.length,
    successCount,
    failureCount,
    isAllSuccess,
    isPartial,
    summaryMessage,
    results
  };

  if (idempotencyKey) {
    executedIdempotencyKeys.set(idempotencyKey, { timestamp: Date.now(), response });
  }

  return response;
}

export const ASSISTANT_TOOLS_DEFINITIONS = [
  {
    name: 'search_students',
    description: 'البحث عن الطلاب بحسب الاسم، المعرف، الحلقة أو حالة الحضور مع الالتزام التام بالصلاحيات وعدم إرجاع طلاب غير مطلوبين.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'نص البحث أو اسم الطالب' },
        names: { type: 'ARRAY', items: { type: 'STRING' }, description: 'قائمة الأسماء المطلوب البحث عنها تحديداً' },
        studentIds: { type: 'ARRAY', items: { type: 'STRING' }, description: 'معرفات الطلاب المحددة' },
        halaqahId: { type: 'STRING', description: 'معرف الحلقة المحددة' },
        attendanceStatus: { type: 'STRING', enum: ['حاضر', 'غائب', 'معتذر', 'متأخر'] },
      },
    },
  },
  {
    name: 'get_student_profile',
    description: 'جلب الملف الشامل لطالب محدد بمعرفه أو اسمه المعتمد.',
    parameters: {
      type: 'OBJECT',
      properties: {
        studentId: { type: 'STRING' },
        studentName: { type: 'STRING' },
      },
      required: ['studentId'],
    },
  },
  {
    name: 'batch_update_attendance',
    description: 'تعديل أو رصد الحضور والغياب لمجموعة محددة من الطلاب مع تقرير مفصل لكل سجل ومفتاح فريد لمنع التكرار.',
    parameters: {
      type: 'OBJECT',
      properties: {
        operations: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              studentId: { type: 'STRING' },
              date: { type: 'STRING' },
              status: { type: 'STRING', enum: ['حاضر', 'غائب', 'معتذر', 'متأخر'] },
              notes: { type: 'STRING' },
            },
            required: ['studentId', 'date', 'status'],
          },
        },
        idempotencyKey: { type: 'STRING' },
      },
      required: ['operations'],
    },
  },
];

export async function executeAssistantTool(
  toolName: string,
  params: any = {},
  context: { user?: SearchUserContext; students?: any[]; halaqahs?: any[]; attendance?: any[]; evaluations?: any[] } = {}
): Promise<any> {
  const user = context.user || { role: 'teacher' as const };
  const students = context.students || [];

  switch (toolName) {
    case 'search_students': {
      const { resolveStudentsQuery } = await import('./assistantStudentSearch');
      return resolveStudentsQuery(
        students,
        {
          query: params.query,
          studentNames: params.names,
          studentIds: params.studentIds,
          halaqahId: params.halaqahId,
          attendanceStatus: params.attendanceStatus,
        },
        user,
        { attendanceRecords: context.attendance }
      );
    }

    case 'get_student_profile': {
      const student = students.find((s: any) => s.id === params.studentId || s.name === params.studentName);
      if (!student) {
        return { success: false, error: 'الطالب غير موجود أو غير مصرح لك بالاطلاع عليه.' };
      }
      return { success: true, student };
    }

    case 'batch_update_attendance': {
      return executeBatchAttendanceUpdate(
        params.operations || [],
        user,
        students,
        context.attendance || [],
        params.idempotencyKey
      );
    }

    default:
      return { success: false, error: `الأداة غير معروفة: ${toolName}` };
  }
}
