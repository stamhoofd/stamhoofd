interface Headers {
    [key: string]: string;
}
export class DecodedRequest<Params, Query, Body> {
    headers: Headers
    params: Params
    body: Body
    query: Query

    constructor(headers: Headers, params: Params, query: Query, body: Body) {
        this.headers = headers
        this.params = params
        this.query = query
        this.body = body
    }
}
