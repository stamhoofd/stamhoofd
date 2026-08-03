/**
 * How a selection of payments is added up into the rows of a breakdown.
 *
 * The payments are handed over page by page while they are read and thrown away again, so what a
 * breakdown holds grows with the number of rows it is building, not with the number of payments it
 * reads - the same way an Excel export writes its rows while it reads them.
 */
import type { StamhoofdFilter } from '../filters/StamhoofdFilter.js';
import { mergeFilters } from '../filters/StamhoofdFilter.js';
import type { PaymentGeneral } from '../members/PaymentGeneral.js';
import type { PaymentAccount } from '../PaymentAccount.js';
import { getPaymentAccount } from '../PaymentAccount.js';
import type { BreakdownPathItem } from '../PaymentBreakdown.js';
import { BreakdownGroup, BreakdownObjectType, BreakdownSelection, BreakdownTab, PaymentBreakdown } from '../PaymentBreakdown.js';
import type { PaymentSettlementGroup } from '../PaymentSettlement.js';
import { getPaymentSettlement } from '../PaymentSettlement.js';
import { PaymentStatus } from '../PaymentStatus.js';
import type { OrderData } from '../webshops/Order.js';
import type { BreakdownPageContext } from './BreakdownPageContext.js';
import { canOpenPartialRow, createBalanceItemSelection, createCategoryGroup, createNamedGroup, createRoundingGroup, createUnallocatedGroup, NOTHING, onlyIfSplit, ROUNDING_ID, UNALLOCATED_ID } from './breakdownGroups.js';
import { BreakdownRows, PaymentBreakdownItem } from './BreakdownRows.js';
import { BreakdownTimeline } from './BreakdownTimeline.js';
import { createOrderArticleGroup, getOrderArticles } from './orderArticles.js';

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
    private pricePending = 0;
    private priceFailed = 0;

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

                if (!this.consumePath(item, account, settlement)) {
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
            if (!this.consumePath(null, account, settlement)) {
                continue;
            }

            if (!isShown && (payment.roundingAmount !== 0 || payment.balanceItemPayments.length === 0)) {
                this.addPayment(payment);
            }

            if (payment.roundingAmount !== 0) {
                this.addRounding(payment, account, settlement);
            }

            const unallocated = this.getUnallocatedPrice(payment);

            if (unallocated !== 0) {
                this.addUnallocated(payment, unallocated, account, settlement);
            }
        }
    }

    build(baseFilter: StamhoofdFilter = null): PaymentBreakdown {
        return PaymentBreakdown.create({
            price: this.price,
            paymentCount: this.paymentCount,
            pricePending: this.pricePending,
            priceFailed: this.priceFailed,
            transferFee: this.transferFee,
            serviceFeeManual: this.serviceFeeManual,
            serviceFeePayout: this.serviceFeePayout,
            graph: this.timeline.build(),
            byAccount: this.finishRows(this.byAccount, baseFilter),
            byCategory: this.finishRows(this.byCategory, baseFilter),
            byArticle: this.finishRows(this.byArticle, baseFilter),
            bySettlement: onlyIfSplit(this.finishRows(this.bySettlement, baseFilter)),
            selection: this.getPageSelection(baseFilter),
        });
    }

    /**
     * Where the money of this whole breakdown lives: the payments that are shown, or the parts of them
     * that were added up when they also paid for something else.
     */
    private getPageSelection(baseFilter: StamhoofdFilter): BreakdownSelection {
        const isListPartial = this.paymentPrice !== this.price;

        return BreakdownSelection.create({
            objectType: isListPartial ? BreakdownObjectType.BalanceItemPayments : BreakdownObjectType.Payments,
            listObjectType: BreakdownObjectType.Payments,
            filter: isListPartial ? this.getSliceFilter(baseFilter) : this.getExportFilter(baseFilter),
            listFilter: this.getExportFilter(baseFilter),
            isListPartial,
        });
    }

    /**
     * A row is shown next to the payments it holds, so it selects them the same way the export does:
     * everything that is already narrowed down, plus the row itself.
     */
    private finishRows(rows: BreakdownRows, baseFilter: StamhoofdFilter): BreakdownGroup[] {
        return rows.build().map((group) => {
            if (!group.selection) {
                return group;
            }

            if (group.selection.filter !== null) {
                // A row says what its own filter is about: what a payment paid for is selected through
                // the balance items, what the payment itself is directly
                const extra = {
                    filter: group.selection.filter,
                    isBalanceItemFilter: group.selection.objectType === BreakdownObjectType.BalanceItems,
                };

                // A payment is listed as a whole, because that is what a payment is
                group.selection.listFilter = this.getExportFilter(baseFilter, extra);
                group.selection.listObjectType = BreakdownObjectType.Payments;

                // But a payment that also paid for something else is only partly this row, and that
                // part is one balance item payment
                group.selection.objectType = group.selection.isListPartial
                    ? BreakdownObjectType.BalanceItemPayments
                    : BreakdownObjectType.Payments;

                group.selection.filter = group.selection.isListPartial
                    ? this.getSliceFilter(baseFilter, extra)
                    : group.selection.listFilter;
            }

            return canOpenPartialRow(group);
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
        this.addStatusPrice(payment, price);
        this.timeline.add(payment.paidAt ?? payment.createdAt, price);

        // It arrived on the same account and in the same payout as the rest of the payment
        this.byAccount
            .row(account.id, () => createNamedGroup(account))
            .addPrice(price)
            .countPayment(payment.id, payment.price);

        this.bySettlement
            .row(settlement.id, () => createNamedGroup(settlement))
            .addPrice(price)
            .countPayment(payment.id, payment.price);

        // These rows hold what was rounded away, not what the payment is worth, so that is also what
        // the payments they select are worth to them
        this.byCategory
            .row(ROUNDING_ID, createRoundingGroup)
            .addPrice(price)
            .countPayment(payment.id, price);

        this.byArticle
            .row(ROUNDING_ID, createRoundingGroup)
            .addPrice(price)
            .countPayment(payment.id, price);
    }

    /**
     * What a payment is worth beyond the things it says it paid for, e.g. an imported payment that
     * carries no balance items at all. Without it that money would be exported with the payment while
     * none of the rows hold it.
     */
    private getUnallocatedPrice(payment: PaymentGeneral): number {
        return payment.balanceItemPayments.reduce(
            (rest, balanceItemPayment) => rest - balanceItemPayment.price,
            payment.price - payment.roundingAmount,
        );
    }

    /**
     * What a payment is worth on top of the things it paid for, as an article of its own.
     *
     * Like the rounding above it belongs to the payment as a whole, so it is added next to it: in the
     * same account and payout, but in a row that says it is not known what it was for.
     */
    private addUnallocated(payment: PaymentGeneral, price: number, account: PaymentAccount, settlement: PaymentSettlementGroup) {
        this.price += price;
        this.addStatusPrice(payment, price);
        this.timeline.add(payment.paidAt ?? payment.createdAt, price);

        this.byAccount
            .row(account.id, () => createNamedGroup(account))
            .addPrice(price)
            .countPayment(payment.id, payment.price);

        this.bySettlement
            .row(settlement.id, () => createNamedGroup(settlement))
            .addPrice(price)
            .countPayment(payment.id, payment.price);

        // These rows hold what the payment didn't say anything about, not what it is worth as a whole
        this.byCategory
            .row(UNALLOCATED_ID, createUnallocatedGroup)
            .addPrice(price)
            .countPayment(payment.id, price);

        this.byArticle
            .row(UNALLOCATED_ID, createUnallocatedGroup)
            .addPrice(price)
            .countPayment(payment.id, price);
    }

    /**
     * What of the price above never arrived, so a selection that holds unfinished payments can say so.
     */
    private addStatusPrice(payment: PaymentGeneral, price: number) {
        if (payment.status === PaymentStatus.Failed) {
            this.priceFailed += price;
            return;
        }

        if (payment.status !== PaymentStatus.Succeeded) {
            this.pricePending += price;
        }
    }

    private addItem(item: PaymentBreakdownItem, account: PaymentAccount, settlement: PaymentSettlementGroup, orders: Map<string, OrderData>) {
        this.price += item.price;
        this.addStatusPrice(item.payment, item.price);

        // When the money was received, which is not when the payment was created for a transfer
        this.timeline.add(item.payment.paidAt ?? item.payment.createdAt, item.price);

        this.byAccount
            .row(account.id, () => createNamedGroup(account))
            .addPrice(item.price)
            .countPayment(item.payment.id, item.payment.price);

        this.bySettlement
            .row(settlement.id, () => createNamedGroup(settlement))
            .addPrice(item.price)
            .countPayment(item.payment.id, item.payment.price);

        this.byCategory
            .row(item.balanceItem.categoryId, () => createCategoryGroup(item.balanceItem))
            .addPrice(item.price)
            .countPayment(item.payment.id, item.payment.price)
            .countBalanceItem(item.balanceItem);

        const orderArticles = getOrderArticles(item.balanceItem, item.price, orders, true);

        if (orderArticles) {
            for (const article of orderArticles) {
                this.byArticle
                    .row(article.id, () => createOrderArticleGroup(article))
                    .addPrice(article.price)
                    .countPayment(item.payment.id, item.payment.price)
                    .countBalanceItem(item.balanceItem, article.quantity);
            }
            return;
        }

        const code = item.balanceItem.articleCode;
        this.byArticle
            .row(code, () => BreakdownGroup.create({
                id: code,
                selection: createBalanceItemSelection(item.balanceItem.articleFilter),
            }))
            .addPrice(item.price)
            .countPayment(item.payment.id, item.payment.price)
            .countBalanceItem(item.balanceItem)
            .describeArticle(item.balanceItem);
    }

    /**
     * Whether this part of a payment is still shown after all the groups that were opened.
     *
     * Remembers the filter of every step it passes: the first object that matches a step knows what
     * that group was, so it doesn't have to be looked up again to export it.
     *
     * @param item Null for the part of a payment that is not for one thing in particular (see
     * addRounding): that part only survives narrowing down to where the money arrived.
     */
    private consumePath(item: PaymentBreakdownItem | null, account: PaymentAccount, settlement: PaymentSettlementGroup): boolean {
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
     * Everything that was narrowed down, split over what it says about a payment and what it says about
     * the balance items it paid for.
     *
     * Null when a group that was opened held nothing: leaving it out would select everything that was
     * not narrowed down yet.
     */
    private getFilterParts(baseFilter: StamhoofdFilter, ...extra: { filter: StamhoofdFilter; isBalanceItemFilter: boolean }[]): { payment: StamhoofdFilter[]; balanceItem: StamhoofdFilter[] } | null {
        const payment: StamhoofdFilter[] = baseFilter ? [baseFilter] : [];
        const balanceItem: StamhoofdFilter[] = [];

        for (const pathFilter of [...this.pathFilters, ...extra]) {
            if (!pathFilter) {
                return null;
            }

            if (pathFilter.isBalanceItemFilter) {
                balanceItem.push(pathFilter.filter);
                continue;
            }

            payment.push(pathFilter.filter);
        }

        return { payment, balanceItem };
    }

    /**
     * Payments don't carry the metadata of a balance item themselves, so a category is selected through
     * the balance items they paid for.
     */
    private getExportFilter(baseFilter: StamhoofdFilter, ...extra: { filter: StamhoofdFilter; isBalanceItemFilter: boolean }[]): StamhoofdFilter {
        const parts = this.getFilterParts(baseFilter, ...extra);

        if (!parts) {
            return NOTHING;
        }

        const filters = [...parts.payment];

        if (parts.balanceItem.length > 0) {
            // One balance item has to match all of them at once: a payment that paid for one thing in
            // this category and for another thing that is this article paid for neither
            filters.push({
                balanceItemPayments: {
                    $elemMatch: { balanceItem: mergeFilters(parts.balanceItem) },
                },
            });
        }

        return mergeFilters(filters);
    }

    /**
     * Selects the parts of the payments that were added up, instead of the payments around them.
     *
     * A payment that also paid for something else is only partly this row, and that part is one balance
     * item payment: the level where it can be selected on its own.
     */
    private getSliceFilter(baseFilter: StamhoofdFilter, ...extra: { filter: StamhoofdFilter; isBalanceItemFilter: boolean }[]): StamhoofdFilter {
        const parts = this.getFilterParts(baseFilter, ...extra);

        if (!parts) {
            return NOTHING;
        }

        const filters: StamhoofdFilter[] = [];

        if (parts.payment.length > 0) {
            filters.push({ payment: mergeFilters(parts.payment) });
        }

        if (parts.balanceItem.length > 0) {
            filters.push({ balanceItem: mergeFilters(parts.balanceItem) });
        }

        return mergeFilters(filters);
    }
}
