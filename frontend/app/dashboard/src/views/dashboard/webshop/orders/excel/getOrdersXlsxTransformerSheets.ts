import type { XlsxTransformerColumn, XlsxTransformerSheet } from '@stamhoofd/excel-writer';
import type { SelectableXlsxTransformerColumn } from '@stamhoofd/frontend-excel-export/SelectableXlsxTransformerColumn';
import type { SelectableXlsxTransformerSheet } from '@stamhoofd/frontend-excel-export/SelectableXlsxTransformerSheet';
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

function toTransformerColumn<R>(group: SelectableXlsxTransformerColumn<R>): XlsxTransformerColumn<R> {
    if (group.columns.length === 1 && group.columns[0].id === group.id) {
        return group.columns[0];
    }

    // A group that expands to multiple Excel columns (e.g. address records): match on the group id
    return {
        match: (id: string) => id === group.id ? group.columns.map(column => ({ ...column })) : undefined,
    };
}
