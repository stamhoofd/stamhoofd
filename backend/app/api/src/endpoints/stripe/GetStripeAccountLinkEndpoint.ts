
import { AutoEncoder, Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { StripeAccount, Token } from '@stamhoofd/models';

import { StripeHelper } from '../../helpers/StripeHelper';

type Params = Record<string, never>;
class Body extends AutoEncoder {
    /**
     * The account id (internal id, not the stripe id)
     */
    @field({ decoder: StringDecoder })
    accountId: string

    @field({ decoder: StringDecoder })
    returnUrl: string

    @field({ decoder: StringDecoder })
    refreshUrl: string
}

type Query = undefined
class ResponseBody extends AutoEncoder {
    @field({ decoder: StringDecoder })
    url: string
}

export class GetStripeAccountLinkEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = Body as Decoder<Body>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/stripe/account-link", {});

        if (params) {
            return [true, params as Params];
        }

        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        if (!user.permissions || !user.permissions.hasFullAccess()) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je moet hoofdbeheerder zijn om Stripe te kunnen connecteren"
            })
        }

        // Search account in database
        const model = await StripeAccount.getByID(request.body.accountId)
        if (!model || model.organizationId != user.organizationId || model.status !== 'active') {
            throw new SimpleError({
                code: "not_found",
                message: "Account niet gevonden",
                statusCode: 400
            })
        }

        // Get account
        const stripe = StripeHelper.getInstance()
        const accountLink = await stripe.accountLinks.create({
            account: model.accountId,
            refresh_url: request.body.refreshUrl,
            return_url: request.body.returnUrl,
            type: 'account_onboarding',
            collect: 'eventually_due', // Collect all at the start
        });

        return new Response(ResponseBody.create({
            url: accountLink.url
        }));
    }
}
