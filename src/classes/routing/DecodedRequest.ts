interface Headers {
    [key: string]: string;
}
export class DecodedRequest<Params, Query, Body> {
    headers: Headers
    params: Params
    body: Body
    query: Query
}
