import type { BalanceItemPaymentWithPrivatePayment } from '../BalanceItem.js';
import type { StripeAccount } from '../StripeAccount.js';
import type { OrderData } from '../webshops/Order.js';

/**
 * Extra information a page needs to be broken down, that isn't part of the objects themselves.
 */
export type BreakdownPageContext = {
    /**
     * The orders of the balance items in this page. A webshop order is charged as one balance item, so
     * the articles that were ordered are only visible inside the order itself.
     */
    orders?: Map<string, OrderData>;

    /**
     * The Stripe accounts the payments in this page arrived on, so they can be named after their
     * holder.
     */
    stripeAccounts?: StripeAccount[];

    /**
     * The payments of the balance items in this page, per balance item id. A balance item doesn't know
     * how it was paid, so the payouts it was part of are only visible through its payments.
     */
    balanceItemPayments?: Map<string, BalanceItemPaymentWithPrivatePayment[]>;
};
