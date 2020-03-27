import { Decoder } from '../../structs/classes/Decoder'
import { Request } from './Request'
import { ObjectData } from '../../structs/classes/ObjectData'

interface Headers {
    [key: string]: string;
}
export class DecodedRequest<Params, Query, Body> {
    method: "GET" | "POST" | "PATCH" | "DELETE"
    url: string
    headers: Headers
    params: Params
    body: Body
    query: Query

    constructor(request: Request, params: Params, queryDecoder: Decoder<Query> | undefined, bodyDecoder: Decoder<Body> | undefined) {
        this.method = request.method
        this.url = request.url
        this.headers = request.headers


        const query = queryDecoder !== undefined ? queryDecoder.decode(new ObjectData(request.query)) : undefined;
        const body = bodyDecoder !== undefined ? bodyDecoder.decode(new ObjectData(JSON.parse(request.body))) : undefined;

        this.params = params
        this.query = query as Query
        this.body = body as Body
    }
}
