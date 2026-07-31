/**
 * How a selection of balance items is added up into the rows of a breakdown.
 *
 * The items are handed over page by page while they are read and thrown away again, so what a breakdown
 * holds grows with the number of rows it is building, not with the number of items it reads.
 */
import type { BalanceItem, BalanceItemPaymentWithPrivatePayment } from '../BalanceItem.js';
import type { StamhoofdFilter } from '../filters/StamhoofdFilter.js';
import { mergeFilters } from '../filters/StamhoofdFilter.js';
import type { BreakdownPathItem } from '../PaymentBreakdown.js';
import { BalanceItemBreakdown, BreakdownAmountType, BreakdownGroup, BreakdownObjectType, BreakdownSelection, BreakdownTab } from '../PaymentBreakdown.js';
import type { OrderData } from '../webshops/Order.js';
import type { BalanceItemPart } from './balanceItemParts.js';
import { getBalanceItemParts } from './balanceItemParts.js';
import { toBalanceItemPaymentFilter } from './breakdownFilters.js';
import type { BreakdownPageContext } from './BreakdownPageContext.js';
import { canOpenPartialRow, createBalanceItemSelection, createCategoryGroup, getWholeAmount, NOTHING, onlyIfSplit } from './breakdownGroups.js';
import { BreakdownRows } from './BreakdownRows.js';
import { BreakdownTimeline } from './BreakdownTimeline.js';
import { createOrderArticleGroup, getOrderArticles } from './orderArticles.js';

/**
 * What of a balance item is left after the groups that were opened, and which money of it that is.
 */
type BalanceItemSlice = {
    price: number;
    amountType: BreakdownAmountType;

    /**
     * The parts the payout tab still shows, which add up to the price above.
     */
    parts: BalanceItemPart[];
};

/**
 * Adds up what a selection of balance items comes down to, one page at a time.
 */
export class BalanceItemBreakdownBuilder {
    private readonly path: BreakdownPathItem[];

    /**
     * The filter of each opened group, remembered the first time an object matches it. Null as long as
     * nothing matched a step, which is not the same as a step that matched but has nothing to select.
     */
    private readonly pathFilters: ({ filter: StamhoofdFilter; isSettlement?: boolean } | null)[];

    private readonly byCategory = new BreakdownRows('balanceItems');
    private readonly byArticle = new BreakdownRows('balanceItems');
    private readonly bySettlement = new BreakdownRows('balanceItems');
    private readonly timeline = new BreakdownTimeline();

    /**
     * Which money the amounts below are, remembered the first time an item matches the path. Null as
     * long as nothing matched, and while the whole item is shown.
     */
    private sliceAmountType: BreakdownAmountType | null = null;

    /**
     * Selects the balance item payments the amounts below are about, when only a part of what these
     * items cost is shown. Null while the whole item is shown.
     */
    private slicePaymentFilter: StamhoofdFilter | null = null;

    private price = 0;
    private pricePaid = 0;
    private pricePending = 0;
    private priceOpen = 0;
    private balanceItemCount = 0;

    /**
     * What the items below were charged in full, which is more than the price when only a part of them
     * is shown.
     */
    private wholeItemPrice = 0;

    constructor(path: BreakdownPathItem[] = []) {
        this.path = path;
        this.pathFilters = path.map(() => null);
    }

    add(items: BalanceItem[], context: BreakdownPageContext = {}) {
        const orders = context.orders ?? new Map<string, OrderData>();
        const balanceItemPayments = context.balanceItemPayments ?? new Map<string, BalanceItemPaymentWithPrivatePayment[]>();

        for (const item of items) {
            const payments = balanceItemPayments.get(item.id) ?? [];
            const parts = getBalanceItemParts(item, payments);
            const slice = this.takeSlice(item, parts);

            if (!slice) {
                continue;
            }

            this.price += slice.price;
            this.wholeItemPrice += item.payablePriceWithVAT;
            this.addSliceTotals(item, slice);
            this.balanceItemCount += 1;
            this.timeline.add(item.createdAt, slice.price);

            this.byCategory
                .row(item.categoryId, () => createCategoryGroup(item, slice.amountType))
                .addPrice(slice.price)
                .countBalanceItem(item)
                .countWhole(item.id, getWholeAmount(item, slice.amountType));

            this.addParts(item, slice.parts);
            this.addArticle(item, orders, slice);
        }
    }

    /**
     * Where the money of this slice stands, which is the whole story only when the whole item is shown:
     * a part of it is entirely paid, entirely on its way or entirely unpaid.
     */
    private addSliceTotals(item: BalanceItem, slice: BalanceItemSlice) {
        switch (slice.amountType) {
            case BreakdownAmountType.Paid:
                this.pricePaid += slice.price;
                break;
            case BreakdownAmountType.Pending:
                this.pricePending += slice.price;
                break;
            case BreakdownAmountType.Open:
                this.priceOpen += slice.price;
                break;
            default:
                this.pricePaid += item.pricePaid;
                this.pricePending += item.pricePending;
                this.priceOpen += item.priceOpen;
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
            selection: this.getPageSelection(baseFilter),
        });
    }

    /**
     * Where the money of this whole breakdown lives: the balance items that are shown, or the parts of
     * them that landed in the payout that was opened.
     */
    private getPageSelection(baseFilter: StamhoofdFilter): BreakdownSelection {
        const listFilter = this.getExportFilter(baseFilter);

        return BreakdownSelection.create({
            objectType: this.slicePaymentFilter ? BreakdownObjectType.BalanceItemPayments : BreakdownObjectType.BalanceItems,
            listObjectType: BreakdownObjectType.BalanceItems,
            // Only a part of what these items cost once a row of the payout tab was opened
            amountType: this.sliceAmountType ?? BreakdownAmountType.Total,
            filter: this.slicePaymentFilter
                ? toBalanceItemPaymentFilter(this.getSliceBalanceItemFilter(baseFilter), this.slicePaymentFilter)
                : listFilter,
            listFilter,
            isListPartial: this.wholeItemPrice !== this.price,
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
                .countBalanceItem(item, 0)
                .countWhole(item.id, getWholeAmount(item, part.amountType));
        }
    }

    /**
     * A row is shown next to the balance items it holds, so it selects them the same way the export
     * does: everything that is already narrowed down, plus the row itself.
     */
    private finishRows(rows: BreakdownRows, baseFilter: StamhoofdFilter): BreakdownGroup[] {
        return rows.build().map((group) => {
            const selection = group.selection;

            if (!selection || selection.filter === null) {
                return group;
            }

            if (selection.objectType === BreakdownObjectType.BalanceItemPayments) {
                // What landed in this payout, out of the balance items that are shown
                selection.listFilter = this.getExportFilter(baseFilter, selection.listFilter);
                selection.filter = toBalanceItemPaymentFilter(this.getSliceBalanceItemFilter(baseFilter), selection.filter);
                return canOpenPartialRow(group);
            }

            selection.filter = this.getExportFilter(baseFilter, selection.filter);
            selection.listFilter = selection.filter;
            return canOpenPartialRow(group);
        });
    }

    private getExportFilter(baseFilter: StamhoofdFilter, ...extra: StamhoofdFilter[]): StamhoofdFilter {
        return this.buildFilter(baseFilter, false, extra);
    }

    /**
     * The same, without the payout that was opened: that one says which payments the money came in
     * with, which is what the payment half of a balance item payment filter already says.
     */
    private getSliceBalanceItemFilter(baseFilter: StamhoofdFilter, ...extra: StamhoofdFilter[]): StamhoofdFilter {
        return this.buildFilter(baseFilter, true, extra);
    }

    private buildFilter(baseFilter: StamhoofdFilter, skipSettlement: boolean, extra: StamhoofdFilter[]): StamhoofdFilter {
        const filters: StamhoofdFilter[] = baseFilter ? [baseFilter] : [];

        for (const pathFilter of this.pathFilters) {
            if (!pathFilter) {
                // A group that was opened held nothing, so leaving it out would select everything that
                // was not narrowed down yet
                return NOTHING;
            }

            if (pathFilter.filter && !(skipSettlement && pathFilter.isSettlement)) {
                filters.push(pathFilter.filter);
            }
        }

        return mergeFilters([...filters, ...extra]);
    }

    private addArticle(item: BalanceItem, orders: Map<string, OrderData>, slice: BalanceItemSlice) {
        // Only what a whole order costs can be split into the articles that were ordered, so a slice of
        // one lands in a row of its own (see getUnmatchedOrderArticle)
        const orderArticles = getOrderArticles(item, slice.price, orders, false);

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
            .row(code, () => BreakdownGroup.create({
                id: code,
                selection: createBalanceItemSelection(item.articleFilter, slice.amountType),
            }))
            .addPrice(slice.price)
            .countBalanceItem(item)
            .countWhole(item.id, getWholeAmount(item, slice.amountType))
            .describeArticle(item);
    }

    /**
     * What is left of a balance item after the groups that were opened, or null when it is not shown at
     * all.
     *
     * Remembers the filter and the amount of every step it passes: the first item that matches a step
     * knows what that group was, so it doesn't have to be looked up again to export it.
     *
     * Without a step on the payout tab that is the whole item. With one it is only the part that ended
     * up there, because that is the amount the row that was opened showed.
     *
     * @param parts What this balance item costs, split over where each part ended up.
     */
    private takeSlice(item: BalanceItem, parts: BalanceItemPart[]): BalanceItemSlice | null {
        let slice: BalanceItemSlice = {
            price: item.payablePriceWithVAT,
            amountType: BreakdownAmountType.Total,
            parts,
        };

        for (const [index, step] of this.path.entries()) {
            switch (step.tab) {
                case BreakdownTab.Category: {
                    if (item.categoryId !== step.id) {
                        return null;
                    }

                    this.pathFilters[index] ??= { filter: item.categoryFilter };
                    break;
                }
                case BreakdownTab.Article: {
                    if (item.articleCode !== step.id) {
                        return null;
                    }

                    this.pathFilters[index] ??= { filter: item.articleFilter };
                    break;
                }
                case BreakdownTab.Settlement: {
                    const part = parts.find(part => part.id === step.id);

                    if (!part) {
                        return null;
                    }

                    const selection = part.createGroup().selection;

                    // The path narrows down balance items, so it uses the filter that selects those
                    this.pathFilters[index] ??= { filter: selection?.listFilter ?? selection?.filter ?? null, isSettlement: true };
                    this.sliceAmountType ??= part.amountType;

                    if (selection?.objectType === BreakdownObjectType.BalanceItemPayments) {
                        // Only a part of these items landed here, so the amounts below are about the
                        // balance item payments that did
                        this.slicePaymentFilter ??= selection.filter;
                    }

                    slice = { price: part.price, amountType: part.amountType, parts: [part] };
                    break;
                }
                case BreakdownTab.Account: {
                    // A balance item isn't paid via one account: it can be paid by several payments
                    return null;
                }
            }
        }

        return slice;
    }
}
