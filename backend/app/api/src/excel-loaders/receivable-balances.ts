import { XlsxBuiltInNumberFormat, XlsxTransformerColumn, XlsxTransformerConcreteColumn } from '@stamhoofd/excel-writer';
import { BalanceItemRelationType, BalanceItemWithPayments, DetailedReceivableBalance, ExcelExportType, getBalanceItemRelationTypeName, getBalanceItemStatusName, getBalanceItemTypeName, getReceivableBalanceTypeName, PaginatedResponse, ReceivableBalance } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint.js';
import { GetReceivableBalancesEndpoint } from '../endpoints/organization/dashboard/receivable-balances/GetReceivableBalancesEndpoint.js';

type ReceivableBalanceWithItem = {
    receivableBalance: DetailedReceivableBalance;
    balanceItem: BalanceItemWithPayments;
};

ExportToExcelEndpoint.loaders.set(ExcelExportType.ReceivableBalances, {
    fetch: async (requestQuery) => {
        const data = await GetReceivableBalancesEndpoint.buildDetailedData(requestQuery);

        return new PaginatedResponse({
            ...data,
        });
    },
    sheets: [
        {
            id: 'receivableBalances',
            name: $t(`%99`),
            columns: getGeneralColumns(),
        },
        {
            id: 'balanceItems',
            name: $t(`%Mg`),
            transform: (data: DetailedReceivableBalance): ReceivableBalanceWithItem[] => data.balanceItems.map(balanceItem => ({
                receivableBalance: data,
                balanceItem,
            })),
            columns: [
                ...getBalanceItemColumns(),

                // Repeating columns need to de-transform again
                ...getGeneralColumns()
                    .map((c) => {
                        return {
                            ...c,
                            id: `receivableBalance.${c.id}`,
                            getValue: (object: ReceivableBalanceWithItem) => {
                                return c.getValue(object.receivableBalance);
                            },
                        };
                    }),
            ],
        },
    ],
});

function getBalanceItemColumns(): XlsxTransformerColumn<ReceivableBalanceWithItem>[] {
    return [
        {
            id: 'id',
            name: $t(`%d`),
            width: 40,
            getValue: (object: ReceivableBalanceWithItem) => ({
                value: object.balanceItem.id,
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
            getValue: (object: ReceivableBalanceWithItem) => ({
                value: getBalanceItemTypeName(object.balanceItem.type),
            }),
        },
        {
            id: 'category',
            name: $t(`%M2`),
            width: 30,
            getValue: (object: ReceivableBalanceWithItem) => {
                return {
                    value: Formatter.capitalizeFirstLetter(object.balanceItem.category),
                };
            },
        },
        {
            id: 'description',
            name: $t(`%6o`),
            width: 40,
            getValue: (object: ReceivableBalanceWithItem) => ({
                value: object.balanceItem.description,
            }),
        },
        {
            id: 'amount',
            name: $t(`%M4`),
            width: 20,
            getValue: (object: ReceivableBalanceWithItem) => ({
                value: object.balanceItem.amount,
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
            getValue: (object: ReceivableBalanceWithItem) => ({
                value: object.balanceItem.unitPrice / 1_0000,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                    },
                },
            }),
        },
        {
            id: 'price',
            name: $t(`%1IP`),
            width: 20,
            getValue: (object: ReceivableBalanceWithItem) => ({
                value: object.balanceItem.priceWithVAT / 1_0000,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                    },
                },
            }),
        },
        {
            id: 'pricePaid',
            name: $t(`%Ml`),
            width: 20,
            getValue: (object: ReceivableBalanceWithItem) => ({
                value: object.balanceItem.pricePaid / 1_0000,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                    },
                },
            }),
        },
        {
            id: 'pricePending',
            name: $t(`%wc`),
            width: 20,
            getValue: (object: ReceivableBalanceWithItem) => ({
                value: object.balanceItem.pricePending / 1_0000,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                    },
                },
            }),
        },
        {
            id: 'priceOpen',
            name: $t(`%76`),
            width: 20,
            getValue: (object: ReceivableBalanceWithItem) => ({
                value: object.balanceItem.priceOpen / 1_0000,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                    },
                },
            }),
        },
        {
            id: 'createdAt',
            name: $t(`%1JJ`),
            width: 20,
            getValue: (object: ReceivableBalanceWithItem) => ({
                value: object.balanceItem.createdAt,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.DateSlash,
                    },
                },
            }),
        },
        {
            id: 'dueAt',
            name: $t(`%wW`),
            width: 20,
            getValue: (object: ReceivableBalanceWithItem) => ({
                value: object.balanceItem.dueAt,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.DateSlash,
                    },
                },
            }),
        },
        {
            id: 'status',
            name: $t(`%1A`),
            width: 20,
            getValue: (object: ReceivableBalanceWithItem) => ({
                value: getBalanceItemStatusName(object.balanceItem.status),
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
                                getValue: (object: ReceivableBalanceWithItem) => ({
                                    value: object.balanceItem.relations.get(type)?.name?.toString() || '',
                                }),
                            },
                        ];
                    }
                }
            },
        },
    ];
}

function getGeneralColumns(): XlsxTransformerConcreteColumn<ReceivableBalance>[] {
    return [
        {
            id: 'id',
            name: $t(`%wd`),
            width: 40,
            getValue: (object: ReceivableBalance) => ({
                value: object.id,
                style: {
                    font: {
                        bold: true,
                    },
                },
            }),
        },
        {
            id: 'name',
            name: $t(`%Mn`),
            width: 40,
            getValue: (object: ReceivableBalance) => ({
                value: object.object.name,
            }),
        },
        {
            id: 'uri',
            name: $t(`%7C`),
            width: 16,
            getValue: (object: ReceivableBalance) => ({
                value: object.object.uri,
            }),
        },
        {
            id: 'amountOpen',
            name: $t(`%76`),
            width: 10,
            getValue: (object: ReceivableBalance) => ({
                value: object.amountOpen / 1_0000,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                    },
                },
            }),
        },
        {
            id: 'amountPending',
            name: $t(`%wc`),
            width: 18,
            getValue: (object: ReceivableBalance) => ({
                value: object.amountPending / 1_0000,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                    },
                },
            }),
        },
        {
            id: 'objectType',
            name: $t(`%1f`),
            width: 10,
            getValue: (object: ReceivableBalance) => ({
                value: getReceivableBalanceTypeName(object.objectType),
            }),
        },
    ];
}
