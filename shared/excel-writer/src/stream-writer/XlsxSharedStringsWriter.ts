import { XlsxFileWriter } from './XlsxFileWriter.js';

export class XlsxSharedStringsWriter extends XlsxFileWriter {
    async close() {
        await this.write(`<?xml version="1.0" encoding="UTF-8"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="0" uniqueCount="0"></sst>`);
        await super.close();
    }
}
