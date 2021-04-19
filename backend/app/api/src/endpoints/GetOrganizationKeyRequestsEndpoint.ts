import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { EncryptedMemberWithRegistrations } from "@stamhoofd/structures";

import { Member } from "../models/Member";
import { Token } from '../models/Token';
type Params = {};
type Query = undefined;
type Body = undefined
type ResponseBody = EncryptedMemberWithRegistrations[];

/**
 * Return a list of users and invites for the given organization with admin permissions
 */
export class GetOrganizationKeyRequestsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/key-requests", {});

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

       const members = (await Member.getMembersWithRegistrationForKeyRequests(user.organizationId))

        // Safety check
        let canAccess = true

        for (const member of members) {
            if (member.organizationId != user.organizationId ) {
                canAccess = false;
                break;
            }
        }

        if (!canAccess) {
            console.error("Requested key requets, but got members of a different organization for "+user.organizationId)
            throw new SimpleError({
                code: "not_found",
                message: "No members found",
                human: "Geen leden gevonden, of je hebt geen toegang to deze leden"
            })
        }

        return new Response(members.map(m => m.getStructureWithRegistrations()));
    }
}
