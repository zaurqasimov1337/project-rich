import { existsSync, readFileSync } from 'fs';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';

/**
 * Shared corporate-branded export helper (Mactab).
 *
 * One place for the three download formats used across the API:
 *  - XLSX  (exceljs)  — branded title band + styled header, frozen panes
 *  - PDF   (pdfkit)   — A4 with wordmark header, table, page-number footer
 *  - CSV              — formula-injection-safe, UTF-8 BOM (Excel friendly)
 *
 * Callers assemble the rows (already filtered/sorted/scoped) and column
 * definitions; this module only formats and serializes.
 */

export interface BrandedColumn {
  key: string;
  header: string;
  /** money = qəpik → manat formatting; number; date; string (default) */
  type?: 'money' | 'number' | 'date' | 'string';
}

export interface BrandedExportOptions {
  /** File name without extension, e.g. `leads-2026-07-24`. */
  filename: string;
  /** Human readable report name shown in the branded header. */
  reportName: string;
  columns: BrandedColumn[];
  rows: Record<string, unknown>[];
}

const BRAND_NAME = 'Mactab';
const BRAND_PRIMARY = '3b82f6';
const HEADER_FILL = 'f2f4f7';

function generatedAt(): string {
  return new Date().toLocaleString('az-Latn-AZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Baku',
  });
}

/** qəpik → manat / raw value used for XLSX numeric cells. */
function cellValue(value: unknown, type?: BrandedColumn['type']): string | number {
  if (value === null || value === undefined) return '';
  switch (type) {
    case 'money':
      return Number(value) / 100;
    case 'number':
      return Number(value);
    case 'date':
      return new Date(value as string).toLocaleDateString('az-Latn-AZ');
    default:
      return String(value);
  }
}

/** Display string for PDF cells (money rendered with 2 decimals + ₼). */
function cellText(value: unknown, type?: BrandedColumn['type']): string {
  if (value === null || value === undefined || value === '') return '';
  const v = cellValue(value, type);
  if (type === 'money') {
    return `${new Intl.NumberFormat('az-Latn-AZ', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(v))} ₼`;
  }
  if (type === 'number') return new Intl.NumberFormat('az-Latn-AZ').format(Number(v));
  return String(v);
}

// ===== CSV (formula-injection safe, UTF-8 BOM) =====

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // neutralize spreadsheet formula injection
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n;]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Serialize header + row arrays to a CSV string (BOM prefixed). */
export function toCsvString(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map((h) => csvCell(h)).join(','), ...rows.map((r) => r.map((c) => csvCell(c)).join(','))];
  // UTF-8 BOM so Excel opens Azerbaijani text correctly
  return '﻿' + lines.join('\r\n');
}

export function sendBrandedCsv(res: Response, opts: BrandedExportOptions): void {
  const rows = opts.rows.map((row) => opts.columns.map((c) => cellValue(row[c.key], c.type)));
  const csv = toCsvString(
    opts.columns.map((c) => c.header),
    rows,
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${opts.filename}.csv"`);
  res.send(csv);
}

// ===== XLSX (branded workbook) =====

export async function sendBrandedXlsx(res: Response, opts: BrandedExportOptions): Promise<void> {
  const { columns, rows } = opts;
  const wb = new ExcelJS.Workbook();
  wb.creator = BRAND_NAME;
  wb.created = new Date();
  const ws = wb.addWorksheet('Hesabat', {
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  ws.columns = columns.map((c) => ({
    key: c.key,
    width: Math.max(c.header.length + 4, 14),
    ...(c.type === 'money' ? { style: { numFmt: '#,##0.00" ₼"' } } : {}),
    ...(c.type === 'number' ? { style: { numFmt: '#,##0' } } : {}),
  }));

  // Row 1 — brand band
  ws.mergeCells(1, 1, 1, columns.length);
  const brandCell = ws.getCell(1, 1);
  brandCell.value = BRAND_NAME;
  brandCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  brandCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BRAND_PRIMARY.toUpperCase()}` } };
  brandCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 28;

  // Row 2 — report name + generation date
  ws.mergeCells(2, 1, 2, columns.length);
  const metaCell = ws.getCell(2, 1);
  metaCell.value = `${opts.reportName} · ${generatedAt()}`;
  metaCell.font = { size: 10, color: { argb: 'FF667085' } };
  metaCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 18;

  // Row 3 — column headers
  const headerRow = ws.getRow(3);
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${HEADER_FILL.toUpperCase()}` } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD0D5DD' } },
      bottom: { style: 'thin', color: { argb: 'FFD0D5DD' } },
      left: { style: 'thin', color: { argb: 'FFD0D5DD' } },
      right: { style: 'thin', color: { argb: 'FFD0D5DD' } },
    };
  });
  headerRow.height = 20;

  for (const row of rows) {
    const out: Record<string, string | number> = {};
    for (const c of columns) out[c.key] = cellValue(row[c.key], c.type);
    ws.addRow(out);
  }
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: columns.length } };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${opts.filename}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}

// ===== PDF (branded A4 document) =====

// Helvetica (pdfkit built-in) has no ə/ş/ç/ğ/ı/ö/ü — load a Unicode TTF from
// the OS instead. Windows Arial covers Azerbaijani Latin plus the ₼ sign.
const FONT_REGULAR_CANDIDATES = [
  'C:\\Windows\\Fonts\\arial.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
];
const FONT_BOLD_CANDIDATES = [
  'C:\\Windows\\Fonts\\arialbd.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
];

function loadFont(candidates: string[]): Buffer | null {
  for (const p of candidates) {
    try {
      if (existsSync(p)) return readFileSync(p);
    } catch {
      // ignore and try the next candidate
    }
  }
  return null;
}

export function sendBrandedPdf(res: Response, opts: BrandedExportOptions): void {
  const { columns, rows } = opts;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${opts.filename}.pdf"`);

  const margin = 40;
  const doc = new PDFDocument({ size: 'A4', margin, bufferPages: true });
  doc.pipe(res);

  const regular = loadFont(FONT_REGULAR_CANDIDATES);
  const bold = loadFont(FONT_BOLD_CANDIDATES);
  let FONT = 'Helvetica';
  let FONT_BOLD = 'Helvetica-Bold';
  if (regular) {
    doc.registerFont('Brand', regular);
    FONT = 'Brand';
    doc.registerFont('Brand-Bold', bold ?? regular);
    FONT_BOLD = 'Brand-Bold';
  }

  const pageWidth = doc.page.width; // 595.28 for A4
  const contentWidth = pageWidth - margin * 2;
  const footerReserve = 26;
  const bottomLimit = () => doc.page.height - margin - footerReserve;

  // Column widths: proportional to header length, numeric columns narrower.
  const weights = columns.map((c) => {
    const base = Math.max(c.header.length, 6);
    return c.type === 'money' || c.type === 'number' ? Math.max(base, 8) : Math.max(base, 12);
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
  const colWidths = weights.map((w) => (w / totalWeight) * contentWidth);
  const cellPadX = 5;
  const cellPadY = 4;

  const drawBrandHeader = () => {
    doc.font(FONT_BOLD).fontSize(18).fillColor(`#${BRAND_PRIMARY}`);
    doc.text(BRAND_NAME, margin, margin - 8, { lineBreak: false });
    doc.font(FONT_BOLD).fontSize(12).fillColor('#101828');
    doc.text(opts.reportName, margin, doc.y + 6, { width: contentWidth });
    doc.font(FONT).fontSize(8.5).fillColor('#667085');
    doc.text(generatedAt(), margin, doc.y + 2, { lineBreak: false });
    doc
      .moveTo(margin, doc.y + 10)
      .lineTo(pageWidth - margin, doc.y + 10)
      .lineWidth(1)
      .strokeColor(`#${BRAND_PRIMARY}`)
      .stroke();
    doc.y = doc.y + 16;
  };

  const rowHeight = (cells: string[], fontName: string, fontSize: number): number => {
    doc.font(fontName).fontSize(fontSize);
    let h = 0;
    cells.forEach((text, i) => {
      const w = (colWidths[i] ?? 40) - cellPadX * 2;
      const th = doc.heightOfString(text || ' ', { width: w });
      if (th > h) h = th;
    });
    return Math.max(h + cellPadY * 2, 16);
  };

  const drawRow = (
    cells: string[],
    o: { bold?: boolean; fill?: string; textColor?: string; fontSize?: number },
  ): void => {
    const fontName = o.bold ? FONT_BOLD : FONT;
    const fontSize = o.fontSize ?? 8.5;
    const h = rowHeight(cells, fontName, fontSize);
    if (doc.y + h > bottomLimit()) {
      doc.addPage();
      doc.y = margin;
      drawTableHeader();
    }
    const y = doc.y;
    if (o.fill) {
      doc.rect(margin, y, contentWidth, h).fillColor(o.fill).fill();
    }
    doc.font(fontName).fontSize(fontSize).fillColor(o.textColor ?? '#101828');
    let x = margin;
    cells.forEach((text, i) => {
      const w = colWidths[i] ?? 40;
      const col = columns[i];
      const align = col && (col.type === 'money' || col.type === 'number') ? 'right' : 'left';
      doc.text(text, x + cellPadX, y + cellPadY, { width: w - cellPadX * 2, align });
      x += w;
    });
    // row separator
    doc
      .moveTo(margin, y + h)
      .lineTo(pageWidth - margin, y + h)
      .lineWidth(0.5)
      .strokeColor('#e4e7ec')
      .stroke();
    doc.y = y + h;
  };

  const drawTableHeader = () =>
    drawRow(
      columns.map((c) => c.header),
      { bold: true, fill: `#${HEADER_FILL}`, textColor: '#344054', fontSize: 8.5 },
    );

  drawBrandHeader();
  drawTableHeader();
  if (rows.length === 0) {
    doc.font(FONT).fontSize(9).fillColor('#667085');
    doc.text('Məlumat tapılmadı', margin, doc.y + 10);
  } else {
    for (const row of rows) {
      drawRow(
        columns.map((c) => cellText(row[c.key], c.type)),
        {},
      );
    }
  }

  // Footer with page numbers on every page
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - margin + 8;
    doc.font(FONT).fontSize(7.5).fillColor('#98a2b3');
    doc.text(`${BRAND_NAME} · ${opts.reportName}`, margin, y, { lineBreak: false });
    const label = `Səhifə ${i - range.start + 1} / ${range.count}`;
    doc.text(label, pageWidth - margin - doc.widthOfString(label), y, { lineBreak: false });
  }
  doc.end();
}

export type BrandedFormat = 'csv' | 'xlsx' | 'pdf';

/** Dispatch on format; defaults to CSV for unknown values. */
export async function sendBrandedExport(
  res: Response,
  format: string | undefined,
  opts: BrandedExportOptions,
): Promise<void> {
  if (format === 'xlsx') return sendBrandedXlsx(res, opts);
  if (format === 'pdf') return sendBrandedPdf(res, opts);
  return sendBrandedCsv(res, opts);
}
