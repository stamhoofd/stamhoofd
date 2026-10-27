import type { Data, Decoder, Encodeable, EncodeContext, PlainObject } from '@common/encoding';
import { AutoEncoder, field, IntegerDecoder, StringDecoder } from '@common/encoding';

import type { SortList } from '@stamhoofd/filters/SortList';
import { encodeSortList, SortListDecoder } from '@stamhoofd/filters/SortList';
import type { StamhoofdFilter } from '@stamhoofd/filters/StamhoofdFilterTypes';
import { StamhoofdFilterJSONDecoder } from './StamhoofdFilterDecoder.js';

export { StamhoofdFilterDecoder, StamhoofdFilterJSONDecoder } from './StamhoofdFilterDecoder.js';

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
            filter: this.filter ? StamhoofdFilterJSONDecoder.encode(this.filter, context) : undefined,
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
            filter: this.filter ? StamhoofdFilterJSONDecoder.encode(this.filter, context) : undefined,
            pageFilter: this.pageFilter ? StamhoofdFilterJSONDecoder.encode(this.pageFilter, context) : undefined,
            sort: encodeSortList(this.sort),
            limit: this.limit,
            search: this.search ?? undefined,
        };
    }
}
