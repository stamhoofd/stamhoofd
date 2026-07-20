import { XlsxColumnFilterer, XlsxTransformer } from '@stamhoofd/excel-writer/core';
import type { ExcelWorkbookFilter, Organization, PrivateOrderWithTickets, Webshop } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { SheetJsWriterAdapter } from '../../../../../classes/SheetJsWriterAdapter';
import { getOrdersXlsxTransformerSheets } from './getOrdersXlsxTransformerSheets';

/**
 * Generate and download the Excel export of webshop orders in the browser.
 * Which sheets and columns are included is determined by the passed workbook filter
 * (built with the workbook of `getSelectableWorkbook`).
 */
export async function exportOrdersToExcel({ webshop, orders, organization, filter }: {
    webshop: Webshop;
    orders: PrivateOrderWithTickets[];
    organization: Organization;
    filter: ExcelWorkbookFilter;
}): Promise<void> {
    const transformerSheets = getOrdersXlsxTransformerSheets(webshop, orders, organization);
    const concreteTransformerSheets = new XlsxColumnFilterer(transformerSheets).filterColumns(filter);

    const writer = new SheetJsWriterAdapter({
        fileName: Formatter.fileSlug(webshop.meta.name) + '.xlsx',
        headerRows: new Map(concreteTransformerSheets.map(sheet => [sheet.name, sheet.columns.some(column => !!column.category) ? 2 : 1])),
        defaultColumnWidth: 13,
    });

    try {
        const transformer = new XlsxTransformer(concreteTransformerSheets, writer);
        await transformer.init();
        await transformer.process([orders]);
        await writer.close();
    } catch (e) {
        await writer.abort();
        throw e;
    }
}
