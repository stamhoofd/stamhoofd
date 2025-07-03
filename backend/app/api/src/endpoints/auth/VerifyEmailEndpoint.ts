import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { EmailVerificationCode, Token, User } from '@stamhoofd/models';
import { Token as TokenStruct, VerifyEmailRequest } from '@stamhoofd/structures';

import { Context } from '../../helpers/Context';

type Params = Record<string, never>;
type Query = undefined;
type Body = VerifyEmailRequest;
type ResponseBody = TokenStruct;

export class VerifyEmailEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = VerifyEmailRequest as Decoder<VerifyEmailRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/verify-email', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope({ willAuthenticate: false });

        const code = await EmailVerificationCode.verify(organization?.id ?? null, request.body.token, request.body.code);

        if (!code) {
            throw new SimpleError({
                code: 'invalid_code',
                message: 'This code is invalid',
                human: $t(`6dfd3a88-1de2-4462-b2a4-625026f9a62f`),
                statusCode: 400,
            });
        }

        const user = await User.getByID(code.userId);

        if (!user || (user.organizationId !== null && user.organizationId !== (organization?.id ?? null))) {
            throw new SimpleError({
                code: 'invalid_code',
                message: 'This code is invalid',
                human: $t(`6dfd3a88-1de2-4462-b2a4-625026f9a62f`),
                statusCode: 400,
            });
        }

        if (user.email !== code.email) {
            const other = await User.getForAuthentication(user.organizationId, code.email, { allowWithoutAccount: true });

            if (other) {
                // Delete the other user, but merge data
                await user.merge(other);
            }

            // change user email
            user.email = code.email;

            // If already in use: will fail, so will verification
        }

        user.verified = true;

        try {
            await user.save();
        }
        catch (e) {
            // Duplicate key probably
            if (e.code && e.code == 'ER_DUP_ENTRY') {
                throw new SimpleError({
                    code: 'email_in_use',
                    message: 'This e-mail is already in use, we cannot set it',
                    human: $t(`3073cc35-f434-4c2c-8347-34db10fc9940`, { email: code.email, contactEmail: request.$t('59b85264-c4c3-4cf6-8923-9b43282b2787') }),
                });
            }
            throw e;
        }

        const token = await Token.createToken(user);
        const st = new TokenStruct(token);
        return new Response(st);
    }
}
