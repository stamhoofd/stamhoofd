import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { User } from '@stamhoofd/models';
import { OrganizationAdmins } from '@stamhoofd/structures';

import { Context } from '../../../helpers/Context.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = undefined;
type ResponseBody = OrganizationAdmins;

export class GetPlatformAdminsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/platform/admins', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        await Context.authenticate();

        // Fast throw first (more in depth checking for patches later)
        if (!Context.auth.canManagePlatformAdmins()) {
            throw Context.auth.error();
        }

        // Get all admins
        const admins = await User.getPlatformAdmins();

        return new Response(
            OrganizationAdmins.create({
                users: admins.map(user => user.getStructure()),
            }),
        );
    }
}
