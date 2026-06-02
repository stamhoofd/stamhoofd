import type { XlsxTransformerSheet, XlsxWorkbookFilter, XlsxWriterAdapter } from './interfaces.js';
import { XlsxColumnFilterer } from './XlsxColumnFilterer.js';
import { XlsxTransformer } from './XlsxTransformer.js';
import { sleep } from '@stamhoofd/utility';

export async function exportToExcel<T>({ definitions, writer, dataGenerator, filter }: {
    filter: XlsxWorkbookFilter;
    definitions: XlsxTransformerSheet<T, unknown>[];
    writer: XlsxWriterAdapter;
    dataGenerator: AsyncIterable<T[]>;
}) {
    try {
        const sheets = new XlsxColumnFilterer(definitions).filterColumns(filter);

        // The transformer handles data and converts it into cell values and writes it to the writer
        const transformer = new XlsxTransformer(sheets, writer);

        await transformer.init();

        // Start looping over the data
        for await (const data of dataGenerator) {
            await transformer.process(data);
            // Sleep for a short duration to reduce load on the server.
            // There's no rush to do things quickly for an export.
            await sleep(100);
        }

        await writer.close();
    }
    catch (e) {
        console.error('Error while exporting to excel', e, 'Aborting writer');
        await writer.abort();
        throw e;
    }
}
