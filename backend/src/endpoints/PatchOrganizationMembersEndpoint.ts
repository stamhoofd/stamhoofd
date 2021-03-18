import { OneToManyRelation } from '@simonbackx/simple-database';
import {  ConvertArrayToPatchableArray,Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { EncryptedMemberWithRegistrations,EncryptedMemberWithRegistrationsPatch, PaymentMethod, PaymentStatus, User as UserStruct, Registration as RegistrationStruct, getPermissionLevelNumber, PermissionLevel } from "@stamhoofd/structures";

import { EncryptedMemberFactory } from '../factories/EncryptedMemberFactory';
import { Group } from '../models/Group';
import { Member, MemberWithRegistrations } from '../models/Member';
import { Organization } from '../models/Organization';
import { Payment } from '../models/Payment';
import { Registration, RegistrationWithPayment } from '../models/Registration';
import { Token } from '../models/Token';
import { User } from '../models/User';
type Params = {};
type Query = undefined;
type Body = PatchableArrayAutoEncoder<EncryptedMemberWithRegistrations>
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
        const groups = await Group.where({organizationId: user.organization.id})

        // Loop all members one by one
        for (const put of request.body.getPuts()) {
            const struct = put.put
            const member = new Member().setManyRelation(Member.registrations as any as OneToManyRelation<"registrations", Member, RegistrationWithPayment>, []).setManyRelation(Member.users, [])
            member.id = struct.id
            member.organizationId = user.organizationId
            member.encryptedDetails = struct.encryptedDetails
            member.firstName = struct.firstName

            for (const registrationStruct of struct.registrations) {
                const group = groups.find(g => g.id === registrationStruct.groupId)
                if (!group) {
                    throw new SimpleError({
                        code: "invalid_group",
                        message: "Invalid group",
                        human: "De groep waar je dit lid wilt toevoegen bestaat niet (meer)",
                        statusCode: 404
                    })
                }
                if (getPermissionLevelNumber(group.privateSettings.permissions.getPermissionLevel(user.permissions)) < getPermissionLevelNumber(PermissionLevel.Write)) {
                    throw new SimpleError({
                        code: "permission_denied",
                        message: "No permissions to create member in this group",
                        human: "Je hebt niet voldoende rechten om leden toe te voegen in deze groep",
                        statusCode: 403
                    })
                }   
            }


            /**
             * In development mode, we allow some secret usernames to create fake data
             */
            if (process.env.NODE_ENV == "development") {
                if (member.firstName == "create" || member.firstName == "Create") {
                    let group = groups[0];

                    for (const registrationStruct of struct.registrations) {
                        const g = groups.find(g => g.id === registrationStruct.groupId)
                        if (g) {
                            group = g
                        }
                    }

                    await this.createDummyMembers(user.organization, group)

                    // Skip creating this member
                    continue;
                }

                if (member.firstName == "clear" || member.firstName == "Clear") {
                    let group = groups[0];

                    for (const registrationStruct of struct.registrations) {
                        const g = groups.find(g => g.id === registrationStruct.groupId)
                        if (g) {
                            group = g
                        }
                    }

                    // Delete all members of this group
                    const groupMembers = await group.getMembersWithRegistration()

                    for (const m of groupMembers) {
                        await User.deleteForDeletedMember(m.id)
                        await m.delete()
                    }
            
                    continue;
                }
            }

            await member.save()
            members.push(member)

            // Add registrations
            for (const registrationStruct of struct.registrations) {
                await this.addRegistration(member, registrationStruct)
            }

            // Add users if they don't exist (only placeholders allowed)
            for (const placeholder of struct.users) {
                await this.linkUser(placeholder, member)
            }
        }

        // Loop all members one by one
        for (const patch of request.body.getPatches()) {
            const member = members.find(m => m.id === patch.id) ?? await Member.getWithRegistrations(patch.id)
            if (!member || member.organizationId != user.organizationId) {
                 throw new SimpleError({
                    code: "permission_denied",
                    message: "You don't have permissions to access this endpoint",
                    human: "Je hebt geen toegang om dit lid te wijzigen"
                })
            }

            if (!await member.hasWriteAccess(user, groups, false, true)) {
                throw new SimpleError({
                    code: "permission_denied",
                    message: "No permissions to edit members in this group",
                    human: "Je hebt niet voldoende rechten om dit lid te wijzigen",
                    statusCode: 403
                })
            }
            
            member.firstName = patch.firstName ?? member.firstName
            if (patch.encryptedDetails) {
                member.encryptedDetails = patch.encryptedDetails.applyTo(member.encryptedDetails)
            }
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

                if (!registration.waitingList && registration.registeredAt === null) {
                    registration.registeredAt = new Date()
                }
                registration.canRegister = patchRegistration.canRegister ?? registration.canRegister
                if (!registration.waitingList) {
                    registration.canRegister = false
                }
                registration.cycle = patchRegistration.cycle ?? registration.cycle
                registration.groupId = patchRegistration.groupId ?? registration.groupId

                // Check if we should create a placeholder payment?
                await registration.save()
            }

            for (const deleteId of patch.registrations.getDeletes()) {
                const registration = member.registrations.find(r => r.id === deleteId)
                if (!registration || registration.memberId != member.id) {
                    throw new SimpleError({
                        code: "permission_denied",
                        message: "You don't have permissions to access this endpoint",
                        human: "Je hebt geen toegang om deze registratie te wijzigen"
                    })
                }
                await registration.delete()
                member.registrations = member.registrations.filter(r => r.id !== deleteId)
            }

            // Add registrations
            for (const registrationStruct of patch.registrations.getPuts()) {
                await this.addRegistration(member, registrationStruct.put)
            }

            // Link users
            for (const placeholder of patch.users.getPuts()) {
                await this.linkUser(placeholder.put, member)
            }

            // Unlink users
            for (const userId of patch.users.getDeletes()) {
                await this.unlinkUser(userId, member)
            }

            if (!members.find(m => m.id === member.id)) {
                members.push(member)
            }
        }

        // Loop all members one by one
        for (const id of request.body.getDeletes()) {
            const member = await Member.getWithRegistrations(id)
            if (!member || member.organizationId != user.organizationId) {
                 throw new SimpleError({
                    code: "permission_denied",
                    message: "You don't have permissions to delete this member",
                    human: "Je hebt geen toegang om dit lid te verwijderen"
                })
            }

            if (!await member.hasWriteAccess(user, groups, true, false)) {
                throw new SimpleError({
                    code: "permission_denied",
                    message: "No permissions to edit members in this group",
                    human: "Je hebt niet voldoende rechten om dit lid te verwijderen",
                    statusCode: 403
                })
            }     

            await User.deleteForDeletedMember(member.id)
            await member.delete()
        }

        return new Response(members.map(m => m.getStructureWithRegistrations()));
    }

    async addRegistration(member: Member & Record<"registrations", RegistrationWithPayment[]> & Record<"users", User[]>, registrationStruct: RegistrationStruct) {
        const registration = new Registration().setOptionalRelation(Registration.payment, null)
        registration.groupId = registrationStruct.groupId
        registration.cycle = registrationStruct.cycle
        registration.memberId = member.id
        registration.registeredAt = registrationStruct.registeredAt
        registration.waitingList = registrationStruct.waitingList

        if (registration.waitingList) {
            registration.registeredAt = null
        }
        registration.canRegister = registrationStruct.canRegister

        if (!registration.waitingList) {
            registration.canRegister = false
        }
        registration.deactivatedAt = registrationStruct.deactivatedAt
        
        // Check payment
        if (registrationStruct.payment) {
            const payment = new Payment()
            payment.method = registrationStruct.payment.method
            payment.paidAt = registrationStruct.payment.paidAt
            payment.price = registrationStruct.payment.price
            payment.status = registrationStruct.payment.status
            payment.transferDescription = registrationStruct.payment.transferDescription
            await payment.save()

            registration.setOptionalRelation(Registration.payment, payment)
        }

        await registration.save()
        member.registrations.push(registration)
    }

    async createDummyMembers(organization: Organization, group: Group) {
        const m = await new EncryptedMemberFactory({ 
            organization,
            minAge: group.settings.minAge ?? undefined,
            maxAge: group.settings.maxAge ?? undefined
        }).createMultiple(25)
        for (const [enc, keychain] of m) {
            const member = new Member().setManyRelation(Member.registrations as unknown as OneToManyRelation<"registrations", Member, RegistrationWithPayment>, []).setManyRelation(Member.users, [])
            Object.assign(member, enc)
            member.organizationId = organization.id

            // if debug enabled: save them
            await member.save()

            const d = new Date(new Date().getTime() - Math.random() * 60 * 1000 * 60 * 24 * 60)

            const payment = new Payment()
            payment.method = Math.random() < 0.3 ? PaymentMethod.Payconiq : (Math.random()  < 0.5 ? PaymentMethod.Bancontact : PaymentMethod.Transfer )
            if (payment.method == PaymentMethod.Transfer) {
                payment.transferDescription = Payment.generateDescription(organization.meta.transferSettings, "")

                if (payment.method == PaymentMethod.Transfer && Math.random() < 0.6) {
                    payment.status = PaymentStatus.Succeeded
                    payment.paidAt = d
                } else {
                    payment.status = PaymentStatus.Pending
                }
            } else {
                payment.status = PaymentStatus.Succeeded
                payment.paidAt = d
            }

            payment.price = group.settings.getGroupPrices(d)?.getPriceFor(false, 0) ?? 0
            await payment.save()

            // Create a registration for this member for thisg roup
            const registration = new Registration().setRelation(Registration.payment, payment)
            registration.memberId = member.id
            registration.groupId = group.id
            registration.cycle = group.cycle
            registration.paymentId = payment.id
            registration.registeredAt = d

            member.registrations.push(registration)
            await registration.save()

            // Create fake users
        }
    }

    async linkUser(user: UserStruct, member: MemberWithRegistrations) {
        const email = user.email
        const existing = await User.where({ organizationId: member.organizationId, email }, { limit: 1 })
        let u: User
        if (existing.length == 1) {
            u = existing[0]
            console.log("Giving an existing user access to a member: "+u.id)

            // todo: read firstname and lastname if public key is not yet set (use a method instead of chekcign public key directly)

        } else {
            u = new User()
            u.organizationId = member.organizationId
            u.email = email
            u.firstName = user.firstName
            u.lastName = user.lastName
            await u.save()

            console.log("Created new (placeholder) user that has access to a member: "+u.id)
        }
        
        // User already exists: give him acecss

        if (u.publicKey) {
            // TODO Create keychains (since we have a public key)
            // need frontend for this!
        }

        await Member.users.reverse("members").link(u, [member])

        // Update model relation to correct response
        member.users.push(u)

    }

    async unlinkUser(userId: string, member: MemberWithRegistrations) {
        console.log("Removing access for "+ userId +" to member "+member.id)
        const existingIndex = member.users.findIndex(u => u.id === userId)
        if (existingIndex === -1) {
            throw new SimpleError({
                code: "user_not_found",
                message: "Unlinking a user that doesn't exists anymore",
                human: "Je probeert de toegang van een account tot een lid te verwijderen, maar dat account bestaat niet (meer)"
            })
        }
        const existing = member.users[existingIndex]
        await Member.users.reverse("members").unlink(existing, member)

        // Update model relation to correct response
        member.users.splice(existingIndex, 1)
    }
}
