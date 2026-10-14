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

export interface ExportToExcelOptions {
  filename: string;
  sheetName?: string;
  title?: string;
  columns?: ExcelColumn[];
  data: Record<string, any>[];
}

export function exportToExcel(
  optionsOrData: ExportToExcelOptions | Record<string, any>[],
  maybeFilename?: string
): boolean {
  try {
    let filename: string;
    let sheetName = 'البيانات';
    let title: string | undefined;
    let columns: ExcelColumn[];
    let data: Record<string, any>[];

    if (Array.isArray(optionsOrData)) {
      data = optionsOrData;
      filename = maybeFilename || 'export';
      if (data.length > 0) {
        columns = Object.keys(data[0]).map(key => ({
          header: key,
          key: key,
          width: Math.max(key.length * 2, 14)
        }));
      } else {
        columns = [];
      }
    } else {
      filename = optionsOrData.filename;
      sheetName = optionsOrData.sheetName || 'البيانات';
      title = optionsOrData.title;
      data = optionsOrData.data || [];
      if (optionsOrData.columns && optionsOrData.columns.length > 0) {
        columns = optionsOrData.columns;
      } else if (data.length > 0) {
        columns = Object.keys(data[0]).map(key => ({
          header: key,
          key: key,
          width: Math.max(key.length * 2, 14)
        }));
      } else {
        columns = [];
      }
    }

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
