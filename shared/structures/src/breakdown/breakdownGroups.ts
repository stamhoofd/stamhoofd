import type { BalanceItem, BalanceItemRelation, BalanceItemRelationType } from '../BalanceItem.js';
import { getBalanceItemTypeIcon, getBalanceItemTypeName } from '../BalanceItem.js';
import type { StamhoofdFilter } from '../filters/StamhoofdFilter.js';
import type { PaymentAccount } from '../PaymentAccount.js';
import { BreakdownAmountType, BreakdownGroup, BreakdownObjectType, BreakdownSelection } from '../PaymentBreakdown.js';
import type { PaymentSettlementGroup } from '../PaymentSettlement.js';
import { PaymentStatus } from '../PaymentStatus.js';
import { TranslatedString } from '../TranslatedString.js';
import { toBalanceItemFilter } from './breakdownFilters.js';

/**
 * What a balance item is worth in full under one measure, so a row can tell whether it holds all of it
 * or only a part. Follows BreakdownAmountType.
 */
export function getWholeAmount(item: BalanceItem, amountType: BreakdownAmountType): number {
    switch (amountType) {
        case BreakdownAmountType.Paid: return item.pricePaid;
        case BreakdownAmountType.Pending: return item.pricePending;
        case BreakdownAmountType.Open: return item.priceOpen;
        default: return item.payablePriceWithVAT;
    }
}

/**
 * Where the money of a row that is added up over payments lives.
 */
export function createPaymentSelection(filter: StamhoofdFilter, amountType = BreakdownAmountType.Total): BreakdownSelection {
    return BreakdownSelection.create({
        objectType: BreakdownObjectType.Payments,
        listObjectType: BreakdownObjectType.Payments,
        amountType,
        filter,
    });
}

/**
 * Where the money of a row that is added up over balance items lives.
 */
export function createBalanceItemSelection(filter: StamhoofdFilter, amountType = BreakdownAmountType.Total): BreakdownSelection {
    return BreakdownSelection.create({
        objectType: BreakdownObjectType.BalanceItems,
        listObjectType: BreakdownObjectType.BalanceItems,
        amountType,
        filter,
    });
}

/**
 * A row that is named after where the money went through instead of after what it was for: the account
 * it arrived on, or the payout it was part of.
 */
export function createNamedGroup(source: PaymentAccount | PaymentSettlementGroup): BreakdownGroup {
    return BreakdownGroup.create({
        id: source.id,
        name: new TranslatedString(source.name),
        description: source.description,
        icon: source.icon,
        asideIcon: 'asideIcon' in source ? source.asideIcon : null,
        canNarrowDown: true,
        selection: createPaymentSelection(source.filter),
    });
}

export function createCategoryGroup(balanceItem: BalanceItem, amountType = BreakdownAmountType.Total): BreakdownGroup {
    const relationType = balanceItem.categoryRelationType;
    const relation = relationType ? balanceItem.relations.get(relationType) : undefined;
    const relations = new Map<BalanceItemRelationType, BalanceItemRelation>();

    if (relationType && relation) {
        relations.set(relationType, relation);
    }

    const typeName = getBalanceItemTypeName(balanceItem.type);
    const name = balanceItem.category;

    return BreakdownGroup.create({
        id: balanceItem.categoryId,
        name: new TranslatedString(name),
        // Several types are named after the same relation, e.g. a registration and the fee for
        // canceling it are both named after their group, so the row says which one it is
        description: relationType && name !== typeName ? typeName : '',
        icon: getBalanceItemTypeIcon(balanceItem.type),
        relations,
        canNarrowDown: true,
        selection: createBalanceItemSelection(balanceItem.categoryFilter, amountType),
    });
}

/**
 * The rows that hold what a payment rounded away. See PaymentBreakdownBuilder.addRounding.
 */
export const ROUNDING_ID = 'rounding';

export function createRoundingGroup(): BreakdownGroup {
    return BreakdownGroup.create({
        id: ROUNDING_ID,
        name: new TranslatedString($t('%1b6')),
        description: $t('%Zit'),
        icon: 'calculator',
        // What a payment rounded away is a part of the payment itself, not of one of the things it
        // paid for
        selection: createPaymentSelection({ roundingAmount: { $neq: 0 } }, BreakdownAmountType.Rounding),
    });
}

/**
 * The rows that hold what a payment doesn't say it paid for. See PaymentBreakdownBuilder.addUnallocated.
 */
export const UNALLOCATED_ID = 'unallocated';

export function createUnallocatedGroup(): BreakdownGroup {
    return BreakdownGroup.create({
        id: UNALLOCATED_ID,
        name: new TranslatedString($t('%Zjq')),
        description: $t('%ZjB'),
        icon: 'help',
        // There is no filter that selects the part of a payment that isn't linked to anything, so this
        // row can only be shown
        selection: null,
    });
}

/**
 * Selects nothing at all. Used when a group that was opened turned out to hold nothing: the objects of
 * that group are the ones that would be exported, and there are none.
 */
export const NOTHING: StamhoofdFilter = { id: { $in: [] } };

/**
 * A tab with one row says nothing that the total above it doesn't already say, so it is left out.
 */
export function onlyIfSplit(groups: BreakdownGroup[]): BreakdownGroup[] {
    return groups.length > 1 ? groups : [];
}

/**
 * A row that holds a part of its objects can only be exported exactly one level deeper, where that part
 * is the amount of the whole breakdown. Without this the deepest rows would only lead to a list, which
 * holds more than they show.
 */
export function canOpenPartialRow(group: BreakdownGroup): BreakdownGroup {
    if (group.selection?.isListPartial) {
        group.canNarrowDown = true;
    }

    return group;
}

export const UNPAID_FAILED_ID = 'unpaid-failed';
export const UNPAID_OPEN_ID = 'unpaid-open';
export const UNPAID_OPEN_AFTER_FAILED_ID = 'unpaid-open-after-failed';
export const REFUND_ID = 'refund';

/**
 * Selects the balance items that have a payment that failed, which is how what is still open is split
 * between what was already tried and what was not.
 */
const HAS_FAILED_PAYMENT: StamhoofdFilter = toBalanceItemFilter({ status: PaymentStatus.Failed });

/**
 * What is still open for the balance items that were already tried.
 *
 * The failed attempts and what is open next to them are two rows of the same items, so they select the
 * same ones: what tells them apart is how much of the open amount they hold, which is not something a
 * list of items can show (see BreakdownSelection.isListPartial).
 */
const OPEN_AFTER_FAILED_ATTEMPT: StamhoofdFilter = { $and: [{ priceOpen: { $gt: 0 } }, HAS_FAILED_PAYMENT] };

/**
 * A balance item doesn't carry how it was paid, so a row of the payout tab selects the items through
 * their payments.
 */
export function createBalanceItemGroup(group: PaymentSettlementGroup, amountType: BreakdownAmountType): BreakdownGroup {
    const result = createNamedGroup(group);

    result.selection = BreakdownSelection.create({
        // A balance item can be spread over several payouts, so what landed in this one is a balance
        // item payment, while the item around it is what a list shows
        objectType: BreakdownObjectType.BalanceItemPayments,
        listObjectType: BreakdownObjectType.BalanceItems,
        amountType,
        filter: { payment: group.filter },
        listFilter: toBalanceItemFilter(group.filter),
    });

    return result;
}

export function createFailedGroup(): BreakdownGroup {
    return BreakdownGroup.create({
        id: UNPAID_FAILED_ID,
        name: new TranslatedString($t('%ZjW')),
        description: $t('%ZjU'),
        icon: 'canceled',
        canNarrowDown: true,
        selection: createBalanceItemSelection(OPEN_AFTER_FAILED_ATTEMPT, BreakdownAmountType.Open),
    });
}

export function createOpenAfterFailedGroup(): BreakdownGroup {
    return BreakdownGroup.create({
        id: UNPAID_OPEN_AFTER_FAILED_ID,
        name: new TranslatedString($t('%ZjC')),
        description: $t('%ZjP'),
        icon: 'label',
        canNarrowDown: true,
        selection: createBalanceItemSelection(OPEN_AFTER_FAILED_ATTEMPT, BreakdownAmountType.Open),
    });
}

export function createOpenGroup(): BreakdownGroup {
    return BreakdownGroup.create({
        id: UNPAID_OPEN_ID,
        name: new TranslatedString($t('%1Ni')),
        description: $t('%Zjj'),
        icon: 'label',
        canNarrowDown: true,
        selection: createBalanceItemSelection({ $and: [{ priceOpen: { $gt: 0 } }, { $not: HAS_FAILED_PAYMENT }] }, BreakdownAmountType.Open),
    });
}

export function createRefundGroup(): BreakdownGroup {
    return BreakdownGroup.create({
        id: REFUND_ID,
        name: new TranslatedString($t('%10b')),
        description: $t('%ZjS'),
        icon: 'undo',
        canNarrowDown: true,
        selection: createBalanceItemSelection({ priceOpen: { $lt: 0 } }, BreakdownAmountType.Open),
    });
}
