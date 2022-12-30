
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { StripeAccount, Token } from '@stamhoofd/models';

import { StripeHelper } from '../../helpers/StripeHelper';

type Params = { id: string };
type Body = undefined;
type Query = undefined
type ResponseBody = undefined

export class DeleteStripeAccountEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {    
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "DELETE") {
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

        if (!user.permissions || !user.permissions.hasFullAccess()) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Deze actie is enkel beschikbaar voor hoofdbeheerders",
            })
        }

       // Search account in database
        const model = await StripeAccount.getByID(request.params.id)
        if (!model || model.organizationId != user.organizationId || model.status !== "active") {
            throw new SimpleError({
                code: "not_found",
                message: "Account niet gevonden",
                statusCode: 400
            })
        }

        // Get account
        const stripe = StripeHelper.getInstance()

        try {
            await stripe.accounts.del(model.accountId);
        } catch (e) {
            console.error('Tried deleting account but failed', e)
        }

        // If that succeeded
        model.status = "deleted"
        await model.save()

        return new Response(undefined);
    }
}
