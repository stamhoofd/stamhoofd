import type { Data, Decoder, EncodeContext, PlainObject } from '@simonbackx/simple-encoding';
import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, IntegerDecoder, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Formatter } from '@stamhoofd/utility';
import { BalanceItemRelation, BalanceItemRelationType } from './BalanceItem.js';
import { CountFilteredRequest, StamhoofdFilterDecoder } from './filters/FilteredRequest.js';
import type { StamhoofdFilter } from './filters/StamhoofdFilter.js';
import { TranslatedString } from './TranslatedString.js';

/**
 * The ways a breakdown splits up its amounts. Each one is a tab in the interface.
 */
export enum BreakdownTab {
    /**
     * Where the money arrived: per bank account, Stripe account, provider or method.
     */
    Account = 'Account',

    /**
     * What it was for: per webshop, group, membership type, ... (see BalanceItem.category)
     */
    Category = 'Category',

    /**
     * Which article was paid or charged: the same unit a member sees on their own balance, but across
     * members (see BalanceItem.articleCode).
     */
    Article = 'Article',

    /**
     * Which payout the money was part of: per settlement of a payment provider (see
     * PaymentSettlementGroup).
     */
    Settlement = 'Settlement',
}

/**
 * One row of a breakdown: everything that was grouped together, and what it adds up to.
 *
 * Carries enough to be shown like a balance item on a member's balance: an icon, a title, a
 * description and the relations that are relevant for this group.
 */
export class BreakdownGroup extends AutoEncoder {
    /**
     * Identifies this group inside its tab. Send it back in the path of a request to narrow down to it.
     */
    @field({ decoder: StringDecoder })
    id = '';

    @field(TranslatedString.field({}))
    name = new TranslatedString();

    @field({ decoder: StringDecoder })
    description = '';

    /**
     * The icon to show, e.g. 'basket' for a webshop or 'bank' for a transfer.
     */
    @field({ decoder: StringDecoder })
    icon = 'box';

    /**
     * The icon to show, e.g. 'basket' for a webshop or 'bank' for a transfer.
     */
    @field({ decoder: StringDecoder, nullable: true })
    asideIcon: string | null;

    /**
     * The relations that are shared by everything in this group, e.g. the webshop of an article. Use
     * these to show extra context, like the price or option a registration was for.
     */
    @field({ decoder: new MapDecoder(new EnumDecoder(BalanceItemRelationType), BalanceItemRelation) })
    relations: Map<BalanceItemRelationType, BalanceItemRelation> = new Map();

    /**
     * Received money, or the price that was charged when breaking down balance items.
     */
    @field({ decoder: IntegerDecoder })
    price = 0;

    /**
     * The number of pieces, e.g. 12 registrations or 3 t-shirts. Zero when counting pieces is
     * meaningless, which is the case for the account a payment arrived on.
     */
    @field({ decoder: IntegerDecoder })
    quantity = 0;

    /**
     * The number of payments in this group, or of balance items when breaking down balance items.
     */
    @field({ decoder: IntegerDecoder })
    count = 0;

    /**
     * Whether this group can be opened to break it down further. Articles are the deepest level.
     */
    @field({ decoder: BooleanDecoder })
    canNarrowDown = false;

    /**
     * Selects the objects of this group, ready to show them in a list: everything that was already
     * narrowed down plus this group itself.
     *
     * Null when a group can't be selected on its own, which is the case for the articles of a webshop
     * order: an order is one balance item, so there is no way to ask the server for one of its lines.
     */
    @field({ decoder: StamhoofdFilterDecoder, nullable: true })
    filter: StamhoofdFilter = null;
}

/**
 * How wide one point of a breakdown graph is.
 */
export enum BreakdownGraphUnit {
    Day = 'Day',
    Week = 'Week',
}

/**
 * What was received or charged in one day or week.
 */
export class BreakdownGraphPoint extends AutoEncoder {
    /**
     * The start of the day or week this point holds, in the timezone of the app.
     */
    @field({ decoder: DateDecoder })
    date: Date = new Date();

    @field({ decoder: IntegerDecoder })
    price = 0;
}

/**
 * What was received or charged over time, oldest first.
 */
export class BreakdownGraph extends AutoEncoder {
    @field({ decoder: new EnumDecoder(BreakdownGraphUnit) })
    unit = BreakdownGraphUnit.Day;

    /**
     * Only the days or weeks in which something happened. Use filledPoints to draw them.
     */
    @field({ decoder: new ArrayDecoder(BreakdownGraphPoint) })
    points: BreakdownGraphPoint[] = [];

    /**
     * The same points, with the days or weeks in which nothing happened added as zero, so a graph
     * shows a flat line instead of jumping over them.
     *
     * A date that is way off would fill a graph with thousands of empty points instead of showing what
     * happened, so above that many we keep to what was measured.
     */
    get filledPoints(): BreakdownGraphPoint[] {
        if (this.points.length === 0) {
            return [];
        }

        const step = this.unit === BreakdownGraphUnit.Week ? { weeks: 1 } : { days: 1 };
        const filled: BreakdownGraphPoint[] = [];
        let expected = Formatter.luxon(this.points[0].date);

        for (const point of this.points) {
            while (expected.toMillis() < point.date.getTime() && filled.length <= MAX_GRAPH_POINTS) {
                filled.push(BreakdownGraphPoint.create({ date: expected.toJSDate() }));
                expected = expected.plus(step);
            }

            filled.push(point);
            expected = Formatter.luxon(point.date).plus(step);
        }

        return filled.length > MAX_GRAPH_POINTS ? this.points : filled;
    }
}

/**
 * Above this many points a graph says nothing anymore, and it is a sign of a date that is way off.
 */
const MAX_GRAPH_POINTS = 1000;

export class BreakdownPathItem extends AutoEncoder {
    @field({ decoder: new EnumDecoder(BreakdownTab) })
    tab: BreakdownTab = BreakdownTab.Category;

    @field({ decoder: StringDecoder })
    id = '';
}

/**
 * What a set of payments adds up to.
 */
export class PaymentBreakdown extends AutoEncoder {
    /**
     * What these payments add up to. Not necessarily money that arrived: a selection can hold payments
     * that failed or are still being processed.
     */
    @field({ decoder: IntegerDecoder })
    price = 0;

    @field({ decoder: IntegerDecoder })
    paymentCount = 0;

    /**
     * Transaction costs that were withheld by the payment provider on the payments below.
     */
    @field({ decoder: IntegerDecoder })
    transferFee = 0;

    @field({ decoder: IntegerDecoder })
    serviceFeeManual = 0;

    @field({ decoder: IntegerDecoder })
    serviceFeePayout = 0;

    /**
     * True when only a part of the payments is shown: the amounts above belong to the payments as a
     * whole, which paid for more than what is broken down here.
     */
    @field({ decoder: BooleanDecoder })
    isPartial = false;

    /**
     * What was received over time.
     */
    @field({ decoder: BreakdownGraph })
    graph = BreakdownGraph.create({});

    @field({ decoder: new ArrayDecoder(BreakdownGroup) })
    byAccount: BreakdownGroup[] = [];

    @field({ decoder: new ArrayDecoder(BreakdownGroup) })
    byCategory: BreakdownGroup[] = [];

    @field({ decoder: new ArrayDecoder(BreakdownGroup) })
    byArticle: BreakdownGroup[] = [];

    /**
     * Per payout of a payment provider. Empty when nothing was paid online, because then there is
     * never anything to pay out.
     */
    @field({ decoder: new ArrayDecoder(BreakdownGroup) })
    bySettlement: BreakdownGroup[] = [];

    /**
     * Selects the payments that are broken down here, to export them to Excel.
     *
     * Note that a payment is exported as a whole: when narrowed down to balance item metadata, the
     * export contains every payment that paid for at least one matching item.
     */
    @field({ decoder: StamhoofdFilterDecoder, nullable: true })
    exportFilter: StamhoofdFilter = null;
}

/**
 * What a set of balance items adds up to.
 */
export class BalanceItemBreakdown extends AutoEncoder {
    /**
     * The price that was charged, excluding canceled and hidden items.
     */
    @field({ decoder: IntegerDecoder })
    price = 0;

    @field({ decoder: IntegerDecoder })
    pricePaid = 0;

    @field({ decoder: IntegerDecoder })
    pricePending = 0;

    @field({ decoder: IntegerDecoder })
    priceOpen = 0;

    @field({ decoder: IntegerDecoder })
    balanceItemCount = 0;

    /**
     * What was charged over time.
     */
    @field({ decoder: BreakdownGraph })
    graph = BreakdownGraph.create({});

    @field({ decoder: new ArrayDecoder(BreakdownGroup) })
    byCategory: BreakdownGroup[] = [];

    @field({ decoder: new ArrayDecoder(BreakdownGroup) })
    byArticle: BreakdownGroup[] = [];

    /**
     * Where the money for these balance items stands: per payout of a payment provider for what came in,
     * plus what is still being processed, what a failed payment tried to cover and what was never paid.
     *
     * A balance item can be spread over several of these, so a row holds a part of it instead of the
     * whole. Together they add up to the price that was charged.
     */
    @field({ decoder: new ArrayDecoder(BreakdownGroup) })
    bySettlement: BreakdownGroup[] = [];

    @field({ decoder: StamhoofdFilterDecoder, nullable: true })
    exportFilter: StamhoofdFilter = null;
}

/**
 * Asks for the breakdown of the objects matching a filter, narrowed down by the groups that were
 * opened.
 */
export class BreakdownRequest extends CountFilteredRequest {
    /**
     * The groups that were opened, from the top down.
     */
    path: BreakdownPathItem[];

    constructor(data: { filter?: StamhoofdFilter | null; search?: string | null; path?: BreakdownPathItem[] }) {
        super(data);
        this.path = data.path ?? [];
    }

    static decode(data: Data): BreakdownRequest {
        const base = CountFilteredRequest.decode(data);
        const encodedPath = data.optionalField('path')?.string;

        return new BreakdownRequest({
            filter: base.filter,
            search: base.search,
            path: encodedPath ? BreakdownRequest.decodePath(data, encodedPath) : [],
        });
    }

    /**
     * The path is sent as JSON because a query parameter can't hold a list of objects.
     */
    private static decodePath(data: Data, encodedPath: string): BreakdownPathItem[] {
        let parsed: unknown;

        try {
            parsed = JSON.parse(encodedPath);
        } catch (e) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Expected JSON at path',
                field: 'path',
            });
        }

        return data.clone({
            data: parsed,
            field: 'path',
            context: data.context,
        }).decode(new ArrayDecoder(BreakdownPathItem as Decoder<BreakdownPathItem>));
    }

    encode(context: EncodeContext): PlainObject {
        return {
            ...(super.encode(context) as Record<string, PlainObject>),
            path: this.path.length > 0 ? JSON.stringify(this.path.map(item => item.encode(context))) : undefined,
        };
    }
}
