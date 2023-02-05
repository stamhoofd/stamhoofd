import { AutoEncoder, DateDecoder, Decoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";

import { FileCache } from "../helpers/FileCache";

type Params = Record<string, never>;
class Query extends AutoEncoder {
    @field({ decoder: StringDecoder })
    cacheId: string

    @field({ decoder: DateDecoder })
    timestamp: Date
}
type Body = undefined
type ResponseBody = Buffer

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class PdfCacheEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/pdf-cache", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const pdf = await FileCache.read(request.query.cacheId, request.query.timestamp)
        if (!pdf) {
            throw new SimpleError({
                code: "cache_not_found",
                message: "Not cached",
                statusCode: 404
            })
        }
        const response = new Response(pdf)
        response.headers["Content-Type"] = "application/pdf"
        response.headers["Content-Length"] = pdf.byteLength.toString()
        return response;
    }
}
