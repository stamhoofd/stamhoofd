import type { BalanceItemPaymentDetailed } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';

/**
 * Oldest items first, in the same order as the balance item lists.
 */
export function sortBalanceItemPayments(items: BalanceItemPaymentDetailed[]): BalanceItemPaymentDetailed[] {
    return items.slice().sort((a, b) => Sorter.stack(
        Sorter.byDateValue(b.balanceItem.dueAt ?? new Date(0), a.balanceItem.dueAt ?? new Date(0)),
        Sorter.byDateValue(b.balanceItem.createdAt, a.balanceItem.createdAt),
        Sorter.byNumberValue(a.price, b.price),
        Sorter.byStringValue(a.itemDescription ?? a.balanceItem.name, b.itemDescription ?? b.balanceItem.name),
    ));
}
