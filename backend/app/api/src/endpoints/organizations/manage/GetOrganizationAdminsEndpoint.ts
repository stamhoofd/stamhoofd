import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Token, User } from '@stamhoofd/models';
import { OrganizationAdmins, User as UserStruct } from "@stamhoofd/structures";
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

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        if (!user.permissions || !user.permissions.hasFullAccess()) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang tot dit onderdeel"
            })
        }

        // Get all admins
        const admins = await User.where({ organizationId: user.organizationId, permissions: { sign: "!=", value: null }})

        return new Response(OrganizationAdmins.create({
            users: admins.map(a => UserStruct.create({...a, hasAccount: a.hasAccount()})),
        }));
    }
}
