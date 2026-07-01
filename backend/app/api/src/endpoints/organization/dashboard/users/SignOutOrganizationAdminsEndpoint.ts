import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { CountResponse } from '@stamhoofd/structures';

import { Context } from '../../../../helpers/Context.js';
import { AdminSessionService } from '../../../../services/AdminSessionService.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = CountResponse;

/**
 * End the sessions of all administrators of this organization, so they have to sign in
 * again. Used after making two-factor authentication required, which is only enforced on
 * new logins.
 */
export class SignOutOrganizationAdminsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'POST') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/organization/admins/sign-out', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        const { token } = await Context.authenticate();

        if (!await Context.auth.canManageAdmins(organization.id)) {
            throw Context.auth.error();
        }

        const count = await AdminSessionService.signOutOrganizationAdmins(organization.id, token.accessToken);

        return new Response(CountResponse.create({ count }));
    }
}
