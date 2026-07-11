import { XlsxColumnFilterer, XlsxTransformer } from '@stamhoofd/excel-writer/core';
import type { ExcelWorkbookFilter, Organization, PrivateOrderWithTickets, Webshop } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { SheetJsWriterAdapter } from '../../../../../classes/SheetJsWriterAdapter';
import { getOrdersExcelDefinitions } from './ordersExcelSheets';

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
    const definitions = getOrdersExcelDefinitions(webshop, orders, organization);
    const sheets = new XlsxColumnFilterer(definitions).filterColumns(filter);

    const writer = new SheetJsWriterAdapter({
        fileName: Formatter.fileSlug(webshop.meta.name) + '.xlsx',
        headerRows: new Map(sheets.map(sheet => [sheet.name, sheet.columns.some(column => !!column.category) ? 2 : 1])),
        defaultColumnWidth: 13,
    });

    try {
        const transformer = new XlsxTransformer(sheets, writer);
        await transformer.init();
        await transformer.process([orders]);
        await writer.close();
    }
    catch (e) {
        await writer.abort();
        throw e;
    }
}
