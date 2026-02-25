import { BalanceItem, BalanceItemPayment, CachedBalance, Payment } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';
import { BalanceItemStatus, doBalanceItemRelationsMatch, PaymentMethod, PaymentStatus, PaymentType, ReceivableBalanceType } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { BalanceItemService } from './BalanceItemService.js';

type BalanceItemWithRemaining = {
    balanceItem: BalanceItem;
    remaining: number;
};

export const PaymentReallocationService = {
    /**
     * Move all canceled balance items payments to one single non-canceled item (note: they should be equal)
     *
     * This avoids the situation where you have multiple balance items for a registration, but only one registration
     * -> this can cause confusion because people might think 'hey' the price for that registration is z, not b (while it is about a canceled registration)
     */
    async mergeBalanceItems(mergeToItem: BalanceItem, otherItems: BalanceItem[]) {
        // Move all balance item payments to the merged item
        await SQL.update(BalanceItemPayment.table)
            .set('balanceItemId', mergeToItem.id)
            .where('balanceItemId', otherItems.map(bi => bi.id))
            .update();
    },

    async reallocate(organizationId: string, objectId: string, type: ReceivableBalanceType) {
        if (STAMHOOFD.environment === 'production') {
            // Disabled on production for now
            // until this has been tested more
            return;
        }

        let balanceItems = (await CachedBalance.balanceForObjects(organizationId, [objectId], type)).filter(b => b.isAfterDueDate);

        const didMerge: BalanceItem[] = [];

        // First try to merge balance items that are the same and have canceled variants
        for (const balanceItem of balanceItems) {
            if (balanceItem.status !== BalanceItemStatus.Due) {
                continue;
            }

            const similarDueItems = balanceItems.filter(b => b.id !== balanceItem.id && b.type === balanceItem.type && b.status === BalanceItemStatus.Due && doBalanceItemRelationsMatch(b.relations, balanceItem.relations, 0));

            if (similarDueItems.length) {
                // Not possible to merge into one: there are 2 due items
                continue;
            }
            const similarCanceledItems = balanceItems.filter(b => b.id !== balanceItem.id && b.type === balanceItem.type && b.status !== BalanceItemStatus.Due && (b.pricePaid !== 0 || b.pricePending !== 0) && doBalanceItemRelationsMatch(b.relations, balanceItem.relations, 0));

            if (similarCanceledItems.length) {
                await this.mergeBalanceItems(balanceItem, similarCanceledItems);
                didMerge.push(balanceItem, ...similarCanceledItems);
            }
        }

        if (didMerge.length) {
            // Update outstanding
            await BalanceItemService.updatePaidAndPending(didMerge);

            // Reload balance items
            balanceItems = (await CachedBalance.balanceForObjects(organizationId, [objectId], type)).filter(b => b.isAfterDueDate);
        }

        // The algorithm:
        // Search balance items that were paid too much, or have a negative open amount.
        // Find the best match in the positive list (balances that have an open amount). Try to find either:
        // - Same type, One with the same relation ids and the same amount -> special case: try to move the balance item payments around since this is safe (no impact on finances or tax)
        // - Same type, One with the same relation ids
        // - Same type, tne with one mismatching relation ids (e.g. same group id, different price id; same webshop, same product, different price)
        // - Same type, One with two mismatching relation ids (e.g. same webshop, different product)
        // - Same type, same amount
        // - Same type
        // - Unrelated balance items
        // This priority must be given for each balance item, so we start with priority 1 for all items, then priority 2 for all items...
        // The result should be a list of postive and negative balance items that is maximized (as much paid items should have been resolved) and equals zero.

        const negativeItems = balanceItems.filter(b => b.priceOpen < 0).map(balanceItem => ({ balanceItem, remaining: balanceItem.priceOpen }));
        const positiveItems = balanceItems.filter(b => b.priceOpen > 0).map(balanceItem => ({ balanceItem, remaining: balanceItem.priceOpen }));

        // If the total remaining is zero, we'll just merge everything together. This removes the restriction that two merged balance items should have the same remaining amount.
        const canReachZero = (negativeItems.reduce((p, i) => p + i.remaining, 0) === -positiveItems.reduce((p, i) => p + i.remaining, 0));

        // Rules:
        // Total outstanding amount should be zero to merge all items into one payment reallocation
        // otherwise, only swap if the amounts match exactly

        if (negativeItems.length === 0 || positiveItems.length === 0) {
            return;
        }

        // Now we reach the part where we are going to create reallocation payments (we are no longer going to alter existing payments)
        const pendingPayment = new Map<BalanceItem, number>();

        const matchMethods: { alterPayments: boolean; match: (negativeItem: BalanceItemWithRemaining, positive: BalanceItemWithRemaining) => boolean }[] = [
            {
                // Priority 1: same type, same relation ids, same amount
                alterPayments: true,
                match: (negativeItem, p) => {
                    return p.remaining === -negativeItem.remaining && p.balanceItem.type === negativeItem.balanceItem.type && doBalanceItemRelationsMatch(p.balanceItem.relations, negativeItem.balanceItem.relations, 0);
                },
            },
            {
                // Priority 1: same type, same relation ids, same amount
                alterPayments: false,
                match: (negativeItem, p) => {
                    return p.remaining === -negativeItem.remaining && p.balanceItem.type === negativeItem.balanceItem.type && doBalanceItemRelationsMatch(p.balanceItem.relations, negativeItem.balanceItem.relations, 0);
                },
            },
            {
                // Priority 2: same type, same relation ids, different amount
                alterPayments: true,
                match: (negativeItem, p) => {
                    return p.balanceItem.type === negativeItem.balanceItem.type && doBalanceItemRelationsMatch(p.balanceItem.relations, negativeItem.balanceItem.relations, 0);
                },
            },
            {
                // Priority 2: same type, same relation ids, different amount
                alterPayments: false,
                match: (negativeItem, p) => {
                    return p.balanceItem.type === negativeItem.balanceItem.type && doBalanceItemRelationsMatch(p.balanceItem.relations, negativeItem.balanceItem.relations, 0);
                },
            },
            {
                // Priority 3: same type, one mismatching relation id, same amount
                alterPayments: false,
                match: (negativeItem, p) => {
                    return p.remaining === -negativeItem.remaining && p.balanceItem.type === negativeItem.balanceItem.type && doBalanceItemRelationsMatch(p.balanceItem.relations, negativeItem.balanceItem.relations, 1);
                },
            },
            {
                // Priority 3: same type, one mismatching relation id
                alterPayments: false,
                match: (negativeItem, p) => {
                    return p.balanceItem.type === negativeItem.balanceItem.type && doBalanceItemRelationsMatch(p.balanceItem.relations, negativeItem.balanceItem.relations, 1);
                },
            },
            {
                // Priority 4: same type, two mismatching relation ids, same amount
                alterPayments: false,
                match: (negativeItem, p) => {
                    return p.remaining === -negativeItem.remaining && p.balanceItem.type === negativeItem.balanceItem.type && doBalanceItemRelationsMatch(p.balanceItem.relations, negativeItem.balanceItem.relations, 2);
                },
            },
            {
                // Priority 4: same type, two mismatching relation ids
                alterPayments: false,
                match: (negativeItem, p) => {
                    return p.balanceItem.type === negativeItem.balanceItem.type && doBalanceItemRelationsMatch(p.balanceItem.relations, negativeItem.balanceItem.relations, 2);
                },
            },
            {
                // Priority 5: same type, same amount
                alterPayments: false,
                match: (negativeItem, p) => {
                    return p.balanceItem.type === negativeItem.balanceItem.type && p.remaining === -negativeItem.remaining;
                },
            },
            {
                // Priority 6: same amount
                alterPayments: false,
                match: (negativeItem, p) => {
                    return p.remaining === -negativeItem.remaining;
                },
            },
            {
                // Priority 6: same type
                alterPayments: false,
                match: (negativeItem, p) => {
                    return p.balanceItem.type === negativeItem.balanceItem.type;
                },
            },
            {
                // Priority: any
                alterPayments: false,
                match: (negativeItem, p) => {
                    return true;
                },
            },
        ];

        for (const matchMethod of matchMethods) {
            // Sort negative items on hight > low
            negativeItems.sort((a, b) => b.remaining - a.remaining);

            // Sort positive items on due date, then hight > low
            positiveItems.sort((a, b) => Sorter.stack(
                Sorter.byDateValue(b.balanceItem.dueAt ?? new Date(0), a.balanceItem.dueAt ?? new Date(0)),
                b.remaining - a.remaining,
            ));

            for (const negativeItem of negativeItems) {
                if (negativeItem.remaining >= 0) {
                    continue;
                }

                const match = positiveItems.find((p) => {
                    return p.remaining > 0 && matchMethod.match(negativeItem, p) && (matchMethod.alterPayments || canReachZero || p.remaining === -negativeItem.remaining);
                });

                if (!match) {
                    continue;
                }

                if (matchMethod.alterPayments) {
                    await this.swapPayments(negativeItem, match);
                }
                else {
                    if (match.remaining !== -negativeItem.remaining) {
                        if (!canReachZero) {
                            continue;
                        }
                    }

                    // Add to pending payment
                    const moveAmount = Math.min(match.remaining, -negativeItem.remaining);

                    negativeItem.remaining += moveAmount;
                    match.remaining -= moveAmount;

                    pendingPayment.set(negativeItem.balanceItem, (pendingPayment.get(negativeItem.balanceItem) ?? 0) - moveAmount);
                    pendingPayment.set(match.balanceItem, (pendingPayment.get(match.balanceItem) ?? 0) + moveAmount);
                }
            }
        }

        // Create payment
        if (pendingPayment.size !== 0) {
            // Assert total is zero
            const total = Array.from(pendingPayment.values()).reduce((a, b) => a + b, 0);
            if (total !== 0) {
                throw new Error('Total is not zero');
            }

            const payment = new Payment();
            payment.organizationId = organizationId;
            payment.price = 0;
            payment.type = PaymentType.Reallocation;
            payment.method = PaymentMethod.Unknown;
            payment.status = PaymentStatus.Succeeded;
            payment.paidAt = new Date();
            await payment.save();

            // Create balance item payments
            for (const [balanceItem, price] of pendingPayment) {
                const balanceItemPayment = new BalanceItemPayment();
                balanceItemPayment.balanceItemId = balanceItem.id;
                balanceItemPayment.paymentId = payment.id;
                balanceItemPayment.price = price;
                balanceItemPayment.organizationId = organizationId;
                await balanceItemPayment.save();
            }
        }

        // Update outstanding
        await BalanceItemService.updatePaidAndPending([
            ...negativeItems.filter(n => n.remaining !== n.balanceItem.priceOpen).map(n => n.balanceItem),
            ...positiveItems.filter(p => p.remaining !== p.balanceItem.priceOpen).map(p => p.balanceItem),
        ]);
    },

    async swapPayments(negativeItem: BalanceItemWithRemaining, match: BalanceItemWithRemaining) {
        const { balanceItemPayments: allBalanceItemPayments, payments } = await BalanceItem.loadPayments([negativeItem.balanceItem, match.balanceItem]);

        // Remove balance item payments of failed or deleted payments
        const balanceItemPayments = allBalanceItemPayments.filter((bp) => {
            const payment = payments.find(p => p.id === bp.paymentId);
            if (!payment || payment.status === PaymentStatus.Failed) {
                return false;
            }
            return true;
        });

        if (balanceItemPayments.length === 0) {
            return;
        }

        // First try to find exact matches
        await this.doSwapPayments(balanceItemPayments, negativeItem, match, { split: false, exactOnly: true });

        // Try with not exact matches
        await this.doSwapPayments(balanceItemPayments, negativeItem, match, { split: false, exactOnly: false });

        // Try with matches that are too big
        await this.doSwapPayments(balanceItemPayments, negativeItem, match, { split: true, exactOnly: false });
    },

    async doSwapPayments(balanceItemPayments: BalanceItemPayment[], negativeItem: BalanceItemWithRemaining, match: BalanceItemWithRemaining, options: { split: boolean; exactOnly: boolean }) {
        if (negativeItem.remaining >= 0 || match.remaining <= 0) {
            // Stop because one item is zero or switched sign
            return;
        }

        // Try with matches that are too big
        for (const bp of balanceItemPayments) {
            const price = bp.price;

            if (bp.balanceItemId === match.balanceItem.id) {
                if (price < 0) {
                    if (price < negativeItem.remaining || price < -match.remaining) {
                        if (!options.split) {
                            continue;
                        }
                        // Split the balance item payment in two: a part for negative item, and a part for match
                        const swap = -Math.min(-negativeItem.remaining, match.remaining);

                        // We need to split
                        bp.price -= swap;
                        await bp.save();

                        // Create a new duplicate
                        const newBP = new BalanceItemPayment();
                        newBP.organizationId = bp.organizationId;
                        newBP.paymentId = bp.paymentId;
                        newBP.balanceItemId = negativeItem.balanceItem.id;
                        newBP.price = swap;
                        await newBP.save();

                        negativeItem.remaining -= swap;
                        match.remaining += swap;
                    }
                    else {
                        if (options.exactOnly && !(price === negativeItem.remaining || price === -match.remaining)) {
                            continue;
                        }

                        // Swap
                        bp.balanceItemId = negativeItem.balanceItem.id;
                        await bp.save();

                        negativeItem.remaining -= price;
                        match.remaining += price;
                    }

                    if (negativeItem.remaining >= 0 || match.remaining <= 0) {
                        // Stop because one item is zero or switched sign
                        return;
                    }
                }
            }
            else {
                if (price > 0) {
                    if (price > -negativeItem.remaining || price > match.remaining) {
                        if (!options.split) {
                            continue;
                        }

                        // Split the balance item payment in two: a part for negative item, and a part for match
                        const swap = Math.min(-negativeItem.remaining, match.remaining);

                        // We need to split
                        bp.price -= swap;
                        await bp.save();

                        // Create a new duplicate
                        const newBP = new BalanceItemPayment();
                        newBP.organizationId = bp.organizationId;
                        newBP.paymentId = bp.paymentId;
                        newBP.balanceItemId = match.balanceItem.id;
                        newBP.price = swap;
                        await newBP.save();

                        negativeItem.remaining += swap;
                        match.remaining -= swap;
                    }
                    else {
                        if (options.exactOnly && !(price === -negativeItem.remaining || price === match.remaining)) {
                            continue;
                        }

                        // Swap
                        bp.balanceItemId = match.balanceItem.id;
                        await bp.save();

                        negativeItem.remaining += price;
                        match.remaining -= price;
                    }

                    if (negativeItem.remaining >= 0 || match.remaining <= 0) {
                        // Stop because one item is zero or switched sign
                        return;
                    }
                }
            }
        }
    },

};
