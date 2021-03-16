import { Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { EncryptedMemberWithRegistrations, KeychainedResponse, KeychainItem as KeychainItemStruct, PatchMembers } from "@stamhoofd/structures";

import { KeychainItem } from '../models/KeychainItem';
import { Member } from '../models/Member';
import { Token } from '../models/Token';
type Params = {};
type Query = undefined;
type Body = PatchMembers
type ResponseBody = KeychainedResponse<EncryptedMemberWithRegistrations[]>;

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
            //member.publicKey = struct.publicKey
            member.organizationId = user.organizationId
            //member.encryptedForMember = struct.encryptedForMember
            //member.encryptedForOrganization = struct.encryptedForOrganization
            //member.organizationPublicKey = struct.organizationPublicKey ?? user.organization.publicKey
            member.firstName = struct.firstName

            await member.save()

            addedMembers.push(member)
            throw new Error("Wip: update data here")
        }

        if (addedMembers.length > 0) {
            // Give access to created members
            await Member.users.reverse("members").link(user, addedMembers)
        }

        // Modify members
        const members = await Member.getMembersWithRegistrationForUser(user)
        for (const struct of request.body.updateMembers) {
            const member = members.find((m) => m.id == struct.id)
            if (!member) {
                throw new SimpleError({
                    code: "invalid_member",
                    message: "This member does not exist or you don't have permissions to modify this member",
                    human: "Je probeert een lid aan te passen die niet (meer) bestaat. Er ging ergens iets mis."
                })
            }
            //member.encryptedForMember = struct.encryptedForMember
            //member.encryptedForOrganization = struct.encryptedForOrganization
            member.firstName = struct.firstName
            //member.publicKey = struct.publicKey
            //member.organizationPublicKey = struct.organizationPublicKey ?? user.organization.publicKey
            await member.save();

            throw new Error("Wip: update data here")
        }

        const addedKeychainItems: KeychainItem[] = []

        // Create keychains (adjusting is not allowed atm)
        for (const keychainItem of request.body.keychainItems) {
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
