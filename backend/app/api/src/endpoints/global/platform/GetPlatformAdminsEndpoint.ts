import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { User } from '@stamhoofd/models';
import { User as UserStruct } from "@stamhoofd/structures";

import { Context } from "../../../helpers/Context";
import { AuthenticatedStructures } from "../../../helpers/AuthenticatedStructures";
type Params = Record<string, never>;
type Query = undefined;
type Body = undefined
type ResponseBody = UserStruct[]

export class GetPlatformAdminsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/platform/admins", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (!Context.auth.canManagePlatformAdmins()) {
            throw Context.auth.error()
        }

        // Get all admins
        let admins = await User.where({ organizationId: null, permissions: { sign: "!=", value: null }})

        // Hide api accounts
        admins = admins.filter(a => !a.isApiUser)
        admins = admins.filter(a => !!a.permissions?.globalPermissions)

        return new Response(
            await AuthenticatedStructures.usersWithMembers(admins)
        );
    }
}
