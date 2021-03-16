import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { EncryptedMember, EncryptedMemberWithRegistrations, KeychainedResponse, KeychainItem as KeychainItemStruct, Payment, Registration } from "@stamhoofd/structures";

import { KeychainItem } from '../models/KeychainItem';
import { Member } from '../models/Member';
import { Token } from '../models/Token';
import { User } from '../models/User';
type Params = {};
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

        const params = Endpoint.parseParameters(request.url, "/user/members", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        const members = await Member.getMembersWithRegistrationForUser(user)
        if (members.length == 0) {
            return new Response(new KeychainedResponse({
                data: [],
                keychainItems: []
            }));
        }

        // Query all the keys needed
        const otherKeys: Set<string> = new Set();
        for (const member of members) {
            for (const details of member.encryptedDetails) {
                // Only keys for organization, because else this might be too big
                otherKeys.add(details.publicKey)
            }
        }

        // Load the needed keychains the user has access to
        if (otherKeys.size > 0) {
            const keychainItems = await KeychainItem.where({
                userId: user.id,
                publicKey: {
                    sign: "IN",
                    value: [...otherKeys.values()]
                }
            })
            return new Response(new KeychainedResponse({
                data: members.map(m => m.getStructureWithRegistrations()),
                keychainItems: keychainItems.map(m => KeychainItemStruct.create(m))
            }));
        }

        return new Response(new KeychainedResponse({
            data: members.map(m => m.getStructureWithRegistrations()),
            keychainItems: []
        }));
        
    }
}
