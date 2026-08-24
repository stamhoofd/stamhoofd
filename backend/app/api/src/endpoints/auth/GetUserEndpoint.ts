import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
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
        await Context.authenticate({ allowWithoutAccount: true, allowUnscoped: true });

        // While impersonating, this returns the account that is being looked at: the whole
        // point is that the frontend behaves as that user. The administrator behind it is
        // reported separately, so the session can show who is really acting.
        return new Response(
            await AuthenticatedStructures.userWithMembers(Context.impersonatedUserOrUser, {
                impersonatedBy: Context.isImpersonating ? Context.user : null,
            }),
        );
    }
}
