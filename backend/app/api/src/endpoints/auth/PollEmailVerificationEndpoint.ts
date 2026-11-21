import type { Decoder } from '@common/encoding';
import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import { EmailVerificationCode, RateLimiter } from '@stamhoofd/models';
import { PollEmailVerificationRequest, PollEmailVerificationResponse } from '@stamhoofd/structures';

import { Context } from '../../helpers/Context.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = PollEmailVerificationRequest;
type ResponseBody = PollEmailVerificationResponse;

/**
 * Keyed by token, not by address: the client polls every few seconds, and a lot of people
 * behind one address can be waiting at once.
 */
export const pollEmailVerificationLimiter = new RateLimiter({
    limits: [
        {
            limit: 120,
            duration: 10 * 60 * 1000,
        },
        {
            limit: 500,
            duration: 60 * 60 * 1000,
        },
    ],
});

export class PollEmailVerificationEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = PollEmailVerificationRequest as Decoder<PollEmailVerificationRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/verify-email/poll', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope({
            willAuthenticate: false,
        });

        pollEmailVerificationLimiter.track(request.body.token);

        const valid = await EmailVerificationCode.poll(
            organization?.id ?? null,
            request.body.token,
        );

        return new Response(
            PollEmailVerificationResponse.create({
                valid,
            }),
        );
    }
}
