import { field } from '@simonbackx/simple-encoding';
import { XlsxBuiltInNumberFormat, XlsxTransformerColumn, XlsxTransformerConcreteColumn } from '@stamhoofd/excel-writer';
import { StripeAccount } from '@stamhoofd/models';
import { BalanceItemPaymentDetailed, BalanceItemRelationType, ExcelExportType, getBalanceItemRelationTypeName, getBalanceItemTypeName, PaginatedResponse, PaymentGeneral, PaymentMethodHelper, PaymentStatusHelper, StripeAccount as StripeAccountStruct } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint.js';
import { GetPaymentsEndpoint } from '../endpoints/organization/dashboard/payments/GetPaymentsEndpoint.js';
import { XlsxTransformerColumnHelper } from '../helpers/XlsxTransformerColumnHelper.js';

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
            name: $t(`15589562-1e34-4197-8097-5ec5bf1636fb`),
            columns: [
                ...getGeneralColumns(),
                ...getInvoiceColumns(),
                ...getPayingOrganizationColumns(),
                ...getSettlementColumns(),
                ...getStripeColumns(),
                ...getTransferColumns(),
            ],
        },
        {
            id: 'balanceItemPayments',
            name: $t(`d62b3102-adc0-4d5f-9dbb-c03138e44fe2`),
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
                    ...getPayingOrganizationColumns(),
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
            name: $t(`29360811-3663-496c-8d8f-c9fdf9467a74`),
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
            id: 'balanceItem.id',
            name: $t(`89594841-9a44-473f-8250-0ccafb570b6f`),
            width: 40,
            getValue: (object: PaymentWithItem) => ({
                value: object.balanceItemPayment.balanceItem.id,
            }),
        },
        {
            id: 'paymentId',
            name: $t(`0601033f-1678-4781-96cd-1653448d689a`),
            width: 40,
            getValue: (object: PaymentWithItem) => ({
                value: object.payment.id,
            }),
        },
        {
            id: 'balanceItem.type',
            name: $t(`6c9d45e5-c9f6-49c8-9362-177653414c7e`),
            width: 30,
            getValue: (object: PaymentWithItem) => ({
                value: getBalanceItemTypeName(object.balanceItemPayment.balanceItem.type),
            }),
        },
        {
            id: 'balanceItem.category',
            name: $t(`502dc65d-e8d3-4b20-a478-a76ca9084e60`),
            width: 30,
            getValue: (object: PaymentWithItem) => {
                return {
                    value: Formatter.capitalizeFirstLetter(object.balanceItemPayment.balanceItem.category),
                };
            },
        },
        {
            id: 'balanceItem.description',
            name: $t(`11d6f2fc-c72d-4c18-aa6d-b8118c2aaa5c`),
            width: 40,
            getValue: (object: PaymentWithItem) => ({
                value: object.balanceItemPayment.balanceItem.description,
            }),
        },
        {
            id: 'balanceItem.createdAt',
            name: $t(`10a1cf76-0757-4c92-9923-a19cd77fe24c`),
            width: 16,
            getValue: (object: PaymentWithItem) => ({
                value: object.balanceItemPayment.balanceItem.createdAt,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.DateTimeSlash,
                    },
                },
            }),
        },
        {
            id: 'balanceItem.dueAt',
            name: $t(`3d586760-01f3-42c3-82be-44cea7ad0820`),
            width: 16,
            getValue: (object: PaymentWithItem) => ({
                value: object.balanceItemPayment.balanceItem.dueAt,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.DateTimeSlash,
                    },
                },
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
                                    value: object.balanceItemPayment.balanceItem.relations.get(type)?.name?.toString() || '',
                                }),
                            },
                        ];
                    }
                }
            },
        },
        {
            id: 'amount',
            name: $t(`697df3e7-fbbf-421d-81c2-9c904dce4842`),
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
            name: $t(`7453643b-fdb2-4aa1-9964-ddd71762c983`),
            width: 20,
            getValue: (object: PaymentWithItem) => ({
                value: object.balanceItemPayment.unitPrice / 1_0000,
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
            getValue: (object: PaymentWithItem) => ({
                value: object.balanceItemPayment.price / 1_0000,
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
            name: $t(`29360811-3663-496c-8d8f-c9fdf9467a74`),
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
            name: $t(`43ca079c-2af8-4bde-9f68-abeca3c3a7d0`),
            width: 10,
            getValue: (object: PaymentGeneralWithStripeAccount) => ({
                value: object.price / 1_0000,
                style: {
                    numberFormat: {
                        id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                    },
                },
            }),
        },
        {
            id: 'status',
            name: $t(`6b4b9fb3-ca24-43cd-9f7b-a5f597b943d8`),
            width: 18,
            getValue: (object: PaymentGeneralWithStripeAccount) => ({
                value: PaymentStatusHelper.getNameCapitalized(object.status),
            }),
        },
        {
            id: 'method',
            name: $t(`07e7025c-0bfb-41be-87bc-1023d297a1a2`),
            width: 18,
            getValue: (object: PaymentGeneralWithStripeAccount) => ({
                value: PaymentMethodHelper.getNameCapitalized(object.method),
            }),
        },
        {
            id: 'provider',
            name: $t(`126040d7-3625-45c5-b561-4bf6c5baac12`),
            width: 16,
            getValue: (object: PaymentGeneralWithStripeAccount) => ({
                value: object.provider ?? PaymentMethodHelper.getNameCapitalized(object.method),
            }),
        },
        {
            id: 'createdAt',
            name: $t(`10fd24bb-43dd-4174-9a23-db3ac54af9be`),
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
            name: $t(`297af5d5-1cb0-4862-b8d4-13416bdefa9f`),
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
            name: $t(`151006be-86c2-48cd-bcd7-7c3bf9b76080`),
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
            name: $t(`02b47907-73e2-4cb2-b398-784f6cbce23a`),
            width: 21,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.settlement?.reference || '',
                };
            },
        },
        {
            id: 'settlement.settledAt',
            name: $t(`4ff3b4aa-8668-4287-bce3-b06cde51ddb7`),
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
            name: $t(`285990a8-0565-4d38-a97f-a9c935096159`),
            width: 18,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.settlement?.amount !== undefined ? (object.settlement?.amount / 1_0000) : null,
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
            name: $t(`02754274-677a-4911-9a32-8422a8d9f827`),
            width: 16,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.transferFee / 1_0000,
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
            name: $t(`a7f32979-1ee8-47fe-a409-7b17ce9f9d39`),
            width: 20,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.stripeAccount?.accountId || '',
                };
            },
        },
        {
            id: 'iban',
            name: $t(`dc091655-124e-4dce-98c2-67061bf5ba14`),
            width: 20,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.iban || '',
                };
            },
        },
        {
            id: 'ibanName',
            name: $t(`037aebd6-adf9-4ddb-90f5-5d89aa7dee01`),
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
            name: $t(`136b7ba4-7611-4ee4-a46d-60758869210f`),
            width: 25,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.transferDescription || '',
                };
            },
        },
        {
            id: 'transferSettings.creditor',
            name: $t(`31c28f13-d3b8-42ee-8979-c8224633237e`),
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
            name: $t(`64d16d6d-bcf9-427f-9aaa-441e2f61a3ab`),
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

function getPayingOrganizationColumns(): XlsxTransformerColumn<PaymentGeneral>[] {
    return [
        {
            id: 'payingOrganization.id',
            name: $t(`73ddcf23-84a5-4911-9f1a-19fb101bf2d1`),
            width: 40,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.payingOrganization?.id || '',
                };
            },
        },
        {
            id: 'payingOrganization.name',
            name: $t(`5f25a20d-ca03-4155-88c6-f9ae3872c052`),
            width: 30,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.payingOrganization?.name || '',
                };
            },
        },
        {
            id: 'payingOrganization.uri',
            name: $t(`711fa35a-e20e-4372-b807-09192714250e`),
            width: 30,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.payingOrganization?.uri || '',
                };
            },
        },
        XlsxTransformerColumnHelper.createAddressColumns<PaymentGeneralWithStripeAccount>({
            matchId: 'payingOrganization.address',
            getAddress: object => object.payingOrganization?.address,
        }),
    ];
}

function getInvoiceColumns(): XlsxTransformerColumn<PaymentGeneral>[] {
    return [
        {
            id: 'customer.name',
            name: $t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`),
            width: 30,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.customer?.name || '',
                };
            },
        },
        {
            id: 'customer.email',
            name: $t(`237d0720-13f0-4029-8bf2-4de7e0a9a358`),
            width: 40,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.customer?.email || '',
                };
            },
        },
        {
            id: 'customer.company.name',
            name: $t(`67928a02-b3f1-465a-9dd7-569d061599a9`),
            width: 30,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.customer?.company?.name || '',
                };
            },
        },
        {
            id: 'customer.company.VATNumber',
            name: $t(`263b7054-d38f-4bb9-be63-84b4e614613d`),
            width: 20,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.customer?.company?.VATNumber || '',
                };
            },
        },
        {
            id: 'customer.company.companyNumber',
            name: $t(`12f64ea7-fb54-4178-8267-9de12bdf70d7`),
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
        }),
        {
            id: 'customer.company.administrationEmail',
            name: $t(`8eb5f50e-d00d-444d-979a-f80ae834eb9a`),
            width: 30,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.customer?.company?.administrationEmail || '',
                };
            },
        },
    ];
}
