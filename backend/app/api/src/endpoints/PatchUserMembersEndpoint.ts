import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { EncryptedMemberWithRegistrations, KeychainedMembers, KeychainedResponse, KeychainItem as KeychainItemStruct } from "@stamhoofd/structures";

import { KeychainItem } from '@stamhoofd/models';
import { Member } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
type Params = {};
type Query = undefined;
type Body = AutoEncoderPatchType<KeychainedMembers>
type ResponseBody = KeychainedResponse<EncryptedMemberWithRegistrations[]>

/**
 * Allow to add, patch and delete multiple members simultaneously, which is needed in order to sync relational data that is saved encrypted in multiple members (e.g. parents)
 */
export class PatchUserMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = KeychainedMembers.patchType() as Decoder<AutoEncoderPatchType<KeychainedMembers>>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/members", {});

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
        for (const put of request.body.members.getPuts()) {
            const struct = put.put

            const member = new Member()
            member.id = struct.id
            member.organizationId = user.organizationId
            member.firstName = struct.firstName
            member.encryptedDetails = struct.encryptedDetails

            await member.save()
            addedMembers.push(member)
        }

        if (addedMembers.length > 0) {
            // Give access to created members
            await Member.users.reverse("members").link(user, addedMembers)
        }

        // Modify members
        const members = await Member.getMembersWithRegistrationForUser(user)
        for (const struct of request.body.members.getPatches()) {
            const member = members.find((m) => m.id == struct.id)
            if (!member) {
                throw new SimpleError({
                    code: "invalid_member",
                    message: "This member does not exist or you don't have permissions to modify this member",
                    human: "Je probeert een lid aan te passen die niet (meer) bestaat. Er ging ergens iets mis."
                })
            }

            member.firstName = struct.firstName ?? member.firstName
            if (struct.encryptedDetails) {
                member.encryptedDetails = struct.encryptedDetails.applyTo(member.encryptedDetails)
            }
            await member.save();
        }

        const addedKeychainItems: KeychainItem[] = []

        // Create keychains (adjusting is not allowed atm)
        for (const put of request.body.keychainItems.getPuts()) {
            const keychainItem = put.put
            if (!members.find(m => m.encryptedDetails.find(k => k.publicKey === keychainItem.publicKey))) {
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
