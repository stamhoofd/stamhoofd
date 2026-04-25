import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { PatchMap } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import type { BalanceItem, Document, Email, EmailTemplate, MemberWithUsers, MemberWithUsersAndRegistrations, MemberWithUsersRegistrationsAndGroups, Order, OrganizationRegistrationPeriod, User } from '@stamhoofd/models';
import { CachedBalance, Event, EventNotification, Group, Member, MemberPlatformMembership, Organization, Payment, Registration, Webshop } from '@stamhoofd/models';
import type { GroupCategory, MemberWithRegistrationsBlob, Platform as PlatformStruct, RecordAnswer, RecordSettings, RegistrationInvitationRequest, ResourcePermissions } from '@stamhoofd/structures';
import { AccessRight, EmailTemplate as EmailTemplateStruct, EventPermissionChecker, FinancialSupportSettings, GroupStatus, GroupType, PermissionLevel, PermissionsResourceType, ReceivableBalanceType, UitpasNumberDetails, UitpasSocialTariff, UitpasSocialTariffStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import type { RecordCacheEntry } from '../services/MemberRecordStore.js';
import { MemberRecordStore } from '../services/MemberRecordStore.js';
import { addTemporaryMemberAccess, hasTemporaryMemberAccess } from './TemporaryMemberAccess.js';

/**
 * One class with all the responsabilities of checking permissions to each resource in the system by a given user, possibly in an organization context.
 * This helps when dependencies of permissions change, such as parent categories for groups
 */
export class AdminPermissionChecker {
    readonly organization: Organization | null;
    user: User;
    /**
     * The member that is linked to this user = is this user
     */
    member: MemberWithUsersRegistrationsAndGroups | null = null;
    platform: PlatformStruct;

    organizationCache: Map<string, Organization | Promise<Organization | undefined>> = new Map();
    groupsCache: Map<string, Group | null | Promise<Group | null>> = new Map();
    webshopsCache: Map<string, Webshop | null | Promise<Webshop | null>> = new Map();

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

                throw new SimpleError({
                    code: 'organization_not_found',
                    message: 'Organization not found',
                });
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

    async getWebshop(webshopId: string): Promise<Webshop | null> {
        const cache = this.webshopsCache.get(webshopId);
        if (cache !== undefined) {
            return await cache;
        }

        const promise = Webshop.select()
            .where('id', webshopId)
            .first(false);

        this.webshopsCache.set(webshopId, promise);
        const webshop = await promise;
        this.webshopsCache.set(webshopId, webshop);
        return webshop;
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
        const human = typeof humanOrData === 'string' ? humanOrData : (humanOrData?.human ?? $t(`%Fg`));
        const message = typeof humanOrData === 'string' ? humanOrData : (humanOrData?.message ?? 'You do not have permissions for this action');

        return new SimpleError({
            code: 'permission_denied',
            message,
            human,
            statusCode: 403,
        });
    }

    memberNotFoundOrNoAccess(): SimpleError {
        return this.notFoundOrNoAccess($t('%CA'));
    }

    notFoundOrNoAccess(message?: string): SimpleError {
        return new SimpleError({
            code: 'not_found',
            message: 'Resource not found or no access',
            human: message ?? $t(`%Fh`),
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

    async canAccessMember(member: MemberWithUsersAndRegistrations, permissionLevel: PermissionLevel = PermissionLevel.Read) {
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
    async temporarilyGrantMemberAccess(member: MemberWithUsersRegistrationsAndGroups, permissionLevel: PermissionLevel = PermissionLevel.Write) {
        console.log('Temporarily granting access to member', member.id, 'for user', this.user.id);
        addTemporaryMemberAccess(this.user.id, member.id, permissionLevel);
    }

    /**
     * Only full admins can delete members permanently
     */
    async canDeleteMember(member: MemberWithUsersAndRegistrations) {
        if (member.registrations.length === 0 && this.isUserManager(member)) {
            const cachedBalance = await CachedBalance.getForObjects([member.id], null, ReceivableBalanceType.member);
            if (cachedBalance.length === 0 || (cachedBalance[0].amountOpen === 0 && cachedBalance[0].amountPending === 0)) {
                const platformMemberships = await MemberPlatformMembership.select().where('memberId', member.id).fetch();
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
    async canAccessRegistration(registration: Registration, permissionLevel: PermissionLevel = PermissionLevel.Read, checkMember: boolean | MemberWithUsersRegistrationsAndGroups = true) {
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
            const webshop = await this.getWebshop(template.webshopId);
            if (!webshop || !(await this.canAccessWebshop(webshop, PermissionLevel.Full))) {
                return false;
            }

            return true;
        }

        if (template.groupId) {
            const group = await this.getGroup(template.groupId);
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

    async canLinkBalanceItemToMember(member: MemberWithUsersAndRegistrations) {
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
        return this.canManageFinances(organizationId);
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

    async canAccessEmailBounces(organizationId: string | null) {
        if (organizationId) {
            return this.hasSomeAccess(organizationId);
        }
        return this.hasSomePlatformAccess();
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

    isUserManager(member: MemberWithUsers) {
        return !!member.users.find(u => u.id === this.user.id);
    }

    /**
     * Return a list of RecordSettings the current user can view or edit
     */
    async hasFinancialMemberAccess(member: MemberWithUsersAndRegistrations, level: PermissionLevel = PermissionLevel.Read, organizationId?: string): Promise<boolean> {
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
    async hasNRNAccess(member: MemberWithUsersAndRegistrations, level: PermissionLevel = PermissionLevel.Read): Promise<boolean> {
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

    private async getSingleRecord(id: string): Promise<RecordCacheEntry | null> {
        // For userMode organization the records should not be cached
        if (STAMHOOFD.userMode === 'organization') {
            if (this.organization) {
                for (const recordCategory of this.organization.meta.recordsConfiguration.recordCategories) {
                    for (const record of recordCategory.getAllRecords()) {
                        if (id === record.id) {
                            return {
                                record,
                                rootCategoryId: recordCategory.id,
                                organizationId: this.organization.id
                            }
                        }
                    }
                }
                return null;
            }
            // should never get called if no organization
            console.error('getRecord called without an organization');
            return null;
        }

        return MemberRecordStore.getRecord(id);
    }

    async canFilterMembersOnRecordId(recordId: string): Promise<{ canAccess: false; record: RecordSettings | null } | { canAccess: true; record: RecordSettings }> {
        const record = await this.getSingleRecord(recordId);
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

    private async loopRecordAnswerSettingsAccess<T extends RecordAnswer | AutoEncoderPatchType<RecordAnswer>>({member, level, recordAnswers, callback }:
        {
            member: MemberWithUsersRegistrationsAndGroups,
            level: PermissionLevel,
            recordAnswers: PatchMap<string, T | null | undefined> |  Map<string, T>
            callback: (result: { canAccess: false; record: RecordSettings | null } | { canAccess: true; record: RecordSettings }, entry: [keys: string, value: T | null | undefined]) => void
        }): Promise<void>
    {
        if (STAMHOOFD.userMode !== 'platform') {
            let organization = this.organization;

            if (!organization) {
                // normally this should not happen
                console.error('loopRecordAnswerSettingsAccess called without an organization set');
                let organizationId = member.organizationId;

                if (!organizationId) {
                    if (member.registrations.length === 0) {
                        // no access to any records (theoretically a global admin should have access, but normally this case should not happen)
                        for (const entry of recordAnswers.entries()) {
                            callback({canAccess: false, record: null}, entry);
                        }
                        return;
                    }
                    
                    // in userMode organization a member can only be linked to 1 organization
                    organizationId = member.registrations[0].organizationId;
                }

                organization = await this.getOrganization(organizationId);
            }

            const organizationId = organization.id;
            const map = new Map<string, RecordCacheEntry>()

            // create map
            for (const category of organization.meta.recordsConfiguration.recordCategories) {
                const rootCategoryId = category.id;

                for (const record of category.getAllRecords()) {
                    map.set(record.id, {
                        record,
                        organizationId,
                        rootCategoryId,
                    });
                }
            }
            
            for (const entry of recordAnswers.entries()) {
                const key = entry[0];
                const cachedRecordEntry = map.get(key);
                if (cachedRecordEntry) {
                    const canAccess = await this.checkRecordAccess({
                        member,
                        record: cachedRecordEntry.record,
                        organizationId: cachedRecordEntry.organizationId,
                        rootCategoryId: cachedRecordEntry.rootCategoryId,
                        level
                    });
                    callback({canAccess, record: cachedRecordEntry.record}, entry);
                } else {
                    callback({canAccess: false, record: null}, entry);
                }
            }

            return;
        }

        // userMode platform
         for (const entry of recordAnswers.entries()) {
            const key = entry[0];
            const cachedRecordEntry = await MemberRecordStore.getRecord(key);
            if (cachedRecordEntry) {
                const canAccess = await this.checkRecordAccess({
                    member,
                    record: cachedRecordEntry.record,
                    organizationId: cachedRecordEntry.organizationId,
                    rootCategoryId: cachedRecordEntry.rootCategoryId,
                    level
                });
                callback({canAccess, record: cachedRecordEntry.record}, entry);
            } else {
                callback({canAccess: false, record: null}, entry);
            }
        }
    }

    private async checkRecordAccess({member, level, record, organizationId, rootCategoryId}: {member: MemberWithUsersRegistrationsAndGroups, record: RecordSettings, organizationId: string | null, rootCategoryId: string, level: PermissionLevel}): Promise<boolean> {
        if (!this.checkScope(organizationId)) {
            return false
        }

        const isUserManager = this.isUserManager(member);
        if (isUserManager) {
            if (record.checkPermissionForUserManager(level)) {
                return true;
            }
        }

        if (!this.user.permissions) {
            return false;
        }

        if (organizationId) {
            const organizationPermissions = await this.getOrganizationPermissions(organizationId);
            if (organizationPermissions && organizationPermissions.hasResourceAccess(PermissionsResourceType.RecordCategories, rootCategoryId, level)) {
                return true;
            }
        }
        else {
            // Also check current scoped organization
            if (this.organization) {
                const organizationPermissions = await this.getOrganizationPermissions(this.organization.id);
                if (organizationPermissions && organizationPermissions.hasResourceAccess(PermissionsResourceType.RecordCategories, rootCategoryId, level)) {
                    return true;
                }
            }
        }

        // 2. Check platform permissions
        if (this.platformPermissions?.hasResourceAccess(PermissionsResourceType.RecordCategories, rootCategoryId, level)) {
            return true;
        }

        // All member access, means also having access to record categories of non-registered members
        if (this.canAccessAllPlatformMembers(level)) { // needs to be full to also inherit record category access
            return true;
        }

        if (hasTemporaryMemberAccess(this.user.id, member.id, PermissionLevel.Full)) {
            // You created this member, so temporary can read all records in order to set the member up correctly
            return true;
        }

        // It is possible that this is a platform admin (or an admin that has access to multiple organizations), and inherits automatic permissions for tags. So'll need to loop all the organizations where this member has an active registration for
        if (!organizationId && !this.organization) {
            const checkedOrganizations = new Map<string, boolean>();
            for (const registration of member.registrations) {
                const permissions = checkedOrganizations.get(registration.organizationId);

                // Checking the organization permissions is faster (and less data lookups required), so we do that first before doing the more expensive registration access check
                if (permissions !== undefined) {
                    if (permissions === true && await this.canAccessRegistration(registration, level)) {
                        return true;
                    }
                    continue;
                }

                const organizationPermissions = await this.getOrganizationPermissions(registration.organizationId);
                if (organizationPermissions && organizationPermissions.hasResourceAccess(PermissionsResourceType.RecordCategories, rootCategoryId, level)) {
                    checkedOrganizations.set(registration.organizationId, true);
                    if (await this.canAccessRegistration(registration, level)) {
                        return true;
                    }
                }
                else {
                    checkedOrganizations.set(registration.organizationId, false);
                }
            }
        }

        return false;
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
    async filterMemberData(member: MemberWithUsersRegistrationsAndGroups, data: MemberWithRegistrationsBlob, options?: { forAdminCartCalculation?: boolean }): Promise<MemberWithRegistrationsBlob> {
        const cloned = data.clone();

        await this.loopRecordAnswerSettingsAccess({
            member,
            level: PermissionLevel.Read,
            recordAnswers: cloned.details.recordAnswers,
            callback: ({ canAccess, record }, [key, value]) => {
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
        });

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
            cloned.details.uitpasNumberDetails = null;
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
    filterMemberPut(member: MemberWithUsersRegistrationsAndGroups, data: MemberWithRegistrationsBlob, options: { asUserManager: boolean }) {
        if (options.asUserManager || STAMHOOFD.userMode === 'platform') {
            // A user manager cannot choose the member number + in platform mode, nobody can choose the member number
            data.details.memberNumber = null;
        }

        // Do not allow setting the security code
        data.details.securityCode = null;
        if (data.details.uitpasNumberDetails) {
            data.details.uitpasNumberDetails.socialTariff = UitpasSocialTariff.create({
                status: UitpasSocialTariffStatus.Unknown,
            });
        }
    }

    async filterMemberPatch(member: MemberWithUsersRegistrationsAndGroups, data: AutoEncoderPatchType<MemberWithRegistrationsBlob>): Promise<AutoEncoderPatchType<MemberWithRegistrationsBlob>> {
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
        const isSetFinancialSupportTrue = data.details.didSetManualFinancialSupport;

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

        if (data.details.uitpasNumberDetails && data.details.uitpasNumberDetails.socialTariff !== undefined) {
            if (data.details.uitpasNumberDetails.uitpasNumber === undefined) {
                data.details.uitpasNumberDetails = undefined;
            }
            else if (data.details.uitpasNumberDetails.uitpasNumber !== member.details.uitpasNumberDetails?.uitpasNumber) {
                // if uitpas number did change -> status should be reset
                data.details.uitpasNumberDetails = UitpasNumberDetails.create({
                    uitpasNumber: data.details.uitpasNumberDetails.uitpasNumber,
                });
            }
            else {
                // if uitpas number did not change
                data.details.uitpasNumberDetails.socialTariff = member.details.uitpasNumberDetails?.socialTariff;
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

            await this.loopRecordAnswerSettingsAccess({
                member,
                level: PermissionLevel.Write,
                recordAnswers: data.details.recordAnswers,
                callback: ({canAccess, record}, [_key, value]) => {
                    if (!canAccess) {
                        throw new SimpleError({
                            code: 'permission_denied',
                            message: $t('%Ff', { name: record?.name ?? 'deze vraag' }),
                            statusCode: 400,
                        });
                    }

                    // Force set the value settings
                    if (value) {
                        value.settings = record;
                    }
                }
            })
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
                if (data.details.uitpasNumberDetails) {
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

    /**
     * Will throw if not allowed to invite.
     * @param invitation
     * @param organizationId id of organization to invite for, should match the organizationId in the invitation
     */
    async checkCanCreateRegistrationInvitation(invitation: RegistrationInvitationRequest, organizationId: string) {
        const group = await Group.getByID(invitation.groupId);

        if (!group || group.organizationId !== organizationId || !await this.canAccessGroup(group, PermissionLevel.Write)) {
            throw this.error($t(`Je hebt geen toegansrechten om iemand uit te nodigen voor deze groep.`));
        }

        // cannot invite for waiting list
        if (group.type === GroupType.WaitingList) {
            throw new SimpleError({
                code: 'bad_group',
                statusCode: 400,
                message: 'Not allowed to invite for waiting list',
            });
        }

        const waitingListId: string = invitation.waitingListId;

        // waiting list should be linked to the group
        if (group.waitingListId !== waitingListId) {
            throw new SimpleError({
                code: 'bad_group',
                statusCode: 400,
                message: 'The group is not linked with the waiting list',
            })
        }

        const waitingList = await Group.getByID(waitingListId);
        if (!waitingList || waitingList.type !== GroupType.WaitingList) {
            throw new SimpleError({
                code: 'not_found',
                statusCode: 404,
                message: 'No waiting list with this id is found',
            });
        }

        const member = await Member.getByIdWithUsersAndRegistrations(invitation.memberId);
        
        if (!member
            // in userMode 'organization' we can only invite members from the same organization
            || (STAMHOOFD.userMode === 'organization' && member.organizationId !== organizationId)
            // read access is suficient
            || !await this.canAccessMember(member, PermissionLevel.Read)
            ) {
                throw this.error($t(`Je hebt geen toegansrechten om dit lid uit te nodigen.`));
        }

        // cannot invite if already registered
        if (member.registrations.some(r => r.groupId === group.id && r.registeredAt !== null)) {
            throw new SimpleError({
                code: 'bad_group',
                statusCode: 400,
                message: 'The member is already registered for this group',
                human: $t('Dit lid is al ingeschreven voor deze groep'),
            })
        }
    }
}
