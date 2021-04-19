import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { PollEmailVerificationRequest, PollEmailVerificationResponse } from "@stamhoofd/structures";

import { EmailVerificationCode } from '@stamhoofd/models';
import { Organization } from "@stamhoofd/models";

type Params = {};
type Query = undefined;
type Body = PollEmailVerificationRequest;
type ResponseBody = PollEmailVerificationResponse;

export class PollEmailVerificationEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = PollEmailVerificationRequest as Decoder<PollEmailVerificationRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/verify-email/poll", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Organization.fromApiHost(request.host);
        const valid = await EmailVerificationCode.poll(organization.id, request.body.token)
        
        return new Response(PollEmailVerificationResponse.create({
            valid
        }));
    }
}