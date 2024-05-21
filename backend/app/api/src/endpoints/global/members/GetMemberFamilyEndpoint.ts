import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { Member, MemberWithRegistrations } from "@stamhoofd/models";

import { MembersBlob } from "@stamhoofd/structures";
import { AuthenticatedStructures } from "../../../helpers/AuthenticatedStructures";
import { Context } from "../../../helpers/Context";
type Params = { id: string };
type Query = undefined
type Body = undefined
type ResponseBody = MembersBlob

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
        const organization = await Context.setOptionalOrganizationScope();
        await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (organization) {
            if (!await Context.auth.hasSomeAccess(organization.id)) {
                throw Context.auth.error()
            }  
        } else {
            if (!Context.auth.hasSomePlatformAccess()) {
                throw Context.auth.error()
            }
        }

        const members = (await Member.getFamilyWithRegistrations(request.params.id))

        let foundMember = false

        const validatedMembers: MemberWithRegistrations[] = []

        for (const member of members) {
            if (member.id === request.params.id) {
                foundMember = true;

                // Check access to this member (this will automatically give access to the family)
                if (!await Context.auth.canAccessMember(member)) {
                    throw Context.auth.error("Je hebt geen toegang tot dit lid")
                }
                validatedMembers.push(member)
                continue;
            }
            if (await Context.auth.canAccessMember(member)) {
                // Remove from result
                validatedMembers.push(member)
            }
        }

        if (!foundMember) {
            throw Context.auth.error("Je hebt geen toegang tot dit lid")
        }

        return new Response(
            await AuthenticatedStructures.membersBlob(validatedMembers)
        );
    }
}
