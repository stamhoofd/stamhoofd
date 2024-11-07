import { field } from '@simonbackx/simple-encoding';
import { XlsxBuiltInNumberFormat, XlsxTransformerColumn, XlsxTransformerConcreteColumn } from '@stamhoofd/excel-writer';
import { StripeAccount } from '@stamhoofd/models';
import { BalanceItemPaymentDetailed, BalanceItemRelationType, ExcelExportType, getBalanceItemRelationTypeName, getBalanceItemTypeName, PaginatedResponse, PaymentGeneral, PaymentMethodHelper, PaymentStatusHelper, StripeAccount as StripeAccountStruct } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint';
import { GetPaymentsEndpoint } from '../endpoints/organization/dashboard/payments/GetPaymentsEndpoint';
import { XlsxTransformerColumnHelper } from '../helpers/xlsxAddressTransformerColumnFactory';

type PaymentWithItem = {
    payment: PaymentGeneral;
    balanceItemPayment: BalanceItemPaymentDetailed;
};

export class PaymentGeneralWithStripeAccount extends PaymentGeneral {
    @field({ decoder: StripeAccountStruct, nullable: true })
    stripeAccount: StripeAccountStruct | null = null;
}

ExportToExcelEndpoint.loaders.set(ExcelExportType.Payments, {
    fetch: async (requestQuery) => {
        const data = await GetPaymentsEndpoint.buildData(requestQuery);

        // Also load Stripe Account Ids
        const stripeAccountIds = Formatter.uniqueArray(data.results.map(p => p.stripeAccountId).filter(id => id !== null));

        let accounts: StripeAccountStruct[] = [];
        if (stripeAccountIds.length > 0) {
            accounts = (await StripeAccount.getByIDs(...stripeAccountIds)).map(s => StripeAccountStruct.create(s));
        }

        return new PaginatedResponse({
            ...data,
            results: data.results.map((p) => {
                const payment = PaymentGeneralWithStripeAccount.create(p);
                payment.stripeAccount = p.stripeAccountId ? (accounts.find(a => a.id === p.stripeAccountId) ?? null) : null;
                return payment;
            }),
        });
    },
    sheets: [
        {
            id: 'payments',
            name: 'Betalingen',
            columns: [
                ...getGeneralColumns(),
                ...getInvoiceColumns(),
                ...getSettlementColumns(),
                ...getStripeColumns(),
                ...getTransferColumns(),
            ],
        },
        {
            id: 'balanceItemPayments',
            name: 'Betaallijnen',
            transform: (data: PaymentGeneral): PaymentWithItem[] => data.balanceItemPayments.map(p => ({
                payment: data,
                balanceItemPayment: p,
            })),
            columns: [
                ...getBalanceItemColumns(),

                // Repeating columns need to de-transform again
                ...[
                    ...getGeneralColumns(),
                    ...getInvoiceColumns(),
                ].map((c) => {
                    if ('match' in c) {
                        return {
                            ...c,
                            match: (id: string) => {
                                const result = c.match(id);
                                if (!result) {
                                    return result;
                                }

                                return result.map(cc => ({
                                    ...cc,
                                    getValue: (object: PaymentWithItem) => {
                                        return cc.getValue(object.payment);
                                    },
                                }));
                            },
                        };
                    }

                    return {
                        ...c,
                        getValue: (object: PaymentWithItem) => {
                            return c.getValue(object.payment);
                        },
                    };
                }),
            ],
        },
    ],
});

function getBalanceItemColumns(): XlsxTransformerColumn<PaymentWithItem>[] {
    return [
        {
            id: 'id',
            name: 'ID',
            width: 40,
            getValue: (object: PaymentWithItem) => ({
                value: object.balanceItemPayment.id,
                style: {
                    font: {
                        bold: true,
                    },
                },
            }),
        },
        {
            id: 'paymentId',
            name: 'Betaling ID',
            width: 40,
            getValue: (object: PaymentWithItem) => ({
                value: object.payment.id,
            }),
        },
        {
            id: 'balanceItem.type',
            name: 'Type',
            width: 30,
            getValue: (object: PaymentWithItem) => ({
                value: getBalanceItemTypeName(object.balanceItemPayment.balanceItem.type),
            }),
        },
        {
            id: 'balanceItem.description',
            name: 'Beschrijving',
            width: 40,
            getValue: (object: PaymentWithItem) => ({
                value: object.balanceItemPayment.balanceItem.description,
            }),
        },
        {
            match: (id) => {
                if (id.startsWith('balanceItem.relations.')) {
                    const type = id.split('.')[2] as BalanceItemRelationType;
                    if (Object.values(BalanceItemRelationType).includes(type)) {
                        return [
                            {
                                id: `balanceItem.relations.${type}`,
                                name: getBalanceItemRelationTypeName(type),
                                width: 35,
                                getValue: (object: PaymentWithItem) => ({
                                    value: object.balanceItemPayment.balanceItem.relations.get(type)?.name || '',
                                }),
                            },
                        ];
                    }
                }
            },
        },
        {
            id: 'amount',
            name: 'Aantal',
            width: 20,
            getValue: (object: PaymentWithItem) => ({
                value: object.balanceItemPayment.amount,
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
            getValue: (object: PaymentWithItem) => ({
                value: object.balanceItemPayment.unitPrice / 100,
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
            getValue: (object: PaymentWithItem) => ({
                value: object.balanceItemPayment.price / 100,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                    },
                },
            }),
        },
    ];
}

function getGeneralColumns(): XlsxTransformerConcreteColumn<PaymentGeneral>[] {
    return [
        {
            id: 'id',
            name: 'ID',
            width: 40,
            getValue: (object: PaymentGeneralWithStripeAccount) => ({
                value: object.id,
                style: {
                    font: {
                        bold: true,
                    },
                },
            }),
        },
        {
            id: 'price',
            name: 'Bedrag',
            width: 10,
            getValue: (object: PaymentGeneralWithStripeAccount) => ({
                value: object.price / 100,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                    },
                },
            }),
        },
        {
            id: 'status',
            name: 'Status',
            width: 18,
            getValue: (object: PaymentGeneralWithStripeAccount) => ({
                value: PaymentStatusHelper.getNameCapitalized(object.status),
            }),
        },
        {
            id: 'method',
            name: 'Betaalmethode',
            width: 18,
            getValue: (object: PaymentGeneralWithStripeAccount) => ({
                value: PaymentMethodHelper.getNameCapitalized(object.method),
            }),
        },
        {
            id: 'provider',
            name: 'Betaalprovider',
            width: 16,
            getValue: (object: PaymentGeneralWithStripeAccount) => ({
                value: object.provider ?? PaymentMethodHelper.getNameCapitalized(object.method),
            }),
        },
        {
            id: 'createdAt',
            name: 'Aangemaakt op',
            width: 16,
            getValue: (object: PaymentGeneralWithStripeAccount) => ({
                value: object.createdAt,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.DateTimeSlash,
                    },
                },
            }),
        },
        {
            id: 'paidAt',
            name: 'Betaald op',
            width: 16,
            getValue: (object: PaymentGeneralWithStripeAccount) => ({
                value: object.paidAt,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.DateTimeSlash,
                    },
                },
            }),
        },
        {
            id: 'description',
            name: 'Detail',
            width: 60,
            getValue: (object: PaymentGeneralWithStripeAccount) => ({
                value: object.balanceItemPayments.map(p => p.toString()).join('\n'),
                style: {
                    alignment: {
                        wrapText: true,
                    },
                },
            }),
        },
    ];
}

function getSettlementColumns(): XlsxTransformerColumn<PaymentGeneral>[] {
    return [
        {
            id: 'settlement.reference',
            name: 'Uitbetalingsmededeling',
            width: 21,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.settlement?.reference || '',
                };
            },
        },
        {
            id: 'settlement.settledAt',
            name: 'Uitbetalingsdatum',
            width: 16,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.settlement?.settledAt ?? null,
                    style: {
                        numberFormat: {
                            id: XlsxBuiltInNumberFormat.DateSlash,
                        },
                    },
                };
            },
        },
        {
            id: 'settlement.amount',
            name: 'Uitbetalingsbedrag',
            width: 18,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.settlement?.amount !== undefined ? (object.settlement?.amount / 100) : null,
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

function getStripeColumns(): XlsxTransformerColumn<PaymentGeneral>[] {
    return [
        {
            id: 'transferFee',
            name: 'Transactiekosten',
            width: 16,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.transferFee / 100,
                    style: {
                        numberFormat: {
                            id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                        },
                    },
                };
            },
        },
        {
            id: 'stripeAccountId',
            name: 'Account ID',
            width: 20,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.stripeAccount?.accountId || '',
                };
            },
        },
        {
            id: 'iban',
            name: 'Kaartnummer',
            width: 20,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.iban || '',
                };
            },
        },
        {
            id: 'ibanName',
            name: 'Kaarthouder',
            width: 20,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.ibanName || '',
                };
            },
        },
    ];
}

function getTransferColumns(): XlsxTransformerColumn<PaymentGeneral>[] {
    return [
        {
            id: 'transferDescription',
            name: 'Mededeling',
            width: 25,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.transferDescription || '',
                };
            },
        },
        {
            id: 'transferSettings.creditor',
            name: 'Begunstigde',
            width: 25,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                if (!object.transferSettings && object.stripeAccount && object.stripeAccount?.meta.bank_account_bank_name) {
                    return {
                        value: (object.stripeAccount.meta.bank_account_name || object.stripeAccount.meta.business_profile?.name || object.stripeAccount.meta.company?.name) + ' (' + (object.stripeAccount?.meta.bank_account_bank_name || '') + ')',
                    };
                }

                return {
                    value: object.transferSettings?.creditor || '',
                };
            },
        },
        {
            id: 'transferSettings.iban',
            name: 'Rekeningnummer begunstigde',
            width: 30,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                if (!object.transferSettings && object.stripeAccount && object.stripeAccount?.meta.bank_account_last4) {
                    return {
                        value: 'xxxx ' + object.stripeAccount?.meta.bank_account_last4,
                    };
                }

                return {
                    value: object.transferSettings?.iban || '',
                };
            },
        },
    ];
}

function getInvoiceColumns(): XlsxTransformerColumn<PaymentGeneral>[] {
    return [
        {
            id: 'customer.name',
            name: 'Naam',
            width: 30,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.customer?.name || '',
                };
            },
        },
        {
            id: 'customer.email',
            name: 'E-mailadres',
            width: 40,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.customer?.email || '',
                };
            },
        },
        {
            id: 'customer.company.name',
            name: 'Bedrijfsnaam',
            width: 30,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.customer?.company?.name || '',
                };
            },
        },
        {
            id: 'customer.company.VATNumber',
            name: 'BTW-nummer',
            width: 20,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.customer?.company?.VATNumber || '',
                };
            },
        },
        {
            id: 'customer.company.companyNumber',
            name: 'Ondernemingsnummer',
            width: 20,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.customer?.company?.companyNumber || '',
                };
            },
        },
        XlsxTransformerColumnHelper.createAddressColumns<PaymentGeneralWithStripeAccount>({
            matchId: 'customer.company.address',
            getAddress: object => object.customer?.company?.address,
            identifier: 'Adres',
        }),
        {
            id: 'customer.company.administrationEmail',
            name: 'E-mailadres administratie',
            width: 30,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.customer?.company?.administrationEmail || '',
                };
            },
        },
    ];
}
