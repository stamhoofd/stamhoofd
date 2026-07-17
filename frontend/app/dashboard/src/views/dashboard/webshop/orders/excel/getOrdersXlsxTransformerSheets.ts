import type { XlsxTransformerSheet } from '@stamhoofd/excel-writer';
import type { SelectableXlsxTransformerSheet } from '@stamhoofd/frontend-excel-export/SelectableXlsxTransformerSheet';
import { toTransformerColumn } from '@stamhoofd/frontend-excel-export/toTransformerColumn';
import type { Organization, PrivateOrderWithTickets, Webshop } from '@stamhoofd/structures';
import { getOrdersSelectableXlsxTransformerSheets } from './getOrdersSelectableXlsxTransformerSheets';

/**
 * Convert the sheets to the format of `@stamhoofd/excel-writer`, so the export
 * can be generated with the same code as the backend Excel exports.
 */
export function getOrdersXlsxTransformerSheets(webshop: Webshop, orders: PrivateOrderWithTickets[], organization: Organization): XlsxTransformerSheet<PrivateOrderWithTickets[], unknown>[] {
    return getOrdersSelectableXlsxTransformerSheets(webshop, orders, organization).map((sheet: SelectableXlsxTransformerSheet<PrivateOrderWithTickets, any>) => ({
        id: sheet.id,
        name: sheet.name,
        transform: sheet.transform,
        columns: sheet.expandableColumns.map(group => toTransformerColumn(group)),
    }));
}
