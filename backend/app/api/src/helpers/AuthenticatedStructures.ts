import { SimpleError } from "@simonbackx/simple-errors";
import { Event, Group, Member, MemberPlatformMembership, MemberResponsibilityRecord, MemberWithRegistrations, Organization, OrganizationRegistrationPeriod, Payment, RegistrationPeriod, User, Webshop } from "@stamhoofd/models";
import { Event as EventStruct, Group as GroupStruct, MemberPlatformMembership as MemberPlatformMembershipStruct, MemberWithRegistrationsBlob, MembersBlob, OrganizationRegistrationPeriod as OrganizationRegistrationPeriodStruct, Organization as OrganizationStruct, PaymentGeneral, PermissionLevel, PrivateWebshop, UserWithMembers, WebshopPreview, Webshop as WebshopStruct } from '@stamhoofd/structures';

import { Formatter } from "@stamhoofd/utility";
import { Context } from "./Context";

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
        const {registrations, orders} = await Payment.loadBalanceItemRelations(balanceItems);

        if (checkPermissions) {
            // Note: permission checking is moved here for performacne to avoid loading the data multiple times
            if (!(await Context.auth.canAccessBalanceItems(balanceItems, PermissionLevel.Read, {registrations, orders}))) {
                throw new SimpleError({
                    code: "not_found",
                    message: "Payment not found",
                    human: "Je hebt geen toegang tot deze betaling"
                })
            }
        }

        const includeSettlements = checkPermissions && !!Context.user && !!Context.user.permissions

        console.log('includeSettlements', includeSettlements)

        return Payment.getGeneralStructureFromRelations({
            payments,
            balanceItemPayments,
            balanceItems
        }, includeSettlements)
    }

    static async group(group: Group) {
        return (await this.groups([group]))[0]
    }

    static async groups(groups: Group[]) {
        const waitingListIds = Formatter.uniqueArray(groups.map(g => g.waitingListId).filter(id => id !== null))
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

    static async organizationRegistrationPeriods(organizationRegistrationPeriods: OrganizationRegistrationPeriod[], periods?: RegistrationPeriod[]) {
        if (organizationRegistrationPeriods.length === 0) {
            return [];
        }

        if(!periods) {
            const periodIds = Formatter.uniqueArray(organizationRegistrationPeriods.map(p => p.periodId));
            periods = await RegistrationPeriod.getByIDs(...periodIds)
        }

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

    static async organizationRegistrationPeriod(organizationRegistrationPeriod: OrganizationRegistrationPeriod, periods?: RegistrationPeriod[]) {
        return (await this.organizationRegistrationPeriods([organizationRegistrationPeriod], periods))[0]
    }

    static async webshop(webshop: Webshop) {
        if (await Context.optionalAuth?.canAccessWebshop(webshop)) {
            return PrivateWebshop.create(webshop)
        }
        return WebshopStruct.create(webshop)
    }

    static async organization(organization: Organization): Promise<OrganizationStruct> {
        return (await this.organizations([organization]))[0];
    }

    static async organizations(organizations: Organization[]): Promise<OrganizationStruct[]> {
        if(organizations.length === 0) {
            return [];
        }

        //#region get period ids / organizations map
        const periodIdOrganizationsMap = new Map<string, Organization[]>();

        for(const organization of organizations) {
            const periodId = organization.periodId;
            const array = periodIdOrganizationsMap.get(periodId);
            if(array !== undefined) {
                array.push(organization);
            } else {
                periodIdOrganizationsMap.set(periodId, [organization]);
            }
        }
        //#endregion

        //#region get registration period and whether private data can be accessed for each organization
        const organizationData: Map<string, {organizationRegistrationPeriod: OrganizationRegistrationPeriod, canAccessPrivateData: boolean}> = new Map();
        const organizationIdsToGetWebshopsFor: string[] = [];

        for(const [periodId, organizations] of periodIdOrganizationsMap.entries()) {
            const organizationMap = new Map(organizations.map(o => [o.id, o]));

            const result = await OrganizationRegistrationPeriod.where({
                periodId,
                organizationId: {
                    sign: 'IN',
                    value: Array.from(organizationMap.keys())
                }
            });

            for(const organizationRegistrationPeriod of result) {
                const organizationId = organizationRegistrationPeriod.organizationId;
                const organization = organizationMap.get(organizationId);
                if(organization) {
                    // check if private data can be accessed
                    const canAccessPrivateData = await Context.optionalAuth?.canAccessPrivateOrganizationData(organization) ?? false;
                    if(canAccessPrivateData) {
                        organizationIdsToGetWebshopsFor.push(organizationId);
                    }
                    organizationData.set(organizationId, {organizationRegistrationPeriod, canAccessPrivateData});
                }
            }
        }
        //#endregion
        
        //#region get periods
        const allPeriodIds = periodIdOrganizationsMap.keys();
        const allPeriods = await RegistrationPeriod.getByIDs(...allPeriodIds);
        const periodMap = new Map<string, RegistrationPeriod>(allPeriods.map(p => [p.id, p]));
        //#endregion

        //#region get webshop previews
        const webshops = organizationIdsToGetWebshopsFor.length > 0 ? await Webshop.where(
            {
                organizationId: {
                    sign: 'IN',
                    value: organizationIdsToGetWebshopsFor
                }
            },
            { select: Webshop.selectColumnsWithout(undefined, "products", "categories")}
        ) : [];

        const webshopPreviews = new Map<string, WebshopPreview[]>();

        for (const w of webshops) {
            if (!await Context.auth.canAccessWebshop(w)) {
                continue
            }

            const organizationId = w.organizationId;
            const array = webshopPreviews.get(organizationId);
            const preview = WebshopPreview.create(w);

            if(array) {
                array.push(preview);
            } else {
                webshopPreviews.set(organizationId, [preview]);
            }
        }
        //#endregion

        //#region create organization structs
        const results: OrganizationStruct[] = [];

        for(const organization of organizations) {
            const registrationPeriod = periodMap.get(organization.periodId);
            if(!registrationPeriod) {
                console.error('Registration period is undefined.')
                continue;
            }

            const organizationId = organization.id;
            const data = organizationData.get(organizationId);
            if(data === undefined) {
                console.error('Organization data is undefined.')
                continue;
            }

            let result: OrganizationStruct;

            const period = await this.organizationRegistrationPeriod(data.organizationRegistrationPeriod, [registrationPeriod]);
            const baseStruct = organization.getBaseStructure();

            if(data.canAccessPrivateData) {
                result = OrganizationStruct.create({
                    ...baseStruct,
                    period,
                    privateMeta: organization.privateMeta,
                    webshops: webshopPreviews.get(organization.id),
                });
            } else {
                result = OrganizationStruct.create({
                    ...baseStruct,
                    period
                });
            }

            results.push(result);
        }
        //#endregion

        return results;
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
        const memberIds = Formatter.uniqueArray(users.map(u => u.memberId).filter(id => id !== null))
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
            member.registrations = member.registrations.filter(r => (Context.auth.organization && Context.auth.organization.active && r.organizationId === Context.auth.organization.id) || (organizations.get(r.organizationId)?.active ?? false))
            const blob = member.getStructureWithRegistrations()
            memberBlobs.push(
                await Context.auth.filterMemberData(member, blob)
            )

        }

        // Load responsibilities
        const responsibilities = members.length > 0 ? await MemberResponsibilityRecord.where({ memberId: { sign: 'IN', value: members.map(m => m.id) } }) : []
        const platformMemberships = members.length > 0 ? await MemberPlatformMembership.where({ deletedAt: null, memberId: { sign: 'IN', value: members.map(m => m.id) } }) : []

        // Load missing organizations
        const organizationIds = Formatter.uniqueArray(responsibilities.map(r => r.organizationId).filter(id => id !== null))
        for (const id of organizationIds) {
            if (includeContextOrganization || id !== Context.auth.organization?.id) {
                const found = organizations.get(id);
                if (!found) {
                    const organization = await Context.auth.getOrganization(id)
                    organizations.set(organization.id, organization)
                }
            }
        }

        const activeOrganizations = [...organizations.values()].filter(o => o.active);
        const organizationStructs = await this.organizations(activeOrganizations)

        // Load missing groups
        const allGroups = new Map<string, GroupStruct>()
        for (const organization of organizationStructs) {
            for (const group of organization.period.groups) {
                allGroups.set(group.id, group)
            }
        }

        for (const blob of memberBlobs) {
            for (const registration of blob.registrations) {
                if (registration.group) {
                    allGroups.set(registration.group.id, registration.group)
                }
            }
        }

        const groupIds = Formatter.uniqueArray(responsibilities.map(r => r.groupId).filter(id => id !== null)).filter(id => !allGroups.has(id))
        const groups = groupIds.length > 0 ? await Group.getByIDs(...groupIds) : []
        const groupStructs = await this.groups(groups)
        
        for (const group of groupStructs) {
            allGroups.set(group.id, group)
        }

        for (const blob of memberBlobs) {
            blob.responsibilities = responsibilities.filter(r => r.memberId == blob.id).map(r => {
                const group = allGroups.get(r.groupId ?? '') ?? null
                return r.getStructure(group)
            })
            blob.platformMemberships = platformMemberships.filter(r => r.memberId == blob.id).map(r => MemberPlatformMembershipStruct.create(r))
        }

        return MembersBlob.create({
            members: memberBlobs,
            organizations: organizationStructs
        })
    }

    static async events(events: Event[]): Promise<EventStruct[]> {
        // Load groups
        const groupIds = events.map(e => e.groupId).filter(id => id !== null)
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
