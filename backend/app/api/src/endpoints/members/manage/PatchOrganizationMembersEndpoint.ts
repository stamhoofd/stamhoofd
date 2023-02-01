import { OneToManyRelation } from '@simonbackx/simple-database';
import { ConvertArrayToPatchableArray, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { BalanceItem, BalanceItemPayment, Document, Group, Member, MemberFactory, MemberWithRegistrations, Organization, Payment, Registration, Token, User } from '@stamhoofd/models';
import { BalanceItemStatus, EncryptedMemberWithRegistrations, getPermissionLevelNumber, PaymentMethod, PaymentStatus, PermissionLevel, Registration as RegistrationStruct, User as UserStruct } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';
type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<EncryptedMemberWithRegistrations>
type ResponseBody = EncryptedMemberWithRegistrations[]

/**
 * One endpoint to create, patch and delete members and their registrations and payments
 */

export class PatchOrganizationMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(EncryptedMemberWithRegistrations as any, EncryptedMemberWithRegistrations.patchType(), StringDecoder) as any as Decoder<ConvertArrayToPatchableArray<EncryptedMemberWithRegistrations[]>>

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
        const groups = await Group.getAll(user.organizationId)
        const updateGroups = new Map<string, Group>()

        const balanceItemMemberIds: string[] = []
        const balanceItemRegistrationIds: string[] = []

        // Loop all members one by one
        for (const put of request.body.getPuts()) {
            const struct = put.put
            const member = new Member().setManyRelation(Member.registrations as any as OneToManyRelation<"registrations", Member, Registration>, []).setManyRelation(Member.users, [])
            member.id = struct.id
            member.organizationId = user.organizationId
            member.details = struct.details

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

                // Update occupancy at the end of the call
                updateGroups.set(group.id, group)
            }


            /**
             * In development mode, we allow some secret usernames to create fake data
             */
            if (STAMHOOFD.environment == "development" || STAMHOOFD.environment == "staging") {
                if (member.details.firstName == "create" && parseInt(member.details.lastName) > 0) {
                    const count = parseInt(member.details.lastName);
                    let group = groups[0];

                    for (const registrationStruct of struct.registrations) {
                        const g = groups.find(g => g.id === registrationStruct.groupId)
                        if (g) {
                            group = g
                        }
                    }

                    await this.createDummyMembers(user.organization, group, count)

                    // Skip creating this member
                    continue;
                }

                if (member.details.firstName == "clear" || member.details.firstName == "Clear") {
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
            balanceItemMemberIds.push(member.id)

            // Add registrations
            for (const registrationStruct of struct.registrations) {
                const reg = await this.addRegistration(user, member, registrationStruct, groups)
                balanceItemRegistrationIds.push(reg.id)
            }

            // Add users if they don't exist (only placeholders allowed)
            for (const placeholder of struct.users) {
                await PatchOrganizationMembersEndpoint.linkUser(placeholder, member)
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
            
            if (patch.details) {
                member.details.patchOrPut(patch.details)
            }
            
            await member.save();

            // Update documents
            await Document.updateForMember(member.id)

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
                    if (group) {
                        // We need to update group occupancy because we moved a member to it
                        updateGroups.set(group.id, group)
                    }
                    const oldGroup = groups.find(g => g.id == registration.groupId) ?? null
                    if (oldGroup) {
                        // We need to update this group occupancy because we moved one member away from it
                        updateGroups.set(oldGroup.id, oldGroup)
                    }
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

                // TODO: allow group changes
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

                if (patchRegistration.cycle !== undefined || patchRegistration.waitingList !== undefined || patchRegistration.canRegister !== undefined) {
                    // We need to update occupancy (because cycle / waitlist change)
                    updateGroups.set(group.id, group)
                }

                if (patchRegistration.price) {
                    const group = groups.find(g => g.id === registration.groupId)
                    // Create balance item
                    const balanceItem = new BalanceItem();
                    balanceItem.registrationId = registration.id;
                    balanceItem.price = patchRegistration.price
                    balanceItem.description = group ? `Inschrijving ${group.settings.name}` : `Inschrijving`
                    balanceItem.pricePaid = patchRegistration.pricePaid ?? 0
                    balanceItem.memberId = registration.memberId;
                    balanceItem.userId = member.users[0]?.id ?? null
                    balanceItem.organizationId = member.organizationId
                    balanceItem.status = BalanceItemStatus.Pending;
                    await balanceItem.save();

                    balanceItemRegistrationIds.push(registration.id)
                    balanceItemMemberIds.push(member.id)

                    if (balanceItem.pricePaid > 0) {
                        // Create an Unknown payment and attach it to the balance item
                        const payment = new Payment();
                        payment.userId = member.users[0]?.id ?? null
                        payment.organizationId = user.organizationId
                        payment.method = PaymentMethod.Unknown
                        payment.status = PaymentStatus.Succeeded
                        payment.price = balanceItem.pricePaid;
                        payment.paidAt = new Date()
                        payment.provider = null
                        await payment.save()

                        const balanceItemPayment = new BalanceItemPayment()
                        balanceItemPayment.balanceItemId = balanceItem.id;
                        balanceItemPayment.paymentId = payment.id;
                        balanceItemPayment.organizationId = user.organizationId;
                        balanceItemPayment.price = payment.price;
                        await balanceItemPayment.save();
                    }
                }

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
                balanceItemMemberIds.push(member.id)                
                await BalanceItem.deleteForDeletedRegistration(registration.id)
                await registration.delete()
                member.registrations = member.registrations.filter(r => r.id !== deleteId)

                const oldGroup = groups.find(g => g.id == registration.groupId) ?? null
                if (oldGroup) {
                    // We need to update this group occupancy because we moved one member away from it
                    updateGroups.set(oldGroup.id, oldGroup)
                }
            }

            // Add registrations
            for (const registrationStruct of patch.registrations.getPuts()) {
                const struct = registrationStruct.put
                const group = groups.find(g => g.id === struct.groupId)
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

                const reg = await this.addRegistration(user, member, struct, groups)
                balanceItemMemberIds.push(member.id)
                balanceItemRegistrationIds.push(reg.id)

                // We need to update this group occupancy because we moved one member away from it
                updateGroups.set(group.id, group)
            }

            // Link users
            for (const placeholder of patch.users.getPuts()) {
                await PatchOrganizationMembersEndpoint.linkUser(placeholder.put, member)
            }

            // Unlink users
            for (const userId of patch.users.getDeletes()) {
                await PatchOrganizationMembersEndpoint.unlinkUser(userId, member)
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
            await BalanceItem.deleteForDeletedMember(member.id)
            await member.delete()

            // Update occupancy of this member because we removed registrations
            const groupIds = member.registrations.flatMap(r => r.groupId)
            for (const id of groupIds) {
                const group = groups.find(g => g.id == id) ?? null
                if (group) {
                    // We need to update this group occupancy because we moved one member away from it
                    updateGroups.set(group.id, group)
                }
            }
        }

        await Member.updateOutstandingBalance(Formatter.uniqueArray(balanceItemMemberIds))
        await Registration.updateOutstandingBalance(Formatter.uniqueArray(balanceItemRegistrationIds), user.organizationId)
        
        // Loop all groups and update occupancy if needed
        for (const group of updateGroups.values()) {
            await group.updateOccupancy()
            await group.save()
        }
        
        // We need to refetch the outstanding amounts of members that have changed
        const updatedMembers = balanceItemMemberIds.length > 0 ? await Member.getAllWithRegistrations(...balanceItemMemberIds) : []
        for (const member of updatedMembers) {
            const index = members.findIndex(m => m.id === member.id)
            if (index !== -1) {
                members[index] = member
            }
        }

        return new Response(members.map(m => m.getStructureWithRegistrations(true)));
    }

    async addRegistration(user: User, member: Member & Record<"registrations", Registration[]> & Record<"users", User[]>, registrationStruct: RegistrationStruct, groups: Group[]) {
        const registration = new Registration()
        registration.groupId = registrationStruct.groupId
        registration.cycle = registrationStruct.cycle
        registration.memberId = member.id
        registration.registeredAt = registrationStruct.registeredAt
        registration.waitingList = registrationStruct.waitingList
        registration.createdAt = registrationStruct.createdAt ?? new Date()

        if (registration.waitingList) {
            registration.registeredAt = null
        }
        registration.canRegister = registrationStruct.canRegister

        if (!registration.waitingList) {
            registration.canRegister = false
        }
        registration.deactivatedAt = registrationStruct.deactivatedAt

        await registration.save()
        member.registrations.push(registration)

        if (registrationStruct.price) {
            const group = groups.find(g => g.id === registration.groupId)
            // Create balance item
            const balanceItem = new BalanceItem();
            balanceItem.registrationId = registration.id;
            balanceItem.price = registrationStruct.price
            balanceItem.description = group ? `Inschrijving ${group.settings.name}` : `Inschrijving`
            balanceItem.pricePaid = registrationStruct.pricePaid ?? 0
            balanceItem.memberId = registration.memberId;
            balanceItem.userId = member.users[0]?.id ?? null
            balanceItem.organizationId = member.organizationId
            balanceItem.status = BalanceItemStatus.Pending;
            await balanceItem.save();

            if (balanceItem.pricePaid > 0) {
                // Create an Unknown payment and attach it to the balance item
                const payment = new Payment();
                payment.userId = member.users[0]?.id ?? null
                payment.organizationId = user.organizationId
                payment.method = PaymentMethod.Unknown
                payment.status = PaymentStatus.Succeeded
                payment.price = balanceItem.pricePaid;
                payment.paidAt = new Date()
                payment.provider = null
                await payment.save()

                const balanceItemPayment = new BalanceItemPayment()
                balanceItemPayment.balanceItemId = balanceItem.id;
                balanceItemPayment.paymentId = payment.id;
                balanceItemPayment.organizationId = user.organizationId;
                balanceItemPayment.price = payment.price;
                await balanceItemPayment.save();
            }
        }

        return registration
    }

    async createDummyMembers(organization: Organization, group: Group, count: number) {
        const members = await new MemberFactory({ 
            organization,
            minAge: group.settings.minAge ?? undefined,
            maxAge: group.settings.maxAge ?? undefined
        }).createMultiple(count)

        for (const m of members) {
            const member = m.setManyRelation(Member.registrations as unknown as OneToManyRelation<"registrations", Member, Registration>, []).setManyRelation(Member.users, [])
            const d = new Date(new Date().getTime() - Math.random() * 60 * 1000 * 60 * 24 * 60)

            // Create a registration for this member for thisg roup
            const registration = new Registration()
            registration.memberId = member.id
            registration.groupId = group.id
            registration.cycle = group.cycle
            registration.registeredAt = d

            member.registrations.push(registration)
            await registration.save()
        }
    }

    static async linkUser(user: UserStruct, member: MemberWithRegistrations) {
        const email = user.email
        const existing = await User.where({ organizationId: member.organizationId, email }, { limit: 1 })
        let u: User
        if (existing.length == 1) {
            u = existing[0]
            console.log("Giving an existing user access to a member: "+u.id)

            // TODO: read firstname and lastname if public key is not yet set (use a method instead of chekcign public key directly)

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

    static async unlinkUser(userId: string, member: MemberWithRegistrations) {
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
