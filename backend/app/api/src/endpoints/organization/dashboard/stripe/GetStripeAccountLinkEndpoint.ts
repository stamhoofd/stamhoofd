
import { AutoEncoder, Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { StripeAccount } from '@stamhoofd/models';
import { PermissionLevel } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context';
import { StripeHelper } from '../../../../helpers/StripeHelper';

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
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (!await Context.auth.canManagePaymentAccounts(organization.id, PermissionLevel.Full)) {
            throw Context.auth.error()
        }

        // Search account in database
        const model = await StripeAccount.getByID(request.body.accountId)
        if (!model || model.organizationId != organization.id || model.status !== 'active') {
            throw Context.auth.notFoundOrNoAccess("Account niet gevonden")
        }

        // Get account
        const stripe = StripeHelper.getInstance()
        const accountLink = await stripe.accountLinks.create({
            account: model.accountId,
            refresh_url: request.body.refreshUrl,
            return_url: request.body.returnUrl,
            type: 'account_onboarding',
            collect: model.meta.type === 'express' ? 'eventually_due' : undefined, // Collect all at the start
        });

        return new Response(ResponseBody.create({
            url: accountLink.url
        }));
    }
}
