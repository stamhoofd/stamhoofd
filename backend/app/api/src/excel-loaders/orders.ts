import type { XlsxTransformerSheet } from '@stamhoofd/excel-writer';
import type { LimitedFilteredRequest, PrivateOrder } from '@stamhoofd/structures';
import { ExcelExportType } from '@stamhoofd/structures';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint.js';
import { GetWebshopOrdersEndpoint } from '../endpoints/organization/dashboard/webshops/GetWebshopOrdersEndpoint.js';

// Assign to a typed variable to assure we have correct type checking in place
const sheet: XlsxTransformerSheet<PrivateOrder, PrivateOrder> = {
    id: 'orders',
    name: $t(`Bestellingen`),
    columns: [
        {
            id: 'id',
            name: $t(`%d`),
            width: 40,
            getValue: (order: PrivateOrder) => ({
                value: order.id,
            }),
        },

    ],
};

ExportToExcelEndpoint.loaders.set(ExcelExportType.Orders, {
    fetch: async (query: LimitedFilteredRequest) => {
        return await GetWebshopOrdersEndpoint.buildData(query);
    },
    sheets: [
        sheet,
    ],
});
