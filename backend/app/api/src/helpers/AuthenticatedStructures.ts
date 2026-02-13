import { SimpleError } from '@simonbackx/simple-errors';
import { AuditLog, BalanceItem, CachedBalance, Document, Event, EventNotification, Group, Invoice, Member, MemberPlatformMembership, MemberResponsibilityRecord, MemberWithUsersRegistrationsAndGroups, Order, Organization, OrganizationRegistrationPeriod, Payment, Registration, RegistrationPeriod, Ticket, User, Webshop } from '@stamhoofd/models';
import { AuditLogReplacement, AuditLogReplacementType, AuditLog as AuditLogStruct, Company, DetailedReceivableBalance, Document as DocumentStruct, EventNotification as EventNotificationStruct, Event as EventStruct, GenericBalance, Group as GroupStruct, GroupType, InvoicedBalanceItem, InvoiceStruct, MemberPlatformMembership as MemberPlatformMembershipStruct, MembersBlob, MemberWithRegistrationsBlob, NamedObject, OrganizationRegistrationPeriod as OrganizationRegistrationPeriodStruct, Organization as OrganizationStruct, PaymentCustomer, PaymentGeneral, PermissionLevel, Platform, PrivateOrder, PrivateWebshop, ReceivableBalanceObject, ReceivableBalanceObjectContact, ReceivableBalance as ReceivableBalanceStruct, ReceivableBalanceType, RegistrationsBlob, RegistrationWithMemberBlob, TicketPrivate, UserWithMembers, WebshopPreview, Webshop as WebshopStruct } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';

import { SQL } from '@stamhoofd/sql';
import { Formatter } from '@stamhoofd/utility';
import { BalanceItemService } from '../services/BalanceItemService.js';
import { Context } from './Context.js';

/**
 * Builds authenticated structures for the current user
 */
export class AuthenticatedStructures {
    static async paymentGeneral(payment: Payment, checkPermissions = true): Promise<PaymentGeneral> {
        return (await this.paymentsGeneral([payment], checkPermissions))[0];
    }

    /**
     *
     * @param payments
     * @param checkPermissions Only set to undefined when not returned in the API + not for public use
     * @returns
     */
    static async paymentsGeneral(payments: Payment[], checkPermissions = true): Promise<PaymentGeneral[]> {
        if (payments.length === 0) {
            return [];
        }

        const { balanceItemPayments, balanceItems } = await Payment.loadBalanceItems(payments);

        if (checkPermissions) {
            const { registrations, orders } = await Payment.loadBalanceItemRelations(balanceItems);

            // Note: permission checking is moved here for performacne to avoid loading the data multiple times
            if (!(await Context.auth.canAccessBalanceItems(balanceItems, PermissionLevel.Read, { registrations, orders }))) {
                throw new SimpleError({
                    code: 'permission_denied',
                    message: 'Permission denied',
                    human: $t(`9f5ee239-d01b-4ee1-961b-2e3224489781`),
                });
            }
        }

        const includeSettlements = checkPermissions && !!Context.user && !!Context.user.permissions;

        const { payingOrganizations } = await Payment.loadPayingOrganizations(payments);

        return Payment.getGeneralStructureFromRelations({
            payments,
            balanceItemPayments,
            balanceItems,
            payingOrganizations,
        }, includeSettlements);
    }

    static async invoices(invoices: Invoice[]): Promise<InvoiceStruct[]> {
        if (invoices.length === 0) {
            return [];
        }

        const { invoicedBalanceItems } = await Invoice.loadBalanceItems(invoices);

        return invoices.map((invoice) => {
            const items = invoicedBalanceItems.filter(i => i.invoiceId === invoice.id);
            return InvoiceStruct.create({
                ...invoice,
                items: items.map((item) => {
                    return InvoicedBalanceItem.create(item);
                }),
            });
        });
    }

    static async group(group: Group) {
        return (await this.groups([group]))[0];
    }

    static async groups(groups: Group[]) {
        const waitingListIds = Formatter.uniqueArray(groups.map(g => g.waitingListId).filter(id => id !== null));

        const waitingLists: Group[] = [];
        const waitingListsToFetch: string[] = [];

        for (const waitingListId of waitingListIds) {
            const existingGroup = groups.find(g => g.id === waitingListId);

            if (existingGroup) {
                waitingLists.push(existingGroup);
            }
            else {
                waitingListsToFetch.push(waitingListId);
            }
        }

        if (waitingListsToFetch.length) {
            const fetchedWaitingLists = await Group.getByIDs(...waitingListsToFetch);
            waitingLists.push(...fetchedWaitingLists);
        }

        const structs: GroupStruct[] = [];
        for (const group of groups) {
            const waitingList = waitingLists.find(g => g.id === group.waitingListId) ?? null;
            const waitingListStruct = waitingList ? GroupStruct.create(waitingList) : null;
            if (waitingList && waitingListStruct && !await Context.optionalAuth?.canAccessGroup(waitingList)) {
                waitingListStruct.privateSettings = null;
            }

            const struct = GroupStruct.create({
                ...group,
                waitingList: waitingListStruct,
            });

            if (!await Context.optionalAuth?.canAccessGroup(group)) {
                struct.privateSettings = null;
            }

            structs.push(struct);
        }

        return structs;
    }

    static async organizationRegistrationPeriods(organizationRegistrationPeriods: OrganizationRegistrationPeriod[], periods?: RegistrationPeriod[], options?: { forceGroupIds?: string[] }) {
        if (organizationRegistrationPeriods.length === 0) {
            return [];
        }

        const periodIds = periods ? Formatter.uniqueArray(periods.map(p => p.id)) : Formatter.uniqueArray(organizationRegistrationPeriods.map(p => p.periodId));

        if (!periods) {
            periods = await RegistrationPeriod.getByIDs(...periodIds);
        }

        const organizationIds = Formatter.uniqueArray(organizationRegistrationPeriods.map(r => r.organizationId));

        const groupIds = Formatter.uniqueArray([
            ...organizationRegistrationPeriods.flatMap(p => p.settings.categories.flatMap(c => c.groupIds)),
            ...(options?.forceGroupIds ?? []),
        ]);

        let groups: Group[] = [];

        const whereWaitingList = SQL.where('organizationId', organizationIds)
            .and('periodId', periodIds)
            .and('type', GroupType.WaitingList)
            .and('deletedAt', null);

        if (groupIds.length) {
            const whereGroupIds = SQL.where('id', groupIds);

            if (organizationIds.length && periodIds.length) {
                groups = await Group.select()
                    .where(whereGroupIds)
                    .orWhere(whereWaitingList)
                    .fetch();
            }
            else {
                groups = await Group.select()
                    .where(whereGroupIds).fetch();
            }
        }
        else if (organizationIds.length && periodIds.length) {
            groups = await Group.select()
                .where(whereWaitingList)
                .fetch();
        }

        const groupStructs = await this.groups(groups);

        const structs: OrganizationRegistrationPeriodStruct[] = [];
        for (const organizationPeriod of organizationRegistrationPeriods) {
            const period = periods.find(p => p.id === organizationPeriod.periodId) ?? null;
            if (!period) {
                continue;
            }

            const struct = OrganizationRegistrationPeriodStruct.create({
                ...organizationPeriod,
                period: period.getStructure(),
                groups: groupStructs.filter((gg) => {
                    if (gg.organizationId !== organizationPeriod.organizationId) {
                        return false;
                    }

                    if (gg.periodId !== organizationPeriod.periodId) {
                        return false;
                    }

                    return true;
                })
                    .sort(GroupStruct.defaultSort),
            });

            structs.push(struct);
        }

        return structs;
    }

    static async organizationRegistrationPeriod(organizationRegistrationPeriod: OrganizationRegistrationPeriod, periods?: RegistrationPeriod[]) {
        return (await this.organizationRegistrationPeriods([organizationRegistrationPeriod], periods))[0];
    }

    static async webshop(webshop: Webshop) {
        if (await Context.optionalAuth?.canAccessWebshop(webshop)) {
            return PrivateWebshop.create(webshop);
        }
        return WebshopStruct.create(webshop);
    }

    static async organization(organization: Organization): Promise<OrganizationStruct> {
        return (await this.organizations([organization]))[0];
    }

    static webshopPreview(webshop: Webshop) {
        return WebshopPreview.create(webshop);
    }

    static async organizations(organizations: Organization[]): Promise<OrganizationStruct[]> {
        if (organizations.length === 0) {
            return [];
        }

        const periodIdOrganizationsMap = new Map<string, Organization[]>();
        const organizationIdsToGetWebshopsFor: string[] = [];

        for (const organization of organizations) {
            const periodId = organization.periodId;
            const array = periodIdOrganizationsMap.get(periodId);
            if (array !== undefined) {
                array.push(organization);
            }
            else {
                periodIdOrganizationsMap.set(periodId, [organization]);
            }
        }

        // Get registration period and whether private data can be accessed for each organization
        const organizationData: Map<string, { organizationRegistrationPeriod: OrganizationRegistrationPeriodStruct; canAccessPrivateData: boolean }> = new Map();
        const allPeriodIds = periodIdOrganizationsMap.keys();
        const allPeriods = await RegistrationPeriod.getByIDs(...allPeriodIds);
        const periodMap = new Map<string, RegistrationPeriod>(allPeriods.map(p => [p.id, p]));

        for (const [periodId, organizations] of periodIdOrganizationsMap.entries()) {
            const result = await OrganizationRegistrationPeriod.where({
                periodId,
                organizationId: {
                    sign: 'IN',
                    value: Formatter.uniqueArray(organizations.map(o => o.id)),
                },
            });
            const period = periodMap.get(periodId);
            if (!period) {
                console.error('Period not found for id', periodId);
                throw new Error('Period not found for id ' + periodId);
            }

            // Automatically create missing organization periods for now
            for (const organization of organizations) {
                const organizationPeriodModel = result.find(r => r.organizationId === organization.id);
                if (!organizationPeriodModel) {
                    result.push(await organization.getPeriod());
                }
            }

            // Do this onece per period, because otherwise we can't optimize fetching the groups for each period
            const organizationRegistrationPeriods = await this.organizationRegistrationPeriods(result, [period]);

            for (const organization of organizations) {
                const organizationId = organization.id;
                const organizationPeriodModel = result.find(r => r.organizationId === organizationId);
                if (organizationPeriodModel) {
                    const organizationRegistrationPeriod = organizationRegistrationPeriods.find(o => o.id === organizationPeriodModel.id);
                    if (!organizationRegistrationPeriod) {
                        throw new Error('Organization registration period not found for id ' + organizationPeriodModel.id);
                    }

                    // check if private data can be accessed
                    const canAccessPrivateData = await Context.optionalAuth?.canAccessPrivateOrganizationData(organization) ?? false;
                    if (canAccessPrivateData) {
                        organizationIdsToGetWebshopsFor.push(organization.id);
                    }
                    organizationData.set(organizationId, { organizationRegistrationPeriod, canAccessPrivateData });
                }
                else {
                    // Should never happen
                    throw new Error('Organization registration period model not found for organization id ' + organizationId + ' and period id ' + periodId);
                }
            }
        }

        // Get webshop previews
        const webshops = organizationIdsToGetWebshopsFor.length > 0
            ? await Webshop.where(
                {
                    organizationId: {
                        sign: 'IN',
                        value: organizationIdsToGetWebshopsFor,
                    },
                },
                { select: Webshop.selectColumnsWithout(undefined, 'products', 'categories') },
            )
            : [];

        const webshopPreviews = new Map<string, WebshopPreview[]>();

        for (const w of webshops) {
            if (!await Context.auth.canAccessWebshop(w)) {
                continue;
            }

            const organizationId = w.organizationId;
            const array = webshopPreviews.get(organizationId);
            const preview = this.webshopPreview(w);

            if (array) {
                array.push(preview);
            }
            else {
                webshopPreviews.set(organizationId, [preview]);
            }
        }

        // Create organization structs
        const results: OrganizationStruct[] = [];

        for (const organization of organizations) {
            const registrationPeriod = periodMap.get(organization.periodId);
            if (!registrationPeriod) {
                console.error('Registration period is undefined.');
                continue;
            }

            const organizationId = organization.id;
            const data = organizationData.get(organizationId);
            if (data === undefined) {
                console.error('Organization data is undefined.');
                continue;
            }

            let result: OrganizationStruct;

            const period = data.organizationRegistrationPeriod;
            const baseStruct = organization.getBaseStructure();

            if (data.canAccessPrivateData) {
                result = OrganizationStruct.create({
                    ...baseStruct,
                    period,
                    privateMeta: organization.privateMeta.removedPrivateKeys,
                    webshops: webshopPreviews.get(organization.id)?.sort((a, b) => Sorter.byDateValue(b.createdAt, a.createdAt)),
                });
            }
            else {
                result = OrganizationStruct.create({
                    ...baseStruct,
                    period,
                });
            }

            results.push(result);
        }

        return results;
    }

    static async adminOrganizations(organizations: Organization[]): Promise<OrganizationStruct[]> {
        const structs: OrganizationStruct[] = [];

        for (const organization of organizations) {
            const base = organization.getBaseStructure();
            structs.push(base);
        }

        return Promise.resolve(structs);
    }

    static async userWithMembers(user: User): Promise<UserWithMembers> {
        const members = await Member.getMembersWithRegistrationForUser(user);
        const filtered: MemberWithUsersRegistrationsAndGroups[] = [];
        for (const member of members) {
            if (await Context.auth.canAccessMember(member, PermissionLevel.Read)) {
                filtered.push(member);
            }
        }

        return UserWithMembers.create({
            ...user,
            hasAccount: user.hasAccount(),
            hasPassword: user.hasPasswordBasedAccount(),

            // Always include the current context organization - because it is possible we switch organization and we don't want to refetch every time
            members: await this.membersBlob(filtered, true, user),
        });
    }

    /**
     * This version only returns connected members that are 1:1, skips other members
     */
    static async usersWithMembers(users: User[]): Promise<UserWithMembers[]> {
        const structs: UserWithMembers[] = [];
        const memberIds = Formatter.uniqueArray(users.map(u => u.memberId).filter(id => id !== null));
        const members = memberIds.length > 0 ? await Member.getBlobByIds(...memberIds) : [];

        for (const user of users) {
            const filteredMembers = user.memberId ? members.filter(m => m.id === user.memberId) : [];
            structs.push(UserWithMembers.create({
                ...user,
                hasAccount: user.hasAccount(),
                hasPassword: user.hasPasswordBasedAccount(),
                members: await this.membersBlob(filteredMembers, false),
            }));
        }

        return structs;
    }

    static async members(members: MemberWithUsersRegistrationsAndGroups[]): Promise<MemberWithRegistrationsBlob[]> {
        return (await this.membersBlob(members, false)).members;
    }

    static async membersBlob(members: MemberWithUsersRegistrationsAndGroups[], includeContextOrganization = false, includeUser?: User, options?: { forAdminCartCalculation?: boolean }): Promise<MembersBlob> {
        if (members.length === 0 && !includeUser) {
            return MembersBlob.create({ members: [], organizations: [] });
        }

        const organizations = new Map<string, Organization>();
        const relevantPeriodIds = Formatter.uniqueArray([
            Platform.shared.period.previousPeriodId,
            Platform.shared.period.id,
            Platform.shared.period.nextPeriodId,
            Context.organization?.periodId ?? null,
        ].filter(id => id !== null)) as string[];

        const registrationIds = Formatter.uniqueArray(members.flatMap(m => m.registrations.map(r => r.id)));

        // This code is a bit messy, we need to optimize it a bit. But it is this complex because it tries
        // to load as many relations as possible in advance in one go, to avoid doing queries inside the loops.
        // this is very important as this method is called very often.

        // Load responsibilities
        const responsibilities = members.length > 0
            ? await MemberResponsibilityRecord.select()
                .where('memberId', members.map(m => m.id))
                .where(SQL.where('endDate', null).or('endDate', '>', new Date()))
                .fetch()
            : [];
        const platformMemberships = members.length > 0
            ? await MemberPlatformMembership.select()
                .where('memberId', members.map(m => m.id))
                .where('deletedAt', null)
                .where('periodId', relevantPeriodIds)
                .fetch()
            : [];

        // Load organizations
        const organizationIds = responsibilities.map(r => r.organizationId)
            .concat(
                platformMemberships.map(r => r.organizationId),
            )
            .filter(id => id !== null);

        if (includeUser) {
            for (const organizationId of includeUser.permissions?.organizationPermissions.keys() ?? []) {
                if (includeContextOrganization || organizationId !== Context.auth.organization?.id) {
                    organizationIds.push(organizationId);
                }
            }
        }

        if (STAMHOOFD.singleOrganization && !Context.auth.organization) {
            organizationIds.push(STAMHOOFD.singleOrganization);
        }

        const membershipOrganizationId = Platform.shared.membershipOrganizationId;
        if (membershipOrganizationId && Context.auth.hasSomePlatformAccess()) {
            if (await Context.auth.hasSomeAccess(membershipOrganizationId)) {
                organizationIds.push(membershipOrganizationId);
            }
        }

        for (const member of members) {
            for (const registration of member.registrations) {
                organizationIds.push(registration.organizationId);
            }
        }

        // Now fetch organizations
        // todo: optimize this
        for (const id of organizationIds) {
            if (includeContextOrganization || id !== Context.auth.organization?.id) {
                const found = organizations.get(id);
                if (!found) {
                    const organization = await Context.auth.getOrganization(id);
                    organizations.set(organization.id, organization);
                }
            }
        }

        // Already fetch these organizations fully, because then we can reuse the groups in here
        const activeOrganizations: Organization[] = [];

        for (const organization of organizations.values()) {
            if (organization.active || await Context.auth.hasFullAccess(organization.id)) {
                activeOrganizations.push(organization);
            }
        }
        const organizationStructs = await this.organizations(activeOrganizations);

        let groupIds = Formatter.uniqueArray(
            [
                ...members.flatMap(m => m.registrations.map(r => r.groupId)).filter(id => id !== null),
                ...responsibilities.map(r => r.groupId).filter(id => id !== null),
            ],
        );

        // Set gropus that we already loaded
        const allGroups = new Map<string, GroupStruct>();
        for (const organization of organizationStructs) {
            for (const group of organization.period.groups) {
                allGroups.set(group.id, group);
            }
        }

        const preloadedGroupModels: Map<string, Group> = new Map();

        for (const member of members) {
            for (const registration of member.registrations) {
                if (!allGroups.has(registration.groupId) && !preloadedGroupModels.has(registration.groupId)) {
                    preloadedGroupModels.set(registration.group.id, registration.group);
                }
            }
        }

        // Remove duplicates and already loaded ones
        groupIds = groupIds.filter(id => !allGroups.has(id) && !preloadedGroupModels.has(id));
        const groups = groupIds.length > 0 ? [...preloadedGroupModels.values(), ...await Group.getByIDs(...groupIds)] : [...preloadedGroupModels.values()];
        if (groupIds.length > 0 && STAMHOOFD.environment === 'development') {
            console.log('Doing extra group query for groups', groupIds);
        }
        const groupStructs = await this.groups(groups);
        for (const group of groupStructs) {
            allGroups.set(group.id, group);
        }

        const balances = await CachedBalance.getForObjects(registrationIds, null, ReceivableBalanceType.registration);
        const memberIds = members.map(m => m.id);
        const allMemberBalances = Context.organization
            ? (await CachedBalance.getForObjects(memberIds, Context.organization.id, ReceivableBalanceType.member))
            : [];

        // Delete organizations that no longer exist in the permissions of the user
        /* if (includeUser) {
            for (const organizationId of includeUser.permissions?.organizationPermissions.keys() ?? []) {
                if (includeContextOrganization || organizationId !== Context.auth.organization?.id) {
                    const found = organizations.get(organizationId);
                    if (!found) {
                        try {
                            const organization = await Context.auth.getOrganization(organizationId);
                            organizations.set(organization.id, organization);
                        }
                        catch (e) {
                            if (e.message.includes('Unexpected missing organization')) {
                                // This user has permissions for an organization that is deleted
                                console.error(e);
                                console.error('User has permissions for an organization that is not found:', organizationId, 'userid', includeUser.id);

                                // Remove permissions for this organization
                                if (includeUser.permissions) {
                                    includeUser.permissions.organizationPermissions.delete(organizationId);
                                    await includeUser.save();
                                }
                            }
                            else {
                                throw e;
                            }
                        }
                    }
                }
            }
        } */

        const memberBlobs: MemberWithRegistrationsBlob[] = [];
        for (const member of members) {
            const filtered: (Registration & {
                group: Group;
            })[] = [];
            const userManager = Context.auth.isUserManager(member);
            for (const registration of member.registrations) {
                if (includeContextOrganization || registration.organizationId !== Context.auth.organization?.id) {
                    const found = organizations.get(registration.id);
                    if (!found) {
                        const organization = await Context.auth.getOrganization(registration.organizationId);
                        organizations.set(organization.id, organization);
                    }
                }
                if (organizations.get(registration.organizationId)?.active || (Context.auth.organization && Context.auth.organization.active && registration.organizationId === Context.auth.organization.id) || await Context.auth.hasFullAccess(registration.organizationId)) {
                    if (
                        !!options?.forAdminCartCalculation
                        || registration.group.settings.implicitlyAllowViewRegistrations
                        || userManager
                        || await Context.auth.canAccessRegistration(registration, PermissionLevel.Read, member)
                    ) {
                        filtered.push(registration);
                    }
                }
            }
            member.registrations = filtered;
            const balancesPermission = (!!options?.forAdminCartCalculation) || await Context.auth.hasFinancialMemberAccess(member, PermissionLevel.Read, Context.organization?.id);

            let memberBalances: GenericBalance[] = [];

            if (balancesPermission && Context.organization) {
                // Only return balances if in an organization scope and you have permission for the finances of that specific organization AND member
                memberBalances = allMemberBalances
                    .filter(b => member.id === b.objectId && b.objectType === ReceivableBalanceType.member)
                    .map((b) => {
                        return GenericBalance.create(b);
                    });
            }

            const blob = MemberWithRegistrationsBlob.create({
                ...member,
                balances: memberBalances,
                registrations: await Promise.all(
                    member.registrations.map(async (r) => {
                        const base = r.getStructure();

                        base.balances = balancesPermission
                            ? (balances.filter(b => r.id === b.objectId && b.objectType === ReceivableBalanceType.registration).map((b) => {
                                    return GenericBalance.create(b);
                                }))
                            : [];
                        const g = allGroups.get(r.groupId);
                        if (g) {
                            base.group = g;
                        }
                        else {
                            console.error('Group not preloaded for registration', r.id, r.groupId);
                        }

                        return base;
                    }),
                ),
                details: member.details,
                users: member.users.map(u => u.getStructure()),
            });

            memberBlobs.push(
                await Context.auth.filterMemberData(member, blob, { forAdminCartCalculation: options?.forAdminCartCalculation ?? false }),
            );
        }

        for (const blob of memberBlobs) {
            blob.responsibilities = responsibilities.filter(r => r.memberId == blob.id).map((r) => {
                const group = allGroups.get(r.groupId ?? '') ?? null;
                return r.getStructure(group);
            });
            blob.platformMemberships = platformMemberships.filter(r => r.memberId == blob.id).map(r => MemberPlatformMembershipStruct.create(r));
        }

        return MembersBlob.create({
            members: memberBlobs,
            organizations: organizationStructs,
        });
    }

    static async events(events: Event[]): Promise<EventStruct[]> {
        // Load groups
        const groupIds = events.map(e => e.groupId).filter(id => id !== null);
        const groups = groupIds.length > 0 ? await Group.getByIDs(...groupIds) : [];
        const groupStructs = await this.groups(groups);

        const result: EventStruct[] = [];

        for (const event of events) {
            const group = groupStructs.find(g => g.id == event.groupId) ?? null;

            const struct = EventStruct.create({
                ...event,
                group,
            });

            result.push(struct);
        }

        return result;
    }

    static async eventNotification(eventNotification: EventNotification): Promise<EventNotificationStruct> {
        return (await this.eventNotifications([eventNotification]))[0];
    }

    static async registrationsBlob(registrations: (Registration & { group: Group })[], members: MemberWithUsersRegistrationsAndGroups[], includeContextOrganization = false, includeUser?: User): Promise<RegistrationsBlob> {
        const membersBlob = await this.membersBlob(members, includeContextOrganization, includeUser);

        const memberBlobs = membersBlob.members;

        const registrationWithMemberBlobs: RegistrationWithMemberBlob[] = [];
        for (const registration of registrations) {
            const memberBlob = memberBlobs.find(m => m.id === registration.memberId);
            if (!memberBlob) {
                throw new Error('Member not found');
            }

            let r = memberBlob.registrations.find(r => r.id === registration.id);

            if (!r) {
                const member = members.find(m => m.id === registration.memberId);
                const balancesPermission = member ? (await Context.auth.hasFinancialMemberAccess(member, PermissionLevel.Read, Context.organization?.id)) : false;
                r = registration.getStructure();
                r.balances = balancesPermission
                    ? ((await CachedBalance.getForObjects([registration.id], null, ReceivableBalanceType.registration)).map((b) => {
                            return GenericBalance.create(b);
                        }))
                    : [];
                r.group = await this.group(registration.group);

                memberBlob.registrations.push(r);

                // Add organization if missing
                if (!membersBlob.organizations.find(o => o.id === r!.organizationId)) {
                    const organization = await Context.auth.getOrganization(r!.organizationId);
                    membersBlob.organizations.push(organization.getBaseStructure());
                }
            }

            const struct = RegistrationWithMemberBlob.create({
                ...r,
                member: memberBlob,
            });
            registrationWithMemberBlobs.push(struct);
        }

        return RegistrationsBlob.create({
            registrations: registrationWithMemberBlobs,
            organizations: membersBlob.organizations,
        });
    }

    static async eventNotifications(eventNotifications: EventNotification[]): Promise<EventNotificationStruct[]> {
        if (eventNotifications.length === 0) {
            return [];
        }

        // Load events
        const rows = await SQL.select()
            .from('_event_notifications_events')
            .where('event_notificationsId', eventNotifications.map(n => n.id))
            .fetch();

        const eventIdsMapping = new Map<string, string[]>();
        const allEvents = new Set<string>();

        for (const row of rows) {
            const notificationId = row['_event_notifications_events']['event_notificationsId'];
            const eventId = row['_event_notifications_events']['eventsId'];

            if (typeof eventId !== 'string') {
                console.error('Invalid event id', eventId);
                continue;
            }

            if (typeof notificationId !== 'string') {
                console.error('Invalid notification id', notificationId);
                continue;
            }

            const array = eventIdsMapping.get(notificationId);
            if (array) {
                array.push(eventId);
            }
            else {
                eventIdsMapping.set(notificationId, [eventId]);
            }

            allEvents.add(eventId);
        }

        const events = allEvents.size > 0 ? await Event.getByIDs(...Array.from(allEvents)) : [];
        const eventStructs = await this.events(events);
        const organizationIds = Formatter.uniqueArray(eventNotifications.map(n => n.organizationId));
        const organizationModels = organizationIds.length > 0 ? await Organization.getByIDs(...organizationIds) : [];
        const userIds = Formatter.uniqueArray(eventNotifications.flatMap(n => [n.createdBy, n.submittedBy]).filter(id => id !== null));
        const users = userIds.length > 0 ? await User.getByIDs(...userIds) : [];
        const userStructs = users.map((user) => {
            return NamedObject.create({
                id: user.id,
                name: user.name ?? user.email,
            });
        });

        const result: EventNotificationStruct[] = [];

        for (const notification of eventNotifications) {
            const thisEventStructs = eventIdsMapping.get(notification.id)?.map(id => eventStructs.find(e => e.id === id)).filter(e => !!e) ?? [];
            const organizationModel = organizationModels.find(o => o.id === notification.organizationId);
            if (!organizationModel) {
                throw new SimpleError({
                    code: 'organization_not_found',
                    message: 'Organization not found',
                    human: $t(`b6f89130-e727-4f85-b3a9-18b97c4f6ab6`),
                });
            }

            const organizationStruct = organizationModel.getBaseStructure();

            const struct = EventNotificationStruct.create({
                ...notification,
                organization: organizationStruct,
                createdBy: notification.createdBy ? userStructs.find(u => u.id === notification.createdBy) : null,
                submittedBy: notification.submittedBy ? userStructs.find(u => u.id === notification.submittedBy) : null,
                events: thisEventStructs,
            });

            result.push(struct);
        }

        return result;
    }

    static async orders(orders: Order[]): Promise<PrivateOrder[]> {
        if (orders.length === 0) {
            return [];
        }

        const result: PrivateOrder[] = [];
        const webshopIds = new Set(orders.map(o => o.webshopId));

        for (const webshopId of webshopIds) {
            const organizationId = orders.find(o => o.webshopId === webshopId)!.organizationId;

            const canAccess = await Context.auth.canAccessOrder({
                id: webshopId,
                organizationId,
            }, PermissionLevel.Read);

            if (!canAccess) {
                throw new SimpleError({
                    code: 'permission_denied',
                    message: 'Permission denied',
                    human: $t(`78cd49fe-260c-4fdc-ad83-e605734c684f`),
                });
            }
        }
        const allBalanceItems = await BalanceItem.select().where('orderId', orders.map(o => o.id)).fetch();

        for (const order of orders) {
            const balanceItems = allBalanceItems.filter(b => b.orderId === order.id);

            const struct = PrivateOrder.create({
                ...order,
                balanceItems: await BalanceItem.getStructureWithPrivatePayments(balanceItems),
            });

            result.push(struct);
        }

        return result;
    }

    static async documents(documents: Document[]): Promise<DocumentStruct[]> {
        const result: DocumentStruct[] = [];
        const templateIds = new Set(documents.map(d => d.templateId));

        for (const templateId of templateIds) {
            const organizationId = documents.find(d => d.templateId === templateId)!.organizationId;

            const canAccess = await Context.auth.canAccessDocumentTemplate({
                organizationId,
            }, PermissionLevel.Read);

            if (!canAccess) {
                throw new SimpleError({
                    code: 'permission_denied',
                    message: 'Permission denied',
                    human: $t(`792f644d-f3eb-4772-88b9-edb88f0b6773`),
                });
            }
        }

        for (const document of documents) {
            const struct = DocumentStruct.create({
                ...document,
            });

            result.push(struct);
        }

        return result;
    }

    // todo?
    static async tickets(tickets: Ticket[]): Promise<TicketPrivate[]> {
        const result: TicketPrivate[] = [];
        const webshopIds = new Set(tickets.map(t => t.webshopId));

        for (const webshopId of webshopIds) {
            const organizationId = tickets.find(t => t.webshopId === webshopId)!.organizationId;

            const canAccess = await Context.auth.canAccessWebshopTickets({
                id: webshopId,
                organizationId,
            }, PermissionLevel.Read);

            if (!canAccess) {
                throw new SimpleError({
                    code: 'permission_denied',
                    message: 'Permission denied',
                    human: $t(`b5079e56-2480-4ce6-a3a2-3f244540fa0e`),
                });
            }
        }

        for (const ticket of tickets) {
            const struct = TicketPrivate.create({ ...ticket });

            result.push(struct);
        }

        return result;
    }

    static async receivableBalance(balance: CachedBalance): Promise<ReceivableBalanceStruct> {
        return (await this.receivableBalances([balance]))[0];
    }

    static async receivableBalances(balances: CachedBalance[]): Promise<ReceivableBalanceStruct[]> {
        return (await this.receivableBalancesHelper(balances)).map(({ balance, object }) => ReceivableBalanceStruct.create({ ...balance, object }));
    }

    private static async receivableBalancesHelper(balances: CachedBalance[]): Promise< { balance: CachedBalance; object: ReceivableBalanceObject }[]> {
        if (balances.length === 0) {
            return [];
        }

        const organizationIds = Formatter.uniqueArray(balances.filter(b => b.objectType === ReceivableBalanceType.organization).map(b => b.objectId));
        const organizations = organizationIds.length > 0 ? await Organization.getByIDs(...organizationIds) : [];

        const responsibilities = organizationIds.length > 0
            ? (await MemberResponsibilityRecord.select()
                    .where('organizationId', organizationIds)
                    .where('endDate', null)
                    .fetch())
            : [];

        const organizationStructs = await this.organizations(organizations);

        const registrationIds = Formatter.uniqueArray([
            ...balances.filter(b => b.objectType === ReceivableBalanceType.registration).map(b => b.objectId),
        ]);
        const registrations = await Registration.getByIDs(...registrationIds);

        const memberIds = Formatter.uniqueArray([
            ...balances.filter(b => b.objectType === ReceivableBalanceType.member).map(b => b.objectId),
            ...responsibilities.map(r => r.memberId),
            ...registrations.map(r => r.memberId),
        ]);
        const members = memberIds.length > 0 ? await Member.getByIDs(...memberIds) : [];

        const userIds = Formatter.uniqueArray([
            ...balances.filter(b => b.objectType === ReceivableBalanceType.user || b.objectType === ReceivableBalanceType.userWithoutMembers).map(b => b.objectId),
        ]);
        const users = userIds.length > 0 ? await User.getByIDs(...userIds) : [];

        const result: { balance: CachedBalance; object: ReceivableBalanceObject }[] = [];

        function getMemberContacts(member: Member, balance: CachedBalance) {
            const url = Context.organization && Context.organization.id === balance.organizationId ? 'https://' + Context.organization.getHost() : '';
            return [
                ...(member.details.getMemberEmails().length
                    ? [
                            ReceivableBalanceObjectContact.create({
                                firstName: member.details.firstName ?? '',
                                lastName: member.details.lastName ?? '',
                                emails: member.details.getMemberEmails(),
                                meta: {
                                    type: 'member',
                                    responsibilityIds: [],
                                    url,
                                },
                            }),
                        ]
                    : []),

                ...((member.details.calculatedParentsHaveAccess || member.details.getMemberEmails().length === 0)
                    ? member.details.parents.filter(p => p.getEmails().length > 0).map(p => ReceivableBalanceObjectContact.create({
                            firstName: p.firstName ?? '',
                            lastName: p.lastName ?? '',
                            emails: p.getEmails(),
                            meta: {
                                type: 'parent',
                                responsibilityIds: [],
                                url,
                            },
                        }))
                    : []),
            ];
        }

        function getMemberCustomers(member: Member): PaymentCustomer[] {
            return [
                ...(member.details.defaultAge >= 14 || member.details.parents.length === 0 || !member.details.calculatedParentsHaveAccess
                    ? [
                            PaymentCustomer.create({
                                firstName: member.details.firstName ?? '',
                                lastName: member.details.lastName ?? '',
                                email: member.details.getMemberEmails()[0] ?? null,
                                phone: member.details.phone,
                            }),
                        ]
                    : []),

                ...((member.details.calculatedParentsHaveAccess || member.details.getMemberEmails().length === 0)
                    ? member.details.parents.map(parent => PaymentCustomer.create({
                            firstName: parent.firstName ?? '',
                            lastName: parent.lastName ?? '',
                            email: parent.getEmails()[0] ?? null,
                            phone: parent.phone,
                        }))
                    : []),
            ];
        }

        for (const balance of balances) {
            let object = ReceivableBalanceObject.create({
                id: balance.objectId,
                name: $t('6c3e777c-7cd6-4566-9540-8a829c26212f'),
            });

            if (balance.objectType === ReceivableBalanceType.organization) {
                const organization = organizationStructs.find(o => o.id === balance.objectId) ?? null;
                if (organization) {
                    const theseResponsibilities = responsibilities.filter(r => r.organizationId === organization.id);
                    const thisMembers = members.flatMap((m) => {
                        const resp = theseResponsibilities.filter(r => r.memberId === m.id);
                        return resp.length > 0
                            ? [{
                                    member: m,
                                    responsibilities: resp,
                                }]
                            : [];
                    });

                    object = ReceivableBalanceObject.create({
                        id: balance.objectId,
                        name: organization.name,
                        uri: organization.uri,
                        customers: organization.defaultCompanies.map(company => PaymentCustomer.create({ company })),
                        contacts: thisMembers.map(({ member, responsibilities }) => ReceivableBalanceObjectContact.create({
                            firstName: member.firstName ?? '',
                            lastName: member.lastName ?? '',
                            emails: member.details.getMemberEmails(),
                            meta: {
                                type: 'organization',
                                responsibilityIds: responsibilities.map(r => r.responsibilityId),
                                url: organization.dashboardUrl + '/boekhouding/openstaand/' + (Context.organization?.uri ?? ''),
                            },
                        })),
                    });
                }
            }
            else if (balance.objectType === ReceivableBalanceType.member) {
                const member = members.find(m => m.id === balance.objectId) ?? null;
                if (member) {
                    object = ReceivableBalanceObject.create({
                        id: balance.objectId,
                        name: member.details.name,
                        customers: getMemberCustomers(member),
                        contacts: getMemberContacts(member, balance),
                    });
                }
            }
            else if (balance.objectType === ReceivableBalanceType.registration) {
                const registration = registrations.find(r => r.id === balance.objectId) ?? null;
                if (!registration) {
                    continue;
                }
                const member = members.find(m => m.id === registration.memberId) ?? null;
                if (member) {
                    object = ReceivableBalanceObject.create({
                        id: balance.objectId,
                        name: member.details.name,
                        customers: getMemberCustomers(member),
                        contacts: getMemberContacts(member, balance),
                    });
                }
            }
            else if (balance.objectType === ReceivableBalanceType.user || balance.objectType === ReceivableBalanceType.userWithoutMembers) {
                const user = users.find(m => m.id === balance.objectId) ?? null;
                if (user) {
                    const url = Context.organization && Context.organization.id === balance.organizationId ? 'https://' + Context.organization.getHost() : '';
                    object = ReceivableBalanceObject.create({
                        id: balance.objectId,
                        name: user.name || user.email,
                        customers: [PaymentCustomer.create({
                            firstName: user.firstName,
                            lastName: user.lastName,
                            email: user.email,
                        })],
                        contacts: [
                            ReceivableBalanceObjectContact.create({
                                firstName: user.firstName ?? '',
                                lastName: user.lastName ?? '',
                                emails: [user.email],
                                meta: {
                                    responsibilityIds: [],
                                    url,
                                },
                            }),
                        ],
                    });
                }
            }

            result.push({
                balance,
                object,
            });
        }

        return result;
    }

    static async detailedReceivableBalances(organizationId: string, balances: CachedBalance[]): Promise<DetailedReceivableBalance[]> {
        const items = await this.receivableBalancesHelper(balances);
        const results: DetailedReceivableBalance[] = [];

        for (const { balance, object } of items) {
            const balanceItems = await CachedBalance.balanceForObjects(organizationId, [balance.objectId], balance.objectType);
            const balanceItemsWithPayments = await BalanceItem.getStructureWithPayments(balanceItems);

            const result = DetailedReceivableBalance.create({
                ...balance,
                object,
                balanceItems: balanceItemsWithPayments,
                // todo!!!
                payments: [],
            });

            results.push(result);
        }

        return results;
    }

    static async auditLogs(logs: AuditLog[]): Promise<AuditLogStruct[]> {
        const structs: AuditLogStruct[] = [];

        const userIds = Formatter.uniqueArray(logs.map(l => l.userId).filter(id => id !== null));
        const users = await User.getByIDs(...userIds);
        const organizationsIds = Formatter.uniqueArray(logs.map(l => l.organizationId).filter(id => id !== null));
        const organizations = await Organization.getByIDs(...organizationsIds);

        for (const log of logs) {
            const user = log.userId ? (users.find(u => u.id === log.userId) ?? null) : null;
            let userStruct: NamedObject | null = null;

            if (user) {
                if (!await Context.auth.canAccessUser(user)) {
                    if (user.permissions?.platform !== null) {
                        userStruct = NamedObject.create({
                            id: '',
                            name: $t(`da016ffd-45c5-41cc-90e4-d4e81105ebe0`) + ' ' + Platform.shared.config.name,
                        });
                    }
                    else {
                        userStruct = NamedObject.create({
                            id: '',
                            name: $t(`bd1e59c8-3d4c-4097-ab35-0ce7b20d0e50`),
                        });
                    }
                }
                else {
                    userStruct = NamedObject.create({
                        id: user.id,
                        name: (user.firstName || user.lastName) ? (user.firstName + ' ' + user.lastName) : user.email,
                    });
                }
            }

            let replacements = log.replacements;

            if (log.organizationId && log.organizationId !== Context.organization?.id) {
                replacements = new Map(log.replacements);
                const org = organizations.find(o => o.id === log.organizationId);
                replacements.set('org', AuditLogReplacement.create({
                    id: log.organizationId,
                    value: org?.name ?? $t(`cc098cc0-d849-4808-b53a-0b99755b3f99`),
                    type: AuditLogReplacementType.Organization,
                }));
            }

            structs.push(
                AuditLogStruct.create({
                    ...log,
                    replacements,
                    user: userStruct,
                }),
            );
        }

        return structs;
    }
}
