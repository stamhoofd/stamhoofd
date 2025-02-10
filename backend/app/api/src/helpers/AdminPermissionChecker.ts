import { AutoEncoderPatchType, PatchMap } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem, CachedBalance, Document, EmailTemplate, Event, EventNotification, Group, Member, MemberPlatformMembership, MemberWithRegistrations, Order, Organization, OrganizationRegistrationPeriod, Payment, Registration, User, Webshop } from '@stamhoofd/models';
import { AccessRight, EventPermissionChecker, FinancialSupportSettings, GroupCategory, GroupStatus, MemberWithRegistrationsBlob, PermissionLevel, PermissionsResourceType, Platform as PlatformStruct, RecordCategory } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { addTemporaryMemberAccess, hasTemporaryMemberAccess } from './TemporaryMemberAccess';

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
    organizationGroupsCache: Map<string, Group[] | Promise<Group[]>> = new Map();

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

    async getOrganizationGroups(id: string) {
        const c = this.organizationGroupsCache.get(id);
        if (c) {
            return await c;
        }
        const organization = await this.getOrganization(id);
        const promise = Group.getAll(id, organization.periodId, true);
        this.organizationGroupsCache.set(id, promise);
        const result = await promise;
        this.organizationGroupsCache.set(id, result);
        return result;
    }

    async getOrganizationCurrentPeriod(id: string | Organization): Promise<OrganizationRegistrationPeriod> {
        const organization = await this.getOrganization(id);
        return await organization.getPeriod();
    }

    error(message?: string): SimpleError {
        return new SimpleError({
            code: 'permission_denied',
            message: 'You do not have permissions for this action',
            human: message ?? 'Je hebt geen toegangsrechten voor deze actie',
            statusCode: 403,
        });
    }

    notFoundOrNoAccess(message?: string): SimpleError {
        return new SimpleError({
            code: 'not_found',
            message: 'Resource not found or no access',
            human: message ?? 'Niet gevonden of geen toegang tot dit object',
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
                if (STAMHOOFD.userMode === 'organization') {
                    return false;
                }
                // Otherwise allow for convenience
            }

            // If user is limited to scope
            if (this.user.organizationId && organizationId !== this.user.organizationId) {
                return false;
            }
        }
        else {
            // User is limited to a scope
            if (this.user.organizationId) {
                return false;
            }
        }

        return true;
    }

    async canAccessGroup(group: Group, permissionLevel: PermissionLevel = PermissionLevel.Read): Promise<boolean> {
        // Check permissions aren't scoped to a specific organization, and they mismatch
        if (!this.checkScope(group.organizationId)) {
            return false;
        }
        const organization = await this.getOrganization(group.organizationId);

        if (group.periodId !== organization.periodId) {
            if (!await this.hasFullAccess(group.organizationId)) {
                return false;
            }
        }

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

        // Check parent categories
        const organizationPeriod = await this.getOrganizationCurrentPeriod(organization);
        const parentCategories = group.getParentCategories(organizationPeriod.settings.categories);
        for (const category of parentCategories) {
            if (organizationPermissions.hasResourceAccess(PermissionsResourceType.GroupCategories, category.id, permissionLevel)) {
                return true;
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

        if (member.organizationId && await this.hasFullAccess(member.organizationId, permissionLevel)) {
            return true;
        }

        // Temporary access
        if (hasTemporaryMemberAccess(this.user.id, member.id, permissionLevel)) {
            console.log('User has temporary access to member', member.id, 'for user', this.user.id);
            return true;
        }

        for (const registration of member.registrations) {
            if (await this.canAccessRegistration(registration, permissionLevel)) {
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
            const platformMemberships = await MemberPlatformMembership.where({ memberId: member.id });
            if (platformMemberships.length === 0) {
                return true;
            }

            const cachedBalance = await CachedBalance.getForObjects([member.id]);
            if (cachedBalance.length === 0 || (cachedBalance[0].amountOpen === 0 && cachedBalance[0].amountPending === 0)) {
                return true;
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
    async canAccessRegistration(registration: Registration, permissionLevel: PermissionLevel = PermissionLevel.Read) {
        const organizationPermissions = await this.getOrganizationPermissions(registration.organizationId);

        if (!organizationPermissions) {
            return false;
        }

        if (organizationPermissions.hasAccess(PermissionLevel.Full)) {
            // Only full permissions; because non-full doesn't have access to other periods
            return true;
        }

        if (registration.deactivatedAt || !registration.registeredAt) {
            // No full access: cannot access deactivated registrations
            return false;
        }

        const allGroups = await this.getOrganizationGroups(registration.organizationId);
        const group = allGroups.find(g => g.id === registration.groupId);
        if (!group || group.deletedAt) {
            return false;
        }

        if (await this.canAccessGroup(group, permissionLevel)) {
            return true;
        }

        return false;
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

    async canAccessEmailTemplate(template: EmailTemplate, level: PermissionLevel = PermissionLevel.Read) {
        if (level === PermissionLevel.Read) {
            if (template.organizationId === null) {
                // Public templates
                return true;
            }
            return this.canReadEmailTemplates(template.organizationId);
        }

        // Note: if the template has an organizationId of null, everyone can access it, but only for reading
        // that is why we only check the scope afterwards
        if (!this.checkScope(template.organizationId)) {
            return false;
        }

        if (!template.organizationId) {
            return this.hasPlatformFullAccess();
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

    async canAccessEmailBounces(organizationId: string) {
        return this.hasSomeAccess(organizationId);
    }

    canSendEmails() {
        return !!this.user.permissions;
    }

    async canReadEmailTemplates(organizationId: string) {
        const organizationPermissions = await this.getOrganizationPermissions(organizationId);

        if (!organizationPermissions) {
            return false;
        }

        return !!this.user.permissions;
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

    canUpload() {
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
        return !!organizationPermissions;
    }

    async canManageAdmins(organizationId: string) {
        return !this.user.isApiUser && (await this.hasFullAccess(organizationId));
    }

    async canReviewEventNotification(eventNotification: { organizationId: string }) {
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
    async getAccessibleRecordCategories(member: MemberWithRegistrations, level: PermissionLevel = PermissionLevel.Read): Promise<RecordCategory[]> {
        const isUserManager = this.isUserManager(member);

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
        // Check if we have access to their data
        const recordCategories: RecordCategory[] = [];
        for (const organization of organizations) {
            if (isUserManager) {
                for (const category of organization.meta.recordsConfiguration.recordCategories) {
                    if (category.checkPermissionForUserManager(level)) {
                        recordCategories.push(category);
                    }
                }
            }

            const permissions = await this.getOrganizationPermissions(organization);

            if (!permissions) {
                continue;
            }

            // Now add all records of this organization
            for (const category of organization.meta.recordsConfiguration.recordCategories) {
                if (isUserManager && recordCategories.find(c => c.id === category.id)) {
                    // Already added
                    continue;
                }

                if (permissions.hasResourceAccess(PermissionsResourceType.RecordCategories, category.id, level)) {
                    recordCategories.push(category);
                }
            }

            // Platform ones where we have been given permissions for in this organization
            for (const category of this.platform.config.recordsConfiguration.recordCategories) {
                if (recordCategories.find(c => c.id === category.id)) {
                    // Already added
                    continue;
                }

                if (permissions.hasResourceAccess(PermissionsResourceType.RecordCategories, category.id, level)) {
                    recordCategories.push(category);
                }
            }
        }

        // Platform data
        const platformPermissions = this.platformPermissions;
        if (platformPermissions || isUserManager) {
            for (const category of this.platform.config.recordsConfiguration.recordCategories) {
                if (recordCategories.find(c => c.id === category.id)) {
                    // Already added
                    continue;
                }

                if (platformPermissions?.hasResourceAccess(PermissionsResourceType.RecordCategories, category.id, level)) {
                    recordCategories.push(category);
                }
                else if (isUserManager) {
                    if (category.checkPermissionForUserManager(level)) {
                        recordCategories.push(category);
                    }
                }
            }
        }

        return recordCategories;
    }

    /**
     * Return a list of RecordSettings the current user can view or edit
     */
    async hasFinancialMemberAccess(member: MemberWithRegistrations, level: PermissionLevel = PermissionLevel.Read): Promise<boolean> {
        const isUserManager = this.isUserManager(member);

        if (isUserManager && level === PermissionLevel.Read) {
            return true;
        }

        if (!await this.canAccessMember(member, level)) {
            return false;
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

    /**
     * Return a list of RecordSettings the current user can view or edit
     */
    async getAccessibleRecordSet(member: MemberWithRegistrations, level: PermissionLevel = PermissionLevel.Read): Promise<Set<string>> {
        const categories = await this.getAccessibleRecordCategories(member, level);
        const set = new Set<string>();
        const isUserManager = this.isUserManager(member);

        if (isUserManager) {
            for (const category of categories) {
                for (const record of category.getAllRecords()) {
                    if (record.checkPermissionForUserManager(level)) {
                        set.add(record.id);
                    }
                }
            }
        }
        else {
            for (const category of categories) {
                for (const record of category.getAllRecords()) {
                    set.add(record.id);
                }
            }
        }

        return set;
    }

    async getAccessibleGroups(organizationId: string, level: PermissionLevel = PermissionLevel.Read): Promise<string[] | 'all'> {
        if (await this.hasFullAccess(organizationId)) {
            return 'all';
        }

        const groups = await this.getOrganizationGroups(organizationId);
        const accessibleGroups: string[] = [];

        for (const group of groups) {
            if (await this.canAccessGroup(group, level)) {
                accessibleGroups.push(group.id);
            }
        }
        return accessibleGroups;
    }

    /**
     * Changes data inline
     */
    async filterMemberData(member: MemberWithRegistrations, data: MemberWithRegistrationsBlob): Promise<MemberWithRegistrationsBlob> {
        const records = await this.getAccessibleRecordSet(member, PermissionLevel.Read);

        const cloned = data.clone();

        for (const [key, value] of cloned.details.recordAnswers.entries()) {
            if (!records.has(value.settings.id)) {
                cloned.details.recordAnswers.delete(key);
            }
        }

        const isUserManager = this.isUserManager(member);
        if (isUserManager) {
            // For a user manager without an organization, we don't delete data, because when registering a new member, it doesn't have any organizations yet...
            if (!(await this.canAccessMember(member, PermissionLevel.Full))) {
                cloned.details.securityCode = null;
                cloned.details.notes = null;
            }

            return cloned;
        }

        // Has financial read access?
        if (!await this.hasFinancialMemberAccess(member, PermissionLevel.Read)) {
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

            const records = await this.getAccessibleRecordSet(member, PermissionLevel.Write);

            for (const [key, value] of data.details.recordAnswers.entries()) {
                let name: string | undefined = undefined;
                if (value) {
                    if (value.isPatch()) {
                        throw new SimpleError({
                            code: 'invalid_request',
                            message: 'Cannot PATCH a record answer object',
                            statusCode: 400,
                        });
                    }

                    const id = value.settings.id;

                    if (id !== key) {
                        throw new SimpleError({
                            code: 'invalid_request',
                            message: 'Record answer key does not match record id',
                            statusCode: 400,
                        });
                    }

                    name = value.settings.name;
                }

                if (!records.has(key)) {
                    throw new SimpleError({
                        code: 'permission_denied',
                        message: `Je hebt geen toegangsrechten om het antwoord op ${name ?? 'deze vraag'} aan te passen voor dit lid`,
                        statusCode: 400,
                    });
                }
            }
        }

        const isUserManager = this.isUserManager(member);

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

    canAccessAllPlatformMembers(): boolean {
        return !!this.platformPermissions && !!this.platformPermissions.hasAccessRight(AccessRight.PlatformLoginAs);
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

        if (tags.length === allTags.length) {
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
