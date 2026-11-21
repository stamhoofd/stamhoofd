import type { Decoder } from '@common/encoding';
import type { DecodedRequest, Request } from '@node/endpoints';
import { Endpoint, Response } from '@node/endpoints';
import { Platform, RateLimiter, User } from '@stamhoofd/models';
import { sendEmailTemplate } from '../../helpers/EmailBuilder.js';
import {
    EmailTemplateType,
    ForgotPasswordRequest,
    LoginMethod,
    Recipient,
} from '@stamhoofd/structures';

import { SimpleError } from '@common/errors';
import { Context } from '../../helpers/Context.js';
import { PasswordForgotService } from '../../services/PasswordForgotService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = ForgotPasswordRequest;
type ResponseBody = undefined;

/**
 * Emails every address it is given, also one without an account.
 */
export const forgotPasswordIPLimiter = new RateLimiter({
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

export const forgotPasswordEmailLimiter = new RateLimiter({
    limits: [
        {
            limit: 3,
            duration: 15 * 60 * 1000,
        },
        {
            limit: 10,
            duration: 60 * 60 * 1000,
        },
    ],
});

export class ForgotPasswordEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected bodyDecoder = ForgotPasswordRequest as Decoder<ForgotPasswordRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/forgot-password', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope({
            willAuthenticate: false,
        });

        forgotPasswordIPLimiter.track(request.request.getIP());
        forgotPasswordEmailLimiter.track(request.body.email.toLowerCase());

        if (STAMHOOFD.userMode === 'platform') {
            const platform = await Platform.getSharedPrivateStruct();
            const config = platform.config.loginMethods.get(LoginMethod.Password);
            if (!config) {
                throw new SimpleError({
                    code: 'not_supported',
                    message: 'This platform does not support password login',
                    human: $t('%D7'),
                    statusCode: 400,
                });
            }

            if (!config.isEnabledForEmail(request.body.email)) {
                throw new SimpleError({
                    code: 'not_supported',
                    message: 'Login method not supported',
                    human: $t('%DD'),
                    statusCode: 400,
                });
            }
        }

        const user = await User.getForAuthentication(organization?.id ?? null, request.body.email, {
            allowWithoutAccount: true,
        });

        if (!user) {
            // Create e-mail builder
            await sendEmailTemplate(organization, {
                recipients: [
                    Recipient.create({
                        email: request.body.email,
                    }),
                ],
                template: {
                    type: EmailTemplateType.ForgotPasswordButNoAccount,
                },
                type: 'transactional',
            });

            return new Response(undefined);
        }

        await PasswordForgotService.sendPasswordRecoveryEmail(user, organization, request.i18n);

        return new Response(undefined);
    }
}
