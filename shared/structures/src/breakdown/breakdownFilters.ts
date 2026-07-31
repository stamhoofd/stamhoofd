import type { StamhoofdFilter } from '../filters/StamhoofdFilter.js';
import { mergeFilters } from '../filters/StamhoofdFilter.js';

/**
 * Selects the balance item payments that are about these balance items, and that came in with one of
 * these payments. Either half can be empty, e.g. when nothing was narrowed down yet.
 *
 * @param balanceItemPaymentFilter Already at the level of a balance item payment, e.g. { payment: ... }.
 */
export function toBalanceItemPaymentFilter(balanceItemFilter: StamhoofdFilter, balanceItemPaymentFilter: StamhoofdFilter): StamhoofdFilter {
    const filters: StamhoofdFilter[] = [];

    if (balanceItemFilter) {
        filters.push({ balanceItem: balanceItemFilter });
    }

    if (balanceItemPaymentFilter) {
        filters.push(balanceItemPaymentFilter);
    }

    return mergeFilters(filters);
}

/**
 * A balance item doesn't carry how it was paid, so anything about its payments is selected through them.
 */
export function toBalanceItemFilter(paymentFilter: StamhoofdFilter): StamhoofdFilter {
    return {
        payments: {
            $elemMatch: {
                payment: paymentFilter,
            },
        },
    };
}
