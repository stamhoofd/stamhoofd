import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { Member } from '@stamhoofd/models';
import { EncryptedMemberWithRegistrations, KeychainedResponse } from "@stamhoofd/structures";

import { Context } from "../../../helpers/Context";
type Params = Record<string, never>;
type Query = undefined;
type Body = undefined
type ResponseBody = KeychainedResponse<EncryptedMemberWithRegistrations[]>;

/**
 * Get the members of the user
 */
export class GetUserMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/members", {});

        if (params) {
            return [true, params as Params];
        }

        return [false];
    }

    async handle(_: DecodedRequest<Params, Query, Body>) {
        await Context.setOrganizationScope();
        const {user} = await Context.authenticate()

        const members = await Member.getMembersWithRegistrationForUser(user)
        
        return new Response(new KeychainedResponse({
            data: members.map(m => m.getStructureWithRegistrations()),
        }));
    }
}
