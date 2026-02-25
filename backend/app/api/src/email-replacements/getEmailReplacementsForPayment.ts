import { Order, Organization, Webshop } from '@stamhoofd/models';
import { BalanceItemPaymentsHtmlTableItem, BalanceItemRelationType, BalanceItemType, getBalanceItemPaymentsHtmlTable, PaymentGeneral, PaymentMethod, PaymentMethodHelper, Replacement, Webshop as WebshopStruct } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { createOrderDataHTMLTable } from '../helpers/email-html-helpers.js';

export type ReplacementsOptions = {
    /**
     * If not set, defaults to true
     */
    shouldAddReplacementsForOrder?: boolean;

    /**
     * If not set, defaults to true
     */
    shouldAddReplacementsForTransfers?: boolean;
    orderMap: Map<string, Order>;
    webshopMap: Map<string, Webshop>;
    organizationMap: Map<string, Organization>;
};

/**
 * To reduce the amount of queries, payment options should be generated for the whole aray of payments you want to send emails to.
 */
export async function buildReplacementOptions(payments: PaymentGeneral[], options?: { doesIncludePaymentWithoutOrders: boolean; areAllPaymentsTransfers: boolean }): Promise<ReplacementsOptions> {
    // get all orders linked to the payments
    const allOrderIdsSet = new Set<string>();
    const allWebshopIdsSet = new Set<string>();
    const organizationIdsForOrdersSet = new Set<string>();

    for (const payment of payments) {
        payment.webshopIds.forEach(id => allWebshopIdsSet.add(id));

        for (const balanceItemPayment of payment.balanceItemPayments) {
            const balanceItem = balanceItemPayment.balanceItem;
            if (balanceItem.orderId) {
                allOrderIdsSet.add(balanceItem.orderId);

                // only important if balance item has order
                organizationIdsForOrdersSet.add(balanceItem.organizationId);
            }
        }
    }

    // get all orders (for replacements later)
    const orders = await Order.getByIDs(...allOrderIdsSet);
    const orderMap = new Map<string, Order>(orders.map(o => [o.id, o] as [string, Order]));

    // get all webshops (for replacements later)
    const webshops = await Webshop.getByIDs(...allWebshopIdsSet);
    const webshopMap = new Map<string, Webshop>(webshops.map(w => [w.id, w] as [string, Webshop]));

    // get all organizations (for replacements later)
    const organizations = await Organization.getByIDs(...organizationIdsForOrdersSet);
    const organizationMap = new Map<string, Organization>(organizations.map(o => [o.id, o] as [string, Organization]));

    return {
        shouldAddReplacementsForOrder: options ? !options.doesIncludePaymentWithoutOrders : true,
        shouldAddReplacementsForTransfers: options ? options.areAllPaymentsTransfers : true,
        orderMap,
        webshopMap,
        organizationMap,
    };
}

export function getEmailReplacementsForPayment(payment: PaymentGeneral, options: ReplacementsOptions): Replacement[] {
    const { orderMap, webshopMap, organizationMap, shouldAddReplacementsForOrder, shouldAddReplacementsForTransfers } = options;
    const orderIds = new Set<string>();

    for (const balanceItemPayment of payment.balanceItemPayments) {
        const orderId = balanceItemPayment.balanceItem.orderId;
        if (orderId) {
            orderIds.add(orderId);
        }
    }

    // will be set if only 1 order is linked
    let singleOrder: Order | null = null;

    if (orderIds.size === 1) {
        const singleOrderId = [...orderIds][0];
        if (singleOrderId) {
            const order = orderMap.get(singleOrderId);

            if (order) {
                singleOrder = order;
            }
        }
    }

    let orderUrlReplacement: Replacement | null = null;
    let paymentUrl: string = '{{signInUrl}}';

    // add replacement for order url if only 1 order is linked
    if (shouldAddReplacementsForOrder ?? true) {
        if (singleOrder) {
            const webshop = webshopMap.get(singleOrder.webshopId);
            const organization = organizationMap.get(singleOrder.organizationId);

            if (webshop && organization) {
                const webshopStruct = WebshopStruct.create(webshop);

                orderUrlReplacement = Replacement.create({
                    token: 'orderUrl',
                    value: 'https://' + webshopStruct.getUrl(organization) + '/order/' + (singleOrder.id),
                });
                paymentUrl = 'https://' + webshopStruct.getUrl(organization) + '/order/' + (singleOrder.id);
            }
        }
        else {
            // Fallback (should not happen, but better than leaving {{orderUrl}} in place)
            orderUrlReplacement = Replacement.create({
                token: 'orderUrl',
                value: paymentUrl,
            });
        }
    }

    const createPaymentDataHtml = () => {
        if (singleOrder) {
            const webshop = webshopMap.get(singleOrder.webshopId);
            if (webshop) {
                return createOrderDataHTMLTable(singleOrder, webshop);
            }
        }

        return payment.getPaymentDataHTMLTable();
    };

    const paymentDataHtml = createPaymentDataHtml();

    return ([
        Replacement.create({
            token: 'paymentUrl',
            value: paymentUrl,
        }),
        Replacement.create({
            token: 'priceToPay',
            value: Formatter.price(payment.price),
        }),
        Replacement.create({
            token: 'paymentMethod',
            value: PaymentMethodHelper.getName(payment.method ?? PaymentMethod.Unknown),
        }),
        ...((shouldAddReplacementsForTransfers ?? true)
            ? [
                    Replacement.create({
                        token: 'transferDescription',
                        value: (payment.transferDescription ?? ''),
                    }),
                    Replacement.create({
                        token: 'transferBankAccount',
                        value: payment.transferSettings?.iban ?? '',
                    }),
                    Replacement.create({
                        token: 'transferBankCreditor',
                        value: payment.transferSettings?.creditor ?? (payment.organizationId ? organizationMap.get(payment.organizationId)?.name : '') ?? '',
                    }),
                ]
            : [
                    Replacement.create({
                        token: 'transferDescription',
                        value: '',
                    }),
                    Replacement.create({
                        token: 'transferBankAccount',
                        value: '',
                    }),
                    Replacement.create({
                        token: 'transferBankCreditor',
                        value: '',
                    }),
                ]),

        Replacement.create({
            token: 'balanceItemPaymentsTable',
            value: '',
            html: getBalanceItemPaymentsHtmlTable(unboxBalanceItemPayments(payment, orderMap)),
        }),
        Replacement.create({
            token: 'paymentTable',
            value: '',
            html: payment.getHTMLTable(),
        }),
        Replacement.create({
            token: 'paymentData',
            value: '',
            html: paymentDataHtml,
        }),
        Replacement.create({
            token: 'overviewContext',
            value: getPaymentContext(payment, options),
        }),
        Replacement.create({
            token: 'memberNames',
            value: payment.memberNames,
        }),
        orderUrlReplacement,
    ]).filter(replacementOrNull => replacementOrNull !== null);
}

function getPaymentContext(payment: PaymentGeneral, { orderMap, webshopMap }: ReplacementsOptions) {
    const overviewContext = new Set<string>();
    const registrationMemberNames = new Set<string>();

    // only add to context if type is order or registration
    for (const balanceItemPayment of payment.balanceItemPayments) {
        const balanceItem = balanceItemPayment.balanceItem;
        const type = balanceItem.type;

        switch (type) {
            case BalanceItemType.Order: {
                if (balanceItem.orderId) {
                    const order = orderMap.get(balanceItem.orderId);

                    if (order) {
                        const webshop = webshopMap.get(order.webshopId);
                        if (webshop) {
                            if (order.number) {
                                overviewContext.add($t('{webshop} (bestelling {orderNumber})', {
                                    webshop: webshop.meta.name,
                                    orderNumber: order.number ?? '',
                                }));
                            }
                            else {
                                overviewContext.add(webshop.meta.name);
                            }
                        }
                        else {
                            overviewContext.add($t('bestelling {orderNumber}', {
                                orderNumber: order.number ?? '',
                            }));
                        }
                    }
                }
                break;
            }
            case BalanceItemType.Registration: {
                const memberName = balanceItem.relations.get(BalanceItemRelationType.Member)?.name.toString();
                if (memberName) {
                    registrationMemberNames.add(memberName);
                }
                else {
                    overviewContext.add(balanceItem.itemTitle);
                }

                break;
            }
            default: {
                break;
            }
        }
    }

    if (registrationMemberNames.size > 0) {
        const memberNames = Formatter.joinLast([...registrationMemberNames], ', ', ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' ');
        overviewContext.add($t(`01d5fd7e-2960-4eb4-ab3a-2ac6dcb2e39c`) + ' ' + memberNames);
    }

    if (overviewContext.size === 0) {
        // add item title if no balance items with type order or registration
        if (payment.balanceItemPayments.length === 1) {
            const balanceItem = payment.balanceItemPayments[0].balanceItem;
            return balanceItem.itemTitle;
        }

        if (payment.balanceItemPayments.length > 1) {
            // return title if all balance items have the same title
            const firstTitle = payment.balanceItemPayments[0].balanceItem.itemTitle;
            const haveAllSameTitle = payment.balanceItemPayments.every(p => p.balanceItem.itemTitle === firstTitle);

            if (haveAllSameTitle) {
                return `${firstTitle} (${payment.balanceItemPayments.length}x)`;
            }

            // else return default text for multiple items
            return $t('Betaling voor {count} items', { count: payment.balanceItemPayments.length });
        }

        // else return default text for single item
        return $t('Betaling voor 1 item');
    }

    // join texts for balance items with type order or registration
    return [...overviewContext].join(', ');
}

function unboxBalanceItemPayments({ balanceItemPayments }: PaymentGeneral, orderMap: Map<string, Order>): BalanceItemPaymentsHtmlTableItem[] {
    const results: BalanceItemPaymentsHtmlTableItem[] = [];
    for (const item of balanceItemPayments) {
        const orderId = item.balanceItem.orderId;
        if (orderId === null) {
            results.push(item);
            continue;
        }

        const order = orderMap.get(orderId);
        if (!order) {
            // if 1 order is not found -> do not unbox the payment
            return balanceItemPayments;
        }

        for (const cartItem of order.data.cart.items) {
            const price = cartItem.getPriceWithDiscounts();
            const quantity = cartItem.amount;
            const unitPrice = Math.abs(quantity) > 1 ? price / quantity : price;

            results.push({
                itemTitle: cartItem.product.name,
                itemDescription: cartItem.description,
                balanceItem: {
                    description: cartItem.description,
                },
                quantity,
                unitPrice,
                price,
            });
        }
    }

    return results;
}
