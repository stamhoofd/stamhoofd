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
            name: $t(`231f28d7-292a-43bc-877b-751012b6ae48`),
            columns: getGeneralColumns(),
        },
        {
            id: 'balanceItems',
            name: $t(`0d735b43-02e4-4846-8aea-a603bdc9f7a4`),
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
            name: $t(`6c9d45e5-c9f6-49c8-9362-177653414c7e`),
            width: 30,
            getValue: (object: ReceivableBalanceWithItem) => ({
                value: getBalanceItemTypeName(object.balanceItem.type),
            }),
        },
        {
            id: 'category',
            name: $t(`502dc65d-e8d3-4b20-a478-a76ca9084e60`),
            width: 30,
            getValue: (object: ReceivableBalanceWithItem) => {
                return {
                    value: Formatter.capitalizeFirstLetter(object.balanceItem.category),
                };
            },
        },
        {
            id: 'description',
            name: $t(`11d6f2fc-c72d-4c18-aa6d-b8118c2aaa5c`),
            width: 40,
            getValue: (object: ReceivableBalanceWithItem) => ({
                value: object.balanceItem.description,
            }),
        },
        {
            id: 'amount',
            name: $t(`697df3e7-fbbf-421d-81c2-9c904dce4842`),
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
            name: $t(`7453643b-fdb2-4aa1-9964-ddd71762c983`),
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
            name: $t(`1205deb9-498d-435d-a6e1-91ea98371523`),
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
            name: $t(`25c803f0-6b45-42aa-9b88-573e3706b8bb`),
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
            name: $t(`28c2bc66-231f-44f3-9249-c1981b871a1f`),
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
            name: $t(`10fd24bb-43dd-4174-9a23-db3ac54af9be`),
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
            name: $t(`6b4b9fb3-ca24-43cd-9f7b-a5f597b943d8`),
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
            name: $t(`72b10926-c8b2-4e8b-8527-43d8286dd9e1`),
            width: 40,
            getValue: (object: ReceivableBalance) => ({
                value: object.object.name,
            }),
        },
        {
            id: 'uri',
            name: $t(`05723781-9357-41b2-9fb8-cb4f80dde7f9`),
            width: 16,
            getValue: (object: ReceivableBalance) => ({
                value: object.object.uri,
            }),
        },
        {
            id: 'amountOpen',
            name: $t(`28c2bc66-231f-44f3-9249-c1981b871a1f`),
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
