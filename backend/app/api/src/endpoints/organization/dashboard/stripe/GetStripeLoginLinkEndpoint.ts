
import { AutoEncoder, Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { StripeAccount, Token } from '@stamhoofd/models';
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
}

type Query = undefined
class ResponseBody extends AutoEncoder {
    @field({ decoder: StringDecoder })
    url: string
}

export class GetStripeLoginLinkEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = Body as Decoder<Body>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/stripe/login-link", {});

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
            throw new SimpleError({
                code: "not_found",
                message: "Account niet gevonden",
                statusCode: 400
            })
        }

        if (model.meta.type === 'standard') {
            return new Response(ResponseBody.create({
                url: 'https://dashboard.stripe.com/'
            }));
        }

        const stripe = StripeHelper.getInstance()
        const accountLink = await stripe.accounts.createLoginLink(model.accountId);

        return new Response(ResponseBody.create({
            url: accountLink.url
        }));
    }
}
