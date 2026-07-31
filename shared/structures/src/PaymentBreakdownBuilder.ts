/**
 * How a selection of payments or balance items is added up into the rows of a breakdown.
 *
 * The objects are handed over page by page while they are read and thrown away again, so what a
 * breakdown holds grows with the number of rows it is building, not with the number of objects it
 * reads - the same way an Excel export writes its rows while it reads them.
 */
import { Formatter, Sorter } from '@stamhoofd/utility';
import type { BalanceItem, BalanceItemPaymentWithPrivatePayment, BalanceItemRelation, BalanceItemRelationType } from './BalanceItem.js';
import { BalanceItemType, getBalanceItemTypeIcon, GroupedBalanceItems } from './BalanceItem.js';
import type { BalanceItemPaymentDetailed } from './BalanceItemDetailed.js';
import type { StamhoofdFilter } from './filters/StamhoofdFilter.js';
import type { PaymentGeneral } from './members/PaymentGeneral.js';
import type { PaymentAccount } from './PaymentAccount.js';
import { getPaymentAccount } from './PaymentAccount.js';
import { BalanceItemBreakdown, BreakdownGraph, BreakdownGraphPoint, BreakdownGraphUnit, BreakdownGroup, BreakdownTab, PaymentBreakdown } from './PaymentBreakdown.js';
import type { BreakdownPathItem } from './PaymentBreakdown.js';
import { PaymentStatus } from './PaymentStatus.js';
import type { PaymentSettlementGroup } from './PaymentSettlement.js';
import { getPaymentSettlement, getPendingPaymentGroup, PENDING_PAYMENT_ID } from './PaymentSettlement.js';
import type { StripeAccount } from './StripeAccount.js';
import { TranslatedString } from './TranslatedString.js';
import type { CartItem } from './webshops/CartItem.js';
import type { OrderData } from './webshops/Order.js';

/**
 * A payment can pay for several things at once, so money is broken down per balance item it was
 * received for: this is one payment and the part of it that was received for one balance item.
 */
class PaymentBreakdownItem {
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
class BreakdownRow {
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

    constructor(group: BreakdownGroup) {
        this.group = group;
    }

    addPrice(price: number) {
        this.group.price += price;
        return this;
    }

    countPayment(paymentId: string) {
        if (this.lastPaymentId !== paymentId) {
            this.lastPaymentId = paymentId;
            this.paymentCount += 1;
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

        if (this.article) {
            const grouped = new GroupedBalanceItems();
            grouped.add(this.article);

            if (this.hasMultipleArticles) {
                // A group of items is named differently than a single one: only whether it holds more
                // than one item changes the title, not how many
                grouped.add(this.article);
            }

            // Only the title: what the article is for is in the relations, which say what they are
            // instead of ending up in a description that would only be true for the first item
            this.group.name = new TranslatedString(grouped.itemTitle);
        }

        return this.group;
    }
}

/**
 * The rows of one tab, added up while the objects stream in.
 */
class BreakdownRows {
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
     * The rows with the most money first, so the biggest amounts are on top.
     */
    build(): BreakdownGroup[] {
        return [...this.rows.values()]
            .map(row => row.finish(this.counts))
            .sort((a, b) => Sorter.byNumberValue(Math.abs(a.price), Math.abs(b.price)));
    }
}

/**
 * A row that is named after where the money went through instead of after what it was for: the account
 * it arrived on, or the payout it was part of.
 */
function createNamedGroup(source: PaymentAccount | PaymentSettlementGroup): BreakdownGroup {
    return BreakdownGroup.create({
        id: source.id,
        name: new TranslatedString(source.name),
        description: source.description,
        icon: source.icon,
        asideIcon: 'asideIcon' in source ? source.asideIcon : null,
        canNarrowDown: true,
        filter: source.filter,
    });
}

function createCategoryGroup(balanceItem: BalanceItem): BreakdownGroup {
    const relationType = balanceItem.categoryRelationType;
    const relation = relationType ? balanceItem.relations.get(relationType) : undefined;
    const relations = new Map<BalanceItemRelationType, BalanceItemRelation>();

    if (relationType && relation) {
        relations.set(relationType, relation);
    }

    return BreakdownGroup.create({
        id: balanceItem.categoryId,
        name: new TranslatedString(balanceItem.category),
        icon: getBalanceItemTypeIcon(balanceItem.type),
        relations,
        canNarrowDown: true,
        filter: balanceItem.categoryFilter,
    });
}

/**
 * The rows that hold what a payment rounded away. See PaymentBreakdownBuilder.addRounding.
 */
const ROUNDING_ID = 'rounding';

function createRoundingGroup(): BreakdownGroup {
    return BreakdownGroup.create({
        id: ROUNDING_ID,
        name: new TranslatedString($t('Afronding')),
        description: $t('Een betaling gaat tot op de cent, wat aangerekend werd tot op vier cijfers na de komma.'),
        icon: 'calculator',
    });
}

/**
 * One line of a webshop order: a product, the delivery cost or the administration cost.
 */
type OrderArticle = { id: string; name: string; description: string; icon: string; price: number; quantity: number };

function createOrderArticleGroup(article: OrderArticle): BreakdownGroup {
    return BreakdownGroup.create({
        id: article.id,
        name: new TranslatedString(article.name),
        description: article.description,
        icon: article.icon,
    });
}

/**
 * Splits one line of a cart into the article that was ordered and the options that were chosen for it,
 * so an option can be counted on its own instead of hiding inside every combination it was part of.
 *
 * The chosen options are priced separately, the article keeps what is left: that way the rows still add
 * up to what the cart line costs, including its discounts and seat or UiTPAS prices.
 */
function getCartItemArticles(item: CartItem): OrderArticle[] {
    const options: OrderArticle[] = item.options.map(({ option, optionMenu }) => ({
        id: 'option-' + optionMenu.id + '-' + option.id,
        name: optionMenu.name + ': ' + option.name,
        description: item.product.name,
        icon: 'add',
        price: option.price * item.amount,
        quantity: item.amount,
    }));

    return [
        {
            // Without the field answers: two t-shirts with a different name printed on them are one article
            id: 'product-' + item.product.id + '-' + item.productPrice.id,
            name: item.product.name,
            // Only the price that was chosen: the options are rows of their own
            description: item.product.prices.length > 1 ? item.productPrice.name : '',
            icon: 'basket',
            price: item.getPriceWithDiscounts() - options.reduce((total, option) => total + option.price, 0),
            quantity: item.amount,
        },
        ...options,
    ];
}

/**
 * Splits a webshop order into the articles that were ordered. Returns null when the balance item isn't
 * a webshop order, or when the amount doesn't match the order (an edited or refunded order can't be
 * attributed to single articles).
 */
function getOrderArticles(balanceItem: BalanceItem, price: number, orders: Map<string, OrderData>): OrderArticle[] | null {
    if (balanceItem.type !== BalanceItemType.Order || !balanceItem.orderId) {
        return null;
    }

    const order = orders.get(balanceItem.orderId);

    if (!order) {
        return null;
    }

    if (price !== order.totalPrice) {
        // A part of the order was paid, refunded or changed, so we can't say which articles it was for
        return [
            price < 0
                ? { id: 'order-refund', name: $t('Terugbetaling bestelling'), description: '', icon: 'undo', price, quantity: 0 }
                : { id: 'order-changed', name: $t('Gewijzigde bestelling'), description: '', icon: 'edit', price, quantity: 0 },
        ];
    }

    const articles: OrderArticle[] = order.cart.items.flatMap(item => getCartItemArticles(item));
    const discount = getOrderDiscount(order);

    if (discount) {
        articles.push({ id: 'order-discount', name: $t('Korting'), description: '', icon: 'label', price: -discount, quantity: 0 });
    }

    if (order.deliveryPrice) {
        articles.push({ id: 'order-delivery', name: $t('Leveringskost'), description: '', icon: 'trailer', price: order.deliveryPrice, quantity: 1 });
    }

    if (order.administrationFee) {
        articles.push({ id: 'order-administration-fee', name: $t('Administratiekosten'), description: '', icon: 'calculator', price: order.administrationFee, quantity: 1 });
    }

    return mergeArticles(articles);
}

/**
 * What a discount code took off the order as a whole, which is not part of the lines of the cart. Never
 * more than what the cart costs, because the total of an order is never negative.
 */
function getOrderDiscount(order: OrderData): number {
    const cartPrice = order.cart.priceWithDiscounts;
    return cartPrice - Math.max(0, cartPrice - order.appliedPercentageDiscount - order.fixedDiscount);
}

/**
 * Adds up the lines of one order that are the same article, e.g. two lines of the same t-shirt in
 * different sizes, so an order counts once in every row it lands in.
 */
function mergeArticles(articles: OrderArticle[]): OrderArticle[] {
    const merged = new Map<string, OrderArticle>();

    for (const article of articles) {
        const existing = merged.get(article.id);

        if (!existing) {
            merged.set(article.id, { ...article });
            continue;
        }

        existing.price += article.price;
        existing.quantity += article.quantity;
    }

    return [...merged.values()];
}

/**
 * Adds up what was received or charged per day, so it can be shown over time.
 *
 * Days are counted in the timezone of the app (see Formatter.luxon), so money that came in just before
 * midnight belongs to the day the user saw on the clock.
 */
class BreakdownTimeline {
    private days = new Map<string, { date: Date; price: number }>();

    add(date: Date | null, price: number) {
        if (!date) {
            return;
        }

        const day = Formatter.luxon(date).startOf('day');
        const key = day.toISODate() ?? '';
        const existing = this.days.get(key);

        if (existing) {
            existing.price += price;
            return;
        }

        this.days.set(key, { date: day.toJSDate(), price });
    }

    build(): BreakdownGraph {
        // Oldest first: a graph reads from left to right
        const days = [...this.days.values()].sort((a, b) => Sorter.byDateValue(b.date, a.date));

        if (days.length === 0) {
            return BreakdownGraph.create({});
        }

        // A month of days is still readable, longer than that only weeks are
        const span = Formatter.luxon(days[days.length - 1].date).diff(Formatter.luxon(days[0].date), 'days').days;
        const unit = span > 31 ? BreakdownGraphUnit.Week : BreakdownGraphUnit.Day;

        const points = unit === BreakdownGraphUnit.Week ? groupByWeek(days) : days;

        // Only the days or weeks something happened: the empty ones in between say nothing that the
        // dates don't already say, so they are added again where the graph is drawn
        return BreakdownGraph.create({
            unit,
            points: points.map(point => BreakdownGraphPoint.create(point)),
        });
    }
}

/**
 * Adds up the days of the same week, which starts on a monday.
 */
function groupByWeek(days: { date: Date; price: number }[]): { date: Date; price: number }[] {
    const weeks = new Map<string, { date: Date; price: number }>();

    for (const day of days) {
        const week = Formatter.luxon(day.date).startOf('week');
        const key = week.toISODate() ?? '';
        const existing = weeks.get(key);

        if (existing) {
            existing.price += day.price;
            continue;
        }

        weeks.set(key, { date: week.toJSDate(), price: day.price });
    }

    return [...weeks.values()];
}

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

/**
 * One part of what a balance item costs, and where that part ended up: paid out in a payout, still
 * being processed, tried and failed, or not paid at all.
 *
 * Every part of a balance item lands in exactly one of these, so together they add up to what was
 * charged.
 */
type BalanceItemPart = {
    /**
     * Identifies the row this part lands in, and is what a request sends back to narrow down to it.
     */
    id: string;
    price: number;
    createGroup: () => BreakdownGroup;
};

/**
 * Selects nothing at all. Used when a group that was opened turned out to hold nothing: the objects of
 * that group are the ones that would be exported, and there are none.
 */
const NOTHING: StamhoofdFilter = { id: { $in: [] } };

/**
 * A tab with one row says nothing that the total above it doesn't already say, so it is left out.
 */
function onlyIfSplit(groups: BreakdownGroup[]): BreakdownGroup[] {
    return groups.length > 1 ? groups : [];
}

/**
 * Splits what a balance item costs over the payouts it was part of and over what is not paid out (yet).
 *
 * A balance item doesn't carry any of this itself, so everything is read from the payments that paid for
 * it: only the money that actually came in was ever paid out, and what is left is still on its way or
 * was never paid.
 *
 * A part lands in a row exactly when the row's filter selects the item, so the list and the export
 * behind a row hold exactly what it was added up from.
 */
function getBalanceItemParts(item: BalanceItem, payments: BalanceItemPaymentWithPrivatePayment[]): BalanceItemPart[] {
    const parts = new Map<string, BalanceItemPart>();
    const add = (id: string, price: number, createGroup: () => BreakdownGroup) => {
        const existing = parts.get(id);

        if (existing) {
            existing.price += price;
            return;
        }

        parts.set(id, { id, price, createGroup });
    };

    let paid = 0;
    let pending = 0;
    let hasPending = false;
    let hasFailed = false;

    for (const { payment, price } of payments) {
        const group = getPaymentSettlement(payment);

        if (payment.status === PaymentStatus.Succeeded) {
            paid += price;
            add(group.id, price, () => createBalanceItemGroup(group));
            continue;
        }

        if (payment.status === PaymentStatus.Failed) {
            // What a failed payment tried to pay is not owed twice: it is still part of what is open
            hasFailed = true;
            continue;
        }

        pending += price;
        hasPending = true;
    }

    if (hasPending) {
        add(PENDING_PAYMENT_ID, pending, () => createBalanceItemGroup(getPendingPaymentGroup()));
    }

    // What is left of what was charged after everything that came in and everything that is on its way.
    // This is what BalanceItem.priceOpen holds, which is how these rows select their items again.
    const open = item.payablePriceWithVAT - paid - pending;

    if (open !== 0) {
        add(
            hasFailed ? UNPAID_FAILED_ID : UNPAID_OPEN_ID,
            open,
            hasFailed ? createFailedOpenGroup : createOpenGroup,
        );
    }

    return [...parts.values()];
}

const UNPAID_FAILED_ID = 'unpaid-failed';
const UNPAID_OPEN_ID = 'unpaid-open';

/**
 * Selects the balance items that have a payment that failed, which is how what is still open is split
 * between what was already tried and what was not.
 */
const HAS_FAILED_PAYMENT: StamhoofdFilter = toBalanceItemFilter({ status: PaymentStatus.Failed });

/**
 * A balance item doesn't carry how it was paid, so a row of the payout tab selects the items through
 * their payments.
 */
function createBalanceItemGroup(group: PaymentSettlementGroup): BreakdownGroup {
    const result = createNamedGroup(group);
    result.filter = toBalanceItemFilter(group.filter);
    return result;
}

function createFailedOpenGroup(): BreakdownGroup {
    return BreakdownGroup.create({
        id: UNPAID_FAILED_ID,
        name: new TranslatedString($t('Mislukte betaling')),
        description: $t('Er werd geprobeerd te betalen, maar dat is niet gelukt.'),
        icon: 'canceled',
        canNarrowDown: true,
        filter: { $and: [{ priceOpen: { $neq: 0 } }, HAS_FAILED_PAYMENT] },
    });
}

function createOpenGroup(): BreakdownGroup {
    return BreakdownGroup.create({
        id: UNPAID_OPEN_ID,
        name: new TranslatedString($t('Openstaand')),
        description: $t('Hiervoor werd nog niet betaald.'),
        icon: 'label',
        canNarrowDown: true,
        filter: { $and: [{ priceOpen: { $neq: 0 } }, { $not: HAS_FAILED_PAYMENT }] },
    });
}

/**
 * Adds up what a selection of payments comes down to, one page at a time.
 *
 * Every page is added and thrown away again, so the memory this needs grows with the number of rows
 * that are shown, not with the number of payments that are read.
 */
export class PaymentBreakdownBuilder {
    private readonly path: BreakdownPathItem[];

    /**
     * The filter of each opened group, remembered the first time an object matches it. That object
     * knows what the group was, so we don't have to look it up again to export it.
     */
    private readonly pathFilters: ({ filter: StamhoofdFilter; isBalanceItemFilter: boolean } | null)[];

    private readonly byAccount = new BreakdownRows('payments');
    private readonly byCategory = new BreakdownRows('payments');
    private readonly byArticle = new BreakdownRows('payments');
    private readonly bySettlement = new BreakdownRows('payments');
    private readonly timeline = new BreakdownTimeline();

    private price = 0;
    private paymentCount = 0;

    /**
     * What the payments above are worth in total, which is more than the price when they also paid for
     * things that are not shown.
     */
    private paymentPrice = 0;
    private transferFee = 0;
    private serviceFeeManual = 0;
    private serviceFeePayout = 0;

    constructor(path: BreakdownPathItem[] = []) {
        this.path = path;
        this.pathFilters = path.map(() => null);
    }

    add(payments: PaymentGeneral[], context: BreakdownPageContext = {}) {
        const stripeAccounts = context.stripeAccounts ?? [];
        const orders = context.orders ?? new Map<string, OrderData>();

        for (const payment of payments) {
            // Where the money arrived and which payout it was part of are the same for everything this
            // payment paid for
            const account = getPaymentAccount(payment, stripeAccounts);
            const settlement = getPaymentSettlement(payment);
            let isShown = false;

            for (const balanceItemPayment of payment.balanceItemPayments) {
                const item = new PaymentBreakdownItem(payment, balanceItemPayment);

                if (!this.matchesPath(item, account, settlement)) {
                    continue;
                }

                if (!isShown) {
                    isShown = true;
                    this.addPayment(payment);
                }

                this.addItem(item, account, settlement, orders);
            }

            // What isn't for one thing in particular: what the payment rounded away, and a payment that
            // doesn't say what it paid for at all. Both are exported with the payment, so they have to
            // be counted with it too
            if (!this.matchesPath(null, account, settlement)) {
                continue;
            }

            if (!isShown && (payment.roundingAmount !== 0 || payment.balanceItemPayments.length === 0)) {
                this.addPayment(payment);
            }

            if (payment.roundingAmount !== 0) {
                this.addRounding(payment, account, settlement);
            }
        }
    }

    build(baseFilter: StamhoofdFilter = null): PaymentBreakdown {
        return PaymentBreakdown.create({
            price: this.price,
            paymentCount: this.paymentCount,
            transferFee: this.transferFee,
            serviceFeeManual: this.serviceFeeManual,
            serviceFeePayout: this.serviceFeePayout,
            // The amounts above belong to whole payments, which paid for more than what is shown
            isPartial: this.paymentPrice !== this.price,
            graph: this.timeline.build(),
            byAccount: this.finishRows(this.byAccount, baseFilter, false),
            byCategory: this.finishRows(this.byCategory, baseFilter, true),
            byArticle: this.finishRows(this.byArticle, baseFilter, true),
            bySettlement: onlyIfSplit(this.finishRows(this.bySettlement, baseFilter, false)),
            exportFilter: this.getExportFilter(baseFilter),
        });
    }

    /**
     * A row is shown next to the payments it holds, so it selects them the same way the export does:
     * everything that is already narrowed down, plus the row itself.
     */
    private finishRows(rows: BreakdownRows, baseFilter: StamhoofdFilter, isBalanceItemFilter: boolean): BreakdownGroup[] {
        return rows.build().map((group) => {
            group.filter = group.filter === null
                ? null
                : this.getExportFilter(baseFilter, { filter: group.filter, isBalanceItemFilter });

            return group;
        });
    }

    /**
     * The amounts that belong to a payment as a whole, counted once for every payment that has at
     * least one thing left after narrowing down.
     */
    private addPayment(payment: PaymentGeneral) {
        this.paymentCount += 1;
        this.paymentPrice += payment.price;
        this.transferFee += payment.transferFee;
        this.serviceFeeManual += payment.serviceFeeManual;
        this.serviceFeePayout += payment.serviceFeePayout;

    }

    /**
     * What a payment rounded away, as an article of its own.
     *
     * A payment goes to the cent, while what was charged goes to four digits after the comma, so a
     * payment carries the difference (see Payment.roundingAmount). It belongs to the payment as a whole
     * instead of to one of the things it paid for, which is why it gets a row of its own: without it the
     * rows would not add up to the payment.
     */
    private addRounding(payment: PaymentGeneral, account: PaymentAccount, settlement: PaymentSettlementGroup) {
        const price = payment.roundingAmount;

        this.price += price;
        this.timeline.add(payment.paidAt ?? payment.createdAt, price);

        // It arrived on the same account and in the same payout as the rest of the payment
        this.byAccount
            .row(account.id, () => createNamedGroup(account))
            .addPrice(price)
            .countPayment(payment.id);

        this.bySettlement
            .row(settlement.id, () => createNamedGroup(settlement))
            .addPrice(price)
            .countPayment(payment.id);

        this.byCategory
            .row(ROUNDING_ID, createRoundingGroup)
            .addPrice(price)
            .countPayment(payment.id);

        this.byArticle
            .row(ROUNDING_ID, createRoundingGroup)
            .addPrice(price)
            .countPayment(payment.id);
    }

    private addItem(item: PaymentBreakdownItem, account: PaymentAccount, settlement: PaymentSettlementGroup, orders: Map<string, OrderData>) {
        this.price += item.price;

        // When the money was received, which is not when the payment was created for a transfer
        this.timeline.add(item.payment.paidAt ?? item.payment.createdAt, item.price);

        this.byAccount
            .row(account.id, () => createNamedGroup(account))
            .addPrice(item.price)
            .countPayment(item.payment.id);

        this.bySettlement
            .row(settlement.id, () => createNamedGroup(settlement))
            .addPrice(item.price)
            .countPayment(item.payment.id);

        this.byCategory
            .row(item.balanceItem.categoryId, () => createCategoryGroup(item.balanceItem))
            .addPrice(item.price)
            .countPayment(item.payment.id)
            .countBalanceItem(item.balanceItem);

        const orderArticles = getOrderArticles(item.balanceItem, item.price, orders);

        if (orderArticles) {
            for (const article of orderArticles) {
                this.byArticle
                    .row(article.id, () => createOrderArticleGroup(article))
                    .addPrice(article.price)
                    .countPayment(item.payment.id)
                    .countBalanceItem(item.balanceItem, article.quantity);
            }
            return;
        }

        const code = item.balanceItem.articleCode;
        this.byArticle
            .row(code, () => BreakdownGroup.create({ id: code, filter: item.balanceItem.articleFilter }))
            .addPrice(item.price)
            .countPayment(item.payment.id)
            .countBalanceItem(item.balanceItem)
            .describeArticle(item.balanceItem);
    }

    /**
     * Whether this part of a payment is still shown after all the groups that were opened.
     *
     * @param item Null for the part of a payment that is not for one thing in particular (see
     * addRounding): that part only survives narrowing down to where the money arrived.
     */
    private matchesPath(item: PaymentBreakdownItem | null, account: PaymentAccount, settlement: PaymentSettlementGroup): boolean {
        for (const [index, step] of this.path.entries()) {
            switch (step.tab) {
                case BreakdownTab.Account: {
                    if (account.id !== step.id) {
                        return false;
                    }

                    this.pathFilters[index] ??= { filter: account.filter, isBalanceItemFilter: false };
                    break;
                }
                case BreakdownTab.Settlement: {
                    if (settlement.id !== step.id) {
                        return false;
                    }

                    this.pathFilters[index] ??= { filter: settlement.filter, isBalanceItemFilter: false };
                    break;
                }
                case BreakdownTab.Category: {
                    if (item?.balanceItem.categoryId !== step.id) {
                        return false;
                    }

                    this.pathFilters[index] ??= { filter: item.balanceItem.categoryFilter, isBalanceItemFilter: true };
                    break;
                }
                case BreakdownTab.Article: {
                    if (item?.balanceItem.articleCode !== step.id) {
                        return false;
                    }

                    this.pathFilters[index] ??= { filter: item.balanceItem.articleFilter, isBalanceItemFilter: true };
                    break;
                }
            }
        }

        return true;
    }

    /**
     * Payments don't carry the metadata of a balance item themselves, so a category is selected through
     * the balance items they paid for.
     */
    private getExportFilter(baseFilter: StamhoofdFilter, ...extra: { filter: StamhoofdFilter; isBalanceItemFilter: boolean }[]): StamhoofdFilter {
        const filters: StamhoofdFilter[] = baseFilter ? [baseFilter] : [];
        const balanceItemFilters: StamhoofdFilter[] = [];

        for (const pathFilter of [...this.pathFilters, ...extra]) {
            if (!pathFilter) {
                // A group that was opened held nothing, so leaving it out would select everything that
                // was not narrowed down yet
                return NOTHING;
            }

            if (pathFilter.isBalanceItemFilter) {
                balanceItemFilters.push(pathFilter.filter);
                continue;
            }

            filters.push(pathFilter.filter);
        }

        if (balanceItemFilters.length > 0) {
            // One balance item has to match all of them at once: a payment that paid for one thing in
            // this category and for another thing that is this article paid for neither
            filters.push({
                balanceItemPayments: {
                    $elemMatch: { balanceItem: combineFilters(balanceItemFilters) },
                },
            });
        }

        return combineFilters(filters);
    }
}

/**
 * Adds up what a selection of balance items comes down to, one page at a time.
 */
export class BalanceItemBreakdownBuilder {
    private readonly path: BreakdownPathItem[];

    /**
     * The filter of each opened group, remembered the first time an object matches it. Null as long as
     * nothing matched a step, which is not the same as a step that matched but has nothing to select.
     */
    private readonly pathFilters: ({ filter: StamhoofdFilter } | null)[];

    private readonly byCategory = new BreakdownRows('balanceItems');
    private readonly byArticle = new BreakdownRows('balanceItems');
    private readonly bySettlement = new BreakdownRows('balanceItems');
    private readonly timeline = new BreakdownTimeline();

    private price = 0;
    private pricePaid = 0;
    private pricePending = 0;
    private priceOpen = 0;
    private balanceItemCount = 0;

    constructor(path: BreakdownPathItem[] = []) {
        this.path = path;
        this.pathFilters = path.map(() => null);
    }

    add(items: BalanceItem[], context: BreakdownPageContext = {}) {
        const orders = context.orders ?? new Map<string, OrderData>();
        const balanceItemPayments = context.balanceItemPayments ?? new Map<string, BalanceItemPaymentWithPrivatePayment[]>();

        for (const item of items) {
            const payments = balanceItemPayments.get(item.id) ?? [];

            // Not narrowed down to the row that was opened: the price below is what these items cost in
            // total, so the tab has to keep showing every part of them for it to add up
            const parts = getBalanceItemParts(item, payments);

            if (!this.matchesPath(item, parts)) {
                continue;
            }

            this.price += item.payablePriceWithVAT;
            this.pricePaid += item.pricePaid;
            this.pricePending += item.pricePending;
            this.priceOpen += item.priceOpen;
            this.balanceItemCount += 1;
            this.timeline.add(item.createdAt, item.payablePriceWithVAT);

            this.byCategory
                .row(item.categoryId, () => createCategoryGroup(item))
                .addPrice(item.payablePriceWithVAT)
                .countBalanceItem(item);

            this.addParts(item, parts);
            this.addArticle(item, orders);
        }
    }

    build(baseFilter: StamhoofdFilter = null): BalanceItemBreakdown {
        return BalanceItemBreakdown.create({
            price: this.price,
            pricePaid: this.pricePaid,
            pricePending: this.pricePending,
            priceOpen: this.priceOpen,
            balanceItemCount: this.balanceItemCount,
            graph: this.timeline.build(),
            byCategory: this.finishRows(this.byCategory, baseFilter),
            byArticle: this.finishRows(this.byArticle, baseFilter),
            bySettlement: onlyIfSplit(this.finishRows(this.bySettlement, baseFilter)),
            exportFilter: this.getExportFilter(baseFilter),
        });
    }

    /**
     * What a balance item costs can be spread over several payouts and over what is not paid out yet, so
     * it lands in a row for every part of it.
     *
     * These rows hold money, not pieces: counting them would count the same item in every part it was
     * spread over, so they only count the items themselves.
     */
    private addParts(item: BalanceItem, parts: BalanceItemPart[]) {
        for (const part of parts) {
            this.bySettlement
                .row(part.id, part.createGroup)
                .addPrice(part.price)
                .countBalanceItem(item, 0);
        }
    }

    /**
     * A row is shown next to the balance items it holds, so it selects them the same way the export
     * does: everything that is already narrowed down, plus the row itself.
     */
    private finishRows(rows: BreakdownRows, baseFilter: StamhoofdFilter): BreakdownGroup[] {
        return rows.build().map((group) => {
            if (group.filter === null) {
                return group;
            }

            group.filter = this.getExportFilter(baseFilter, group.filter);
            return group;
        });
    }

    private getExportFilter(baseFilter: StamhoofdFilter, ...extra: StamhoofdFilter[]): StamhoofdFilter {
        const filters: StamhoofdFilter[] = baseFilter ? [baseFilter] : [];

        for (const pathFilter of this.pathFilters) {
            if (!pathFilter) {
                // A group that was opened held nothing, so leaving it out would select everything that
                // was not narrowed down yet
                return NOTHING;
            }

            if (pathFilter.filter) {
                filters.push(pathFilter.filter);
            }
        }

        return combineFilters([...filters, ...extra]);
    }

    private addArticle(item: BalanceItem, orders: Map<string, OrderData>) {
        const orderArticles = getOrderArticles(item, item.payablePriceWithVAT, orders);

        if (orderArticles) {
            for (const article of orderArticles) {
                this.byArticle
                    .row(article.id, () => createOrderArticleGroup(article))
                    .addPrice(article.price)
                    .countBalanceItem(item, article.quantity);
            }
            return;
        }

        const code = item.articleCode;
        this.byArticle
            .row(code, () => BreakdownGroup.create({ id: code, filter: item.articleFilter }))
            .addPrice(item.payablePriceWithVAT)
            .countBalanceItem(item)
            .describeArticle(item);
    }

    /**
     * @param parts What this balance item costs, split over where each part ended up, already narrowed
     * down to the row that was opened.
     */
    private matchesPath(item: BalanceItem, parts: BalanceItemPart[]): boolean {
        for (const [index, step] of this.path.entries()) {
            switch (step.tab) {
                case BreakdownTab.Category: {
                    if (item.categoryId !== step.id) {
                        return false;
                    }

                    this.pathFilters[index] ??= { filter: item.categoryFilter };
                    break;
                }
                case BreakdownTab.Article: {
                    if (item.articleCode !== step.id) {
                        return false;
                    }

                    this.pathFilters[index] ??= { filter: item.articleFilter };
                    break;
                }
                case BreakdownTab.Settlement: {
                    const part = parts.find(part => part.id === step.id);

                    if (!part) {
                        return false;
                    }

                    this.pathFilters[index] ??= { filter: part.createGroup().filter };
                    break;
                }
                case BreakdownTab.Account: {
                    // A balance item isn't paid via one account: it can be paid by several payments
                    this.pathFilters[index] ??= { filter: null };
                    break;
                }
            }
        }

        return true;
    }
}

/**
 * A balance item doesn't carry how it was paid, so anything about its payments is selected through them.
 */
function toBalanceItemFilter(paymentFilter: StamhoofdFilter): StamhoofdFilter {
    return {
        payments: {
            $elemMatch: {
                payment: paymentFilter,
            },
        },
    };
}

function combineFilters(filters: StamhoofdFilter[]): StamhoofdFilter {
    if (filters.length === 0) {
        return null;
    }

    if (filters.length === 1) {
        return filters[0];
    }

    return { $and: filters };
}
