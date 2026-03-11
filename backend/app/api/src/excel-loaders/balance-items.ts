import { XlsxBuiltInNumberFormat, XlsxTransformerColumn } from '@stamhoofd/excel-writer';
import { BalanceItem } from '@stamhoofd/models';
import { BalanceItemRelationType, BalanceItemWithPayments, ExcelExportType, getBalanceItemRelationTypeName, getBalanceItemTypeName, PaginatedResponse, PaymentStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint.js';
import { GetBalanceItemsEndpoint } from '../endpoints/organization/dashboard/balance-items/GetBalanceItemsEndpoint.js';

ExportToExcelEndpoint.loaders.set(ExcelExportType.BalanceItems, {
    fetch: async (requestQuery) => {
        const data = await GetBalanceItemsEndpoint.buildData(requestQuery);

        return new PaginatedResponse({
            ...data,
            results: await BalanceItem.getStructureWithPayments(data.results),
        });
    },
    sheets: [
        {
            id: 'balanceItems',
            name: $t(`%1LA`),
            columns: [
                ...getBalanceItemColumns(),
            ],
        },
    ],
});

function getBalanceItemColumns(): XlsxTransformerColumn<BalanceItemWithPayments>[] {
    return [
        {
            id: 'id',
            name: $t(`%d`),
            width: 40,
            getValue: (object: BalanceItemWithPayments) => ({
                value: object.id,
                style: {
                    font: {
                        bold: true,
                    },
                },
            }),
        },
        {
            id: 'type',
            name: $t(`%1B`),
            width: 30,
            getValue: (object: BalanceItemWithPayments) => ({
                value: getBalanceItemTypeName(object.type),
            }),
        },
        {
            id: 'category',
            name: $t(`%M2`),
            width: 30,
            getValue: (object: BalanceItemWithPayments) => {
                return {
                    value: Formatter.capitalizeFirstLetter(object.category),
                };
            },
        },
        {
            id: 'description',
            name: $t(`%6o`),
            width: 40,
            getValue: (object: BalanceItemWithPayments) => ({
                value: object.description,
            }),
        },
        {
            id: 'createdAt',
            name: $t(`%wV`),
            width: 16,
            getValue: (object: BalanceItemWithPayments) => ({
                value: object.createdAt,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.DateTimeSlash,
                    },
                },
            }),
        },
        {
            id: 'dueAt',
            name: $t(`%wW`),
            width: 16,
            getValue: (object: BalanceItemWithPayments) => ({
                value: object.dueAt,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.DateTimeSlash,
                    },
                },
            }),
        },
        {
            match: (id) => {
                if (id.startsWith('relations.')) {
                    const type = id.split('.')[1] as BalanceItemRelationType;
                    if (Object.values(BalanceItemRelationType).includes(type)) {
                        return [
                            {
                                id: `relations.${type}`,
                                name: getBalanceItemRelationTypeName(type),
                                width: 35,
                                getValue: (object: BalanceItemWithPayments) => ({
                                    value: object.relations.get(type)?.name?.toString() || '',
                                }),
                            },
                        ];
                    }
                }
            },
        },
        {
            id: 'quantity',
            name: $t(`%M4`),
            width: 20,
            getValue: (object: BalanceItemWithPayments) => ({
                value: object.quantity,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Number,
                    },
                },
            }),
        },
        {
            id: 'unitPrice',
            name: $t(`%6q`),
            width: 20,
            getValue: (object: BalanceItemWithPayments) => ({
                value: object.unitPrice / 1_0000,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                    },
                },
            }),
        },
        {
            id: 'payablePriceWithVAT',
            name: $t(`%1IP`),
            width: 20,
            getValue: (object: BalanceItemWithPayments) => ({
                value: object.payablePriceWithVAT / 1_0000,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                    },
                },
            }),
        },

        {
            id: 'priceOpen',
            name: $t(`%1LB`),
            width: 40,
            getValue: (object: BalanceItemWithPayments) => ({
                value: object.priceOpen / 1_0000,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                    },
                },
            }),
        },

        {
            id: 'pricePaid',
            name: $t(`%1LC`),
            width: 40,
            getValue: (object: BalanceItemWithPayments) => ({
                value: object.pricePaid / 1_0000,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                    },
                },
            }),
        },

        {
            id: 'pricePending',
            name: $t(`%1LD`),
            width: 40,
            getValue: (object: BalanceItemWithPayments) => ({
                value: object.pricePending / 1_0000,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                    },
                },
            }),
        },

        {
            match: (id) => {
                if (id.startsWith('paidIn[')) {
                    // paidIn[year]
                    const yearStr = id.substring('paidIn['.length, id.length - 1);
                    const year = parseInt(yearStr);
                    if (year && year > 2000 && year < 2100) {
                        return [
                            {
                                id: `paidIn[${year}]`,
                                name: $t('%1L8', { year: year.toFixed(0) }),
                                width: 35,
                                getValue: (object: BalanceItemWithPayments) => {
                                    let value = 0;
                                    for (const p of object.payments) {
                                        if (p.payment.status === PaymentStatus.Succeeded && p.payment.paidAt) {
                                            if (Formatter.year(p.payment.paidAt) === year) {
                                                value += p.price;
                                            }
                                        }
                                    }

                                    return {
                                        value: value / 1_0000,
                                        style: {
                                            numberFormat: {
                                                id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                                            },
                                        },
                                    };
                                },
                            },
                        ];
                    }
                }
            },
        },

        {
            match: (id) => {
                if (id.startsWith('chargedIn[')) {
                    // paidIn[year]
                    const yearStr = id.substring('chargedIn['.length, id.length - 1);
                    const year = parseInt(yearStr);
                    if (year && year > 2000 && year < 2100) {
                        return [
                            {
                                id: `chargedIn[${year}]`,
                                name: $t('%1L9', { year: year.toFixed(0) }),
                                width: 35,
                                getValue: (object: BalanceItemWithPayments) => {
                                    let value = 0;
                                    if (Formatter.year(object.createdAt) === year) {
                                        value = object.payablePriceWithVAT;
                                    }

                                    return {
                                        value: value / 1_0000,
                                        style: {
                                            numberFormat: {
                                                id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                                            },
                                        },
                                    };
                                },
                            },
                        ];
                    }
                }
            },
        },
    ];
}
