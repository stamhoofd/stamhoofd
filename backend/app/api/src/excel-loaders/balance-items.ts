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
            name: $t(`fbe6e4c4-8d98-41b5-b839-11d469031002`),
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
            name: $t(`29360811-3663-496c-8d8f-c9fdf9467a74`),
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
            name: $t(`f97ad8c1-31d2-4b61-9e09-3be86eaeba08`),
            width: 30,
            getValue: (object: BalanceItemWithPayments) => ({
                value: getBalanceItemTypeName(object.type),
            }),
        },
        {
            id: 'category',
            name: $t(`c5d24ab8-a87a-481d-a470-23e9386199f3`),
            width: 30,
            getValue: (object: BalanceItemWithPayments) => {
                return {
                    value: Formatter.capitalizeFirstLetter(object.category),
                };
            },
        },
        {
            id: 'description',
            name: $t(`9c4977db-1ce9-424b-92cf-4bbe7f6606fd`),
            width: 40,
            getValue: (object: BalanceItemWithPayments) => ({
                value: object.description,
            }),
        },
        {
            id: 'createdAt',
            name: $t(`10a1cf76-0757-4c92-9923-a19cd77fe24c`),
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
            name: $t(`3d586760-01f3-42c3-82be-44cea7ad0820`),
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
            name: $t(`f085f874-242d-47cb-a404-96eab69662ec`),
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
            name: $t(`7f7fdce2-1fcd-44c9-8c98-856aea11ffc3`),
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
            name: $t(`6f3104d4-9b8f-4946-8434-77202efae9f0`),
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
            name: $t(`cae1af9b-b2b1-440e-893c-e7c1010f0d4b`),
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
            name: $t(`b9716962-aa02-4bd5-a8b3-d7d8def6ac28`),
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
            name: $t(`73637226-b5a9-4a64-b006-27122c0516d4`),
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
                                name: $t('7df15807-0b2d-487f-8c97-deb8ce79d07b', { year: year.toFixed(0) }),
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
                                name: $t('91748032-ca3b-49c2-b065-ddfcb9fd460e', { year: year.toFixed(0) }),
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
