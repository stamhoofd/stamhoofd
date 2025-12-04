import { CellType, CellValue } from '../interfaces.js';
import { escapeXml } from './escapeXml.js';
import { XlsxFileWriter } from './XlsxFileWriter.js';
import { XlsxStylesWriter } from './XlsxStylesWriter.js';
import { DateTime } from 'luxon';

function numberToAlpha(num: number) {
    // 1 = a
    // 2 = b
    // 26 = z
    // 27 = aa
    // 28 = ab
    // 52 = az
    // 53 = ba
    const aCharCode = 'a'.charCodeAt(0);

    // Convert into an array with min-max values aCharCode - zCharCode
    const chars: number[] = [];

    // Calculate numeric value of this string
    let val = num;
    while (val > 0) {
        const char = (val - 1) % 26;
        chars.unshift(char + aCharCode);
        val = Math.floor((val - 1) / 26);
    }

    return chars.map(c => String.fromCharCode(c)).join('');
}

class ColumnInfo {
    width?: number;

    growToMinimum(width: number) {
        if (this.width === undefined || this.width < width) {
            this.width = width;
        }
    }
}

export class XlsxSheetWriter extends XlsxFileWriter {
    /**
     * The sheet writer will write
     */
    styles: XlsxStylesWriter;
    didWriteHeader = false;

    /**
     * When running in the backend, you'll need to set this to the timezone offset of the user.
     */
    timezone = 'Europe/Brussels';

    columns: ColumnInfo[] = [];

    rowCount = 0;

    mergeCells: string[] = [];

    async writeHeader(columnCount = 0) {
        await this.write('<?xml version="1.0" encoding="UTF-8"?>\n');
        await this.write(`<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`);

        // Sadly <cols> must be before <sheetData> - so we cant calculate the best widths on the fly
        await this.write('<cols>');

        for (const [index, column] of this.columns.entries()) {
            const width = column.width ?? 20;
            await this.write(`<col min="${index + 1}" max="${index + 1}" width="${width}" />`);
        }

        await this.write('</cols>');

        await this.write('<sheetData>');
        this.didWriteHeader = true;
    }

    async writeFooter() {
        if (!this.didWriteHeader) {
            await this.writeHeader(0);
        }

        await this.write('</sheetData>');

        if (this.mergeCells.length > 0) {
            await this.write('<mergeCells count="' + this.mergeCells.length + '">');
            for (const merge of this.mergeCells) {
                await this.write('<mergeCell ref="' + escapeXml(merge) + '" />');
            }
            await this.write('</mergeCells>');
        }

        await this.write('</worksheet>');
    }

    async writeRow(cells: CellValue[]) {
        if (!this.didWriteHeader) {
            while (this.columns.length < cells.length) {
                // Append until we have enough columns
                const cell = cells[this.columns.length];
                const info = new ColumnInfo();

                if (cell.width !== undefined) {
                    info.width = cell.width;
                }
                this.columns.push(info);
            }

            await this.writeHeader(cells.length);
        }

        this.rowCount++;
        let str = `<row r="${this.rowCount}">`;

        for (const [index, cell] of cells.entries()) {
            str += await this.getCellString(cell, { row: this.rowCount, column: index + 1 });

            if (cell.merge && (cell.merge.width > 1 || cell.merge.height > 1)) {
                const start = `${numberToAlpha(index + 1).toUpperCase()}${this.rowCount}`;
                const end = `${numberToAlpha(index + cell.merge.width).toUpperCase()}${this.rowCount + cell.merge.height - 1}`;
                // append at the end of the file
                this.mergeCells.push(`${start}:${end}`);
            }
        }

        str += '</row>';
        await this.write(str);
    }

    async getCellString(cell: CellValue, { row, column }: { row: number; column: number }) {
        let type = CellType.InlineString;
        let str = '';
        const r = `${numberToAlpha(column).toUpperCase()}${row}`;

        switch (typeof cell.value) {
            case 'boolean':
                type = CellType.Boolean;
                str = cell.value ? '1' : '0';
                break;
            case 'number':
                type = CellType.Number;
                if (isNaN(cell.value) || !isFinite(cell.value)) {
                    type = CellType.Error;
                    str = '#VALUE!';
                }
                else {
                    str = cell.value.toString();
                }
                break;
            case 'string':
                // todo: we can use shared strings here
                type = CellType.InlineString;
                str = cell.value;
                break;
            case 'object':
                if (cell.value instanceof Date) {
                    // Excel has this funny thing where they ALWAYS interpret dates as the local timezone
                    // This has the advantage that if you write a date in a cell, it will always contain the same value, regardless of the timezone of the user.
                    const dateTime = DateTime.fromJSDate(cell.value).setZone(this.timezone);

                    type = CellType.Number;
                    str = ((cell.value.getTime() + dateTime.offset * 60 * 1000) / 1000 / 24 / 60 / 60 + 25569).toFixed(6);
                }

                // Null
                if (cell.value === null) {
                    type = CellType.InlineString;
                    str = '';
                }
                break;
        }

        const styleId = (await this.styles.requestCellStyleId(cell.style ?? {})).toString();

        if (type === CellType.InlineString) {
            return `<c r="${escapeXml(r)}" s="${escapeXml(styleId)}" t="${escapeXml(type)}"><is><t>${escapeXml(str)}</t></is></c>`;
        }

        return `<c r="${escapeXml(r)}" s="${escapeXml(styleId)}" t="${escapeXml(type)}"><v>${escapeXml(str)}</v></c>`;
    }

    async close() {
        await this.writeFooter();
        await super.close();
    }
}
