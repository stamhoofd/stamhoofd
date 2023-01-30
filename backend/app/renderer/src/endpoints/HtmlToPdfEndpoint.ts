import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined
type ResponseBody = Buffer

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class HtmlToPdfEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/html-to-pdf", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Promise.resolve();
        const pdf = Buffer.from('test')
        const response = new Response(pdf)
        response.headers["Content-Type"] = "application/pdf"
        response.headers["Content-Length"] = pdf.byteLength.toString()
        return response;
    }
}
