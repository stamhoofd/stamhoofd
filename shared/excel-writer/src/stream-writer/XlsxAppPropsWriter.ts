import { XlsxFileWriter } from './XlsxFileWriter.js';

export class XlsxAppPropsWriter extends XlsxFileWriter {
    async close() {
        await this.write(`<?xml version="1.0" encoding="UTF-8"?>\n`);
        await this.write(`<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"/>\n`);

        await super.close();
    }
}
