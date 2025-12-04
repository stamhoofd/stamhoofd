import { escapeXml } from './escapeXml.js';
import { XlsxFileWriter } from './XlsxFileWriter.js';

export class XlsxRelationsWriter extends XlsxFileWriter {
    relations: { target: string; type: string; id: string }[] = [];

    async addRelation({ target, type }: { target: string; type: string }): Promise<string> {
        const id = `rId${this.relations.length + 1}`;
        this.relations.push({ target, type, id });
        return Promise.resolve(id);
    }

    /**
     * Write remaining data to the file
     */
    async close() {
        // Write all
        await this.write(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`);
        await this.write(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`);

        for (const relation of this.relations) {
            await this.write(`<Relationship Id="${escapeXml(relation.id)}" Type="${escapeXml(relation.type)}" Target="${escapeXml(relation.target)}"/>`);
        }

        await this.write(`</Relationships>`);

        await super.close();
    }
}
