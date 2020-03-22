import { Decoder } from './Decoder'
import { ContentDecoder } from './ContentDecoder'
import { Request } from '../routing/Request'
import { DecodedRequest } from '../routing/DecodedRequest'
import { ContentType } from '../routing/ContentType'

export class RequestDecoder<Params, Query, Body> {
    parametersDecoder: Decoder<Params>
    queryDecoder: Decoder<Query>
    bodyDecoder: ContentDecoder<string, Body>

    constructor(parametersDecoder: Decoder<Params>, queryDecoder: Decoder<Query>, bodyDecoder: ContentDecoder<string, Body>) {
        this.parametersDecoder = parametersDecoder
        this.queryDecoder = queryDecoder
        this.bodyDecoder = bodyDecoder
    }

    decode(request: Request): DecodedRequest<Params, Query, Body> {
        const decoded = new DecodedRequest<Params, Query, Body>();
        decoded.headers = request.headers
        const contentType = ContentType.fromString(request.headers['Content-Type']);

        // Todo: augment thrown errors here by indicating if they origin in body, params or query
        decoded.body = this.bodyDecoder.decodeContent(contentType, request.body)
        decoded.params = this.parametersDecoder.decode(request.params)
        decoded.query = this.queryDecoder.decode(request.query)
        return decoded
    }
}