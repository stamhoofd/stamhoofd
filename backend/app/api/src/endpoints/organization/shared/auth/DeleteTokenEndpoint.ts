import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';

import { Context } from '../../../../helpers/Context';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = undefined;

export class CreateTokenEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "DELETE") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/oauth/token", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        await Context.setOrganizationScope()
        const {token} = await Context.authenticate({allowWithoutAccount: true})
        await token.delete()
        
        return new Response(undefined)
    }
}
