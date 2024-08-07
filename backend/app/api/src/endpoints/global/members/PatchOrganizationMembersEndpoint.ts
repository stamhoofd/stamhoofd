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

                // You need write permissions, because a user can potentially earn write permissions on a member
                // by registering it
                if (!await Context.auth.canAccessMember(duplicate, PermissionLevel.Write)) {
                    throw new SimpleError({
                        code: "known_member_missing_rights",
                        message: "Creating known member without sufficient access rights",
                        human: "Dit lid is al bekend in het systeem, maar je hebt er geen toegang tot. Vraag iemand met de juiste toegangsrechten om dit lid voor jou toe te voegen, of vraag het lid om zelf in te schrijven via het ledenportaal.",
                        statusCode: 400
                    })
                }
            }

            // We risk creating a new member without being able to access it manually afterwards
            if ((organization && !await Context.auth.hasFullAccess(organization.id)) || (!organization && !Context.auth.hasPlatformFullAccess())) {
                throw new SimpleError({
                    code: "missing_group",
                    message: "Missing group",
                    human: "Je moet hoofdbeheerder zijn om een lid toe te voegen in het systeem",
                    statusCode: 400
                })
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
                    await this.createDummyMembers(organization, count)

                    // Skip creating this member
                    continue;
                }
            }

            await member.save()
            members.push(member)
            balanceItemMemberIds.push(member.id)
            updateMembershipMemberIds.add(member.id)

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

                if (responsibility && !responsibility.organizationBased && !Context.auth.hasPlatformFullAccess()) {
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

                if (!org && responsibility.organizationBased) {
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

    async createDummyMembers(organization: Organization, count: number) {
        await new MemberFactory({ 
            organization
        }).createMultiple(count)
    }
}
