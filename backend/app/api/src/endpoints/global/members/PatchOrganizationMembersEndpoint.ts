import { OneToManyRelation } from '@simonbackx/simple-database';
import { ConvertArrayToPatchableArray, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { BalanceItem, BalanceItemPayment, Document, Group, Member, MemberFactory, MemberPlatformMembership, MemberResponsibilityRecord, MemberWithRegistrations, Organization, Payment, Platform, Registration, RegistrationPeriod, User } from '@stamhoofd/models';
import { BalanceItemStatus, MemberWithRegistrationsBlob, MembersBlob, PaymentMethod, PaymentStatus, PermissionLevel, Registration as RegistrationStruct, User as UserStruct } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';

import { AuthenticatedStructures } from '../../../helpers/AuthenticatedStructures';
import { Context } from '../../../helpers/Context';
import { MemberUserSyncer } from '../../../helpers/MemberUserSyncer';

type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>
type ResponseBody = MembersBlob

/**
 * One endpoint to create, patch and delete members and their registrations and payments
 */

export class PatchOrganizationMembersEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    bodyDecoder = new PatchableArrayDecoder(MemberWithRegistrationsBlob as any, MemberWithRegistrationsBlob.patchType(), StringDecoder) as any as Decoder<ConvertArrayToPatchableArray<MemberWithRegistrationsBlob[]>>

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
        const organization = await Context.setOptionalOrganizationScope();
        await Context.authenticate()

        // Fast throw first (more in depth checking for patches later)
        if (organization) {
            if (!await Context.auth.hasSomeAccess(organization.id)) {
                throw Context.auth.error()
            } 
        } else {
            if (!Context.auth.hasSomePlatformAccess()) {
                throw Context.auth.error()
            } 
        }

        const members: MemberWithRegistrations[] = []

        const platform = await Platform.getShared()

        // Cache
        const groups: Group[] = []
        
        async function getGroup(id: string) {
            const f = groups.find(g => g.id === id)
            if (f) {
                return f
            }
            const group = await Group.getByID(id)
            if (group) {
                groups.push(group)
                return group
            }
            return null
        }
        const updateGroups = new Map<string, Group>()

        const balanceItemMemberIds: string[] = []
        const balanceItemRegistrationIdsPerOrganization: Map<string, string[]> = new Map()
        const updateMembershipMemberIds = new Set<string>()

        function addBalanceItemRegistrationId(organizationId: string, registrationId: string) {
            const existing = balanceItemRegistrationIdsPerOrganization.get(organizationId);
            if (existing) {
                existing.push(registrationId)
                return;
            }
            balanceItemRegistrationIdsPerOrganization.set(organizationId, [registrationId])
        }

        // Loop all members one by one
        for (const put of request.body.getPuts()) {
            const struct = put.put
            let member = new Member()
                .setManyRelation(Member.registrations as any as OneToManyRelation<"registrations", Member, Registration & {group: Group}>, [])
                .setManyRelation(Member.users, [])
            member.id = struct.id

            if (organization && STAMHOOFD.userMode !== 'platform') {
                member.organizationId = organization.id
            }

            struct.details.cleanData()
            member.details = struct.details

            const duplicate = await PatchOrganizationMembersEndpoint.checkDuplicate(member);
            if (duplicate) {
                // Merge data
                duplicate.details.merge(member.details)
                member = duplicate

                // Only save after checking permissions
            }

            if (struct.registrations.length === 0) {
                 throw new SimpleError({
                    code: "missing_group",
                    message: "Missing group",
                    human: "Schrijf een nieuw lid altijd in voor minstens één groep",
                    statusCode: 400
                })
            }

            // Throw early
            for (const registrationStruct of struct.registrations) {
                const group = await getGroup(registrationStruct.groupId)
                if (!group || group.organizationId !== registrationStruct.organizationId || !await Context.auth.canAccessGroup(group, PermissionLevel.Write)) {
                    throw Context.auth.notFoundOrNoAccess("Je hebt niet voldoende rechten om leden toe te voegen in deze groep")
                }

                const period = await RegistrationPeriod.getByID(group.periodId)
                if (!period || period.locked) {
                    throw new SimpleError({
                        code: "period_locked",
                        message: "Deze inschrijvingsperiode is afgesloten en staat geen wijzigingen meer toe.",
                    })
                }

                // Set organization id of member based on registrations
                if (!organization && STAMHOOFD.userMode !== 'platform' && !member.organizationId) {
                    member.organizationId = group.organizationId
                }
            }

            if (STAMHOOFD.userMode !== 'platform' && !member.organizationId) {
                throw new SimpleError({
                    code: "missing_organization",
                    message: "Missing organization",
                    human: "Je moet een organisatie selecteren voor dit lid",
                    statusCode: 400
                })
            }

            /**
             * In development mode, we allow some secret usernames to create fake data
             */
            if ((STAMHOOFD.environment == "development" || STAMHOOFD.environment == "staging") && organization) {
                if (member.details.firstName.toLocaleLowerCase() == "create" && parseInt(member.details.lastName) > 0) {
                    const count = parseInt(member.details.lastName);
                    let group = groups[0];

                    for (const registrationStruct of struct.registrations) {
                        const g = await getGroup(registrationStruct.groupId)
                        if (g) {
                            group = g
                        }
                    }

                    await this.createDummyMembers(organization, group, count)

                    // Skip creating this member
                    continue;
                }
            }

            await member.save()
            members.push(member)
            balanceItemMemberIds.push(member.id)
            updateMembershipMemberIds.add(member.id)

            // Add registrations
            for (const registrationStruct of struct.registrations) {
                const group = await getGroup(registrationStruct.groupId)
                if (!group || group.organizationId !== registrationStruct.organizationId || !await Context.auth.canAccessGroup(group, PermissionLevel.Write)) {
                    throw Context.auth.notFoundOrNoAccess("Je hebt niet voldoende rechten om leden toe te voegen in deze groep")
                }

                const reg = await this.addRegistration(member, registrationStruct, group)
                addBalanceItemRegistrationId(reg.organizationId, reg.id)

                // Update occupancy at the end of the call
                updateGroups.set(group.id, group)
            }

            // Auto link users based on data
            await MemberUserSyncer.onChangeMember(member)
        }

        // Loop all members one by one
        for (let patch of request.body.getPatches()) {
            const member = members.find(m => m.id === patch.id) ?? await Member.getWithRegistrations(patch.id)
            if (!member || !await Context.auth.canAccessMember(member, PermissionLevel.Write)) {
                throw Context.auth.notFoundOrNoAccess("Je hebt geen toegang tot dit lid of het bestaat niet")
            }
            patch = await Context.auth.filterMemberPatch(member, patch)

            if (patch.details) {
                if (patch.details.isPut()) {
                    throw new SimpleError({
                        code: "not_allowed",
                        message: "Cannot override details",
                        human: "Er ging iets mis bij het aanpassen van de gegevens van dit lid. Probeer het later opnieuw en neem contact op als het probleem zich blijft voordoen.",
                        field: "details"
                    })
                }
                
                member.details.patchOrPut(patch.details)
                member.details.cleanData()
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

                console.log('Patch registration', patchRegistration)

                if (patchRegistration.group) {
                    patchRegistration.groupId = patchRegistration.group.id
                }

                if (patchRegistration.groupId) {
                    group = await getGroup(patchRegistration.groupId)
                    if (group) {
                        // We need to update group occupancy because we moved a member to it
                        updateGroups.set(group.id, group)
                    }
                    const oldGroup = await getGroup(registration.groupId)
                    if (oldGroup) {
                        // We need to update this group occupancy because we moved one member away from it
                        updateGroups.set(oldGroup.id, oldGroup)
                    }
                } else {
                    group = await getGroup(registration.groupId)
                }

                if (!group || group.organizationId !== (patchRegistration.organizationId ?? registration.organizationId)) {
                    throw new SimpleError({
                        code: "invalid_field",
                        message: "Group doesn't exist",
                        human: "De groep naarwaar je dit lid wilt verplaatsen bestaat niet",
                        field: "groupId"
                    })
                }

                if (!await Context.auth.canAccessGroup(group, PermissionLevel.Write)) {
                    throw Context.auth.error("Je hebt niet voldoende rechten om leden te verplaatsen naar deze groep")
                }

                if (patchRegistration.cycle && patchRegistration.cycle > group.cycle) {
                    throw new SimpleError({
                        code: "invalid_field",
                        message: "Invalid cycle",
                        human: "Je kan een lid niet inschrijven voor een groep die nog moet starten",
                        field: "cycle"
                    })
                }

                const period = await RegistrationPeriod.getByID(group.periodId)
                if (!period || period.locked) {
                    throw new SimpleError({
                        code: "period_locked",
                        message: "Deze inschrijvingsperiode is afgesloten en staat geen wijzigingen meer toe.",
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
                registration.group = group
                registration.organizationId = patchRegistration.organizationId ?? registration.organizationId

                // Check if we should create a placeholder payment?

                if (patchRegistration.cycle !== undefined || patchRegistration.waitingList !== undefined || patchRegistration.canRegister !== undefined) {
                    // We need to update occupancy (because cycle / waitlist change)
                    updateGroups.set(group.id, group)
                }

                if (patchRegistration.price) {
                    // Create balance item
                    const balanceItem = new BalanceItem();
                    balanceItem.registrationId = registration.id;
                    balanceItem.price = patchRegistration.price
                    balanceItem.description = group ? `Inschrijving ${group.settings.name}` : `Inschrijving`
                    balanceItem.pricePaid = patchRegistration.pricePaid ?? 0
                    balanceItem.memberId = registration.memberId;
                    balanceItem.userId = member.users[0]?.id ?? null
                    balanceItem.organizationId = group.organizationId
                    balanceItem.status = BalanceItemStatus.Pending;
                    await balanceItem.save();

                    addBalanceItemRegistrationId(registration.organizationId, registration.id)
                    balanceItemMemberIds.push(member.id)

                    if (balanceItem.pricePaid > 0) {
                        // Create an Unknown payment and attach it to the balance item
                        const payment = new Payment();
                        payment.userId = member.users[0]?.id ?? null
                        payment.organizationId = member.organizationId
                        payment.method = PaymentMethod.Unknown
                        payment.status = PaymentStatus.Succeeded
                        payment.price = balanceItem.pricePaid;
                        payment.paidAt = new Date()
                        payment.provider = null
                        await payment.save()

                        const balanceItemPayment = new BalanceItemPayment()
                        balanceItemPayment.balanceItemId = balanceItem.id;
                        balanceItemPayment.paymentId = payment.id;
                        balanceItemPayment.organizationId = group.organizationId
                        balanceItemPayment.price = payment.price;
                        await balanceItemPayment.save();
                    }
                }

                await registration.save()
                updateMembershipMemberIds.add(member.id)
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

                if (!await Context.auth.canAccessRegistration(registration, PermissionLevel.Write)) {
                    throw Context.auth.error("Je hebt niet voldoende rechten om deze inschrijving te verwijderen")
                }
                const oldGroup = await getGroup(registration.groupId)
                const period = oldGroup && await RegistrationPeriod.getByID(oldGroup.periodId)
                if (!period || period.locked) {
                    throw new SimpleError({
                        code: "period_locked",
                        message: "Deze inschrijvingsperiode is afgesloten en staat geen wijzigingen meer toe.",
                    })
                }

                balanceItemMemberIds.push(member.id)     
                updateMembershipMemberIds.add(member.id)           
                await BalanceItem.deleteForDeletedRegistration(registration.id)
                await registration.delete()
                member.registrations = member.registrations.filter(r => r.id !== deleteId)

                if (oldGroup) {
                    // We need to update this group occupancy because we moved one member away from it
                    updateGroups.set(oldGroup.id, oldGroup)
                }
            }

            // Add registrations
            for (const registrationStruct of patch.registrations.getPuts()) {
                const struct = registrationStruct.put
                const group = await getGroup(struct.groupId)

                if (!group || group.organizationId !== struct.organizationId || !await Context.auth.canAccessGroup(group, PermissionLevel.Write)) {
                    throw Context.auth.error("Je hebt niet voldoende rechten om inschrijvingen in deze groep te maken")
                }
                const period = await RegistrationPeriod.getByID(group.periodId)
                if (!period || period.locked) {
                    throw new SimpleError({
                        code: "period_locked",
                        message: "Deze inschrijvingsperiode is afgesloten en staat geen wijzigingen meer toe.",
                    })
                }

                const reg = await this.addRegistration(member, struct, group)
                balanceItemMemberIds.push(member.id)
                updateMembershipMemberIds.add(member.id)
                addBalanceItemRegistrationId(reg.organizationId, reg.id)

                // We need to update this group occupancy because we moved one member away from it
                updateGroups.set(group.id, group)
            }

            // Update responsibilities
            for (const patchResponsibility of patch.responsibilities.getPatches()) {
                if (!Context.auth.hasPlatformFullAccess() && !(organization && await Context.auth.hasFullAccess(organization.id))) {
                    throw Context.auth.error("Je hebt niet voldoende rechten om functies van leden aan te passen")
                }

                const responsibilityRecord = await MemberResponsibilityRecord.getByID(patchResponsibility.id)
                if (!responsibilityRecord || responsibilityRecord.memberId != member.id || (organization && responsibilityRecord.organizationId !== organization.id)) {
                    throw new SimpleError({
                        code: "permission_denied",
                        message: "You don't have permissions to access this endpoint",
                        human: "Je hebt geen toegang om deze functie te wijzigen"
                    })
                }

                const platform = await Platform.getShared()
                const responsibility = platform.config.responsibilities.find(r => r.id === patchResponsibility.responsibilityId)

                if (responsibility && !responsibility.assignableByOrganizations && !Context.auth.hasPlatformFullAccess()) {
                    throw Context.auth.error("Je hebt niet voldoende rechten om deze functie aan te passen")
                }
                
                // Allow patching begin and end date
                if (patchResponsibility.endDate !== undefined) {
                    if (responsibilityRecord.endDate) {
                        if (!Context.auth.hasPlatformFullAccess()) {
                            throw Context.auth.error("Je hebt niet voldoende rechten om reeds beëindigde functies aan te passen")
                        }
                    }
                    responsibilityRecord.endDate = patchResponsibility.endDate
                }

                if (patchResponsibility.startDate !== undefined) {

                    if (patchResponsibility.startDate > new Date()) {
                        throw Context.auth.error("Je kan de startdatum van een functie niet in de toekomst zetten")
                    }
                    const daysDiff = Math.abs((new Date().getTime() - patchResponsibility.startDate.getTime()) / (1000 * 60 * 60 * 24))

                    if (daysDiff > 60 && !Context.auth.hasPlatformFullAccess()) {
                        throw Context.auth.error("Je kan de startdatum van een functie niet zoveel verplaatsen")
                    }
                    responsibilityRecord.startDate = patchResponsibility.startDate
                }

                await responsibilityRecord.save()
            }

            // Create responsibilities
            for (const {put} of patch.responsibilities.getPuts()) {
                if (!Context.auth.hasPlatformFullAccess() && !(organization && await Context.auth.hasFullAccess(organization.id))) {
                    throw Context.auth.error("Je hebt niet voldoende rechten om functies van leden aan te passen")
                }

                const platform = await Platform.getShared()
                const platformResponsibility = platform.config.responsibilities.find(r => r.id === put.responsibilityId)
                const org = organization ?? (put.organizationId ? await Organization.getByID(put.organizationId) : null)

                if (!org && put.organizationId) {
                    throw new SimpleError({
                        code: "invalid_field",
                        message: "Invalid organization",
                        human: "Deze vereniging bestaat niet",
                        field: "organizationId"
                    })
                }
                const responsibility = platformResponsibility ?? org?.privateMeta.responsibilities.find(r => r.id === put.responsibilityId)

                if (!responsibility) {
                    throw new SimpleError({
                        code: "invalid_field",
                        message: "Invalid responsibility",
                        human: "Deze functie bestaat niet",
                        field: "responsibilityId"
                    })
                }

                if (!org && !responsibility.assignableByOrganizations) {
                    throw new SimpleError({
                        code: "invalid_field",
                        message: "Invalid organization",
                        human: "Deze functie kan niet worden toegewezen aan deze vereniging",
                        field: "organizationId"
                    })
                }

                const model = new MemberResponsibilityRecord()
                model.memberId = member.id
                model.responsibilityId = responsibility.id
                model.organizationId = org?.id ?? null

                if (responsibility.organizationTagIds !== null && (!org || !org.meta.matchTags(responsibility.organizationTagIds))) {
                    throw new SimpleError({
                        code: "invalid_field",
                        message: "Invalid organization",
                        human: "Deze functie is niet beschikbaar voor deze vereniging",
                        field: "organizationId"
                    })
                }

                if (responsibility.defaultAgeGroupIds !== null) {
                    if (!put.groupId) {
                        throw new SimpleError({
                            code: "invalid_field",
                            message: "Missing groupId",
                            human: "Kies een leeftijdsgroep waarvoor je deze functie wilt toekennen",
                            field: "groupId"
                        })
                    }

                    const group = await Group.getByID(put.groupId)
                    if (!group || group.organizationId !== model.organizationId) {
                        throw new SimpleError({
                            code: "invalid_field",
                            message: "Invalid groupId",
                            human: "Deze leeftijdsgroep bestaat niet",
                            field: "groupId"
                        })
                    }

                    if (group.defaultAgeGroupId === null || !responsibility.defaultAgeGroupIds.includes(group.defaultAgeGroupId)) {
                        throw new SimpleError({
                            code: "invalid_field",
                            message: "Invalid groupId",
                            human: "Deze leeftijdsgroep komt niet in aanmerking voor deze functie",
                            field: "groupId"
                        })
                    }

                    model.groupId = group.id
                }
                
                // Allow patching begin and end date
                model.endDate = put.endDate

                if (put.startDate > new Date()) {
                    throw Context.auth.error("Je kan de startdatum van een functie niet in de toekomst zetten")
                }

                if (put.endDate && put.endDate > new Date(Date.now() + 60*1000)) {
                    throw Context.auth.error("Je kan de einddatum van een functie niet in de toekomst zetten - kijk indien nodig je systeemtijd na")
                }

                model.startDate = put.startDate

                await model.save()
            }

            // Auto link users based on data
            await MemberUserSyncer.onChangeMember(member)

            // Add platform memberships
            for (const {put} of patch.platformMemberships.getPuts()) {
                if (put.periodId !== platform.periodId) {
                    throw new SimpleError({
                        code: "invalid_field",
                        message: "Invalid period",
                        human: "Je kan geen aansluitingen maken voor een andere werkjaar dan het actieve werkjaar",
                        field: "periodId"
                    })
                }

                if (organization && put.organizationId !== organization.id) {
                    throw new SimpleError({
                        code: "invalid_field",
                        message: "Invalid organization",
                        human: "Je kan geen aansluitingen maken voor een andere vereniging",
                        field: "organizationId"
                    })
                }

                if (!await Context.auth.hasFullAccess(put.organizationId)) {
                    throw Context.auth.error("Je hebt niet voldoende rechten om deze aansluiting toe te voegen")
                }

                if (!platform.config.membershipTypes.find(t => t.id === put.membershipTypeId)) {
                    throw new SimpleError({
                        code: "invalid_field",
                        field: "membershipTypeId",
                        message: "Invalid membership type",
                        human: "Dit aansluitingstype bestaat niet"
                    })
                }
                
                // Check duplicate memberships

                // Check dates

                // Calculate prices

                const membership = new MemberPlatformMembership()
                membership.id = put.id
                membership.memberId = member.id
                membership.membershipTypeId = put.membershipTypeId
                membership.organizationId = put.organizationId
                membership.periodId = put.periodId

                membership.startDate = put.startDate
                membership.endDate = put.endDate
                membership.expireDate = put.expireDate

                await membership.calculatePrice()
                await membership.save()

                updateMembershipMemberIds.add(member.id)           
            }

            // Delete platform memberships
            for (const id of patch.platformMemberships.getDeletes()) {
                const membership = await MemberPlatformMembership.getByID(id)

                if (!membership || membership.memberId !== member.id) {
                    throw new SimpleError({
                        code: "invalid_field",
                        field: "id",
                        message: "Invalid id",
                        human: "Deze aansluiting bestaat niet"
                    })
                }

                if (!await Context.auth.hasFullAccess(membership.organizationId)) {
                    throw Context.auth.error("Je hebt niet voldoende rechten om deze aansluiting te verwijderen")
                }

                if (membership.periodId !== platform.periodId) {
                    throw new SimpleError({
                        code: "invalid_field",
                        message: "Invalid period",
                        human: "Je kan geen aansluitingen meer verwijderen voor een ander werkjaar dan het actieve werkjaar",
                        field: "periodId"
                    })
                }

                if (!membership.canDelete()) {
                    throw new SimpleError({
                        code: "invalid_field",
                        message: "Invalid invoice",
                        human: "Je kan geen aansluiting verwijderen die al werd gefactureerd",
                    })
                }

                membership.deletedAt = new Date()
                await membership.save()
                updateMembershipMemberIds.add(member.id)
            }


            if (!members.find(m => m.id === member.id)) {
                members.push(member)
            }
        }

        // Loop all members one by one
        for (const id of request.body.getDeletes()) {
            const member = await Member.getWithRegistrations(id)
            if (!member || !await Context.auth.canDeleteMember(member)) {
                throw Context.auth.error("Je hebt niet voldoende rechten om dit lid te verwijderen")
            }

            await MemberUserSyncer.onDeleteMember(member)
            await User.deleteForDeletedMember(member.id)
            await BalanceItem.deleteForDeletedMember(member.id)
            await member.delete()

            // Update occupancy of this member because we removed registrations
            const groupIds = member.registrations.flatMap(r => r.groupId)
            for (const id of groupIds) {
                const group = await getGroup(id)
                if (group) {
                    // We need to update this group occupancy because we moved one member away from it
                    updateGroups.set(group.id, group)
                }
            }
        }

        await Member.updateOutstandingBalance(Formatter.uniqueArray(balanceItemMemberIds))
        for (const [organizationId, balanceItemRegistrationIds] of balanceItemRegistrationIdsPerOrganization) {
            await Registration.updateOutstandingBalance(Formatter.uniqueArray(balanceItemRegistrationIds), organizationId)
        }
        
        // Loop all groups and update occupancy if needed
        for (const group of updateGroups.values()) {
            await group.updateOccupancy()
            await group.save()
        }
        
        // We need to refetch the outstanding amounts of members that have changed
        const updatedMembers = balanceItemMemberIds.length > 0 ? await Member.getBlobByIds(...balanceItemMemberIds) : []
        for (const member of updatedMembers) {
            const index = members.findIndex(m => m.id === member.id)
            if (index !== -1) {
                members[index] = member
            }
        }

        for (const member of members) {
            if (updateMembershipMemberIds.has(member.id)) {
                await member.updateMemberships()
            }
        }

        return new Response(
            await AuthenticatedStructures.membersBlob(members)
        );
    }

    static async checkDuplicate(member: Member) {
        if (!member.details.birthDay) {
            return
        }
        const existingMembers = await Member.where({ organizationId: member.organizationId, firstName: member.details.firstName, lastName: member.details.lastName, birthDay: Formatter.dateIso(member.details.birthDay) });
        
        if (existingMembers.length > 0) {
            const withRegistrations = await Member.getBlobByIds(...existingMembers.map(m => m.id))
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

    async addRegistration(member: Member & Record<"registrations", (Registration & {group: Group})[]> & Record<"users", User[]>, registrationStruct: RegistrationStruct, group: Group) {
        // Check if this member has this registration already.
        // Note: we cannot use the relation here, because invalid ones or reserved ones are not loaded in there
        const existings = await Registration.where({ 
            memberId: member.id, 
            groupId: registrationStruct.groupId,
            cycle: registrationStruct.cycle
        }, { limit: 1 })
        const existing = existings.length > 0 ? existings[0] : null

        // If the existing is invalid, delete it.
        if (existing && !existing.registeredAt && !existing.waitingList) {
            console.log('Deleting invalid registration', existing.id)
            await existing.delete()
        } else if (existing) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Registration already exists",
                human: existing.waitingList ? "Dit lid staat al op de wachtlijst voor deze groep" : "Dit lid is al ingeschreven voor deze groep",
                field: "groupId"
            });
        }

        if (!group) {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'groupId',
                message: 'Invalid groupId',
                human: 'Deze inschrijvingsgroep is ongeldig'
            })
        }

        const registration = new Registration()
        registration.groupId = registrationStruct.groupId
        registration.organizationId = group.organizationId
        registration.periodId = group.periodId
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
        member.registrations.push(registration.setRelation(Registration.group, group))

        if (registrationStruct.price) {
            // Create balance item
            const balanceItem = new BalanceItem();
            balanceItem.registrationId = registration.id;
            balanceItem.price = registrationStruct.price
            balanceItem.description = group ? `Inschrijving ${group.settings.name}` : `Inschrijving`
            balanceItem.pricePaid = registrationStruct.pricePaid ?? 0
            balanceItem.memberId = registration.memberId;
            balanceItem.userId = member.users[0]?.id ?? null
            balanceItem.organizationId = group.organizationId
            balanceItem.status = BalanceItemStatus.Pending;
            await balanceItem.save();

            if (balanceItem.pricePaid > 0) {
                // Create an Unknown payment and attach it to the balance item
                const payment = new Payment();
                payment.userId = member.users[0]?.id ?? null
                payment.organizationId = member.organizationId
                payment.method = PaymentMethod.Unknown
                payment.status = PaymentStatus.Succeeded
                payment.price = balanceItem.pricePaid;
                payment.paidAt = new Date()
                payment.provider = null
                await payment.save()

                const balanceItemPayment = new BalanceItemPayment()
                balanceItemPayment.balanceItemId = balanceItem.id;
                balanceItemPayment.paymentId = payment.id;
                balanceItemPayment.organizationId = group.organizationId
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
            registration.organizationId = organization.id
            registration.memberId = member.id
            registration.groupId = group.id
            registration.periodId = group.periodId
            registration.cycle = group.cycle
            registration.registeredAt = d

            member.registrations.push(registration)
            await registration.save()
        }
    }
}
