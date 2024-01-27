import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from '@simonbackx/simple-errors';
import { Document, Member, Token } from '@stamhoofd/models';
import { EncryptedMemberWithRegistrations, KeychainedMembers, KeychainedResponse, User as UserStruct } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';

import { PatchOrganizationMembersEndpoint } from './manage/PatchOrganizationMembersEndpoint';
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

    static async checkDuplicate(member: Member) {
        if (!member.details.birthDay) {
            return
        }
        const existingMembers = await Member.where({ organizationId: member.organizationId, firstName: member.details.firstName, lastName: member.details.lastName, birthDay: Formatter.dateIso(member.details.birthDay) });
        
        if (existingMembers.length > 0) {
            const withRegistrations = await Member.getAllWithRegistrations(...existingMembers.map(m => m.id))
            for (const member of withRegistrations) {
                if (member.registrations.length > 0) {
                    return member
                }
            }

            if (withRegistrations.length > 0) {
                return withRegistrations[0]
            }
        }
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        // TODO: process everything and throw combined errors

        // Process changes
        const addedMembers: Member[] = []
        for (const put of request.body.members.getPuts()) {
            const struct = put.put

            const member = new Member()
            member.id = struct.id
            member.organizationId = user.organizationId

            struct.details.cleanData()
            member.details = struct.details

            if (!struct.details) {
                throw new SimpleError({
                    code: "invalid_data",
                    message: "No details provided",
                    human: "Opgelet! Je gebruikt een oudere versie van de inschrijvingspagina die niet langer wordt ondersteund. Herlaad de website grondig en wis je browser cache.",
                    field: "details"
                })
            }

            // Check for duplicates and prevent creating a duplicate member by a user
            const duplicate = await PatchUserMembersEndpoint.checkDuplicate(member);
            if (duplicate) {
                // Merge data
                duplicate.details.merge(member.details)
                await duplicate.save()
                addedMembers.push(duplicate)
                continue;
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

            if (struct.details) {
                member.details.patchOrPut(struct.details)
                member.details.cleanData()
            }

            if (!member.details) {
                throw new SimpleError({
                    code: "invalid_data",
                    message: "No details provided",
                    human: "Opgelet! Je gebruikt een oudere versie van de inschrijvingspagina die niet langer wordt ondersteund. Herlaad de website grondig en wis je browser cache.",
                    field: "details"
                })
            }
            await member.save();

            // Check accounts
            const managers = member.details.getManagerEmails()

            for(const email of managers) {
                const u = member.users.find(u => u.email.toLocaleLowerCase() === email.toLocaleLowerCase())
                if (!u) {
                    console.log("Linking user "+email+" to member "+member.id + " from patch by " + user.id)
                    await PatchOrganizationMembersEndpoint.linkUser(UserStruct.create({
                        firstName: member.details.parents.find(p => p.email === email)?.firstName,
                        lastName: member.details.parents.find(p => p.email === email)?.lastName,
                        email,
                    }), member)
                }
            }

            // Delete accounts that should no longer have access
            for (const u of member.users) {
                if (!u.hasAccount()) {
                    // And not in managers list (case insensitive)
                    if (!managers.find(m => m.toLocaleLowerCase() === u.email.toLocaleLowerCase())) {
                        console.log("Unlinking user "+u.email+" from member "+member.id + " from patch by " + user.id)
                        await PatchOrganizationMembersEndpoint.unlinkUser(u.id, member)
                    }
                }
            }

            // Update documents
            await Document.updateForMember(member.id)
        }

        return new Response(new KeychainedResponse({
            data: members.map(m => m.getStructureWithRegistrations()),
            keychainItems: []
        }));
    }
}
