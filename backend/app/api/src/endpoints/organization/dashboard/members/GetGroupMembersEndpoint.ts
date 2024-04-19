import { AutoEncoder, BooleanDecoder, Decoder, field, IntegerDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Group } from "@stamhoofd/models";
import { EncryptedMemberWithRegistrations, KeychainedResponse } from "@stamhoofd/structures";

import { Context } from '../../../../helpers/Context';

type Params = { id: string };
class Query extends AutoEncoder {
    @field({ decoder: BooleanDecoder, optional: true })
    waitingList = false

    @field({ decoder: IntegerDecoder, optional: true })
    cycleOffset = 0
}
type Body = undefined
type ResponseBody = KeychainedResponse<EncryptedMemberWithRegistrations[]>;

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class GetGroupMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/group/@id/members", { id: String});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        await Context.setOrganizationScope();
        await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (!Context.auth.hasSomeAccess()) {
            throw Context.auth.error()
        }  
        
        const group = await Group.getByID(request.params.id)
        if (!group || !Context.auth.canAccessGroup(group)) {
            throw Context.auth.notFoundOrNoAccess("De groep die je opvraagt bestaat niet (meer)")
        }

        const members = await group.getMembersWithRegistration(request.query.waitingList, request.query.cycleOffset)
        return new Response(new KeychainedResponse({ data: members.map(m => m.getStructureWithRegistrations(true)) }));
    }
}
