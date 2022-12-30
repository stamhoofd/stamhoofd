
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { StripeAccount, Token } from '@stamhoofd/models';
import { StripeAccount as StripeAccountStruct } from '@stamhoofd/structures';

import { StripeHelper } from '../../helpers/StripeHelper';

type Params = { id: string };
type Body = undefined;
type Query = undefined
type ResponseBody = StripeAccountStruct

export class GetStripeAccountLinkEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {    
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/stripe/accounts/@id", {id: String});

        if (params) {
            return [true, params as Params];
        }

        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        if (!user.permissions) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Deze actie is enkel beschikbaar voor beheerders",
            })
        }

       // Search account in database
        const model = await StripeAccount.getByID(request.params.id)
        if (!model || model.organizationId != user.organizationId) {
            throw new SimpleError({
                code: "not_found",
                message: "Account niet gevonden",
                statusCode: 400
            })
        }

        // Get account
        const stripe = StripeHelper.getInstance()
        const account = await stripe.accounts.retrieve(model.accountId);
        model.setMetaFromStripeAccount(account)
        await model.save()

        return new Response(StripeAccountStruct.create(model));
    }
}
