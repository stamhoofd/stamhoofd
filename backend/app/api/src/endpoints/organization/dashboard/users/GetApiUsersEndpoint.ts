import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Token, User } from '@stamhoofd/models';
import { ApiUser } from "@stamhoofd/structures";

import { Context } from "../../../../helpers/Context";
type Params = Record<string, never>;
type Query = undefined;
type Body = undefined
type ResponseBody = ApiUser[]

export class GetOrganizationAdminsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/api-keys", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (!Context.auth.canManageAdmins()) {
            throw Context.auth.error()
        }

        // Get all admins
        const admins = await User.getApiUsers([organization.id])

        const mapped: ApiUser[] = []
        for (const admin of admins) {
            mapped.push(await admin.toApiUserStruct())
        }

        return new Response(
            mapped
        );
    }
}
