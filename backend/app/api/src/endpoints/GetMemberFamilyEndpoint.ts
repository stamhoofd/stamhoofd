import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { EncryptedMemberWithRegistrations } from "@stamhoofd/structures";
import { Group } from "@stamhoofd/models";

import { Member } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
type Params = { id: string };
type Query = undefined
type Body = undefined
type ResponseBody = EncryptedMemberWithRegistrations[];

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class GetMemberFamilyEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/members/@id/family", { id: String});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        if (!user.permissions) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang tot deze groep"
            })
        }

        const groups = await Group.where({ organizationId: user.organizationId })
        const members = (await Member.getFamilyWithRegistrations(request.params.id))

        // You can access a family when you have access to one of the members
        let canAccess = true

        for (const member of members) {
            if (member.organizationId != user.organizationId ) {
                canAccess = false;
                break;
            }
        }

        if (!canAccess) {
            throw new SimpleError({
                code: "not_found",
                message: "No members found",
                human: "Geen leden gevonden, of je hebt geen toegang to deze leden"
            })
        }

        return new Response(members.filter(member => member.hasReadAccess(user, groups)).map(m => m.getStructureWithRegistrations()));
    }
}
