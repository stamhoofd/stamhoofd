import { Data,Decoder,EncodableObject, Encodeable, EncodeContext, encodeObject } from "@simonbackx/simple-encoding";

export class PaginatedResponse<Result extends EncodableObject, Query extends Encodeable> implements Encodeable {
    results: Result;
    next?: Query;

    constructor(data: {results: Result;next?: Query}) {
        this.results = data.results
        this.next = data.next
    }

    encode(context: EncodeContext) {
        return {
            results: encodeObject(this.results, context), //this.results.map(r => r.encode(context)),
            next: this.next?.encode(context),
        };
    }
}

export class PaginatedResponseDecoder<Result extends EncodableObject, Query extends Encodeable> implements Decoder<PaginatedResponse<Result, Query>> {
    resultDecoder: Decoder<Result>
    querydecoder: Decoder<Query>

    constructor(resultDecoder: Decoder<Result>, querydecoder: Decoder<Query>) {
        this.resultDecoder = resultDecoder
        this.querydecoder = querydecoder
    }

    decode(data: Data) {
        return new PaginatedResponse<Result, Query>({
            results: data.field('results').decode(this.resultDecoder),
            next: data.optionalField('next')?.decode(this.querydecoder),
        })
    }
}
