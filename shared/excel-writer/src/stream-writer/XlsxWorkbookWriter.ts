import { XlsxFileWriter } from './XlsxFileWriter.js';

export class XlsxWorkbookWriter extends XlsxFileWriter {
    sheets: { name; sheetId; relationId }[] = [];

    async addSheet({ name, relationId }: { name: string; relationId: string }): Promise<string> {
        const sheetId = (this.sheets.length + 1).toString();
        this.sheets.push({ name, relationId, sheetId: sheetId });
        return Promise.resolve(sheetId);
    }

    /**
     * Write remaining data to the file
     */
    async close() {
        // Write all
        // Write all
        await this.write(`<?xml version="1.0" encoding="UTF-8"?>\n`);
        await this.write(`<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`);

        await this.write(`<sheets>`);
        for (const sheet of this.sheets) {
            await this.write(`<sheet name="${sheet.name}" sheetId="${sheet.sheetId}" r:id="${sheet.relationId}"/>`);
        }
        await this.write(`</sheets>`);
        await this.write(`</workbook>`);

        console.log('Done writing workbook');

        await super.close();
    }
}
