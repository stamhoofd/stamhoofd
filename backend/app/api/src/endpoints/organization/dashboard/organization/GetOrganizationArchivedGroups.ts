import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Group, Token } from '@stamhoofd/models';
import { Group as GroupStruct, GroupStatus } from "@stamhoofd/structures";

import { AuthenticatedStructures } from "../../../../helpers/AuthenticatedStructures";
import { Context } from "../../../../helpers/Context";
type Params = Record<string, never>;
type Query = undefined;
type Body = undefined
type ResponseBody = GroupStruct[]

export class GetOrganizationArchivedEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/archived-groups", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate()

        if (!Context.auth.canAccessArchivedGroups()) {
            throw Context.auth.error()
        }

        // Get all admins
        const groups = await Group.where({ organizationId: organization.id, status: GroupStatus.Archived, deletedAt: null })
        return new Response(groups.map(g => AuthenticatedStructures.group(g)));
    }
}
