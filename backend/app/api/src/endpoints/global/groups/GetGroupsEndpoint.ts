import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { Group, Organization } from '@stamhoofd/models';
import { GroupsWithOrganizations } from "@stamhoofd/structures";

import { AutoEncoder, Decoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { Formatter } from "@stamhoofd/utility";
import { StringArrayDecoder } from "../../../decoders/StringArrayDecoder";
import { AuthenticatedStructures } from "../../../helpers/AuthenticatedStructures";
import { Context } from "../../../helpers/Context";
import { SimpleError } from "@simonbackx/simple-errors";
type Params = Record<string, never>;

class Query extends AutoEncoder {
    @field({ decoder: new StringArrayDecoder(StringDecoder) })
    ids: string[]

    /**
     * List of organizations the requester already knows and doesn't need to be included in the response
     */
    @field({ decoder: new StringArrayDecoder(StringDecoder), optional: true })
    excludeOrganizationIds: string[] = []
}

type Body = undefined
type ResponseBody = GroupsWithOrganizations

/**
 * Get the members of the user
 */
export class GetGroupsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/groups", {});

        if (params) {
            return [true, params as Params];
        }

        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOptionalOrganizationScope();
        await Context.optionalAuthenticate()

        if (request.query.ids.length === 0) {
            return new Response(
                GroupsWithOrganizations.create({
                    groups: [],
                    organizations: []
                })
            );
        }

        if (request.query.ids.length > 100) {
            throw new SimpleError({
                code: "too_many_ids",
                message: "You can't request more than 100 groups at once"
            })
        }

        const groups = await Group.getByIDs(...request.query.ids)
        const organizationIds = Formatter.uniqueArray(groups.map(g => g.organizationId).filter(id => !request.query.excludeOrganizationIds.includes(id)));

        const organizations = organizationIds.length > 0 ? (await Organization.getByIDs(...organizationIds)) : [];
        
        return new Response(
            GroupsWithOrganizations.create({
                groups: await AuthenticatedStructures.groups(groups),
                organizations: await AuthenticatedStructures.organizations(organizations)
            })
        );
    }
}
