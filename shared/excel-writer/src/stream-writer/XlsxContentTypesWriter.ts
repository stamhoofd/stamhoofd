import { XlsxFileWriter } from './XlsxFileWriter.js';

export class XlsxContentTypesWriter extends XlsxFileWriter {
    overrides: { partName: string; contentType: string }[] = [];

    async addOverride({ partName, contentType }: { partName: string; contentType: string }) {
        this.overrides.push({ partName, contentType });
        return Promise.resolve();
    }

    async close() {
        await this.write(`<?xml version="1.0" encoding="UTF-8"?>\n`);
        await this.write(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`);
        await this.write(`<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />`);
        await this.write(`<Default Extension="xml" ContentType="application/xml" />`);

        for (const override of this.overrides) {
            await this.write(`<Override PartName="${override.partName}" ContentType="${override.contentType}" />`);
        }

        await this.write(`</Types>`);

        await super.close();
    }
}
