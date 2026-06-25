import { field } from '@simonbackx/simple-encoding';
import type { XlsxTransformerColumn, XlsxTransformerConcreteColumn } from '@stamhoofd/excel-writer';
import { XlsxBuiltInNumberFormat } from '@stamhoofd/excel-writer';
import { Order, StripeAccount } from '@stamhoofd/models';
import type { OrderData } from '@stamhoofd/structures';
import { BalanceItem, BalanceItemPaymentDetailed, BalanceItemRelationType, BalanceItemType, ExcelExportType, getBalanceItemRelationTypeName, getBalanceItemTypeName, PaginatedResponse, PaymentGeneral, PaymentMethodHelper, PaymentStatusHelper, StripeAccount as StripeAccountStruct } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ExportToExcelEndpoint } from '../endpoints/global/files/ExportToExcelEndpoint.js';
import { GetPaymentsEndpoint } from '../endpoints/organization/dashboard/payments/GetPaymentsEndpoint.js';
import { XlsxTransformerColumnHelper } from '../helpers/XlsxTransformerColumnHelper.js';

type PaymentWithItem = {
    payment: PaymentGeneralWithStripeAccount;
    balanceItemPayment: PaymentExportBalanceItemPayment;
};

type PaymentExportOrder = {
    id: string;
    number: number | null;
    data: OrderData;
};

export type PaymentExportBalanceItemPayment = BalanceItemPaymentDetailed & {
    customTitle: string | null;
};

export class PaymentGeneralWithStripeAccount extends PaymentGeneral {
    @field({ decoder: StripeAccountStruct, nullable: true })
    stripeAccount: StripeAccountStruct | null = null;

    expandedBalanceItemPayments: PaymentExportBalanceItemPayment[] = [];
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

        const orderIds = Formatter.uniqueArray(
            data.results.flatMap(payment => payment.balanceItemPayments.flatMap((item) => {
                return item.balanceItem.orderId ? [item.balanceItem.orderId] : [];
            })),
        );
        const orders = orderIds.length > 0 ? await Order.getByIDs(...orderIds) : [];
        const orderMap = new Map<string, PaymentExportOrder>(orders.map(order => [order.id, order]));
        const addedOrderIds = new Set<string>();

        return new PaginatedResponse({
            ...data,
            results: data.results.map((p) => {
                const payment = PaymentGeneralWithStripeAccount.create(p);
                payment.stripeAccount = p.stripeAccountId ? (accounts.find(a => a.id === p.stripeAccountId) ?? null) : null;
                payment.expandedBalanceItemPayments = expandPaymentBalanceItemPayments(payment, orderMap, addedOrderIds);
                return payment;
            }),
        });
    },
    sheets: [
        {
            id: 'payments',
            name: $t(`%1JH`),
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
            name: $t(`%Ly`),
            transform: (data: PaymentGeneralWithStripeAccount): PaymentWithItem[] => data.expandedBalanceItemPayments.map(p => ({
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

export function expandPaymentBalanceItemPayments(
    payment: PaymentGeneral,
    orderMap: Map<string, PaymentExportOrder>,
    addedOrderIds = new Set<string>(),
): PaymentExportBalanceItemPayment[] {
    return payment.balanceItemPayments.flatMap((item) => {
        const orderId = item.balanceItem.orderId;
        if (!orderId) {
            return [createExportBalanceItemPayment(item, null)];
        }

        const order = orderMap.get(orderId);
        if (!order) {
            return [createExportBalanceItemPayment(item, null)];
        }

        if (!addedOrderIds.has(order.id) && item.price === order.data.totalPrice) {
            addedOrderIds.add(order.id);
            return createOrderItemPaymentRows(item, order);
        }

        return [
            createSyntheticBalanceItemPayment({
                source: item,
                description: getPartialOrderPaymentDescription(order),
                amount: 1,
                price: item.price,
            }),
        ];
    });
}

function createOrderItemPaymentRows(
    item: BalanceItemPaymentDetailed,
    order: PaymentExportOrder,
): PaymentExportBalanceItemPayment[] {
    const rows: PaymentExportBalanceItemPayment[] = [];

    for (const orderItem of order.data.cart.items) {
        rows.push(
            createSyntheticBalanceItemPayment({
                source: item,
                customTitle: orderItem.product.name,
                description: orderItem.description,
                amount: orderItem.amount,
                price: orderItem.getPrice(),
            }),
        );
    }

    addOrderDiscountRows(rows, item, order);

    if (order.data.deliveryPrice) {
        rows.push(
            createSyntheticBalanceItemPayment({
                source: item,
                customTitle: $t('Leveringskosten'),
                description: $t('Leveringskosten'),
                amount: 1,
                price: order.data.deliveryPrice,
            }),
        );
    }

    if (order.data.administrationFee) {
        rows.push(
            createSyntheticBalanceItemPayment({
                source: item,
                customTitle: $t('Administratiekosten'),
                description: $t('Administratiekosten'),
                amount: 1,
                price: order.data.administrationFee,
            }),
        );
    }

    const difference = item.price - rows.reduce((sum, row) => sum + row.price, 0);
    if (difference !== 0) {
        rows.push(
            createSyntheticBalanceItemPayment({
                source: item,
                customTitle: $t('Correctie bestelling'),
                description: $t('Correctie bestelling'),
                amount: 1,
                price: difference,
            }),
        );
    }

    return rows;
}

function addOrderDiscountRows(
    rows: PaymentExportBalanceItemPayment[],
    item: BalanceItemPaymentDetailed,
    order: PaymentExportOrder,
) {
    let remainingDiscountablePrice = order.data.cart.price;

    const appliedPercentageDiscount = Math.min(order.data.appliedPercentageDiscount, remainingDiscountablePrice);
    if (appliedPercentageDiscount > 0) {
        rows.push(
            createSyntheticBalanceItemPayment({
                source: item,
                customTitle: $t('Korting ({percentage})', { percentage: Formatter.percentage(order.data.percentageDiscount) }),
                description: $t('Korting ({percentage})', { percentage: Formatter.percentage(order.data.percentageDiscount) }),
                amount: 1,
                price: -appliedPercentageDiscount,
            }),
        );
        remainingDiscountablePrice -= appliedPercentageDiscount;
    }

    const fixedDiscount = Math.min(order.data.fixedDiscount, remainingDiscountablePrice);
    if (fixedDiscount > 0) {
        rows.push(
            createSyntheticBalanceItemPayment({
                source: item,
                customTitle: $t('Korting'),
                description: $t('Vaste korting'),
                amount: 1,
                price: -fixedDiscount,
            }),
        );
    }
}

function getPartialOrderPaymentDescription(order: PaymentExportOrder): string {
    if (order.number !== null) {
        return $t('Gedeeltelijke betaling/terugbetaling voor bestelling #{number}', { number: order.number.toString() });
    }

    return $t('Gedeeltelijke betaling/terugbetaling voor bestelling');
}

function createSyntheticBalanceItemPayment({
    source,
    customTitle = null,
    description,
    amount,
    price,
}: {
    source: BalanceItemPaymentDetailed;
    customTitle?: string | null;
    description: string;
    amount: number;
    price: number;
}): PaymentExportBalanceItemPayment {
    return createExportBalanceItemPayment(BalanceItemPaymentDetailed.create({
        ...source,
        price,
        balanceItem: BalanceItem.create({
            ...source.balanceItem,
            type: BalanceItemType.Order,
            relations: new Map(source.balanceItem.relations),
            description,
            amount,
            unitPrice: amount === 0 ? 0 : price / amount,
        }),
    }), customTitle);
}

function createExportBalanceItemPayment(
    item: BalanceItemPaymentDetailed,
    customTitle: string | null,
): PaymentExportBalanceItemPayment {
    return Object.assign(item, {
        customTitle,
    });
}

function getBalanceItemColumns(): XlsxTransformerColumn<PaymentWithItem>[] {
    return [
        {
            id: 'id',
            name: $t(`%d`),
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
            name: $t(`%1LE`),
            width: 40,
            getValue: (object: PaymentWithItem) => ({
                value: object.balanceItemPayment.balanceItem.id,
            }),
        },
        {
            id: 'paymentId',
            name: $t(`%wU`),
            width: 40,
            getValue: (object: PaymentWithItem) => ({
                value: object.payment.id,
            }),
        },
        {
            id: 'balanceItem.type',
            name: $t(`%1B`),
            width: 30,
            getValue: (object: PaymentWithItem) => ({
                value: getBalanceItemTypeName(object.balanceItemPayment.balanceItem.type),
            }),
        },
        {
            id: 'balanceItem.category',
            name: $t(`%M2`),
            width: 30,
            getValue: (object: PaymentWithItem) => {
                return {
                    value: Formatter.capitalizeFirstLetter(object.balanceItemPayment.balanceItem.category),
                };
            },
        },
        {
            id: 'balanceItem.title',
            name: $t('Titel'),
            width: 40,
            getValue: (object: PaymentWithItem) => ({
                value: object.balanceItemPayment.customTitle || object.balanceItemPayment.balanceItem.itemTitle,
            }),
        },
        {
            id: 'balanceItem.description',
            name: $t(`%6o`),
            width: 50,
            getValue: (object: PaymentWithItem) => ({
                value: object.balanceItemPayment.balanceItem.itemDescription || object.balanceItemPayment.balanceItem.description,
                style: {
                    alignment: {
                        wrapText: true,
                    },
                },
            }),
        },
        {
            id: 'balanceItem.createdAt',
            name: $t(`%wV`),
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
            name: $t(`%wW`),
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
            name: $t(`%M4`),
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
            name: $t(`%6q`),
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
            name: $t(`%1IP`),
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
            name: $t(`%d`),
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
            name: $t(`%1JL`),
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
            name: $t(`%1A`),
            width: 18,
            getValue: (object: PaymentGeneralWithStripeAccount) => ({
                value: PaymentStatusHelper.getNameCapitalized(object.status),
            }),
        },
        {
            id: 'method',
            name: $t(`%M7`),
            width: 18,
            getValue: (object: PaymentGeneralWithStripeAccount) => ({
                value: PaymentMethodHelper.getNameCapitalized(object.method),
            }),
        },
        {
            id: 'provider',
            name: $t(`%wX`),
            width: 16,
            getValue: (object: PaymentGeneralWithStripeAccount) => ({
                value: object.provider ?? PaymentMethodHelper.getNameCapitalized(object.method),
            }),
        },
        {
            id: 'createdAt',
            name: $t(`%1JJ`),
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
            name: $t(`%wY`),
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
            name: $t(`%X`),
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
            name: $t(`%M8`),
            width: 21,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.settlement?.reference || '',
                };
            },
        },
        {
            id: 'settlement.settledAt',
            name: $t(`%MB`),
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
            name: $t(`%MD`),
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
            name: $t(`%wZ`),
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
            id: 'serviceFeeManual',
            name: $t(`%1dO`),
            width: 42,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.serviceFeeManual / 1_0000,
                    style: {
                        numberFormat: {
                            id: XlsxBuiltInNumberFormat.Currency2DecimalWithRed,
                        },
                    },
                };
            },
        },
        {
            id: 'serviceFeePayout',
            name: $t(`%1VD`),
            width: 50,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.serviceFeePayout / 1_0000,
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
            name: $t(`%1m`),
            width: 20,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.stripeAccount?.accountId || '',
                };
            },
        },
        {
            id: 'iban',
            name: $t(`%MH`),
            width: 20,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.iban || '',
                };
            },
        },
        {
            id: 'ibanName',
            name: $t(`%MJ`),
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
            name: $t(`%J8`),
            width: 25,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.transferDescription || '',
                };
            },
        },
        {
            id: 'transferSettings.creditor',
            name: $t(`%J5`),
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
            name: $t(`%MO`),
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
            name: $t(`%MQ`),
            width: 40,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.payingOrganization?.id || '',
                };
            },
        },
        {
            id: 'payingOrganization.name',
            name: $t(`%MT`),
            width: 30,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.payingOrganization?.name || '',
                };
            },
        },
        {
            id: 'payingOrganization.uri',
            name: $t(`%MS`),
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
            name: $t(`%1Os`),
            width: 30,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.customer?.name || '',
                };
            },
        },
        {
            id: 'customer.email',
            name: $t(`%1FK`),
            width: 40,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.customer?.email || '',
                };
            },
        },
        {
            id: 'customer.company.name',
            name: $t(`%1JI`),
            width: 30,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.customer?.company?.name || '',
                };
            },
        },
        {
            id: 'customer.company.VATNumber',
            name: $t(`%1CK`),
            width: 20,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.customer?.company?.VATNumber || '',
                };
            },
        },
        {
            id: 'customer.company.companyNumber',
            name: $t(`%wa`),
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
            name: $t(`%wb`),
            width: 30,
            getValue: (object: PaymentGeneralWithStripeAccount) => {
                return {
                    value: object.customer?.company?.administrationEmail || '',
                };
            },
        },
    ];
}
