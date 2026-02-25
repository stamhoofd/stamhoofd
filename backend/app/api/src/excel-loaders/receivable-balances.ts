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
            name: $t(`ecacb29b-6be5-4581-a0bd-5c0824b27cb9`),
            columns: getGeneralColumns(),
        },
        {
            id: 'balanceItems',
            name: $t(`e023f8a6-a91a-48c0-98fc-863697e1e8c6`),
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
            name: $t(`29360811-3663-496c-8d8f-c9fdf9467a74`),
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
            name: $t(`f97ad8c1-31d2-4b61-9e09-3be86eaeba08`),
            width: 30,
            getValue: (object: ReceivableBalanceWithItem) => ({
                value: getBalanceItemTypeName(object.balanceItem.type),
            }),
        },
        {
            id: 'category',
            name: $t(`c5d24ab8-a87a-481d-a470-23e9386199f3`),
            width: 30,
            getValue: (object: ReceivableBalanceWithItem) => {
                return {
                    value: Formatter.capitalizeFirstLetter(object.balanceItem.category),
                };
            },
        },
        {
            id: 'description',
            name: $t(`9c4977db-1ce9-424b-92cf-4bbe7f6606fd`),
            width: 40,
            getValue: (object: ReceivableBalanceWithItem) => ({
                value: object.balanceItem.description,
            }),
        },
        {
            id: 'amount',
            name: $t(`f085f874-242d-47cb-a404-96eab69662ec`),
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
            name: $t(`7f7fdce2-1fcd-44c9-8c98-856aea11ffc3`),
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
            name: $t(`6f3104d4-9b8f-4946-8434-77202efae9f0`),
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
            name: $t(`dc9f65e0-19ce-4908-8830-da48235faa70`),
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
            name: $t(`5c75e9bf-1b64-4d28-a435-6e33247d5170`),
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
            name: $t(`eb0421f4-6ee9-4d81-b549-2bc4e16c4b63`),
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
            name: $t(`e5902b28-754d-42cd-b245-f403d03b8c56`),
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
            name: $t(`3d586760-01f3-42c3-82be-44cea7ad0820`),
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
            name: $t(`d7003b29-cc92-4ef4-b07b-f283193ef2ae`),
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
            name: $t(`333e8879-0e98-4233-bc51-93a5c623c75e`),
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
            name: $t(`b9c7a57e-6dc1-48a2-bcba-a26c5f59555e`),
            width: 40,
            getValue: (object: ReceivableBalance) => ({
                value: object.object.name,
            }),
        },
        {
            id: 'uri',
            name: $t(`27cfaf26-6b88-4ebc-a50a-627a9f0f9e64`),
            width: 16,
            getValue: (object: ReceivableBalance) => ({
                value: object.object.uri,
            }),
        },
        {
            id: 'amountOpen',
            name: $t(`eb0421f4-6ee9-4d81-b549-2bc4e16c4b63`),
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
            name: $t(`5c75e9bf-1b64-4d28-a435-6e33247d5170`),
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
            name: $t(`a0dfe596-0670-48bc-a5f3-2c9308c70a17`),
            width: 10,
            getValue: (object: ReceivableBalance) => ({
                value: getReceivableBalanceTypeName(object.objectType),
            }),
        },
    ];
}
