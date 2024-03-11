import { AutoEncoder, Data, Decoder, EncodeContext, Encodeable, IntegerDecoder, PlainObject, StringDecoder, field } from "@simonbackx/simple-encoding";
import { SimpleError } from "@simonbackx/simple-errors";
import { SortList, SortListDecoder, encodeSortList } from "./SortList";
import { StamhoofdFilter } from "./StamhoofdFilter";

export class StamhoofdFilterDecoder {
    static decode(data: Data): StamhoofdFilter {
        const str = data.string;
        try {
            const decoded = JSON.parse(str);
            return decoded;
        } catch (e) {
            throw new SimpleError({
                code: "invalid_field",
                message: `Expected JSON at ${data.currentField}`,
                field: data.currentField,
            });
        }
    }
}

export class CountResponse extends AutoEncoder {
    @field({decoder: IntegerDecoder})
    count: number
}

export class CountFilteredRequest implements Encodeable {
    filter: StamhoofdFilter|null
    search: string|null

    constructor(data: {filter?: StamhoofdFilter|null, search?: string|null}) {
        this.filter = data.filter ?? null;
        this.search = data.search ?? null
    }

    static decode(data: Data): CountFilteredRequest {
        return new CountFilteredRequest({
            filter: data.optionalField('filter')?.nullable(StamhoofdFilterDecoder),
            search: data.optionalField('search')?.nullable(StringDecoder)
        })
    }

    encode(context: EncodeContext): PlainObject {
        return {
            filter: this.filter ? JSON.stringify(this.filter) : undefined,
            search: this.search ?? undefined
        }
    }
}

export class LimitedFilteredRequest implements Encodeable {
    /**
     * This is the base filter
     */
    filter: StamhoofdFilter|null

    /**
     * This is a filter than get extended to fetch the next page
     */
    pageFilter: StamhoofdFilter|null

    sort: SortList
    limit: number
    search: string|null

    constructor(data: {filter?: StamhoofdFilter|null, pageFilter?: StamhoofdFilter|null, sort: SortList, limit: number, search?: string|null}) {
        this.filter = data.filter ?? null;
        this.pageFilter = data.pageFilter ?? null;
        this.sort = data.sort
        this.limit = data.limit
        this.search = data.search ?? null
    }

    static decode(data: Data): LimitedFilteredRequest {
        return new LimitedFilteredRequest({
            filter: data.optionalField('filter')?.nullable(StamhoofdFilterDecoder),
            pageFilter: data.optionalField('pageFilter')?.nullable(StamhoofdFilterDecoder),
            sort: data.field('sort').decode(SortListDecoder as Decoder<SortList>),
            limit: data.field('limit').integer,
            search: data.optionalField('search')?.nullable(StringDecoder)
        })
    }

    encode(context: EncodeContext): PlainObject {
        return {
            filter: this.filter ? JSON.stringify(this.filter) : undefined,
            pageFilter: this.pageFilter ? JSON.stringify(this.pageFilter) : undefined,
            sort: encodeSortList(this.sort),
            limit: this.limit,
            search: this.search ?? undefined
        }
    }
}