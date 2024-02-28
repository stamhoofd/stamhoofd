import { Data, Decoder, EncodeContext, Encodeable, PlainObject, StringDecoder } from "@simonbackx/simple-encoding";
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

export class FilteredRequest implements Encodeable {
    filter: StamhoofdFilter|null
    sort: SortList
    limit: number
    search: string|null

    constructor(data: {filter?: StamhoofdFilter|null, sort: SortList, limit: number, search?: string|null}) {
        this.filter = data.filter ?? null;
        this.sort = data.sort
        this.limit = data.limit
        this.search = data.search ?? null
    }

    static decode(data: Data): FilteredRequest {
        return new FilteredRequest({
            filter: data.optionalField('filter')?.nullable(StamhoofdFilterDecoder),
            sort: data.field('sort').decode(SortListDecoder as Decoder<SortList>),
            limit: data.field('limit').integer,
            search: data.optionalField('search')?.nullable(StringDecoder)
        })
    }

    encode(context: EncodeContext): PlainObject {
        return {
            filter: this.filter ? JSON.stringify(this.filter) : undefined,
            sort: encodeSortList(this.sort),
            limit: this.limit,
            search: this.search ?? undefined
        }
    }
}
