import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { EmailVerificationCode } from '@stamhoofd/models';
import { PollEmailVerificationRequest, PollEmailVerificationResponse } from '@stamhoofd/structures';

import { Context } from '../../helpers/Context';

type Params = Record<string, never>;
type Query = undefined;
type Body = PollEmailVerificationRequest;
type ResponseBody = PollEmailVerificationResponse;

export class PollEmailVerificationEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = PollEmailVerificationRequest as Decoder<PollEmailVerificationRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/verify-email/retry', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope({ willAuthenticate: false });
        const valid = await EmailVerificationCode.poll(organization?.id ?? null, request.body.token);

        if (valid) {
            EmailVerificationCode.resend(organization, request.body.token, request.i18n).catch(console.error);
        }

        return new Response(PollEmailVerificationResponse.create({
            valid,
        }));
    }
}
