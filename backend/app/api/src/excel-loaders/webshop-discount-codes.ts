import type { XlsxTransformerConcreteColumn } from '@stamhoofd/excel-writer';
import { XlsxBuiltInNumberFormat } from '@stamhoofd/excel-writer';
import type { PrivateDiscountCode } from '@stamhoofd/structures';
import { ExcelExportType } from '@stamhoofd/structures';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint.js';
import { GetWebshopDiscountCodesEndpoint } from '../endpoints/organization/dashboard/webshops/GetDiscountCodesEndpoint.js';

ExportToExcelEndpoint.loaders.set(ExcelExportType.WebshopDiscountCodes, {
    fetch: async (requestQuery) => {
        return await GetWebshopDiscountCodesEndpoint.buildData(requestQuery, {
            webshopIds: await GetWebshopDiscountCodesEndpoint.getManagedWebshopIds(),
        });
    },
    getSheets: () => [
        {
            id: 'discountCodes',
            name: $t('%QM'),
            columns: getColumns(),
        },
    ],
});

/**
 * The same columns the import reads, so an export can be edited and imported again.
 */
function getColumns(): XlsxTransformerConcreteColumn<PrivateDiscountCode>[] {
    return [
        {
            id: 'code',
            name: $t('%1eg'),
            width: 30,
            getValue: (object: PrivateDiscountCode) => ({
                value: object.code,
                style: {
                    font: {
                        bold: true,
                    },
                },
            }),
        },
        {
            id: 'email',
            name: $t('%1FK'),
            width: 40,
            getValue: (object: PrivateDiscountCode) => ({
                value: object.email ?? '',
            }),
        },
        {
            id: 'description',
            name: $t('%6o'),
            width: 50,
            getValue: (object: PrivateDiscountCode) => ({
                value: object.description,
            }),
        },
        {
            id: 'maximumUsage',
            name: $t('%Zwq'),
            width: 30,
            getValue: (object: PrivateDiscountCode) => ({
                value: object.maximumUsage ?? '',
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Number,
                    },
                },
            }),
        },
    ];
}
