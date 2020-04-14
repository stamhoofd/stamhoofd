import { Decoder } from "@/structs/classes/Decoder";
import { Request, HttpMethod } from "./Request";
import { ObjectData } from "@/structs/classes/ObjectData";
import http from "http";

export class DecodedRequest<Params, Query, Body> {
    method: HttpMethod;
    url: string;
    host: string;
    headers: http.IncomingHttpHeaders;
    params: Params;
    body: Body;
    query: Query;

    static async fromRequest<Params, Query, Body>(
        request: Request,
        params: Params,
        queryDecoder: Decoder<Query> | undefined,
        bodyDecoder: Decoder<Body> | undefined
    ): Promise<DecodedRequest<Params, Query, Body>> {
        const r = new DecodedRequest<Params, Query, Body>();
        r.method = request.method;
        r.url = request.url;
        r.host = request.host;
        r.headers = request.headers;

        const query = queryDecoder !== undefined ? queryDecoder.decode(new ObjectData(request.query)) : undefined;
        const body =
            bodyDecoder !== undefined ? bodyDecoder.decode(new ObjectData(JSON.parse(await request.body))) : undefined;

        r.params = params;
        r.query = query as Query;
        r.body = body as Body;

        return r;
    }
}
