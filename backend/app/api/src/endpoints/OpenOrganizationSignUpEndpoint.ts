import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { FacebookPixel } from '@stamhoofd/models';
import { FBId } from "@stamhoofd/structures";

type Params = Record<string, never>;
type Query = undefined;
type Body = FBId;
type ResponseBody = undefined;

export class OpenOrganizationSignUpEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = FBId as Decoder<FBId>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organizations/open", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        FacebookPixel.trackOpenSignUp(request.body, request.request)
        return Promise.resolve(new Response(undefined));
    }
}
