import type { SelectableXlsxTransformerColumn } from '#SelectableXlsxTransformerColumn.ts';

/**
 * Is used both in the UI when selecting sheets/columns and when actually exporting the data to Excel.
 */
export type SelectableXlsxTransformerSheet<A, B> = {
    id: string;
    name: string;
    description?: string;
    /**
     * Shown as a warning in the export settings, above the columns.
     */
    warning?: string;
    transform: (items: A[]) => B[];
    expandableColumns: SelectableXlsxTransformerColumn<B>[];
};
