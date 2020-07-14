import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { EncryptedMember, KeychainedResponse, KeychainItem as KeychainItemStruct, PatchMembers } from "@stamhoofd/structures";

import { KeychainItem } from '../models/KeychainItem';
import { Member } from '../models/Member';
import { Token } from '../models/Token';
import { User } from '../models/User';
type Params = {};
type Query = undefined;
type Body = PatchMembers
type ResponseBody = KeychainedResponse<EncryptedMember[]>;

/**
 * Allow to add, patch and delete multiple members simultaneously, which is needed in order to sync relational data that is saved encrypted in multiple members (e.g. parents)
 */
export class PostUserMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = PatchMembers as Decoder<PatchMembers>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
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

        // todo: process everything and throw combined errors

        // Process changes
        const addedMembers: Member[] = []
        for (const struct of request.body.addMembers) {
            const member = new Member()
            member.id = struct.id
            member.publicKey = struct.publicKey
            member.organizationId = user.organizationId
            member.encryptedForMember = struct.encryptedForMember
            member.encryptedForOrganization = struct.encryptedForOrganization
            await member.save()

            addedMembers.push(member)
        }

        if (addedMembers.length > 0) {
            // Give access to created members
            await User.members.link(user, addedMembers)
        }

        // Modify members
        const members = await User.members.load(user)
        for (const struct of request.body.updateMembers) {
            const member = members.find((m) => m.id == struct.id)
            if (!member) {
                throw new SimpleError({
                    code: "invalid_member",
                    message: "This member does not exist or you don't have permissions to modify this member",
                    human: "Je probeert een lid aan te passen die niet (meer) bestaat. Er ging ergens iets mis."
                })
            }
        }

        const addedKeychainItems: KeychainItem[] = []

        // Create keychains (adjusting is not allowed atm)
        for (const keychainItem of request.body.keychainItems) {
            if (!members.find(m => m.publicKey == keychainItem.publicKey)) {
                throw new SimpleError({
                    code: "invalid_public_key",
                    message: "Could not find the member for which you are trying to create a keychain item",
                    field: "keychainItems"
                })
            }
            const model = new KeychainItem()
            addedKeychainItems.push(model)

            model.encryptedPrivateKey = keychainItem.encryptedPrivateKey
            model.userId = user.id
            model.publicKey = keychainItem.publicKey

            await model.save()
        }
        
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
