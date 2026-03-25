import type { DecodedRequest, Request} from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import type { UserWithMembers } from '@stamhoofd/structures';

import { AuthenticatedStructures } from '../../helpers/AuthenticatedStructures.js';
import { Context } from '../../helpers/Context.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = UserWithMembers;

export class GetUserEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/user', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope();
        const { user } = await Context.authenticate({ allowWithoutAccount: true });

        return new Response(
            await AuthenticatedStructures.userWithMembers(user),
        );
    }
}
