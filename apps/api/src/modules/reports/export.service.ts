import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import {
  sendBrandedCsv,
  sendBrandedPdf,
  sendBrandedXlsx,
  type BrandedColumn,
} from '../../common/export/branded-export';

export type ExportColumn = BrandedColumn;

/**
 * Streams a dataset to the client as XLSX, CSV or PDF. Callers assemble the
 * rows (already filtered/sorted/scoped) and column definitions; the shared
 * branded-export helper does the actual formatting/serialization.
 */
@Injectable()
export class ExportService {
  async toXlsx(
    res: Response,
    filename: string,
    columns: ExportColumn[],
    rows: Record<string, unknown>[],
    reportName?: string,
  ): Promise<void> {
    await sendBrandedXlsx(res, { filename, reportName: reportName ?? filename, columns, rows });
  }

  toCsv(
    res: Response,
    filename: string,
    columns: ExportColumn[],
    rows: Record<string, unknown>[],
    reportName?: string,
  ): void {
    sendBrandedCsv(res, { filename, reportName: reportName ?? filename, columns, rows });
  }

  toPdf(
    res: Response,
    filename: string,
    columns: ExportColumn[],
    rows: Record<string, unknown>[],
    reportName?: string,
  ): void {
    sendBrandedPdf(res, { filename, reportName: reportName ?? filename, columns, rows });
  }
}
