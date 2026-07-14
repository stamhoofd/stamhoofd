import type { CellValue, XlsxWriterAdapter } from '@stamhoofd/excel-writer/core';
import { AppManager } from '@stamhoofd/networking/AppManager';
import XLSX from 'xlsx';
import { ExcelHelper } from './ExcelHelper';

type SheetState = {
    name: string;
    rows: CellValue[][];
};

/**
 * A writer for `@stamhoofd/excel-writer` that builds the Excel file in the browser
 * using SheetJS and downloads the resulting file. This makes it possible to generate
 * Excel exports in the frontend using the same sheet and column definitions as the
 * backend Excel exports.
 */
export class SheetJsWriterAdapter implements XlsxWriterAdapter {
    private readonly fileName: string;
    private readonly defaultColumnWidth: number;

    /**
     * Number of header rows per sheet name (1, or 2 if the sheet has a category row).
     */
    private readonly headerRows: Map<string, number>;

    private readonly sheets: Map<symbol, SheetState> = new Map();

    constructor(options: { fileName: string; headerRows?: Map<string, number>; defaultColumnWidth?: number }) {
        this.fileName = options.fileName;
        this.headerRows = options.headerRows ?? new Map();
        this.defaultColumnWidth = options.defaultColumnWidth ?? 13;
    }

    addSheet(name: string): symbol {
        const sheetSymbol = Symbol(name);
        this.sheets.set(sheetSymbol, { name, rows: [] });
        return sheetSymbol;
    }

    addRow(sheet: symbol, values: CellValue[]): void {
        const state = this.sheets.get(sheet);
        if (!state) {
            throw new Error('Sheet not found');
        }
        state.rows.push(values);
    }

    async ready(): Promise<void> {
        // No preparation needed: everything is kept in memory
    }

    async close(): Promise<void> {
        const workbook = XLSX.utils.book_new();

        for (const state of this.sheets.values()) {
            XLSX.utils.book_append_sheet(workbook, this.buildWorksheet(state), state.name);
        }

        const data: ArrayBuffer = XLSX.write(workbook, { type: 'array' });
        const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        await AppManager.shared.downloadFile(blob, this.fileName);
    }

    async abort(): Promise<void> {
        this.sheets.clear();
    }

    private buildWorksheet(state: SheetState): XLSX.WorkSheet {
        const headerRowCount = this.headerRows.get(state.name) ?? 1;
        const rows = state.rows;

        // Remove columns without any data
        this.deleteEmptyColumns(rows, headerRowCount);

        const worksheet = XLSX.utils.aoa_to_sheet(rows.map(row => row.map(cell => cell.value)), { cellStyles: true, cellDates: true });

        // Apply number formats
        for (let rowIndex = headerRowCount; rowIndex < rows.length; rowIndex++) {
            const row = rows[rowIndex];
            for (let columnIndex = 0; columnIndex < row.length; columnIndex++) {
                const formatCode = row[columnIndex].style?.numberFormat?.formatCode;
                if (!formatCode) {
                    continue;
                }

                const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })] as XLSX.CellObject | undefined;
                if (!cell || (cell.t !== 'n' && cell.t !== 'd')) {
                    continue;
                }
                cell.z = formatCode;
                delete cell.w;
            }
        }

        // Set column widths, based on the header row (the last of the header rows)
        const headerRow = rows[headerRowCount - 1] ?? [];
        worksheet['!cols'] = headerRow.map((cell) => {
            if (cell.width) {
                return { width: cell.width };
            }
            return { width: ExcelHelper.getAutoColumnWidth(typeof cell.value === 'string' ? cell.value : '', this.defaultColumnWidth) };
        });

        // Merge cells (used for the category header row)
        const merges: XLSX.Range[] = [];
        for (const [rowIndex, row] of rows.entries()) {
            for (const [columnIndex, cell] of row.entries()) {
                if (cell.merge && (cell.merge.width > 1 || cell.merge.height > 1)) {
                    merges.push({
                        s: { r: rowIndex, c: columnIndex },
                        e: { r: rowIndex + cell.merge.height - 1, c: columnIndex + cell.merge.width - 1 },
                    });
                }
            }
        }
        if (merges.length > 0) {
            worksheet['!merges'] = merges;
        }

        return worksheet;
    }

    /**
     * Remove columns that don't contain any data ('', '/', 0, null or empty dates are
     * considered empty). Same behaviour as ExcelHelper.deleteEmptyColumns.
     */
    private deleteEmptyColumns(rows: CellValue[][], headerRowCount: number) {
        if (rows.length === 0) {
            return;
        }

        // Keep track of the category of every column, so the merged cells of the category row
        // can be rebuilt for the columns that are left
        const categoryRow = headerRowCount > 1 ? rows[0] : null;
        const categoryPerColumn = categoryRow ? this.getCategoryPerColumn(categoryRow) : null;

        for (let columnIndex = rows[0].length - 1; columnIndex >= 0; columnIndex--) {
            let empty = true;

            for (const row of rows.slice(headerRowCount)) {
                const value = row[columnIndex]?.value ?? null;

                if (value instanceof Date) {
                    empty = false;
                    break;
                }

                if (typeof value === 'number') {
                    if (value === 0) {
                        // If all zero: empty
                        continue;
                    }
                    empty = false;
                    break;
                }

                if (typeof value === 'string') {
                    if (value.length === 0 || value === '/') {
                        continue;
                    }
                    empty = false;
                    break;
                }

                // null: empty
            }

            if (empty) {
                for (const row of rows) {
                    row.splice(columnIndex, 1);
                }
                categoryPerColumn?.splice(columnIndex, 1);
            }
        }

        if (categoryRow && categoryPerColumn) {
            this.rebuildCategoryRow(categoryRow, categoryPerColumn);
        }
    }

    /**
     * The category row only contains the name of a category above its first column, merged over all
     * the columns of that category. Map every column to the cell that starts its category.
     */
    private getCategoryPerColumn(categoryRow: CellValue[]): (CellValue | null)[] {
        let category: CellValue | null = null;

        return categoryRow.map((cell) => {
            if (cell.merge) {
                category = cell;
            }
            return category;
        });
    }

    /**
     * Move the name of every category back to its first remaining column, and merge it over the
     * columns of that category that were not deleted.
     */
    private rebuildCategoryRow(categoryRow: CellValue[], categoryPerColumn: (CellValue | null)[]) {
        let columnIndex = 0;

        while (columnIndex < categoryPerColumn.length) {
            const category = categoryPerColumn[columnIndex];

            let width = 1;
            while (columnIndex + width < categoryPerColumn.length && categoryPerColumn[columnIndex + width] === category) {
                width++;
            }

            for (let index = 0; index < width; index++) {
                const cell = categoryRow[columnIndex + index];
                delete cell.merge;

                if (index === 0 && category) {
                    cell.value = category.value;
                    cell.merge = { width, height: 1 };
                } else {
                    cell.value = null;
                }
            }

            columnIndex += width;
        }
    }
}
