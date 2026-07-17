import type { XlsxTransformerConcreteColumn } from '@stamhoofd/excel-writer/core';

/**
 * A column as shown in the export settings (ExcelExportView). One selectable column can
 * expand to multiple concrete Excel columns (e.g. address records).
 */
export type SelectableXlsxTransformerColumn<B> = {
    id: string;
    name: string;
    description?: string;
    /**
     * Groups the column in the export settings, and is written as a category row above the
     * headers in the Excel file (unless the category row is turned off).
     */
    category?: string;
    /**
     * Default enabled state in the UI (defaults to true)
     */
    enabled?: boolean;
    columns: XlsxTransformerConcreteColumn<B>[];
};
