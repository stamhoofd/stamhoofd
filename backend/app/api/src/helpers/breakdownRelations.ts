import { BalanceItem, Order } from '@stamhoofd/models';
import type { OrderData } from '@stamhoofd/structures';
import { BalanceItemPaymentWithPrivatePayment, PrivatePayment } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

/**
 * A webshop order is charged as one balance item, so the articles that were ordered are only visible
 * inside the order itself.
 */
export async function loadOrdersForBreakdown(orderIds: (string | null)[]): Promise<Map<string, OrderData>> {
    const ids = Formatter.uniqueArray(orderIds.flatMap(id => id ? [id] : []));

    if (ids.length === 0) {
        return new Map();
    }

    const orders = await Order.getByIDs(...ids);
    return new Map(orders.map(order => [order.id, order.data]));
}

/**
 * The payments that paid for these balance items, per balance item id. A balance item doesn't know how
 * it was paid, so the payouts it was part of are only visible through its payments (see
 * PaymentSettlementGroup).
 */
export async function loadPaymentsForBreakdown(balanceItemIds: string[]): Promise<Map<string, BalanceItemPaymentWithPrivatePayment[]>> {
    if (balanceItemIds.length === 0) {
        return new Map();
    }

    const { payments, balanceItemPayments } = await BalanceItem.loadPayments(balanceItemIds.map(id => ({ id })));
    const paymentsById = new Map(payments.map(payment => [payment.id, PrivatePayment.create(payment)]));
    const result = new Map<string, BalanceItemPaymentWithPrivatePayment[]>();

    for (const balanceItemPayment of balanceItemPayments) {
        const payment = paymentsById.get(balanceItemPayment.paymentId);

        if (!payment) {
            continue;
        }

        const list = result.get(balanceItemPayment.balanceItemId) ?? [];
        list.push(BalanceItemPaymentWithPrivatePayment.create({ ...balanceItemPayment, payment }));
        result.set(balanceItemPayment.balanceItemId, list);
    }

    return result;
}
