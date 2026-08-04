import { Formatter, Sorter } from '@stamhoofd/utility';
import type { BalanceItem } from '../BalanceItem.js';
import { getBalanceItemTitle, getBalanceItemTypeIcon } from '../BalanceItem.js';
import type { BalanceItemPaymentDetailed } from '../BalanceItemDetailed.js';
import type { PaymentGeneral } from '../members/PaymentGeneral.js';
import { BreakdownGroup } from '../PaymentBreakdown.js';
import { TranslatedString } from '../TranslatedString.js';

/**
 * A payment can pay for several things at once, so money is broken down per balance item it was
 * received for: this is one payment and the part of it that was received for one balance item.
 */
export class PaymentBreakdownItem {
    payment: PaymentGeneral;
    balanceItemPayment: BalanceItemPaymentDetailed;

    constructor(payment: PaymentGeneral, balanceItemPayment: BalanceItemPaymentDetailed) {
        this.payment = payment;
        this.balanceItemPayment = balanceItemPayment;
    }

    get balanceItem(): BalanceItem {
        return this.balanceItemPayment.balanceItem;
    }

    /**
     * The amount of money that was received for this balance item.
     */
    get price(): number {
        return this.balanceItemPayment.price;
    }
}

/**
 * One row of a tab, while it is being built.
 *
 * A row keeps no more than what it needs to add the next object: the totals so far, the ids of the
 * balance items it counted and the first article it holds.
 */
export class BreakdownRow {
    readonly group: BreakdownGroup;

    /**
     * All the money of one payment is added in one go, so remembering the last one is enough to count
     * every payment once.
     */
    private lastPaymentId: string | null = null;
    private paymentCount = 0;

    /**
     * The balance items that were already counted, because a balance item can be paid by more than one
     * payment - possibly in different pages - but it stays one piece.
     */
    private countedBalanceItems = new Set<string>();

    /**
     * The article this row holds, used to name it. See describeArticle.
     */
    private article: BalanceItem | null = null;
    private hasMultipleArticles = false;

    /**
     * What the objects in this row are worth in full, which is more than the row itself when it holds
     * a part of them. See countWhole.
     */
    private wholePrice = 0;
    private countedWhole = new Set<string>();

    constructor(group: BreakdownGroup) {
        this.group = group;
    }

    addPrice(price: number) {
        this.group.price += price;
        return this;
    }

    /**
     * @param wholePrice What this payment is worth in full, so a row that holds one of the things it
     * paid for can tell it holds a part of it.
     */
    countPayment(paymentId: string, wholePrice = 0) {
        if (this.lastPaymentId !== paymentId) {
            this.lastPaymentId = paymentId;
            this.paymentCount += 1;
            this.wholePrice += wholePrice;
        }
        return this;
    }

    /**
     * Counts what an object is worth in full under the measure this row adds up, so the row knows
     * whether it holds all of it or only a part.
     */
    countWhole(objectId: string, whole: number) {
        if (!this.countedWhole.has(objectId)) {
            this.countedWhole.add(objectId);
            this.wholePrice += whole;
        }
        return this;
    }

    /**
     * @param quantity The number of pieces this balance item adds to this row, which is not its own
     * quantity when a row holds one line of a webshop order.
     */
    countBalanceItem(item: BalanceItem, quantity = item.payableQuantity) {
        if (!this.countedBalanceItems.has(item.id)) {
            this.countedBalanceItems.add(item.id);
            this.group.quantity += quantity;
        }
        return this;
    }

    /**
     * Names this row after the article it holds, the same way a member sees it on their own balance,
     * and keeps track of the relations that everything in it has in common.
     */
    describeArticle(item: BalanceItem) {
        if (!this.article) {
            this.article = item;
            this.group.icon = getBalanceItemTypeIcon(item.type);
            this.group.relations = new Map(item.relations);
            return this;
        }

        if (item.id !== this.article.id) {
            // The same balance item can be paid by more than one payment, which doesn't make it a group
            this.hasMultipleArticles = true;
        }

        // Only keep what is true for everything in this row, so it never shows the member or option of
        // one of them as if it were the whole row
        for (const [type, relation] of this.group.relations) {
            if (item.relations.get(type)?.id !== relation.id) {
                this.group.relations.delete(type);
            }
        }

        return this;
    }

    /**
     * @param counts Whether the count of this row is a number of payments or of balance items.
     */
    finish(counts: 'payments' | 'balanceItems'): BreakdownGroup {
        this.group.count = counts === 'payments' ? this.paymentCount : this.countedBalanceItems.size;

        if (this.group.selection) {
            this.group.selection.isListPartial = this.wholePrice !== this.group.price;
        }

        if (this.article) {
            // Only the title: what the article is for is in the relations, which say what they are
            // instead of ending up in a description that would only be true for the first item
            this.group.name = new TranslatedString(getBalanceItemTitle(this.article, this.hasMultipleArticles));
        }

        return this.group;
    }
}

/**
 * The rows of one tab, added up while the objects stream in.
 */
export class BreakdownRows {
    private rows = new Map<string, BreakdownRow>();

    constructor(private readonly counts: 'payments' | 'balanceItems') {
    }

    /**
     * @param create Builds the row the first time something lands in it.
     */
    row(id: string, create: () => BreakdownGroup): BreakdownRow {
        let row = this.rows.get(id);

        if (!row) {
            row = new BreakdownRow(create());
            this.rows.set(id, row);
        }

        return row;
    }

    /**
     * The rows with the most money first, so the biggest amounts are on top. Everything below the
     * biggest MAX_TAB_ROWS is added together in one row at the end.
     */
    build(): BreakdownGroup[] {
        const groups = [...this.rows.values()]
            .map(row => row.finish(this.counts))
            .sort((a, b) => Sorter.byNumberValue(Math.abs(a.price), Math.abs(b.price)));

        if (groups.length <= MAX_TAB_ROWS) {
            return groups;
        }

        const shown = groups.slice(0, MAX_TAB_ROWS - 1);
        const rest = groups.slice(MAX_TAB_ROWS - 1);

        shown.push(BreakdownGroup.create({
            id: OTHER_GROUPS_ID,
            name: new TranslatedString($t('%mV')),
            description: $t('%ZiR', { count: Formatter.integer(rest.length) }),
            icon: 'box',
            price: rest.reduce((total, group) => total + group.price, 0),
            quantity: rest.reduce((total, group) => total + group.quantity, 0),
            // The same payment can be in more than one of these rows, so adding up their counts would
            // count it twice. How many rows this holds is in the description instead
            count: 0,
            // There is no single filter that selects exactly what this row was added up from
            selection: null,
        }));

        return shown;
    }
}

/**
 * Above this many rows a tab says nothing anymore, and everything that is added to it has to be sent
 * and drawn. A one-off correction gets a row of its own (see BalanceItem.categoryId), so a selection
 * can hold thousands of them.
 */
const MAX_TAB_ROWS = 100;

const OTHER_GROUPS_ID = 'other-groups';
