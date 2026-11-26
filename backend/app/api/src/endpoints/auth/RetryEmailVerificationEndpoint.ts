import type { Decoder } from '@common/encoding';
import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import { EmailVerificationCode, RateLimiter } from '@stamhoofd/models';
import { PollEmailVerificationRequest, PollEmailVerificationResponse } from '@stamhoofd/structures';

import { Context } from '../../helpers/Context.js';
import { VerificationCodeService } from '../../services/VerificationCodeService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = PollEmailVerificationRequest;
type ResponseBody = PollEmailVerificationResponse;

/**
 * Every call resends the verification email, so cap it per token and per address.
 */
export const retryEmailVerificationTokenLimiter = new RateLimiter({
    limits: [
        {
            limit: 3,
            duration: 10 * 60 * 1000,
        },
        {
            limit: 10,
            duration: 60 * 60 * 1000,
        },
    ],
});

export const retryEmailVerificationIPLimiter = new RateLimiter({
    limits: [
        {
            limit: 10,
            duration: 15 * 60 * 1000,
        },
        {
            limit: 30,
            duration: 60 * 60 * 1000,
        },
    ],
});

export class RetryEmailVerificationEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
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
        const organization = await Context.setOptionalOrganizationScope({
            willAuthenticate: false,
        });

        retryEmailVerificationIPLimiter.track(request.request.getIP());
        retryEmailVerificationTokenLimiter.track(request.body.token);

        const valid = await EmailVerificationCode.poll(
            organization?.id ?? null,
            request.body.token,
        );

        if (valid) {
            VerificationCodeService.resend(organization, request.body.token, request.i18n).catch(
                console.error,
            );
        }

        return new Response(
            PollEmailVerificationResponse.create({
                valid,
            }),
        );
    }
}
