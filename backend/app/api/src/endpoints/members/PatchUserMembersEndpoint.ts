import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { KeychainItem } from '@stamhoofd/models';
import { Member } from '@stamhoofd/models';
import { Token } from '@stamhoofd/models';
import { EncryptedMemberWithRegistrations, KeychainedMembers, KeychainedResponse, KeychainItem as KeychainItemStruct, MemberDetails } from "@stamhoofd/structures";
type Params = Record<string, never>;
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
            member.details = struct.nonEncryptedDetails

            if (!struct.nonEncryptedDetails) {
                throw new SimpleError({
                    code: "invalid_data",
                    message: "No nonEncryptedDetails provided",
                    human: "Opgelet! Je gebruikt een oudere versie van de inschrijvinsgpagina die niet langer wordt ondersteund. Herlaad de website grondig en wis je browser cache.",
                    field: "nonEncryptedDetails"
                })
            }

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
            if (struct.nonEncryptedDetails) {
                if (member.details) {
                    member.details.patchOrPut(struct.nonEncryptedDetails)
                } else {
                    member.details = MemberDetails.create({})
                    member.details.patchOrPut(struct.nonEncryptedDetails)
                }
                if (!member.details.isRecovered) {
                    member.encryptedDetails = []
                }
            }

            if (!member.details) {
                throw new SimpleError({
                    code: "invalid_data",
                    message: "No nonEncryptedDetails provided",
                    human: "Opgelet! Je gebruikt een oudere versie van de inschrijvinsgpagina die niet langer wordt ondersteund. Herlaad de website grondig en wis je browser cache.",
                    field: "nonEncryptedDetails"
                })
            }
            await member.save();
        }

        return new Response(new KeychainedResponse({
            data: members.map(m => m.getStructureWithRegistrations()),
            keychainItems: []
        }));
    }
}
