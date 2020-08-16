import { OneToManyRelation } from '@simonbackx/simple-database';
import {  ConvertArrayToPatchableArray,Decoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { EncryptedMemberWithRegistrations,EncryptedMemberWithRegistrationsPatch } from "@stamhoofd/structures";

import { Group } from '../models/Group';
import { Member, MemberWithRegistrations } from '../models/Member';
import { Registration, RegistrationWithPayment } from '../models/Registration';
import { Token } from '../models/Token';
type Params = {};
type Query = undefined;
type Body = ConvertArrayToPatchableArray<EncryptedMemberWithRegistrations[]>
type ResponseBody = EncryptedMemberWithRegistrations[]

/**
 * One endpoint to create, patch and delete members and their registrations and payments
 */

export class PatchOrganizationMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(EncryptedMemberWithRegistrations as any, EncryptedMemberWithRegistrationsPatch, StringDecoder) as any as Decoder<ConvertArrayToPatchableArray<EncryptedMemberWithRegistrations[]>>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/members", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        // If the user has permission, we'll also search if he has access to the organization's key
        if (!user.permissions) {
            throw new SimpleError({
                code: "permission_denied",
                message: "You don't have permissions to access this endpoint",
                human: "Je hebt geen toegang tot deze functie"
            })
        }

        const members: MemberWithRegistrations[] = []

        // Loop all members one by one
        for (const put of request.body.getPuts()) {
            const struct = put.put
            const member = new Member().setManyRelation(Member.registrations as any as OneToManyRelation<"registrations", Member, RegistrationWithPayment>, [])
            member.id = struct.id
            member.publicKey = struct.publicKey
            member.organizationId = user.organizationId
            member.encryptedForMember = struct.encryptedForMember
            member.encryptedForOrganization = struct.encryptedForOrganization
            member.firstName = struct.firstName

            // Created by organization = placeholder
            member.placeholder = struct.placeholder

            console.log(member)
            await member.save()

            members.push(member)

            // Add registrations
            for (const registrationStruct of struct.registrations) {
                const registration = new Registration().setOptionalRelation(Registration.payment, null)
                registration.groupId = registrationStruct.groupId
                registration.cycle = registrationStruct.cycle
                registration.memberId = member.id
                registration.registeredAt = registrationStruct.registeredAt
                registration.waitingList = registrationStruct.waitingList
                registration.canRegister = registrationStruct.canRegister
                registration.deactivatedAt = registrationStruct.deactivatedAt
                await registration.save()

                member.registrations.push(registration)
            }
        }

        const groups = await Group.where({organizationId: user.organization.id})

       // Loop all members one by one
        for (const patch of request.body.getPatches()) {
            const member = await Member.getWithRegistrations(patch.id)
            if (!member || member.organizationId != user.organizationId) {
                 throw new SimpleError({
                    code: "permission_denied",
                    message: "You don't have permissions to access this endpoint",
                    human: "Je hebt geen toegang om dit lid te wijzigen"
                })
            }

            // Check permissions (todo)

            member.encryptedForMember = patch.encryptedForMember ?? member.encryptedForMember
            member.encryptedForOrganization = patch.encryptedForOrganization ?? member.encryptedForOrganization
            member.firstName = patch.firstName ?? member.firstName
            member.publicKey = patch.publicKey ?? member.publicKey
            member.placeholder = patch.placeholder ?? member.placeholder
            await member.save();

            // Update registrations
            for (const patchRegistration of patch.registrations.getPatches()) {
                const registration = member.registrations.find(r => r.id === patchRegistration.id)
                if (!registration || registration.memberId != member.id) {
                    throw new SimpleError({
                        code: "permission_denied",
                        message: "You don't have permissions to access this endpoint",
                        human: "Je hebt geen toegang om deze registratie te wijzigen"
                    })
                }

                let group: Group | null = null

                if (patchRegistration.groupId) {
                    group = groups.find(g => g.id == patchRegistration.groupId) ?? null
                } else {
                    group = groups.find(g => g.id == registration.groupId) ?? null
                }

                if (!group) {
                    throw new SimpleError({
                        code: "invalid_field",
                        message: "Group doesn't exist",
                        human: "De groep naarwaar je dit lid wilt verplaatsen bestaat niet",
                        field: "groupId"
                    })
                }

                if (patchRegistration.cycle && patchRegistration.cycle > group.cycle) {
                    throw new SimpleError({
                        code: "invalid_field",
                        message: "Invalid cycle",
                        human: "Je kan een lid niet inschrijven voor een groep die nog moet starten",
                        field: "cycle"
                    })
                }

                // todo: allow group changes
                registration.waitingList = patchRegistration.waitingList ?? registration.waitingList
                registration.canRegister = patchRegistration.canRegister ?? registration.canRegister
                registration.cycle = patchRegistration.cycle ?? registration.cycle
                registration.groupId = patchRegistration.groupId ?? registration.groupId

                // Check if we should create a placeholder payment?
                await registration.save()
            }

            members.push(member)
        }

        // Loop all members one by one
        for (const id of request.body.getDeletes()) {
            const member = await Member.getByID(id)
            if (!member || member.organizationId != user.organizationId) {
                 throw new SimpleError({
                    code: "permission_denied",
                    message: "You don't have permissions to delete this member",
                    human: "Je hebt geen toegang om dit lid te verwijderen"
                })
            }

            await member.delete()
        }

        return new Response(members.map(m => m.getStructureWithRegistrations()));
    }

}
