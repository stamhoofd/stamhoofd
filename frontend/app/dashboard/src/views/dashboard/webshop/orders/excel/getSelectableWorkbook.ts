import { SelectableColumn } from '@stamhoofd/frontend-excel-export/SelectableColumn';
import { SelectableSheet } from '@stamhoofd/frontend-excel-export/SelectableSheet';
import { SelectableWorkbook } from '@stamhoofd/frontend-excel-export/SelectableWorkbook';
import type { Organization, PrivateOrderWithTickets, Webshop } from '@stamhoofd/structures';
import { getOrdersExcelSheets } from './ordersExcelSheets';

/**
 * Build the workbook with selectable sheets and columns for the Excel export of webshop orders.
 * The available columns depend on the webshop configuration and on the exported orders
 * (e.g. answers for deleted products or records are still included).
 */
export function getSelectableWorkbook(webshop: Webshop, orders: PrivateOrderWithTickets[], organization: Organization, options?: { includeTickets?: boolean }): SelectableWorkbook {
    return new SelectableWorkbook({
        sheets: getOrdersExcelSheets(webshop, orders, organization, options).map((sheet) => {
            return new SelectableSheet({
                id: sheet.id,
                name: sheet.name,
                description: sheet.description,
                warning: sheet.warning,
                columns: sheet.groups.map((group) => {
                    return new SelectableColumn({
                        id: group.id,
                        name: group.name,
                        ...(group.description !== undefined ? { description: group.description } : {}),
                        ...(group.category !== undefined ? { category: group.category } : {}),
                        ...(group.enabled !== undefined ? { enabled: group.enabled } : {}),
                    });
                }),
            });
        }),
    });
}
