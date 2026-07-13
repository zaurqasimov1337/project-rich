import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { Response } from 'express';

export interface ExportColumn {
  key: string;
  header: string;
  /** money = qəpik → manat formatting; number; date; string (default) */
  type?: 'money' | 'number' | 'date' | 'string';
}

/**
 * Streams a dataset to the client as XLSX or CSV. Callers assemble the rows
 * (already filtered/sorted/scoped) and column definitions; this service only
 * formats and serializes. PDF/print is handled client-side (browser print).
 */
@Injectable()
export class ExportService {
  private formatCell(value: unknown, type?: ExportColumn['type']): string | number {
    if (value == null) return '';
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

  async toXlsx(
    res: Response,
    filename: string,
    columns: ExportColumn[],
    rows: Record<string, unknown>[],
  ): Promise<void> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'EduSphere';
    const ws = wb.addWorksheet('Hesabat');

    ws.columns = columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: Math.max(c.header.length + 4, 14),
      ...(c.type === 'money' ? { style: { numFmt: '#,##0.00" ₼"' } } : {}),
      ...(c.type === 'number' ? { style: { numFmt: '#,##0' } } : {}),
    }));
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };

    for (const row of rows) {
      const out: Record<string, string | number> = {};
      for (const c of columns) out[c.key] = this.formatCell(row[c.key], c.type);
      ws.addRow(out);
    }
    ws.autoFilter = { from: 'A1', to: { row: 1, column: columns.length } };

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  }

  toCsv(
    res: Response,
    filename: string,
    columns: ExportColumn[],
    rows: Record<string, unknown>[],
  ): void {
    const esc = (v: string | number): string => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [columns.map((c) => esc(c.header)).join(',')];
    for (const row of rows) {
      lines.push(columns.map((c) => esc(this.formatCell(row[c.key], c.type))).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    res.send('﻿' + lines.join('\r\n')); // BOM for Excel UTF-8
  }
}
