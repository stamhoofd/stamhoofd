import type { DeleteRegisterItem } from '@stamhoofd/structures';

/**
 * Registrations that are cancelled together are grouped by how much of them was already paid:
 * every group gets one refund choice, because the sensible choices differ per group.
 */
export enum RefundCategoryType {
    Paid = 'Paid',
    PartiallyPaid = 'PartiallyPaid',
    NotPaid = 'NotPaid',
}

export enum RefundChoice {
    /**
     * No cancellation fee: everything that was paid is given back as credit and nothing stays open.
     */
    NoFee = 'NoFee',

    /**
     * A cancellation fee equal to the amount that was already paid: nothing is refunded and nothing stays open.
     */
    KeepPaid = 'KeepPaid',

    /**
     * A cancellation fee of the full price: nothing is refunded and everything that is open stays open.
     */
    FullFee = 'FullFee',

    /**
     * A cancellation fee chosen by the user.
     */
    CustomFee = 'CustomFee',
}

function amountPaidFor(item: DeleteRegisterItem) {
    // Payments that are still being processed are counted as paid: they will be paid after this action
    return item.registration.registration.balances.reduce((total, balance) => total + balance.amountPaid + balance.amountPending, 0);
}

function amountOpenFor(item: DeleteRegisterItem) {
    return item.registration.registration.balances.reduce((total, balance) => total + balance.amountOpen, 0);
}

function categoryTypeFor(item: DeleteRegisterItem): RefundCategoryType | null {
    const paid = amountPaidFor(item);
    const open = amountOpenFor(item);

    if (paid + open === 0) {
        // Nothing was charged, so there is nothing to refund or to cancel
        return null;
    }

    if (open <= 0) {
        return RefundCategoryType.Paid;
    }

    if (paid <= 0) {
        return RefundCategoryType.NotPaid;
    }

    return RefundCategoryType.PartiallyPaid;
}

export class RefundCategory {
    readonly type: RefundCategoryType;
    readonly items: DeleteRegisterItem[];

    constructor(type: RefundCategoryType, items: DeleteRegisterItem[]) {
        this.type = type;
        this.items = items;
    }

    get count() {
        return this.items.length;
    }

    get amountPaid() {
        return this.items.reduce((total, item) => total + amountPaidFor(item), 0);
    }

    get amountOpen() {
        return this.items.reduce((total, item) => total + amountOpenFor(item), 0);
    }

    /**
     * The choices of this category, in the order they are offered.
     */
    get choices(): RefundChoice[] {
        if (this.type === RefundCategoryType.PartiallyPaid) {
            return [RefundChoice.KeepPaid, RefundChoice.FullFee, RefundChoice.CustomFee];
        }
        return [RefundChoice.NoFee, RefundChoice.FullFee, RefundChoice.CustomFee];
    }

    /**
     * The choice that matches the cancellation fees that are set now. Falls back to a custom fee.
     */
    get choice(): RefundChoice {
        for (const choice of this.choices) {
            if (choice === RefundChoice.CustomFee) {
                continue;
            }

            if (this.items.every(item => item.cancellationFeePercentage === this.percentageFor(item, choice))) {
                return choice;
            }
        }

        return RefundChoice.CustomFee;
    }

    /**
     * The cancellation fee that is shown and edited for a custom choice. Fees can differ between
     * registrations, so the first one is used as the value for the whole category.
     */
    get cancellationFeePercentage() {
        return this.items[0]?.cancellationFeePercentage ?? 0;
    }

    set cancellationFeePercentage(percentage: number) {
        for (const item of this.items) {
            item.cancellationFeePercentage = percentage;
        }
    }

    select(choice: RefundChoice) {
        if (choice === RefundChoice.CustomFee) {
            // The fee that is set now is the starting point of the custom fee
            return;
        }

        for (const item of this.items) {
            item.cancellationFeePercentage = this.percentageFor(item, choice);
        }
    }

    private percentageFor(item: DeleteRegisterItem, choice: RefundChoice) {
        switch (choice) {
            case RefundChoice.NoFee:
                return 0;
            case RefundChoice.FullFee:
                return 100_00;
            case RefundChoice.KeepPaid: {
                const paid = amountPaidFor(item);
                const price = paid + amountOpenFor(item);
                return price === 0 ? 0 : Math.round(paid * 10000 / price);
            }
            case RefundChoice.CustomFee:
                return item.cancellationFeePercentage;
        }
    }
}

/**
 * Groups the registrations that are being cancelled by how much of them was already paid.
 * Registrations that were never charged are left out: they have nothing to refund.
 */
export function getRefundCategories(items: DeleteRegisterItem[]): RefundCategory[] {
    const order = [RefundCategoryType.Paid, RefundCategoryType.PartiallyPaid, RefundCategoryType.NotPaid];

    return order.flatMap((type) => {
        const itemsOfType = items.filter(item => categoryTypeFor(item) === type);
        return itemsOfType.length > 0 ? [new RefundCategory(type, itemsOfType)] : [];
    });
}
