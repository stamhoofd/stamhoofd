import type { Data, Decoder, EncodeContext, PlainObject } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { CountFilteredRequest, StamhoofdFilterJSONDecoder } from '../filters/FilteredRequest.js';
import type { StamhoofdFilter } from '../filters/StamhoofdFilter.js';
import { BreakdownPathItem } from '../PaymentBreakdown.js';

/**
 * Asks for the breakdown of the objects matching a filter, narrowed down by the groups that were
 * opened.
 */
export class BreakdownRequest extends CountFilteredRequest {
    /**
     * The groups that were opened, from the top down.
     */
    path: BreakdownPathItem[];

    /**
     * Leaves out the objects that the path would drop anyway, so they are never read.
     *
     * A row already knows which objects it holds (see BreakdownSelection.listFilter), so opening it
     * doesn't have to read the whole selection again to throw most of it away. It never selects less
     * than the path keeps, so the amounts are the same with or without it.
     */
    narrowFilter: StamhoofdFilter | null;

    constructor(data: { filter?: StamhoofdFilter | null; search?: string | null; path?: BreakdownPathItem[]; narrowFilter?: StamhoofdFilter | null }) {
        super(data);
        this.path = data.path ?? [];
        this.narrowFilter = data.narrowFilter ?? null;
    }

    static decode(data: Data): BreakdownRequest {
        const base = CountFilteredRequest.decode(data);
        const encodedPath = data.optionalField('path')?.string;

        return new BreakdownRequest({
            filter: base.filter,
            search: base.search,
            path: encodedPath ? BreakdownRequest.decodePath(data, encodedPath) : [],
            narrowFilter: data.optionalField('narrowFilter')?.nullable(StamhoofdFilterJSONDecoder),
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

    /**
     * The filter to read with, which is not the one the rows are built from: what the path selects is
     * decided while the objects are read (see PaymentBreakdownBuilder).
     */
    get readFilter(): StamhoofdFilter {
        if (!this.narrowFilter) {
            return this.filter;
        }

        return this.filter ? { $and: [this.filter, this.narrowFilter] } : this.narrowFilter;
    }

    encode(context: EncodeContext): PlainObject {
        return {
            ...(super.encode(context) as Record<string, PlainObject>),
            path: this.path.length > 0 ? JSON.stringify(this.path.map(item => item.encode(context))) : undefined,
            narrowFilter: this.narrowFilter ? StamhoofdFilterJSONDecoder.encode(this.narrowFilter, context) : undefined,
        };
    }
}
