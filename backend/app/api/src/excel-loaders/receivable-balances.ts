import { XlsxBuiltInNumberFormat, XlsxTransformerColumn, XlsxTransformerConcreteColumn } from '@stamhoofd/excel-writer';
import { BalanceItemRelationType, BalanceItemWithPayments, DetailedReceivableBalance, ExcelExportType, getBalanceItemRelationTypeName, getBalanceItemStatusName, getBalanceItemTypeName, getReceivableBalanceTypeNameNotTranslated, PaginatedResponse, ReceivableBalance } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint';
import { GetReceivableBalancesEndpoint } from '../endpoints/organization/dashboard/receivable-balances/GetReceivableBalancesEndpoint';

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
            name: 'Te ontvangen bedragen',
            columns: getGeneralColumns(),
        },
        {
            id: 'balanceItems',
            name: 'Lijnen',
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
            name: 'ID',
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
            name: 'Type',
            width: 30,
            getValue: (object: ReceivableBalanceWithItem) => ({
                value: getBalanceItemTypeName(object.balanceItem.type),
            }),
        },
        {
            id: 'category',
            name: 'Categorie',
            width: 30,
            getValue: (object: ReceivableBalanceWithItem) => {
                return {
                    value: Formatter.capitalizeFirstLetter(object.balanceItem.category),
                };
            },
        },
        {
            id: 'description',
            name: 'Beschrijving',
            width: 40,
            getValue: (object: ReceivableBalanceWithItem) => ({
                value: object.balanceItem.description,
            }),
        },
        {
            id: 'amount',
            name: 'Aantal',
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
            name: 'Eenheidsprijs',
            width: 20,
            getValue: (object: ReceivableBalanceWithItem) => ({
                value: object.balanceItem.unitPrice / 100,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                    },
                },
            }),
        },
        {
            id: 'price',
            name: 'Prijs',
            width: 20,
            getValue: (object: ReceivableBalanceWithItem) => ({
                value: object.balanceItem.price / 100,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                    },
                },
            }),
        },
        {
            id: 'pricePaid',
            name: 'Betaald bedrag',
            width: 20,
            getValue: (object: ReceivableBalanceWithItem) => ({
                value: object.balanceItem.pricePaid / 100,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                    },
                },
            }),
        },
        {
            id: 'pricePending',
            name: 'In verwerking',
            width: 20,
            getValue: (object: ReceivableBalanceWithItem) => ({
                value: object.balanceItem.pricePending / 100,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                    },
                },
            }),
        },
        {
            id: 'priceOpen',
            name: 'Openstaand bedrag',
            width: 20,
            getValue: (object: ReceivableBalanceWithItem) => ({
                value: object.balanceItem.priceOpen / 100,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                    },
                },
            }),
        },
        {
            id: 'createdAt',
            name: 'Aangemaakt op',
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
            name: 'Verschuldigd vanaf',
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
            name: 'Status',
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
                                    value: object.balanceItem.relations.get(type)?.name || '',
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
            name: 'ID schuldenaar',
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
            name: 'Schuldenaar',
            width: 40,
            getValue: (object: ReceivableBalance) => ({
                value: object.object.name,
            }),
        },
        {
            id: 'uri',
            name: 'Groepsnummer',
            width: 16,
            getValue: (object: ReceivableBalance) => ({
                value: object.object.uri,
            }),
        },
        {
            id: 'amountOpen',
            name: 'Openstaand bedrag',
            width: 10,
            getValue: (object: ReceivableBalance) => ({
                value: object.amountOpen / 100,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                    },
                },
            }),
        },
        {
            id: 'amountPending',
            name: 'In verwerking',
            width: 18,
            getValue: (object: ReceivableBalance) => ({
                value: object.amountPending / 100,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                    },
                },
            }),
        },
        {
            id: 'objectType',
            name: 'type',
            width: 10,
            getValue: (object: ReceivableBalance) => ({
                value: getReceivableBalanceTypeNameNotTranslated(object.objectType),
            }),
        },
    ];
}
