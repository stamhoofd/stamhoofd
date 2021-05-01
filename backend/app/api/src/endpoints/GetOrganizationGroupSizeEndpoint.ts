import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { GroupSizeResponse } from "@stamhoofd/structures";

import { Group } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
type Params = { id: string };
type Query = undefined;
type Body = undefined
type ResponseBody = GroupSizeResponse

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class GetOrganizationGroupSizeEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/groups/@id/size", { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

       const groups = await Group.where({ id: request.params.id, organizationId: user.organizationId}, { limit: 1})
        if (groups.length != 1) {
            throw new SimpleError({
                code: "group_not_found",
                message: "De groep die je opvraagt bestaat niet (meer)"
            })
        }

        const group = groups[0]
        const members = await group.getMembersWithRegistration(false)

        return new Response(GroupSizeResponse.create({
            occupied: members.length,
            maximum: group.settings.maxMembers ?? 0
        }));
    }
}
