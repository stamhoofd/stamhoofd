import { AutoEncoderPatchType, PatchMap } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, CachedBalance, Document, Email, EmailTemplate, Event, EventNotification, Group, Member, MemberPlatformMembership, MemberWithRegistrations, Order, Organization, OrganizationRegistrationPeriod, Payment, Registration, User, Webshop } from '@stamhoofd/models';
import { AccessRight, EmailTemplate as EmailTemplateStruct, EventPermissionChecker, FinancialSupportSettings, GroupCategory, GroupStatus, GroupType, MemberWithRegistrationsBlob, PermissionLevel, PermissionsResourceType, Platform as PlatformStruct, ReceivableBalanceType, RecordSettings, ResourcePermissions } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { MemberRecordStore } from '../services/MemberRecordStore.js';
import { addTemporaryMemberAccess, hasTemporaryMemberAccess } from './TemporaryMemberAccess.js';

/**
 * One class with all the responsabilities of checking permissions to each resource in the system by a given user, possibly in an organization context.
 * This helps when dependencies of permissions change, such as parent categories for groups
 */
export class AdminPermissionChecker {
    organization: Organization | null;
    user: User;
    /**
     * The member that is linked to this user = is this user
     */
    member: MemberWithRegistrations | null = null;
    platform: PlatformStruct;

    organizationCache: Map<string, Organization | Promise<Organization | undefined>> = new Map();
    groupsCache: Map<string, Group | null | Promise<Group | null>> = new Map();

    constructor(user: User, platform: PlatformStruct, organization?: Organization) {
        this.user = user;
        this.platform = platform;

        if (user.organizationId && (!organization || organization.id !== user.organizationId)) {
            throw new SimpleError({
                code: 'invalid_scope',
                message: 'Tried accessing a resource without an organization context, but this user is limited to the organization context',
                statusCode: 403,
            });
        }

        this.organization = organization ?? null;
    }

    async getOrganization(id: string | Organization): Promise<Organization> {
        if (this.organization && id === this.organization.id) {
            return this.organization;
        }
        if (typeof id === 'string') {
            const c = this.organizationCache.get(id);
            if (c) {
                const result = await c;
                if (!result) {
                    throw new Error('Unexpected missing organization in AdminPermissionChecker.getOrganization');
                }
                return result;
            }
            const promise = Organization.getByID(id);
            this.organizationCache.set(id, promise);
            const result = await promise;
            if (!result) {
                console.error('Unexpected missing organization in AdminPermissionChecker.getOrganization', id);
                this.organizationCache.delete(id);
                throw new Error('Unexpected missing organization in AdminPermissionChecker.getOrganization');
            }
            this.organizationCache.set(id, result);
            return result;
        }
        return id;
    }

    async getGroup(groupId: string): Promise<Group | null> {
        const cache = this.groupsCache.get(groupId);
        if (cache !== undefined) {
            return await cache;
        }

        console.log('Get group', groupId);
        const promise = Group.select()
            .where('id', groupId)
            .first(false);

        this.groupsCache.set(groupId, promise);
        const group = await promise;
        this.groupsCache.set(groupId, group);
        return group;
    }

    async getGroups(groupIds: string[]): Promise<Group[]> {
        const cached: Group[] = [];
        const remainingIds: string[] = [];

        for (const groupId of groupIds) {
            const cache = this.groupsCache.get(groupId);
            if (cache !== undefined) {
                const resolved = await cache;
                if (resolved) {
                    cached.push(resolved);
                }
                else {
                    // Not found, no need to readd
                }
            }
            else {
                remainingIds.push(groupId);
            }
        }

        if (remainingIds.length > 0) {
            console.log('Get groups', remainingIds);
            const promise = Group.select()
                .where('id', remainingIds)
                .fetch();

            for (const groupId of remainingIds) {
                this.groupsCache.set(groupId, promise.then(list => list.find(l => l.id === groupId) ?? null));
            }
            const groups = await promise;
            cached.push(...groups);

            for (const groupId of remainingIds) {
                this.groupsCache.set(groupId, groups.find(l => l.id === groupId) ?? null);
            }
        }

        return cached;
    }

    cacheGroup(group: Group) {
        this.groupsCache.set(group.id, group);
    }

    cacheGroups(groups: Group[]) {
        for (const group of groups) {
            this.cacheGroup(group);
        }
    }

    async getOrganizationCurrentPeriod(id: string | Organization): Promise<OrganizationRegistrationPeriod> {
        const organization = await this.getOrganization(id);
        return await organization.getPeriod();
    }

    error(humanOrData?: string | { message: string; human?: string }): SimpleError {
        const human = typeof humanOrData === 'string' ? humanOrData : (humanOrData?.human ?? $t(`ab071f11-e05b-4bd9-9370-cd4f220c1b54`));
        const message = typeof humanOrData === 'string' ? humanOrData : (humanOrData?.message ?? 'You do not have permissions for this action');

        return new SimpleError({
            code: 'permission_denied',
            message,
            human,
            statusCode: 403,
        });
    }

    memberNotFoundOrNoAccess(): SimpleError {
        return this.notFoundOrNoAccess($t('d24814a3-aedc-4569-9ab3-f854027c4e9f'));
    }

    notFoundOrNoAccess(message?: string): SimpleError {
        return new SimpleError({
            code: 'not_found',
            message: 'Resource not found or no access',
            human: message ?? $t(`8a8bb10d-9a78-48d0-8589-65d95331530e`),
            statusCode: 404,
        });
    }

    get platformPermissions() {
        return this.user.permissions?.forPlatform(this.platform);
    }

    async getOrganizationPermissions(organizationOrId: string | Organization) {
        if (!this.user.permissions) {
            return null;
        }
        const organization = await this.getOrganization(organizationOrId);

        const p = this.user.permissions.forOrganization(
            organization,
            this.platform,
        );
        return p;
    }

    async canAccessPrivateOrganizationData(organization: Organization) {
        if (!this.checkScope(organization.id)) {
            return false;
        }

        if (!await this.hasSomeAccess(organization)) {
            return false;
        }
        return true;
    }

    checkScope(organizationId: string | null) {
        if (organizationId) {
            // If request is scoped to a different organization
            if (this.organization && organizationId !== this.organization.id) {
                return false;
            }

            // If user is limited to scope
            if (this.user.organizationId && organizationId !== this.user.organizationId) {
                return false;
            }
        }
        else {
            if (STAMHOOFD.userMode === 'organization') {
                // User is limited to a scope: can't access platform resources
                if (this.user.organizationId) {
                    return false;
                }
            }
            else {
                // User can access platform resources (e.g. API keys)
            }
        }

        return true;
    }

    async canAccessGroupsInPeriod(periodId: string, organizationId: string) {
        const organization = await this.getOrganization(organizationId);
        if (periodId !== organization.periodId) {
            if (STAMHOOFD.userMode === 'organization' || periodId !== this.platform.period.id) {
                if (!await this.hasFullAccess(organization.id)) {
                    return false;
                }
            }
        }
        return true;
    }

    async canAccessGroup(group: Group, permissionLevel: PermissionLevel = PermissionLevel.Read): Promise<boolean> {
        // Check permissions aren't scoped to a specific organization, and they mismatch
        if (!this.checkScope(group.organizationId)) {
            // return false;
        }

        if (!await this.canAccessGroupsInPeriod(group.periodId, group.organizationId)) {
            return false;
        }
        const organization = await this.getOrganization(group.organizationId);

        if (group.deletedAt || group.status === GroupStatus.Archived) {
            return await this.canAccessArchivedGroups(group.organizationId);
        }

        const organizationPermissions = await this.getOrganizationPermissions(group.organizationId);

        if (!organizationPermissions) {
            return false;
        }

        // Check global level permissions for this user
        if (organizationPermissions.hasResourceAccess(PermissionsResourceType.Groups, group.id, permissionLevel)) {
            return true;
        }

        if (group.type === GroupType.EventRegistration) {
            // Check if we can access the event
            const event = await Event.select().where('groupId', group.id).first(false);

            if (event && event.organizationId === group.organizationId && await this.canAccessEvent(event)) {
                return true;
            }
        }

        // Check parent categories
        if (group.type === GroupType.Membership) {
            const organizationPeriod = await this.getOrganizationCurrentPeriod(organization);
            const parentCategories = group.getParentCategories(organizationPeriod.settings.categories);
            for (const category of parentCategories) {
                if (organizationPermissions.hasResourceAccess(PermissionsResourceType.GroupCategories, category.id, permissionLevel)) {
                    return true;
                }
            }
        }

        if (group.type === GroupType.WaitingList) {
            // Check if this is a waiting list for an event
            const parentGroup = await Group.select()
                .where('type', GroupType.EventRegistration)
                .where('organizationId', group.organizationId)
                .where('waitingListId', group.id)
                .first(false);

            if (parentGroup) {
                return await this.canAccessGroup(parentGroup, permissionLevel);
            }
        }

        return false;
    }

    async canRegisterMembersInGroup(group: Group, asOrganizationId: string | null) {
        if (await this.canAccessGroup(group, PermissionLevel.Write)) {
            return true;
        }
        if (asOrganizationId) {
            if (group.settings.allowRegistrationsByOrganization && !group.getStructure().closed) {
                if (group.organizationId !== asOrganizationId) {
                    return await this.hasFullAccess(asOrganizationId);
                }
                else {
                    return await this.hasSomeAccess(asOrganizationId);
                }
            }
        }
        return false;
    }

    /**
     * Will throw error if not allowed to edit/add/delete this event
     * @param event
     * @returns Organization if event for specific organization, else null
     * @throws error if not allowed to write this event
     */
    async checkEventAccess(event: Event): Promise<Organization | null> {
        return await EventPermissionChecker.checkEventAccessAsync(event, {
            userPermissions: this.user.permissions,
            platform: this.platform,
            getOrganization: async (id: string) => await this.getOrganization(id),
        });
    }

    async canAccessEvent(event: Event): Promise<boolean> {
        try {
            await this.checkEventAccess(event);
            return true;
        }
        catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                return false;
            }
            throw e;
        }
    }

    async canAccessEventNotification(notification: EventNotification, permissionLevel: PermissionLevel = PermissionLevel.Read) {
        // todo: check if user has access to this notification
        const events = EventNotification.events.isLoaded(notification) ? notification.events : await EventNotification.events.load(notification);
        for (const event of events) {
            if (!await this.canAccessEvent(event)) {
                return false;
            }
        }

        if (events.length === 0 || permissionLevel === PermissionLevel.Full) {
            // Requires `OrganizationEventNotificationReviewer` access right for the organization
            if (!await this.canReviewEventNotification(notification)) {
                return false;
            }
        }

        return true;
    }

    async canAccessArchivedGroups(organizationId: string) {
        return await this.hasFullAccess(organizationId);
    }

    async canAccessMember(member: MemberWithRegistrations, permissionLevel: PermissionLevel = PermissionLevel.Read) {
        if (permissionLevel !== PermissionLevel.Full && this.isUserManager(member)) {
            return true;
        }

        // Check user has permissions
        if (!this.user.permissions) {
            return false;
        }

        if (this.hasPlatformFullAccess()) {
            return true;
        }

        if (this.getPlatformAccessibleOrganizationTags(permissionLevel) === 'all') {
            // Can access all members: even members without any registration
            return true;
        }

        if (!this.checkScope(member.organizationId)) {
            return false;
        }

        if (member.organizationId && await this.hasFullAccess(member.organizationId, permissionLevel)) {
            return true;
        }

        // Temporary access
        if (hasTemporaryMemberAccess(this.user.id, member.id, permissionLevel)) {
            console.log('User has temporary access to member', member.id, 'for user', this.user.id);
            return true;
        }

        for (const registration of member.registrations) {
            if (await this.canAccessRegistration(registration, permissionLevel, false)) {
                return true;
            }
        }

        return false;
    }

    /**
     * The server will temporarily grant the user access to this member, and store this in the server
     * memory. This is required for adding new members to an organization (first add member -> then patch with registrations, which requires write access).
     */
    async temporarilyGrantMemberAccess(member: MemberWithRegistrations, permissionLevel: PermissionLevel = PermissionLevel.Write) {
        console.log('Temporarily granting access to member', member.id, 'for user', this.user.id);
        addTemporaryMemberAccess(this.user.id, member.id, permissionLevel);
    }

    /**
     * Only full admins can delete members permanently
     */
    async canDeleteMember(member: MemberWithRegistrations) {
        if (member.registrations.length === 0 && this.isUserManager(member)) {
            const cachedBalance = await CachedBalance.getForObjects([member.id], null, ReceivableBalanceType.member);
            if (cachedBalance.length === 0 || (cachedBalance[0].amountOpen === 0 && cachedBalance[0].amountPending === 0)) {
                const platformMemberships = await MemberPlatformMembership.where({ memberId: member.id });
                if (platformMemberships.length === 0) {
                    return true;
                }
            }
        }

        if (member.organizationId) {
            // Not a platform
            return await this.hasFullAccess(member.organizationId);
        }
        return this.hasPlatformFullAccess();
    }

    /**
     * Note: only checks admin permissions. Users that 'own' this member can also access it but that does not use the AdminPermissionChecker
     */
    async canAccessRegistration(registration: Registration, permissionLevel: PermissionLevel = PermissionLevel.Read, checkMember: boolean | MemberWithRegistrations = true) {
        if (registration.deactivatedAt || !registration.registeredAt) {
            if (!checkMember) {
                // We can't grant access to a member because of a deactivated registration
                return false;
            }

            // No full access: cannot access deactivated registrations
            if (permissionLevel !== PermissionLevel.Read) {
                // Not allowed to edit registrations that are deleted
                return false;
            }
        }

        const organizationPermissions = await this.getOrganizationPermissions(registration.organizationId);

        if (!organizationPermissions) {
            return false;
        }

        if (organizationPermissions.hasAccess(PermissionLevel.Full)) {
            // Only full permissions; because non-full doesn't have access to other periods
            return true;
        }
        const organization = await this.getOrganization(registration.organizationId);

        if (registration.periodId !== organization.periodId) {
            if (STAMHOOFD.userMode === 'organization' || registration.periodId !== this.platform.period.id) {
                // We already checked for full permissions - and we don't have full permissions
                // so that also means no permissions for registrations in other periods
                return false;
            }
        }

        const group = Registration.group.isLoaded(registration) ? ((registration as any).group as Group) : await this.getGroup(registration.groupId);
        if (!group || group.deletedAt) {
            return false;
        }

        if (await this.canAccessGroup(group, permissionLevel)) {
            return true;
        }

        if (permissionLevel === PermissionLevel.Read && checkMember && group.settings.implicitlyAllowViewRegistrations) {
            // We can also view this registration if we have access to the member
            const members = checkMember === true ? await Member.getBlobByIds(registration.memberId) : [checkMember];

            if (members.length === 1) {
                if (await this.canAccessMember(members[0], permissionLevel)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
        Returns true if the user has full access to all resource ids in the provided resources map. The resource permissions in the map are ignored for now.
    */
    async hasFullAccessForOrganizationResources(organizationId: string, resources: Map<PermissionsResourceType, Map<string, ResourcePermissions>>): Promise<boolean> {
        const organizationPermissions = await this.getOrganizationPermissions(organizationId);

        if (!organizationPermissions) {
            return false;
        }

        for (const [resourceType, mapForType] of resources.entries()) {
            for (const resourceId of mapForType.keys()) {
                if (!organizationPermissions.hasResourceAccess(resourceType, resourceId, PermissionLevel.Full)) {
                    return false;
                }
            }
        }

        return true;
    }

    async canAccessWebshop(webshop: { id: string; organizationId: string }, permissionLevel: PermissionLevel = PermissionLevel.Read) {
        const organizationPermissions = await this.getOrganizationPermissions(webshop.organizationId);

        if (!organizationPermissions) {
            return false;
        }

        if (organizationPermissions.hasResourceAccess(PermissionsResourceType.Webshops, webshop.id, permissionLevel)) {
            return true;
        }

        if (permissionLevel === PermissionLevel.Read && organizationPermissions.hasResourceAccessRight(PermissionsResourceType.Webshops, webshop.id, AccessRight.WebshopScanTickets)) {
            return true;
        }

        return false;
    }

    async canAccessWebshopTickets(webshop: { id: string; organizationId: string }, permissionLevel: PermissionLevel = PermissionLevel.Read) {
        if (!this.checkScope(webshop.organizationId)) {
            return false;
        }

        const organizationPermissions = await this.getOrganizationPermissions(webshop.organizationId);

        if (!organizationPermissions) {
            return false;
        }

        if (organizationPermissions.hasResourceAccess(PermissionsResourceType.Webshops, webshop.id, permissionLevel)) {
            return true;
        }

        if ((permissionLevel === PermissionLevel.Read || permissionLevel === PermissionLevel.Write) && organizationPermissions.hasResourceAccessRight(PermissionsResourceType.Webshops, webshop.id, AccessRight.WebshopScanTickets)) {
            return true;
        }

        return false;
    }

    async canAccessOrder(webshop: { id: string; organizationId: string }, permissionLevel: PermissionLevel = PermissionLevel.Read) {
        return await this.canAccessWebshop(webshop, permissionLevel);
    }

    async canAccessPayment(payment: Payment, permissionLevel: PermissionLevel = PermissionLevel.Read) {
        return await this.canAccessPayments([payment], permissionLevel);
    }

    async canAccessPayments(payments: Payment[], permissionLevel: PermissionLevel = PermissionLevel.Read) {
        for (const payment of payments) {
            if (!this.checkScope(payment.organizationId)) {
                // Invalid scope
                return false;
            }
        }

        if (payments.length === 0) {
            return false;
        }

        const organizationId = payments[0].organizationId;
        for (const item of payments) {
            if (item.organizationId !== organizationId) {
                // Cannot merge multiple organizations for now
                return false;
            }
        }

        // First try without queries
        if (!organizationId) {
            return this.hasPlatformFullAccess();
        }

        if (await this.canManagePayments(organizationId)) {
            return true;
        }

        const { balanceItems } = await Payment.loadBalanceItems(payments);

        if (balanceItems.length === 0) {
            return false;
        }
        return await this.canAccessBalanceItems(balanceItems, permissionLevel);
    }

    async canAccessBalanceItems(
        balanceItems: BalanceItem[],
        permissionLevel: PermissionLevel = PermissionLevel.Read,
        data?: {
            registrations: Registration[];
            orders: Order[];
        },
    ): Promise<boolean> {
        // These balance items are out of scope - but we do have access to them
        for (const balanceItem of balanceItems) {
            if (balanceItem.payingOrganizationId && this.checkScope(balanceItem.payingOrganizationId)) {
                if (await this.canManagePayments(balanceItem.payingOrganizationId)) {
                    return true;
                }
            }
        }

        for (const balanceItem of balanceItems) {
            if (!this.checkScope(balanceItem.organizationId)) {
                // Invalid scope
                return false;
            }
        }

        if (balanceItems.length === 0) {
            return true;
        }

        const organizationId = balanceItems[0].organizationId;
        for (const item of balanceItems) {
            if (item.organizationId !== organizationId) {
                // Cannot merge multiple organizations for now
                return false;
            }
        }

        // First try without queries
        if (await this.canManagePayments(organizationId)) {
            return true;
        }

        if (permissionLevel === PermissionLevel.Read) {
            for (const balanceItem of balanceItems) {
                if (balanceItem.userId === this.user.id) {
                    return true;
                }
            }
        }

        // Slight optimization possible here
        const { registrations, orders } = data ?? (this.user.permissions || permissionLevel === PermissionLevel.Read) ? (await Payment.loadBalanceItemRelations(balanceItems)) : { registrations: [], orders: [] };

        if (this.user.permissions) {
            // We grant permission for a whole payment when the user has at least permission for a part of that payment.
            for (const registration of registrations) {
                if (await this.canAccessRegistration(registration, permissionLevel)) {
                    return true;
                }
            }

            const webshopCache: Map<string, Webshop> = new Map();

            for (const order of orders) {
                const webshop = webshopCache.get(order.webshopId) ?? await Webshop.getByID(order.webshopId);
                if (webshop) {
                    webshopCache.set(order.webshopId, webshop);

                    if (await this.canAccessWebshop(webshop, permissionLevel)) {
                        return true;
                    }
                }
            }
        }

        if (permissionLevel === PermissionLevel.Read) {
            // Check members
            const userMembers = await Member.getMembersWithRegistrationForUser(this.user);
            for (const member of userMembers) {
                if (balanceItems.find(m => m.memberId === member.id)) {
                    return true;
                }
            }
        }

        return false;
    }

    async canAccessDocumentTemplate(documentTemplate: { organizationId: string }, _: PermissionLevel = PermissionLevel.Read) {
        if (!this.checkScope(documentTemplate.organizationId)) {
            return false;
        }

        return await this.hasFullAccess(documentTemplate.organizationId);
    }

    async canAccessDocument(document: Document, level: PermissionLevel = PermissionLevel.Read) {
        if (!this.checkScope(document.organizationId)) {
            return false;
        }

        if (await this.hasFullAccess(document.organizationId)) {
            return true;
        }

        if (level === PermissionLevel.Read && document.memberId) {
            const members = await Member.getMembersWithRegistrationForUser(this.user);

            if (members.find(m => m.id == document.memberId)) {
                return true;
            }
        }

        return false;
    }

    async canAccessUser(user: User, level: PermissionLevel = PermissionLevel.Read) {
        // Write = edit email, name
        // full = edit permissions
        if (user.id === this.user.id && (level === PermissionLevel.Read || level === PermissionLevel.Write)) {
            return true;
        }

        if (!this.checkScope(user.organizationId)) {
            return false;
        }

        if (!user.organizationId) {
            if (this.hasPlatformFullAccess()) {
                return true;
            }

            // Check if this user has permissions for the current scoped organization
            if (this.organization && await this.hasFullAccess(this.organization.id)) {
                if (user.permissions?.forOrganization(this.organization)) {
                    return true;
                }
            }

            return false;
        }

        return await this.canManageAdmins(user.organizationId);
    }

    async canEditUserName(user: User) {
        if (user.hasAccount() && !user.hasPasswordBasedAccount()) {
            return false;
        }

        if (user.id === this.user.id) {
            return true;
        }

        if (user.organizationId) {
            // normal behaviour
            return this.canAccessUser(user, PermissionLevel.Write);
        }

        // platform user: only allowed to change names if not platform admins
        if (user.permissions?.globalPermissions) {
            return this.hasPlatformFullAccess();
        }

        return this.canAccessUser(user, PermissionLevel.Write);
    }

    async canEditUserEmail(user: User) {
        return this.canEditUserName(user);
    }

    async canAccessEmailTemplate(template: EmailTemplate, level: PermissionLevel = PermissionLevel.Read): Promise<boolean> {
        if (level === PermissionLevel.Read && !EmailTemplateStruct.isSavedEmail(template.type)) {
            if (template.organizationId === null) {
                // Public templates

                return EmailTemplateStruct.allowPlatformLevel(template.type);
            }

            if (!await this.canReadEmailTemplates(template.organizationId)) {
                return false;
            }

            return EmailTemplateStruct.allowOrganizationLevel(template.type);
        }

        // Note: if the template has an organizationId of null, everyone can access it, but only for reading
        // that is why we only check the scope afterwards
        if (!this.checkScope(template.organizationId)) {
            return false;
        }

        if (!template.organizationId) {
            return this.hasPlatformFullAccess() || !!this.platformPermissions?.hasAccessRight(AccessRight.ManageEmailTemplates);
        }

        if (await this.hasFullAccess(template.organizationId)) {
            return true;
        }

        if (template.webshopId) {
            const webshop = await Webshop.getByID(template.webshopId);
            if (!webshop || !(await this.canAccessWebshop(webshop, PermissionLevel.Full))) {
                return false;
            }

            return true;
        }

        if (template.groupId) {
            const group = await Group.getByID(template.groupId);
            if (!group || !(await this.canAccessGroup(group, PermissionLevel.Full))) {
                return false;
            }

            return true;
        }

        const o = await this.getOrganizationPermissions(template.organizationId);
        if (o && o.hasAccessRight(AccessRight.ManageEmailTemplates)) {
            return true;
        }

        return false;
    }

    async canLinkBalanceItemToUser(balanceItem: BalanceItem, linkingUser: User) {
        if (!this.checkScope(linkingUser.organizationId)) {
            return false;
        }

        if (!this.checkScope(balanceItem.organizationId)) {
            return false;
        }

        if (await this.canManagePayments(balanceItem.organizationId)) {
            return true;
        }

        return false;
    }

    async canLinkBalanceItemToMember(member: MemberWithRegistrations) {
        if (!this.checkScope(member.organizationId)) {
            return false;
        }

        if (member.organizationId) {
            if (await this.canManagePayments(member.organizationId)) {
                return true;
            }
        }
        else {
            const organizationIds = Formatter.uniqueArray(member.registrations.map(r => r.organizationId));
            for (const organizationId of organizationIds) {
                if (await this.canManagePayments(organizationId)) {
                    return true;
                }
            }
        }

        if (await this.hasFinancialMemberAccess(member, PermissionLevel.Write)) {
            return true;
        }

        return false;
    }

    async canManageFinances(organizationId: string) {
        const organizationPermissions = await this.getOrganizationPermissions(organizationId);

        if (!organizationPermissions) {
            return false;
        }

        return organizationPermissions.hasAccessRight(AccessRight.OrganizationFinanceDirector);
    }

    /**
     * Mainly for transfer payment management
     */
    async canManagePayments(organizationId: string) {
        const organizationPermissions = await this.getOrganizationPermissions(organizationId);

        if (!organizationPermissions) {
            return false;
        }

        return !!organizationPermissions && (
            organizationPermissions.hasAccessRight(AccessRight.OrganizationManagePayments)
            || organizationPermissions.hasAccessRight(AccessRight.OrganizationFinanceDirector)
        );
    }

    async canCreateWebshops(organizationId: string) {
        const organizationPermissions = await this.getOrganizationPermissions(organizationId);

        if (!organizationPermissions) {
            return false;
        }

        return !!organizationPermissions && organizationPermissions.hasAccessRight(AccessRight.OrganizationCreateWebshops);
    }

    async canManagePaymentAccounts(organizationId: string, level: PermissionLevel = PermissionLevel.Read) {
        if (level === PermissionLevel.Read) {
            return await this.hasSomeAccess(organizationId);
        }

        return await this.canManageFinances(organizationId);
    }

    async canActivatePackages(organizationId: string) {
        return await this.canManageFinances(organizationId);
    }

    async canDeactivatePackages(organizationId: string) {
        return this.canManageFinances(organizationId);
    }

    async canManageDocuments(organizationId: string, _: PermissionLevel = PermissionLevel.Read) {
        const organizationPermissions = await this.getOrganizationPermissions(organizationId);

        if (!organizationPermissions) {
            return false;
        }

        return this.hasFullAccess(organizationId);
    }

    async canAccessEmailBounces(organizationId: string) {
        return this.hasSomeAccess(organizationId);
    }

    async canSendEmails(organizationId: Organization | string | null) {
        if (organizationId) {
            return (await this.getOrganizationPermissions(organizationId))?.hasAccessRightForSomeResourceOfType(PermissionsResourceType.Senders, AccessRight.SendMessages) ?? false;
        }
        return this.platformPermissions?.hasAccessRightForSomeResourceOfType(PermissionsResourceType.Senders, AccessRight.SendMessages) ?? false;
    }

    /**
     * Fast check if this user can read at least one email in the system.
     */
    async canReadEmails(organizationId: Organization | string | null) {
        if (await this.canSendEmails(organizationId)) {
            // A user can reads its own emails, so they can read.
            return true;
        }
        if (organizationId) {
            return (await this.getOrganizationPermissions(organizationId))?.hasAccessForSomeResourceOfType(PermissionsResourceType.Senders, PermissionLevel.Read) ?? false;
        }
        return this.platformPermissions?.hasAccessForSomeResourceOfType(PermissionsResourceType.Senders, PermissionLevel.Read) ?? false;
    }

    async canReadAllEmails(organizationId: Organization | string | null, senderId = ''): Promise<boolean> {
        if (organizationId) {
            return (await this.getOrganizationPermissions(organizationId))?.hasResourceAccess(PermissionsResourceType.Senders, senderId, PermissionLevel.Read) ?? false;
        }
        return this.platformPermissions?.hasResourceAccess(PermissionsResourceType.Senders, senderId, PermissionLevel.Read) ?? false;
    }

    async canAccessEmail(email: Email, level: PermissionLevel = PermissionLevel.Read): Promise<boolean> {
        if (!this.checkScope(email.organizationId)) {
            return false;
        }

        if (email.deletedAt) {
            return false;
        }

        if (email.userId === this.user.id) {
            // User can always read their own emails
            // Note; for sending we'll always need to use 'canSendEmailsFrom' externally
            return true;
        }

        if (email.organizationId) {
            const organizationPermissions = await this.getOrganizationPermissions(email.organizationId);
            if (!organizationPermissions) {
                return false;
            }
            if (!email.senderId) {
                return organizationPermissions.hasResourceAccess(PermissionsResourceType.Senders, '', level);
            }
            return organizationPermissions.hasResourceAccess(PermissionsResourceType.Senders, email.senderId, level);
        }

        // Platform email
        const platformPermissions = this.platformPermissions;
        if (!platformPermissions) {
            return false;
        }
        if (!email.senderId) {
            return platformPermissions.hasResourceAccess(PermissionsResourceType.Senders, '', level);
        }
        return platformPermissions.hasResourceAccess(PermissionsResourceType.Senders, email.senderId, level);
    }

    async canSendEmail(email: Email): Promise<boolean> {
        if (email.senderId) {
            return await this.canSendEmailsFrom(email.organizationId, email.senderId);
        }
        return await this.canSendEmails(email.organizationId);
    }

    async canSendEmailsFrom(organizationId: Organization | string | null, senderId: string): Promise<boolean> {
        if (organizationId) {
            return (await this.getOrganizationPermissions(organizationId))?.hasResourceAccessRight(PermissionsResourceType.Senders, senderId, AccessRight.SendMessages) ?? false;
        }
        return this.platformPermissions?.hasResourceAccessRight(PermissionsResourceType.Senders, senderId, AccessRight.SendMessages) ?? false;
    }

    async canReadEmailTemplates(organizationId: string) {
        if (!await this.hasSomeAccess(organizationId) && !this.hasSomePlatformAccess()) {
            return false;
        }

        return true;
    }

    async canCreateGroupInCategory(organizationId: string, category: GroupCategory) {
        const organizationPermissions = await this.getOrganizationPermissions(organizationId);

        if (!organizationPermissions) {
            return false;
        }

        if (organizationPermissions.hasResourceAccessRight(PermissionsResourceType.GroupCategories, category.id, AccessRight.OrganizationCreateGroups)) {
            return true;
        }

        // Check parents
        const organization = await this.getOrganization(organizationId);
        const organizationPeriod = await this.getOrganizationCurrentPeriod(organization);
        const parentCategories = category.getParentCategories(organizationPeriod.settings.categories);

        for (const parentCategory of parentCategories) {
            if (organizationPermissions.hasResourceAccessRight(PermissionsResourceType.GroupCategories, parentCategory.id, AccessRight.OrganizationCreateGroups)) {
                return true;
            }
        }

        return false;
    }

    canUpload(data: { private: boolean }) {
        if (data.private) {
            return true;
        }
        return !!this.user.permissions;
    }

    canManageOrganizationDomain(organizationId: string) {
        return this.hasFullAccess(organizationId);
    }

    canManageSSOSettings(organizationId: string | null) {
        if (!organizationId) {
            return this.hasPlatformFullAccess();
        }
        return this.hasFullAccess(organizationId);
    }

    async canManageOrganizationSettings(organizationId: string) {
        return this.hasFullAccess(organizationId);
    }

    /**
     * Use this as a circuit breaker to avoid queries for non-admin users
     */
    async hasSomeAccess(organizationOrId: string | Organization): Promise<boolean> {
        const organizationPermissions = await this.getOrganizationPermissions(organizationOrId);
        return !!organizationPermissions && !organizationPermissions.isEmpty;
    }

    async canManageAdmins(organizationId: string) {
        return !this.user.isApiUser && (await this.hasFullAccess(organizationId));
    }

    async canReviewEventNotification(eventNotification: { organizationId: string }) {
        if (!this.checkScope(eventNotification.organizationId)) {
            return false;
        }

        const organizationPermissions = await this.getOrganizationPermissions(eventNotification.organizationId);

        if (!organizationPermissions) {
            return false;
        }

        if (organizationPermissions.hasAccessRight(AccessRight.OrganizationEventNotificationReviewer)) {
            return true;
        }
        return false;
    }

    async hasFullAccess(organizationId: string, level = PermissionLevel.Full): Promise<boolean> {
        const organizationPermissions = await this.getOrganizationPermissions(organizationId);

        if (!organizationPermissions) {
            return false;
        }

        return !!organizationPermissions && organizationPermissions.hasAccess(level);
    }

    isUserManager(member: MemberWithRegistrations) {
        return !!member.users.find(u => u.id === this.user.id);
    }

    /**
     * Return a list of RecordSettings the current user can view or edit
     */
    async hasFinancialMemberAccess(member: MemberWithRegistrations, level: PermissionLevel = PermissionLevel.Read, organizationId?: string): Promise<boolean> {
        const isUserManager = this.isUserManager(member);

        if (isUserManager && level === PermissionLevel.Read) {
            return true;
        }

        if (!await this.canAccessMember(member, level)) {
            return false;
        }

        // Temporary access
        if (hasTemporaryMemberAccess(this.user.id, member.id, level)) {
            return true;
        }

        // First list all organizations this member is part of
        const organizations: Organization[] = [];

        if (member.organizationId) {
            if (this.checkScope(member.organizationId)) {
                organizations.push(await this.getOrganization(member.organizationId));
            }
        }
        else {
            if (organizationId) {
                if (this.checkScope(organizationId)) {
                    organizations.push(await this.getOrganization(organizationId));
                }
            }
            else {
                for (const registration of member.registrations) {
                    if (this.checkScope(registration.organizationId)) {
                        if (!organizations.find(o => o.id === registration.organizationId)) {
                            organizations.push(await this.getOrganization(registration.organizationId));
                        }
                    }
                }
            }
        }

        // Loop all organizations.
        for (const organization of organizations) {
            const permissions = await this.getOrganizationPermissions(organization);
            if (!permissions) {
                continue;
            }

            if (isUserManager) {
                // Requirements are higher: you need financial access to write your own financial
                // data changes
                if (permissions.hasAccessRight(AccessRight.OrganizationManagePayments)) {
                    return true;
                }
                continue;
            }

            if (permissions.hasAccessRight(level === PermissionLevel.Read ? AccessRight.MemberReadFinancialData : AccessRight.MemberWriteFinancialData)) {
                return true;
            }
        }

        // Platform data
        const platformPermissions = this.platformPermissions;
        if (platformPermissions) {
            if (isUserManager) {
                // Requirements are higher: you need financial access to write your own financial
                // data changes
                if (platformPermissions.hasAccessRight(AccessRight.OrganizationManagePayments)) {
                    return true;
                }
            }
            else {
                if (platformPermissions.hasAccessRight(level === PermissionLevel.Read ? AccessRight.MemberReadFinancialData : AccessRight.MemberWriteFinancialData)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Return a list of RecordSettings the current user can view or edit
     */
    async hasNRNAccess(member: MemberWithRegistrations, level: PermissionLevel = PermissionLevel.Read): Promise<boolean> {
        const isUserManager = this.isUserManager(member);

        if (isUserManager) {
            return true;
        }

        if (!await this.canAccessMember(member, level)) {
            return false;
        }

        if (hasTemporaryMemberAccess(this.user.id, member.id, PermissionLevel.Full)) {
            return true;
        }

        // First list all organizations this member is part of
        const organizations: Organization[] = [];

        if (member.organizationId) {
            if (this.checkScope(member.organizationId)) {
                organizations.push(await this.getOrganization(member.organizationId));
            }
        }

        for (const registration of member.registrations) {
            if (this.checkScope(registration.organizationId)) {
                if (!organizations.find(o => o.id === registration.organizationId)) {
                    organizations.push(await this.getOrganization(registration.organizationId));
                }
            }
        }

        // Loop all organizations.
        for (const organization of organizations) {
            const permissions = await this.getOrganizationPermissions(organization);
            if (!permissions) {
                continue;
            }

            if (permissions.hasAccessRight(AccessRight.MemberManageNRN)) {
                return true;
            }
        }

        // Platform data
        const platformPermissions = this.platformPermissions;
        if (platformPermissions) {
            if (platformPermissions.hasAccessRight(AccessRight.MemberManageNRN)) {
                return true;
            }
        }

        return false;
    }

    async canFilterMembersOnRecordId(recordId: string): Promise<{ canAccess: false; record: RecordSettings | null } | { canAccess: true; record: RecordSettings }> {
        const record = await MemberRecordStore.getRecord(recordId);
        if (!record) {
            return {
                canAccess: false,
                record: null,
            };
        }

        if (!this.checkScope(record.organizationId)) {
            return {
                canAccess: false,
                record: record.record,
            };
        }

        if (!this.user.permissions) {
            return {
                canAccess: false,
                record: record.record,
            };
        }

        if (record.organizationId) {
            const organizationPermissions = await this.getOrganizationPermissions(record.organizationId);
            if (organizationPermissions && organizationPermissions.hasResourceAccess(PermissionsResourceType.RecordCategories, record.rootCategoryId, PermissionLevel.Read)) {
                return {
                    canAccess: true,
                    record: record.record,
                };
            }
        }
        else {
            // ONLY check current scoped organization
            if (this.organization) {
                const organizationPermissions = await this.getOrganizationPermissions(this.organization.id);
                if (organizationPermissions && organizationPermissions.hasResourceAccess(PermissionsResourceType.RecordCategories, record.rootCategoryId, PermissionLevel.Read)) {
                    return {
                        canAccess: true,
                        record: record.record,
                    };
                }
            }
        }

        // 2. Check platform permissions
        if (this.platformPermissions?.hasResourceAccess(PermissionsResourceType.RecordCategories, record.rootCategoryId, PermissionLevel.Read)) {
            return {
                canAccess: true,
                record: record.record,
            };
        }

        // All member access, means also having access to record categories of non-registered members
        if (this.canAccessAllPlatformMembers(PermissionLevel.Read)) {
            return {
                canAccess: true,
                record: record.record,
            };
        }

        return {
            canAccess: false,
            record: record.record,
        };
    }

    async checkRecordAccess(member: MemberWithRegistrations, recordId: string, level: PermissionLevel = PermissionLevel.Read): Promise<{ canAccess: false; record: RecordSettings | null } | { canAccess: true; record: RecordSettings }> {
        const record = await MemberRecordStore.getRecord(recordId);
        if (!record) {
            return {
                canAccess: false,
                record: null,
            };
        }

        if (!this.checkScope(record.organizationId)) {
            return {
                canAccess: false,
                record: record.record,
            };
        }

        const isUserManager = this.isUserManager(member);
        if (isUserManager) {
            if (record.record.checkPermissionForUserManager(level)) {
                return {
                    canAccess: true,
                    record: record.record,
                };
            }
        }

        if (!this.user.permissions) {
            return {
                canAccess: false,
                record: record.record,
            };
        }

        if (record.organizationId) {
            const organizationPermissions = await this.getOrganizationPermissions(record.organizationId);
            if (organizationPermissions && organizationPermissions.hasResourceAccess(PermissionsResourceType.RecordCategories, record.rootCategoryId, level)) {
                return {
                    canAccess: true,
                    record: record.record,
                };
            }
        }
        else {
            // Also check current scoped organization
            if (this.organization) {
                const organizationPermissions = await this.getOrganizationPermissions(this.organization.id);
                if (organizationPermissions && organizationPermissions.hasResourceAccess(PermissionsResourceType.RecordCategories, record.rootCategoryId, level)) {
                    return {
                        canAccess: true,
                        record: record.record,
                    };
                }
            }
        }

        // 2. Check platform permissions
        if (this.platformPermissions?.hasResourceAccess(PermissionsResourceType.RecordCategories, record.rootCategoryId, level)) {
            return {
                canAccess: true,
                record: record.record,
            };
        }

        // All member access, means also having access to record categories of non-registered members
        if (this.canAccessAllPlatformMembers(level)) { // needs to be full to also inherit record category access
            return {
                canAccess: true,
                record: record.record,
            };
        }

        if (hasTemporaryMemberAccess(this.user.id, member.id, PermissionLevel.Full)) {
            // You created this member, so temporary can read all records in order to set the member up correctly
            return {
                canAccess: true,
                record: record.record,
            };
        }

        // It is possible that this is a platform admin (or an admin that has access to multiple organizations), and inherits automatic permissions for tags. So'll need to loop all the organizations where this member has an active registration for
        if (!record.organizationId && !this.organization) {
            const checkedOrganizations = new Map<string, boolean>();
            for (const registration of member.registrations) {
                const permissions = checkedOrganizations.get(registration.organizationId);

                // Checking the organization permissions is faster (and less data lookups required), so we do that first before doing the more expensive registration access check
                if (permissions !== undefined) {
                    if (permissions === true && await this.canAccessRegistration(registration, level)) {
                        return {
                            canAccess: true,
                            record: record.record,
                        };
                    }
                    continue;
                }

                const organizationPermissions = await this.getOrganizationPermissions(registration.organizationId);
                if (organizationPermissions && organizationPermissions.hasResourceAccess(PermissionsResourceType.RecordCategories, record.rootCategoryId, level)) {
                    checkedOrganizations.set(registration.organizationId, true);
                    if (await this.canAccessRegistration(registration, level)) {
                        return {
                            canAccess: true,
                            record: record.record,
                        };
                    }
                }
                else {
                    checkedOrganizations.set(registration.organizationId, false);
                }
            }
        }

        return {
            canAccess: false,
            record: record.record,
        };
    }

    /**
     * Performance helper
     */
    async canAccessAllMembers(organizationId: string, level: PermissionLevel = PermissionLevel.Read): Promise<boolean> {
        const permissions = await this.getOrganizationPermissions(organizationId);
        if (!permissions) {
            return false;
        }

        return permissions.hasResourceAccess(PermissionsResourceType.Groups, '', level);
    }

    /**
     * Changes data inline
     */
    async filterMemberData(member: MemberWithRegistrations, data: MemberWithRegistrationsBlob, options?: { forAdminCartCalculation?: boolean }): Promise<MemberWithRegistrationsBlob> {
        const cloned = data.clone();

        for (const [key, value] of cloned.details.recordAnswers.entries()) {
            const { canAccess, record } = await this.checkRecordAccess(member, key, PermissionLevel.Read);
            if (!canAccess) {
                cloned.details.recordAnswers.delete(key);
            }
            else {
                if (value) {
                    // Force update
                    value.settings = record;
                }
            }
        }

        const isUserManager = this.isUserManager(member);
        if (isUserManager) {
            // For a user manager without an organization, we don't delete data, because when registering a new member, it doesn't have any organizations yet...
            if (!(await this.canAccessMember(member, PermissionLevel.Full))) {
                cloned.details.notes = null;
                // a user manager can see the security codes
            }

            return cloned;
        }

        // Has financial read access?
        if (!options?.forAdminCartCalculation && !await this.hasFinancialMemberAccess(member, PermissionLevel.Read)) {
            cloned.details.requiresFinancialSupport = null;
            cloned.details.uitpasNumber = null;
            cloned.outstandingBalance = 0;

            for (const registration of cloned.registrations) {
                registration.price = 0;
                registration.pricePaid = 0;
                registration.balances = [];
            }
        }

        // At least write permissions is required for now to obtain the security code
        if (!(await this.canAccessMember(member, PermissionLevel.Write))) {
            cloned.details.securityCode = null;
        }

        if (!await this.hasNRNAccess(member, PermissionLevel.Read)) {
            cloned.details.nationalRegisterNumber = null;

            for (const parent of cloned.details.parents) {
                parent.nationalRegisterNumber = null;
            }
        }

        return cloned;
    }

    /**
     * Only for creating new members
     */
    filterMemberPut(member: MemberWithRegistrations, data: MemberWithRegistrationsBlob, options: { asUserManager: boolean }) {
        if (options.asUserManager || STAMHOOFD.userMode === 'platform') {
            // A user manager cannot choose the member number + in platform mode, nobody can choose the member number
            data.details.memberNumber = null;
        }

        // Do not allow setting the security code
        data.details.securityCode = null;
    }

    async filterMemberPatch(member: MemberWithRegistrations, data: AutoEncoderPatchType<MemberWithRegistrationsBlob>): Promise<AutoEncoderPatchType<MemberWithRegistrationsBlob>> {
        if (!data.details) {
            return data;
        }
        if (data.details.isPut()) {
            throw new SimpleError({
                code: 'invalid_request',
                message: 'Cannot PUT a full member details object',
                statusCode: 400,
            });
        }

        if (Array.isArray(data.details.parents)) {
            throw new SimpleError({
                code: 'invalid_request',
                message: 'Cannot PUT a full member details parents',
                statusCode: 400,
            });
        }

        const hasRecordAnswers = !!data.details.recordAnswers;
        const hasNotes = data.details.notes !== undefined;
        const isSetFinancialSupportTrue = data.details.shouldApplyReducedPrice;

        if (data.details.securityCode !== undefined || data.details.trackingYear !== undefined) {
            const hasFullAccess = await this.canAccessMember(member, PermissionLevel.Full);

            if (!hasFullAccess) {
                if (data.details.securityCode !== undefined) {
                    // can only be set to null, and only if can access member with full access
                    if (data.details.securityCode !== null) {
                        // Unset silently
                        data.details.securityCode = undefined;
                    }
                }

                if (data.details.trackingYear !== undefined) {
                    // Unset silently
                    data.details.trackingYear = undefined;
                }
            }
        }

        if (hasRecordAnswers) {
            if (!(data.details.recordAnswers instanceof PatchMap)) {
                throw new SimpleError({
                    code: 'invalid_request',
                    message: 'Cannot PUT recordAnswers',
                    statusCode: 400,
                });
            }

            for (const [key, value] of data.details.recordAnswers.entries()) {
                const { canAccess, record } = await this.checkRecordAccess(member, key, PermissionLevel.Write);
                if (!canAccess) {
                    throw new SimpleError({
                        code: 'permission_denied',
                        message: $t('0823202f-8c46-445b-9b49-f171e1ae85ac', { name: record?.name ?? 'deze vraag' }),
                        statusCode: 400,
                    });
                }

                // Force set the value settings
                if (value) {
                    value.settings = record;
                }
            }
        }

        const isUserManager = this.isUserManager(member);

        // Do not allow setting the member number
        if (isUserManager || STAMHOOFD.userMode === 'platform') {
            // A user manager cannot choose the member number + in platform mode, nobody can choose the member number
            delete data.details.memberNumber;
        }

        if (hasNotes && isUserManager && !(await this.canAccessMember(member, PermissionLevel.Full))) {
            throw new SimpleError({
                code: 'permission_denied',
                message: 'Cannot edit notes',
                statusCode: 400,
            });
        }

        // Has financial write access?
        if (!await this.hasFinancialMemberAccess(member, PermissionLevel.Write)) {
            if (isUserManager && isSetFinancialSupportTrue) {
                const financialSupportSettings = this.platform.config.financialSupport;
                const preventSelfAssignment = financialSupportSettings?.preventSelfAssignment === true;

                if (preventSelfAssignment) {
                    throw new SimpleError({
                        code: 'permission_denied',
                        message: 'No permissions to enable financial support for your own members',
                        human: financialSupportSettings.preventSelfAssignmentText ?? FinancialSupportSettings.defaultPreventSelfAssignmentText,
                        statusCode: 400,
                    });
                }
            }

            if (data.details.requiresFinancialSupport) {
                if (isUserManager) {
                    // Already handled
                }
                else {
                    throw new SimpleError({
                        code: 'permission_denied',
                        message: 'Je hebt geen toegangsrechten om de financiële status van dit lid aan te passen',
                        statusCode: 400,
                    });
                }
            }

            if (!isUserManager) {
                if (data.details.uitpasNumber) {
                    throw new SimpleError({
                        code: 'permission_denied',
                        message: 'Je hebt geen toegangsrechten om het UiTPAS-nummer van dit lid aan te passen',
                        statusCode: 400,
                    });
                }
            }

            if (data.outstandingBalance) {
                throw new SimpleError({
                    code: 'permission_denied',
                    message: 'Je hebt geen toegangsrechten om het openstaande saldo van dit lid aan te passen',
                    statusCode: 400,
                });
            }

            for (const { put: registration } of data.registrations.getPuts()) {
                if (registration.price) {
                    throw new SimpleError({
                        code: 'permission_denied',
                        message: 'Je hebt geen toegangsrechten om de prijs van een inschrijving te bepalen',
                        statusCode: 400,
                    });
                }

                if (registration.pricePaid) {
                    throw new SimpleError({
                        code: 'permission_denied',
                        message: 'Je hebt geen toegangsrechten om het betaalde bedrag van een inschrijving te bepalen',
                        statusCode: 400,
                    });
                }
            }
        }

        if (!await this.hasNRNAccess(member, PermissionLevel.Write)) {
            if (data.details.nationalRegisterNumber) {
                throw new SimpleError({
                    code: 'permission_denied',
                    message: 'Je hebt geen toegangsrechten om het rijksregisternummer van dit lid aan te passen',
                    statusCode: 400,
                });
            }

            for (const parent of data.details.parents.getPatches()) {
                if (parent.nationalRegisterNumber) {
                    throw new SimpleError({
                        code: 'permission_denied',
                        message: 'Je hebt geen toegangsrechten om het rijksregisternummer van een ouder aan te passen',
                        statusCode: 400,
                    });
                }
            }
        }

        return data;
    }

    canAccessAllPlatformMembers(level: PermissionLevel): boolean {
        return this.getPlatformAccessibleOrganizationTags(level) === 'all';
    }

    canAccess(accessRight: AccessRight): boolean {
        return !!this.platformPermissions && !!this.platformPermissions.hasAccessRight(accessRight);
    }

    hasPlatformFullAccess(): boolean {
        return !!this.platformPermissions && !!this.platformPermissions.hasFullAccess();
    }

    getPlatformAccessibleOrganizationTags(level: PermissionLevel): string[] | 'all' {
        if (!this.hasSomePlatformAccess()) {
            return [];
        }

        if (this.hasPlatformFullAccess()) {
            return 'all';
        }

        if (this.platformPermissions?.hasResourceAccess(PermissionsResourceType.OrganizationTags, '', level)) {
            return 'all';
        }

        const allTags = this.platform.config.tags;
        const tags: string[] = [];

        for (const tag of allTags) {
            if (this.platformPermissions?.hasResourceAccess(PermissionsResourceType.OrganizationTags, tag.id, level)) {
                tags.push(tag.id);
            }
        }

        if (tags.length > 0 && tags.length === allTags.length) {
            return 'all';
        }

        return tags;
    }

    getOrganizationTagsWithAccessRight(right: AccessRight): string[] | 'all' {
        if (!this.hasSomePlatformAccess()) {
            return [];
        }

        if (this.hasPlatformFullAccess()) {
            return 'all';
        }

        if (this.platformPermissions?.hasResourceAccessRight(PermissionsResourceType.OrganizationTags, '', right)) {
            return 'all';
        }

        const allTags = this.platform.config.tags;
        const tags: string[] = [];

        for (const tag of allTags) {
            if (this.platformPermissions?.hasResourceAccessRight(PermissionsResourceType.OrganizationTags, tag.id, right)) {
                tags.push(tag.id);
            }
        }

        if (tags.length === allTags.length) {
            return 'all';
        }

        return tags;
    }

    hasSomePlatformAccess(): boolean {
        return !!this.platformPermissions && !this.platformPermissions.isEmpty;
    }

    canManagePlatformAdmins() {
        return this.hasPlatformFullAccess();
    }
}
