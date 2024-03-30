
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { StripeAccount, Token } from '@stamhoofd/models';
import { StripeAccount as StripeAccountStruct } from '@stamhoofd/structures';

type Params = Record<string, never>;
type Body = undefined;
type Query = undefined
type ResponseBody = StripeAccountStruct[]

export class GetStripeAccountLinkEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {    
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/stripe/accounts", {});

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

        const models = await StripeAccount.where({ organizationId: user.organizationId, status: 'active' })
        return new Response(models.map(m => StripeAccountStruct.create(m)));
    }
}
