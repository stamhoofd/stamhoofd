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
            name: $t(`d4dbb3ee-ab9d-4231-be12-945b7d156900`),
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
            name: $t(`fb8a50ba-0429-46f6-8a83-0602ba46bca7`),
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
            name: $t(`Aanrekening ID`),
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
            name: $t(`f97ad8c1-31d2-4b61-9e09-3be86eaeba08`),
            width: 30,
            getValue: (object: PaymentWithItem) => ({
                value: getBalanceItemTypeName(object.balanceItemPayment.balanceItem.type),
            }),
        },
        {
            id: 'balanceItem.category',
            name: $t(`c5d24ab8-a87a-481d-a470-23e9386199f3`),
            width: 30,
            getValue: (object: PaymentWithItem) => {
                return {
                    value: Formatter.capitalizeFirstLetter(object.balanceItemPayment.balanceItem.category),
                };
            },
        },
        {
            id: 'balanceItem.description',
            name: $t(`9c4977db-1ce9-424b-92cf-4bbe7f6606fd`),
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
            name: $t(`f085f874-242d-47cb-a404-96eab69662ec`),
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
            name: $t(`7f7fdce2-1fcd-44c9-8c98-856aea11ffc3`),
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
            name: $t(`6f3104d4-9b8f-4946-8434-77202efae9f0`),
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
            name: $t(`61b7b9cb-287a-4655-bac2-bb2d0b83fe47`),
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
            name: $t(`d7003b29-cc92-4ef4-b07b-f283193ef2ae`),
            width: 18,
            getValue: (object: PaymentGeneralWithStripeAccount) => ({
                value: PaymentStatusHelper.getNameCapitalized(object.status),
            }),
        },
        {
            id: 'method',
            name: $t(`f12ffd5b-2138-41b4-8179-ae7ea2ce7621`),
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
            name: $t(`e5902b28-754d-42cd-b245-f403d03b8c56`),
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
            name: $t(`544a77e9-c915-4f47-afbf-c626396b0308`),
            width: 21,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.settlement?.reference || '',
                };
            },
        },
        {
            id: 'settlement.settledAt',
            name: $t(`fe56b791-fc88-4301-a59a-b5b185d1f124`),
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
            name: $t(`3790be02-581f-4713-8c4b-14cdf430f54a`),
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
            name: $t(`f8dd1b1a-3da5-472d-bb46-8763537e53c8`),
            width: 20,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.iban || '',
                };
            },
        },
        {
            id: 'ibanName',
            name: $t(`04d9151b-cca1-4bce-b320-3e2b7da25575`),
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
            name: $t(`dccdacf7-0760-4b17-8e03-fbfcda7a0b4f`),
            width: 25,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.transferDescription || '',
                };
            },
        },
        {
            id: 'transferSettings.creditor',
            name: $t(`63c0eca3-d13a-4e13-a9d6-1fc54718fbba`),
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
            name: $t(`6d5a8830-866d-4fe9-ae26-002a29b6054f`),
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
            name: $t(`bc1ac306-adaa-4e7b-a02f-47a1683c10b8`),
            width: 40,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.payingOrganization?.id || '',
                };
            },
        },
        {
            id: 'payingOrganization.name',
            name: $t(`ffd75ec7-b80b-4b97-961f-21246df7d803`),
            width: 30,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.payingOrganization?.name || '',
                };
            },
        },
        {
            id: 'payingOrganization.uri',
            name: $t(`a5332744-e6e1-4af9-b05c-cbc21515c4d0`),
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
            name: $t(`522fb6c5-6d4d-4d9c-94b7-3e282fb0ea1f`),
            width: 30,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.customer?.name || '',
                };
            },
        },
        {
            id: 'customer.email',
            name: $t(`82f4b6ed-afee-4655-9f07-22802e0e7ad9`),
            width: 40,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.customer?.email || '',
                };
            },
        },
        {
            id: 'customer.company.name',
            name: $t(`ea302250-6bae-409a-a547-78ff71181cfc`),
            width: 30,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.customer?.company?.name || '',
                };
            },
        },
        {
            id: 'customer.company.VATNumber',
            name: $t(`ee7d3d8e-9dc3-472f-900a-d1c1cc7e3947`),
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
