import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { EncryptedMember, KeychainedResponse, KeychainItem as KeychainItemStruct } from "@stamhoofd/structures";

import { KeychainItem } from '../models/KeychainItem';
import { Token } from '../models/Token';
import { User } from '../models/User';
type Params = {};
type Query = undefined;
type Body = undefined
type ResponseBody = KeychainedResponse<EncryptedMember[]>;

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

        const members = await User.members.load(user)

        // Load the needed keychains the user has access to
        const keychainItems = await KeychainItem.where({ 
            userId: user.id,
            publicKey: {
                sign: "IN",
                value: members.map(m => m.publicKey)
            }
        })
        return new Response(new KeychainedResponse({
            data: members.map(m => EncryptedMember.create(m)),
            keychainItems: keychainItems.map(m => KeychainItemStruct.create(m))
        }));
    }
}
