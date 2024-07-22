import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { UserWithMembers } from '@stamhoofd/structures';

import { AuthenticatedStructures } from '../../helpers/AuthenticatedStructures';
import { Context } from '../../helpers/Context';
import { User } from '@stamhoofd/models';

type Params = {id: string};
type Query = undefined;
type Body = undefined;
type ResponseBody = UserWithMembers;

export class GetUserEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/user/@id", {id: String});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope()
        await Context.authenticate()

        const user = await User.getByID(request.params.id)
        if (!user || !(await Context.auth.canAccessUser(user)) ){
            throw Context.auth.error()
        }

        return new Response(
            await AuthenticatedStructures.userWithMembers(user)
        );
    }
}
