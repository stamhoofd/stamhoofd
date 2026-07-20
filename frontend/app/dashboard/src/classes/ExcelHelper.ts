import XLSX from 'xlsx';

export type RowValue = (string | number | Date | { value: string | number | Date; format?: null | string; width?: number });

function transformRowValues(row: RowValue[][]): (string | number | Date)[][] {
    return row.map(r => r.map((c) => {
        if (typeof c === 'object' && !(c instanceof Date)) {
            return c.value;
        }
        return c;
    }));
}

export class ExcelHelper {
    static buildWorksheet(wsData: RowValue[][], options: { keepLastColumns?: number; defaultColumnWidth?: number }) {
        // Delete after
        this.deleteEmptyColumns(wsData, options?.keepLastColumns);

        const ws = XLSX.utils.aoa_to_sheet(transformRowValues(wsData), { cellStyles: true, cellDates: true });

        // Format columns based on format option in wsData
        if (wsData[1]) {
            for (const [index, col] of wsData[1].entries()) {
                if (typeof col !== 'object' || (col instanceof Date)) {
                    continue;
                }
                if (col.format) {
                    this.formatColumn(index, col.format, ws);
                }
            }
        }

        // Set column width
        ws['!cols'] = [];
        for (const column of wsData[0]) {
            if (typeof column !== 'string') {
                if (typeof column === 'object' && !(column instanceof Date) && column.width) {
                    ws['!cols'].push({ width: column.width });
                }
                continue;
            }
            ws['!cols'].push({ width: this.getAutoColumnWidth(column, options?.defaultColumnWidth ?? 13) });
        }

        return ws;
    }

    /**
     * Guess a column width based on the column header
     */
    static getAutoColumnWidth(column: string, defaultColumnWidth = 13): number {
        if (column.toLowerCase().includes('totaal') || column.toLowerCase().includes('datum')) {
            return 25;
        }
        if (column.toLowerCase().startsWith('naam')) {
            return 20;
        }
        if (column.toLowerCase().includes('naam')) {
            return 13;
        }
        if (column.toLowerCase().includes('e-mail')) {
            return 25;
        }
        if (column.toLowerCase().includes('adres')) {
            return 30;
        }
        if (column.toLowerCase().includes('gsm')) {
            return 16;
        }
        if (column.toLowerCase().includes('product')) {
            return 40;
        }
        if (column.toLowerCase() === 'id' || column.toLowerCase() === 'betaling id') {
            return 25;
        }
        if (column.toLowerCase() === 'omschrijving') {
            return 40;
        }
        if (column.toLowerCase() === 'context') {
            return 40;
        }
        if (column.toLowerCase().includes('uitbetaling')) {
            return 25;
        }
        if (column.toLowerCase().includes('plaatsen')) {
            return 40;
        }
        if (column.toLowerCase().includes('betaalmethode')) {
            return 40;
        }
        return defaultColumnWidth;
    }

    static formatColumn(colNum: number, fmt: string, worksheet: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for (let i = range.s.r + 1; i <= range.e.r; ++i) {
            /* find the data cell (range.s.r + 1 skips the header row of the worksheet) */
            const ref = XLSX.utils.encode_cell({ r: i, c: colNum });
            /* if the particular row did not contain data for the column, the cell will not be generated */
            if (!worksheet[ref]) continue;
            /* `.t == "n"` for number cells */
            if (worksheet[ref].t !== 'n' && worksheet[ref].t !== 'd') continue;
            /* assign the `.z` number format */
            worksheet[ref].z = fmt;
            delete worksheet[ref].w;
        }
    }

    static wrapColumn(colNum: number, worksheet: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for (let i = range.s.r + 1; i <= range.e.r; ++i) {
            /* find the data cell (range.s.r + 1 skips the header row of the worksheet) */
            const ref = XLSX.utils.encode_cell({ r: i, c: colNum });
            /* if the particular row did not contain data for the column, the cell will not be generated */
            if (!worksheet[ref]) continue;
            worksheet[ref].s = { alignment: { wrapText: true } };
        }
    }

    static deleteEmptyColumns(wsData: RowValue[][], skipLast = 0) {
        // Delete empty columns
        for (let index = wsData[0].length - 1 - skipLast; index >= 0; index--) {
            let empty = true;
            for (const row of wsData.slice(1)) {
                let value = row[index];

                if (typeof value === 'object' && !(value instanceof Date)) {
                    if (value == null) {
                        continue;
                    }
                    value = value.value;
                }

                if (value instanceof Date) {
                    empty = false;
                    break;
                }

                if (typeof value !== 'string') {
                    if (value == 0) {
                        // If all zero: empty
                        continue;
                    }
                    empty = false;
                    break;
                }
                if (value.length == 0 || value == '/') {
                    continue;
                }
                empty = false;
                break;
            }
            if (empty) {
                for (const row of wsData) {
                    row.splice(index, 1);
                }
            }
        }
    }
}
