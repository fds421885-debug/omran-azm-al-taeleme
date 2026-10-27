/**
 * Omran Platform Universal Export Engine
 * Generates true .xlsx Excel files with Arabic RTL support
 * Generates branded PDF reports with complex theme and metrics
 * Connects with the platform Library documents archive
 */

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { LibraryDocument } from '../types';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

export interface ExcelExportOptions {
  sheetName?: string;
  title?: string;
  columns?: ExportColumn[];
  statsSummary?: Record<string, string | number>;
  complexName?: string;
}

/**
 * Exports data to a genuine Excel (.xlsx) file with RTL layout & Arabic formatting
 */
export function exportToExcel(
  data: Record<string, any>[],
  filename: string,
  options: ExcelExportOptions = {}
): Blob {
  const {
    sheetName = 'تقرير عمران',
    title = 'تقرير منظومة عُمْرَان لإدارة الحلقات القرآنية',
    columns,
    statsSummary,
    complexName
  } = options;

  // Build rows array for the sheet
  const rows: any[][] = [];

  // 1. Header rows
  rows.push([title]);
  if (complexName) {
    rows.push([`المجمع القرآني: ${complexName}`]);
  }
  rows.push([`تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-SA')} - ${new Date().toLocaleTimeString('ar-SA')}`]);
  rows.push([]); // blank line

  // 2. Summary stats if provided
  if (statsSummary && Object.keys(statsSummary).length > 0) {
    rows.push(['ملخص الإحصائيات:']);
    Object.entries(statsSummary).forEach(([key, val]) => {
      rows.push([key, val]);
    });
    rows.push([]); // blank line
  }

  // 3. Table Header
  const headers = columns
    ? columns.map(c => c.header)
    : data.length > 0
    ? Object.keys(data[0])
    : ['البيان'];
  rows.push(headers);

  // 4. Data Rows
  data.forEach(item => {
    if (columns) {
      const row = columns.map(col => item[col.key] ?? '-');
      rows.push(row);
    } else {
      rows.push(Object.values(item));
    }
  });

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set RTL view property so Arabic renders right-to-left in Excel
  ws['!views'] = [{ RTL: true }];

  // Column width calculations
  const colWidths = (columns || []).map(col => ({ wch: col.width || 20 }));
  if (colWidths.length > 0) {
    ws['!cols'] = colWidths;
  }

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));

  // Generate buffer and trigger download
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  // Browser download trigger
  if (typeof window !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return blob;
}

export interface PdfExportOptions {
  title: string;
  subtitle?: string;
  complexName?: string;
  columns: ExportColumn[];
  data: Record<string, any>[];
  statsSummary?: Record<string, string | number>;
  primaryColor?: string;
}

/**
 * Generates an executive PDF report matching Omran's design and typography
 */
export function exportToPdf(options: PdfExportOptions): jsPDF {
  const {
    title,
    subtitle,
    complexName,
    columns,
    data,
    statsSummary,
    primaryColor = '#131f24'
  } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 18;

  // Header Bar
  doc.setFillColor(19, 31, 36);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Title
  doc.setTextColor(255, 200, 0); // Duolingo yellow
  doc.setFontSize(16);
  doc.text(title, pageWidth / 2, 12, { align: 'center' });

  // Subtitle / Complex
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  const subText = `${complexName ? complexName + ' | ' : ''}${subtitle || 'منظومة عُمْرَان الذكية لإدارة الحلقات القرآنية'}`;
  doc.text(subText, pageWidth / 2, 20, { align: 'center' });

  currentY = 36;

  // Date and timestamp
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.text(`تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')} - ${new Date().toLocaleTimeString('ar-SA')}`, pageWidth - 14, currentY, { align: 'right' });
  currentY += 8;

  // KPI stats summary box if present
  if (statsSummary && Object.keys(statsSummary).length > 0) {
    doc.setFillColor(32, 56, 67);
    doc.roundedRect(14, currentY, pageWidth - 28, 18, 2, 2, 'F');
    
    doc.setTextColor(255, 200, 0);
    doc.setFontSize(9);
    
    const entries = Object.entries(statsSummary);
    const colStep = (pageWidth - 28) / Math.max(1, entries.length);
    entries.forEach(([label, val], idx) => {
      const x = 18 + (idx * colStep) + (colStep / 2);
      doc.setTextColor(200, 220, 230);
      doc.text(label, x, currentY + 6, { align: 'center' });
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text(String(val), x, currentY + 13, { align: 'center' });
    });

    currentY += 24;
  }

  // Table rendering
  const marginX = 14;
  const tableWidth = pageWidth - (marginX * 2);
  const colWidth = tableWidth / Math.max(1, columns.length);

  // Table Header row
  doc.setFillColor(27, 46, 53);
  doc.rect(marginX, currentY, tableWidth, 9, 'F');
  doc.setTextColor(255, 200, 0);
  doc.setFontSize(9);

  columns.forEach((col, idx) => {
    const x = marginX + (idx * colWidth) + (colWidth / 2);
    doc.text(col.header, x, currentY + 6, { align: 'center' });
  });

  currentY += 9;

  // Data Rows
  doc.setFontSize(8.5);
  data.forEach((item, rIdx) => {
    // Page overflow check
    if (currentY > 270) {
      doc.addPage();
      currentY = 20;
    }

    const isEven = rIdx % 2 === 0;
    doc.setFillColor(isEven ? 245 : 255, isEven ? 248 : 255, isEven ? 250 : 255);
    doc.rect(marginX, currentY, tableWidth, 8, 'F');
    
    doc.setTextColor(30, 40, 50);
    columns.forEach((col, cIdx) => {
      const val = item[col.key] !== undefined && item[col.key] !== null ? String(item[col.key]) : '-';
      const x = marginX + (cIdx * colWidth) + (colWidth / 2);
      doc.text(val, x, currentY + 5.5, { align: 'center' });
    });

    currentY += 8;
  });

  // Footer branding
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`صفحة ${i} من ${totalPages} — تم الإنشاء آلياً عبر منظومة عُمْرَان القرآنية`, pageWidth / 2, 290, { align: 'center' });
  }

  // Trigger download in browser
  const filename = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);

  return doc;
}

/**
 * Creates a library document object and triggers save callback
 */
export function createLibraryDocFromExport(
  title: string,
  type: 'excel' | 'pdf' | 'تقرير_حضور' | 'تقرير_تسميع' | 'شهادة',
  dataPayload: any,
  meta?: { complexId?: string; complexName?: string; halaqahName?: string; teacherName?: string }
): LibraryDocument {
  return {
    id: `lib_doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title,
    type: (type === 'excel' ? 'google_sheet' : type === 'pdf' ? 'pdf_report' : 'custom_file') as any,
    date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    complexId: meta?.complexId,
    complexName: meta?.complexName,
    halaqahName: meta?.halaqahName || 'كافة الحلقات',
    createdByName: meta?.teacherName || 'مساعد عمران الذكي',
    description: `مستند تم استخراجه وحفظه آلياً بواسطة المساعد التنفيذي لمنظومة عمران بتاريخ ${new Date().toLocaleDateString('ar-SA')}`,
    fileUrl: typeof dataPayload === 'string' && dataPayload.startsWith('data:') ? dataPayload : undefined,
    htmlContent: typeof dataPayload === 'string' ? dataPayload : JSON.stringify(dataPayload)
  };
}
