/**
 * Omran Platform Excel (.xlsx) Export Utility
 * Uses the xlsx library to export data with Arabic RTL support, headers, and metadata.
 */
import * as XLSX from 'xlsx';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
}

export function exportToExcel(options: {
  filename: string;
  sheetName?: string;
  title?: string;
  columns: ExcelColumn[];
  data: Record<string, any>[];
}): boolean {
  try {
    const { filename, sheetName = 'البيانات', title, columns, data } = options;

    // Prepare rows with column headers
    const rows: any[][] = [];

    if (title) {
      rows.push([title]);
      rows.push([`تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-SA')} - منصة عُمْرَان`]);
      rows.push([]); // blank row
    }

    // Header row
    const headers = columns.map(c => c.header);
    rows.push(headers);

    // Data rows
    data.forEach(item => {
      const row = columns.map(col => {
        const val = item[col.key];
        return val !== undefined && val !== null ? val : '';
      });
      rows.push(row);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    // Set column widths
    worksheet['!cols'] = columns.map(c => ({
      wch: c.width || Math.max(c.header.length * 2, 12),
    }));

    // Enable RTL orientation for sheet
    if (!worksheet['!views']) {
      worksheet['!views'] = [{ rightToLeft: true }];
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));

    // Save and download
    const cleanFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    XLSX.writeFile(workbook, cleanFilename);
    return true;
  } catch (error) {
    console.error('Failed to export to Excel:', error);
    return false;
  }
}
