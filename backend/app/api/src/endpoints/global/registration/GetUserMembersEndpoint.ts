import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import type { MemberWithUsersRegistrationsAndGroups } from '@stamhoofd/models';
import { Member } from '@stamhoofd/models';
import type { MembersBlob } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/structures';

import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures.js';
import { Context } from '../../../helpers/Context.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = MembersBlob;

/**
 * Get the members of the user
 */
export class GetUserMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/user/members', {});

        if (params) {
            return [true, params as Params];
        }

        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        await Context.setUserOrganizationScope();
        await Context.authenticate();

        // While impersonating, these are the members of the account being looked at: the
        // frontend has to show that user's family. Which of them actually come through is
        // still decided for the administrator behind the session as well.
        const members = await Member.getMembersWithRegistrationForUser(Context.impersonatedUserOrUser);
        const accessible: MemberWithUsersRegistrationsAndGroups[] = [];

        for (const member of members) {
            if (await Context.auth.canAccessMember(member, PermissionLevel.Read)) {
                accessible.push(member);
            }
        }

        return new Response(
            await AuthenticatedStructures.membersBlob(accessible),
        );
    }
}
