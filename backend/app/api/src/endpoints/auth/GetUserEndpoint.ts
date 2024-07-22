import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { UserWithMembers } from '@stamhoofd/structures';

import { AuthenticatedStructures } from '../../helpers/AuthenticatedStructures';
import { Context } from '../../helpers/Context';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = UserWithMembers;

export class GetUserEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/user", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope()
        const {user} = await Context.authenticate({allowWithoutAccount: true})

        return new Response(
            await AuthenticatedStructures.userWithMembers(user)
        );
    }
}
