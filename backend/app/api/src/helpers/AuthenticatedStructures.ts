import { SimpleError } from "@simonbackx/simple-errors";
import { Event, Group, Member, MemberPlatformMembership, MemberResponsibilityRecord, MemberWithRegistrations, Organization, OrganizationRegistrationPeriod, Payment, RegistrationPeriod, User, Webshop } from "@stamhoofd/models";
import { Event as EventStruct, MemberPlatformMembership as MemberPlatformMembershipStruct, MemberResponsibilityRecord as MemberResponsibilityRecordStruct, MemberWithRegistrationsBlob, MembersBlob, Organization as OrganizationStruct, PaymentGeneral, PermissionLevel, PrivateWebshop, User as UserStruct, UserWithMembers, WebshopPreview, Webshop as WebshopStruct } from '@stamhoofd/structures';
import { OrganizationRegistrationPeriod as OrganizationRegistrationPeriodStruct, GroupCategory, GroupPrivateSettings, GroupSettings, GroupStatus, Group as GroupStruct, GroupType } from '@stamhoofd/structures';

import { Context } from "./Context";
import { Formatter } from "@stamhoofd/utility";

/**
 * Builds authenticated structures for the current user
 */
export class AuthenticatedStructures {
    static async paymentGeneral(payment: Payment, checkPermissions = true): Promise<PaymentGeneral> {
        return (await this.paymentsGeneral([payment], checkPermissions))[0]
    }

    /**
     * 
     * @param payments 
     * @param checkPermissions Only set to undefined when not returned in the API + not for public use
     * @returns 
     */
    static async paymentsGeneral(payments: Payment[], checkPermissions = true): Promise<PaymentGeneral[]> {
        if (payments.length === 0) {
            return []
        }

        const {balanceItemPayments, balanceItems} = await Payment.loadBalanceItems(payments)
        const {registrations, orders, members, groups} = await Payment.loadBalanceItemRelations(balanceItems);

        if (checkPermissions) {
            // Note: permission checking is moved here for performacne to avoid loading the data multiple times
            if (!(await Context.auth.canAccessBalanceItems(balanceItems, PermissionLevel.Read, {registrations, orders, members}))) {
                throw new SimpleError({
                    code: "not_found",
                    message: "Payment not found",
                    human: "Je hebt geen toegang tot deze betaling"
                })
            }
        }

        const includeSettlements = checkPermissions && !!Context.user && !!Context.user.permissions

        return Payment.getGeneralStructureFromRelations({
            payments,
            balanceItemPayments,
            balanceItems,
            registrations,
            orders,
            members,
            groups
        }, includeSettlements)
    }

    static async group(group: Group) {
        return (await this.groups([group]))[0]
    }

    static async groups(groups: Group[]) {
        const waitingListIds = Formatter.uniqueArray(groups.map(g => g.waitingListId).filter(id => id !== null) as string[])
        const waitingLists = waitingListIds.length > 0 ? await Group.getByIDs(...waitingListIds) : []

        const structs: GroupStruct[] = []
        for (const group of groups) {
            const waitingList = waitingLists.find(g => g.id == group.waitingListId) ?? null
            const waitingListStruct = waitingList ? GroupStruct.create(waitingList) : null
            if (waitingList && waitingListStruct && !await Context.optionalAuth?.canAccessGroup(waitingList)) {
                waitingListStruct.privateSettings = null;
            }

            const struct = GroupStruct.create({
                ...group,
                waitingList: waitingListStruct
            })

            if (!await Context.optionalAuth?.canAccessGroup(group)) {
                struct.privateSettings = null;
            }

            structs.push(struct)
        }

        return structs;
    }

    static async organizationRegistrationPeriods(organizationRegistrationPeriods: OrganizationRegistrationPeriod[]) {
        if (organizationRegistrationPeriods.length === 0) {
            return [];
        }

        const periodIds = Formatter.uniqueArray(organizationRegistrationPeriods.map(p => p.periodId))
        const periods = await RegistrationPeriod.getByIDs(...periodIds)

        const groupIds = Formatter.uniqueArray(organizationRegistrationPeriods.flatMap(p => p.settings.categories.flatMap(c => c.groupIds)))
        const groups = groupIds.length ? await Group.getByIDs(...groupIds) : []

        const groupStructs = await this.groups(groups)

        const structs: OrganizationRegistrationPeriodStruct[] = []
        for (const organizationPeriod of organizationRegistrationPeriods) {
            const period = periods.find(p => p.id == organizationPeriod.periodId) ?? null
            if (!period) {
                continue
            }
            const groupIds = Formatter.uniqueArray(organizationPeriod.settings.categories.flatMap(c => c.groupIds))

            structs.push(
                OrganizationRegistrationPeriodStruct.create({
                    ...organizationPeriod,
                    period: period.getStructure(),
                    groups: groupStructs.filter(gg => groupIds.includes(gg.id)).sort(GroupStruct.defaultSort)
                })
            )
        }

        return structs
    }

    static async organizationRegistrationPeriod(organizationRegistrationPeriod: OrganizationRegistrationPeriod) {
        return (await this.organizationRegistrationPeriods([organizationRegistrationPeriod]))[0]
    }

    static async webshop(webshop: Webshop) {
        if (await Context.optionalAuth?.canAccessWebshop(webshop)) {
            return PrivateWebshop.create(webshop)
        }
        return WebshopStruct.create(webshop)
    }

    static async organization(organization: Organization): Promise<OrganizationStruct> {
        const organizationPeriod = await organization.getPeriod()

        if (await Context.optionalAuth?.canAccessPrivateOrganizationData(organization)) {
            const webshops = await Webshop.where({ organizationId: organization.id }, { select: Webshop.selectColumnsWithout(undefined, "products", "categories")})
            const webshopStructures: WebshopPreview[] = [] 

            for (const w of webshops) {
                if (!await Context.auth.canAccessWebshop(w)) {
                    continue
                }
                webshopStructures.push(WebshopPreview.create(w))
            }

            return OrganizationStruct.create({
                ...organization.getBaseStructure(),
                privateMeta: organization.privateMeta,
                webshops: webshopStructures,
                period: await this.organizationRegistrationPeriod(organizationPeriod)
            })
        }
        
        return OrganizationStruct.create({
            ...organization.getBaseStructure(),
            period: await this.organizationRegistrationPeriod(organizationPeriod)
        })
    }

    static async adminOrganizations(organizations: Organization[]): Promise<OrganizationStruct[]> {
        const structs: OrganizationStruct[] = [];

        for (const organization of organizations) {
            const base = organization.getBaseStructure()
            structs.push(base)
        }
        
        return Promise.resolve(structs)
    }

    static async userWithMembers(user: User): Promise<UserWithMembers> {
        const members = await Member.getMembersWithRegistrationForUser(user)

        return UserWithMembers.create({
            ...user,
            hasAccount: user.hasAccount(),

            // Always include the current context organization - because it is possible we switch organization and we don't want to refetch every time
            members: await this.membersBlob(members, true, user)
        })
    }

    /**
     * This version only returns connected members that are 1:1, skips other members
     */
    static async usersWithMembers(users: User[]): Promise<UserWithMembers[]> {
        const structs: UserWithMembers[] = [];
        const memberIds = Formatter.uniqueArray(users.map(u => u.memberId).filter(id => id !== null) as string[])
        const members = memberIds.length > 0 ? await Member.getBlobByIds(...memberIds) : []

        for (const user of users) {
            const filteredMembers = user.memberId ? members.filter(m => m.id === user.memberId) : []
            structs.push(UserWithMembers.create({
                ...user,
                hasAccount: user.hasAccount(),
                members: await this.membersBlob(filteredMembers, false)
            }))
        }
        
        return structs
    }

    static async membersBlob(members: MemberWithRegistrations[], includeContextOrganization = false, includeUser?: User): Promise<MembersBlob> {
        if (members.length === 0 && !includeUser) {
            return MembersBlob.create({members: [], organizations: []})
        }
        const organizations = new Map<string, Organization>()
 
        if (includeUser) {
            for (const organizationId of includeUser.permissions?.organizationPermissions.keys() ?? []) {
                if (includeContextOrganization || organizationId !== Context.auth.organization?.id) {
                    const found = organizations.get(organizationId);
                    if (!found) {
                        const organization = await Context.auth.getOrganization(organizationId)
                        organizations.set(organization.id, organization)
                    }
                }
            }
        }


        const memberBlobs: MemberWithRegistrationsBlob[] = []
        for (const member of members) {
            for (const registration of member.registrations) {
                if (includeContextOrganization || registration.organizationId !== Context.auth.organization?.id) {
                    const found = organizations.get(registration.id);
                    if (!found) {
                        const organization = await Context.auth.getOrganization(registration.organizationId)
                        organizations.set(organization.id, organization)
                    }
                }
            }


            const blob = member.getStructureWithRegistrations()
            memberBlobs.push(
                await Context.auth.filterMemberData(member, blob)
            )
        }

        // Load responsibilities
        const responsibilities = members.length > 0 ? await MemberResponsibilityRecord.where({ memberId: { sign: 'IN', value: members.map(m => m.id) } }) : []
        const platformMemberships = members.length > 0 ? await MemberPlatformMembership.where({ deletedAt: null, memberId: { sign: 'IN', value: members.map(m => m.id) } }) : []

        // Load missing organizations
        const organizationIds = Formatter.uniqueArray(responsibilities.map(r => r.organizationId).filter(id => id !== null) as string[])
        for (const id of organizationIds) {
            if (includeContextOrganization || id !== Context.auth.organization?.id) {
                const found = organizations.get(id);
                if (!found) {
                    const organization = await Context.auth.getOrganization(id)
                    organizations.set(organization.id, organization)
                }
            }
        }

        for (const blob of memberBlobs) {
            blob.responsibilities = responsibilities.filter(r => r.memberId == blob.id).map(r => r.getStructure())
            blob.platformMemberships = platformMemberships.filter(r => r.memberId == blob.id).map(r => MemberPlatformMembershipStruct.create(r))
        }

        return MembersBlob.create({
            members: memberBlobs,
            organizations: await Promise.all([...organizations.values()].map(o => this.organization(o)))
        })
    }

    static async events(events: Event[]): Promise<EventStruct[]> {
        // Load groups
        const groupIds = events.map(e => e.groupId).filter(id => id !== null) as string[]
        const groups = groupIds.length > 0 ? await Group.getByIDs(...groupIds) : []
        const groupStructs = await this.groups(groups)

        const result: EventStruct[] = []

        for (const event of events) {
            const group = groupStructs.find(g => g.id == event.groupId) ?? null

            const struct = EventStruct.create({
                ...event,
                group
            })

            result.push(struct)
        }
        
        return result
    }
}
