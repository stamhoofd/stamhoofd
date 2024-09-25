import { AutoEncoder, Data, DateDecoder, Decoder, Encodeable, EncodeContext, field, IntegerDecoder, PlainObject, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';

import { encodeSortList, SortList, SortListDecoder } from './SortList';
import { StamhoofdCompareValue, StamhoofdFilter } from './StamhoofdFilter';

export class StamhoofdFilterJSONDecoder {
    static encode(context: EncodeContext, filter: StamhoofdFilter): string {
        return JSON.stringify(StamhoofdFilterDecoder.encode(context, filter));
    }

    static decode(data: Data): StamhoofdFilter {
        const str = data.string;
        try {
            const decoded = JSON.parse(str);
            return StamhoofdFilterDecoder.decode(data.clone({ data: decoded, field: data.currentField, context: data.context }));
        }
        catch (e) {
            throw new SimpleError({
                code: 'invalid_field',
                message: `Expected JSON at ${data.currentField}`,
                field: data.currentField,
            });
        }
    }
}

export class StamhoofdFilterDecoder {
    static encode(context: EncodeContext, filter: StamhoofdFilter<StamhoofdCompareValue>): PlainObject {
        // We need to convert all Date objects to something recornizable so we can decode them as Dates too
        // We'll use magic objects for this: { $: '$date', value: unixtimeinms }
        if (filter instanceof Date) {
            return { $: '$date', value: filter.encode(context) };
        }

        if (filter === null) {
            return null;
        }

        if (Array.isArray(filter)) {
            return filter.map(f => this.encode(context, f));
        }

        if (typeof filter === 'object') {
            // Loop and replace all keys
            const c = {} as Record<string, PlainObject>;
            for (const [key, value] of Object.entries(filter)) {
                c[key] = this.encode(context, value);
            }
            return c;
        }

        return filter;
    }

    static decode(data: Data): StamhoofdFilter {
        const value: unknown = data.value;

        if (value === null) {
            return null;
        }

        if (Array.isArray(value)) {
            return value.map((v, index) => this.decode(
                data.clone({
                    data: v,
                    field: data.addToCurrentField(index),
                    context: data.context,
                }),
            ));
        }

        if (typeof value === 'object') {
            // Check if it's a date
            if ('$' in value && value.$ === '$date' && 'value' in value) {
                return DateDecoder.decode(
                    data.clone({
                        data: value.value,
                        field: data.addToCurrentField('value'),
                        context: data.context,
                    }),
                );
            }

            // Loop and replace all keys
            const c = {} as Record<string, StamhoofdFilter>;
            for (const [key, v] of Object.entries(value)) {
                c[key] = this.decode(data.clone({
                    data: v,
                    field: data.addToCurrentField(key),
                    context: data.context,
                }));
            }
            return c;
        }

        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return value;
        }

        throw new SimpleError({
            code: 'invalid_field',
            message: `Invalid filter at ${data.currentField}`,
            field: data.currentField,
        });
    }
}

export class CountResponse extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    count: number;
}

export class CountFilteredRequest implements Encodeable {
    filter: StamhoofdFilter | null;
    search: string | null;

    constructor(data: { filter?: StamhoofdFilter | null; search?: string | null }) {
        this.filter = data.filter ?? null;
        this.search = data.search ?? null;
    }

    static decode(data: Data): CountFilteredRequest {
        return new CountFilteredRequest({
            filter: data.optionalField('filter')?.nullable(StamhoofdFilterJSONDecoder),
            search: data.optionalField('search')?.nullable(StringDecoder),
        });
    }

    encode(context: EncodeContext): PlainObject {
        return {
            filter: this.filter ? JSON.stringify(this.filter) : undefined,
            search: this.search ?? undefined,
        };
    }
}

export class LimitedFilteredRequest implements Encodeable {
    /**
     * This is the base filter
     */
    filter: StamhoofdFilter | null;

    /**
     * This is a filter than get extended to fetch the next page
     */
    pageFilter: StamhoofdFilter | null;

    sort: SortList;
    limit: number;
    search: string | null;

    constructor(data: { filter?: StamhoofdFilter | null; pageFilter?: StamhoofdFilter | null; sort?: SortList; limit: number; search?: string | null }) {
        this.filter = data.filter ?? null;
        this.pageFilter = data.pageFilter ?? null;
        this.sort = data.sort ?? [];
        this.limit = data.limit;
        this.search = data.search ?? null;
    }

    static decode(data: Data): LimitedFilteredRequest {
        return new LimitedFilteredRequest({
            filter: data.optionalField('filter')?.nullable(StamhoofdFilterJSONDecoder),
            pageFilter: data.optionalField('pageFilter')?.nullable(StamhoofdFilterJSONDecoder),
            sort: data.field('sort').decode(SortListDecoder as Decoder<SortList>),
            limit: data.field('limit').integer,
            search: data.optionalField('search')?.nullable(StringDecoder),
        });
    }

    encode(context: EncodeContext): PlainObject {
        return {
            filter: this.filter ? StamhoofdFilterJSONDecoder.encode(context, this.filter) : undefined,
            pageFilter: this.pageFilter ? StamhoofdFilterJSONDecoder.encode(context, this.pageFilter) : undefined,
            sort: encodeSortList(this.sort),
            limit: this.limit,
            search: this.search ?? undefined,
        };
    }
}
