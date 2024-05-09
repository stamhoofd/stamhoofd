import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { User } from '@stamhoofd/models';
import { OrganizationAdmins, User as UserStruct } from "@stamhoofd/structures";

import { Context } from "../../../../helpers/Context";
type Params = Record<string, never>;
type Query = undefined;
type Body = undefined
type ResponseBody = OrganizationAdmins

export class GetOrganizationAdminsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/admins", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        const {user} = await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (!await Context.auth.canManageAdmins(organization.id)) {
            throw Context.auth.error()
        }

        // Get all admins
        let admins = await User.where({ organizationId: organization.id, permissions: { sign: "!=", value: null }})
        const global = await User.where({ organizationId: null, permissions: { sign: "!=", value: null }})

        admins.push(...global)

        // Hide internal users
        admins = STAMHOOFD.environment === 'production' ? admins.filter(a => a.id === user.id || !((a.email.endsWith('@stamhoofd.be') || a.email.endsWith('@stamhoofd.nl')) && a.firstName == 'Stamhoofd')) : admins

        // Hide api accounts
        admins = admins.filter(a => !a.isApiUser)

        return new Response(OrganizationAdmins.create({
            users: admins.map(a => UserStruct.create({...a, hasAccount: a.hasAccount()})),
        }));
    }
}
