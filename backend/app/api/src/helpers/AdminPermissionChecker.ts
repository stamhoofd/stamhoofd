import { SimpleError } from "@simonbackx/simple-errors"
import { BalanceItem, Document, DocumentTemplate, EmailTemplate, Group, Member, MemberWithRegistrations, Order, Organization, Payment, Registration, User, Webshop } from "@stamhoofd/models"
import { AccessRight, GroupCategory, GroupStatus, PermissionLevel, Platform } from "@stamhoofd/structures"

/**
 * One class with all the responsabilities of checking permissions to each resource in the system by a given user, possibly in an organization context.
 * This helps when dependencies of permissions change, such as parent categories for groups
 */
export class AdminPermissionChecker {
    organization: Organization|null
    user: User

    organizationCache: Map<string, Organization|Promise<Organization|undefined>> = new Map()
    organizationGroupsCache: Map<string, Group[]|Promise<Group[]>> = new Map()

    constructor(user: User, organization?: Organization) {
        this.user = user

        if (user.organizationId && (!organization || organization.id !== user.organizationId)) {
            throw new SimpleError({
                code: 'invalid_scope',
                message: 'Tried accessing a resource without an organization context, but this user is limited to the organization context',
                statusCode: 403
            })
        }

        this.organization = organization ?? null
    }

    async getOrganization(id: string|Organization): Promise<Organization> {
        if (this.organization && id === this.organization.id) {
            return this.organization
        }
        if (typeof id === 'string') {
            const c = this.organizationCache.get(id);
            if (c) {
                const result = await c;
                if (!result) {
                    throw new Error('Unexpected missing organization in AdminPermissionChecker.getOrganization')
                }
                return result;
            }
            const promise = Organization.getByID(id)
            this.organizationCache.set(id, promise)
            const result = await promise;
            if (!result) {
                console.error('Unexpected missing organization in AdminPermissionChecker.getOrganization', id)
                this.organizationCache.delete(id)
                throw new Error('Unexpected missing organization in AdminPermissionChecker.getOrganization')
            }
            this.organizationCache.set(id, result)
            return result;
        }
        return id;
    }

    async getOrganizationGroups(id: string) {
        const c = this.organizationGroupsCache.get(id);
        if (c) {
            return await c;
        }
        const promise = Group.getAll(id, true)
        this.organizationGroupsCache.set(id, promise)
        const result = await promise;
        this.organizationGroupsCache.set(id, result)
        return result;
    }

    error(message?: string): SimpleError {
        return new SimpleError({
            code: "permission_denied",
            message: "You do not have permissions for this action",
            human: message ?? 'Je hebt geen toegangsrechten voor deze actie',
            statusCode: 403
        })
    }

    notFoundOrNoAccess(message?: string): SimpleError {
        return new SimpleError({
            code: "not_found",
            message: "Resource not found or no access",
            human: message ?? 'Niet gevonden of geen toegang tot dit object',
            statusCode: 404
        })
    }

    async getOrganizationRoles(organization: string|Organization) {
        if (typeof organization === 'string') {
            const loadedOrg = await this.getOrganization(organization)
            return this.getOrganizationRoles(loadedOrg)
        }
        return [...(organization.privateMeta.roles ?? [])]
    }

    getPlatformRoles() {
        // todo
        return Platform.create({}).getRoles()
    }

    async getOrganizationPermissions(organization: string|Organization) {
        if (!this.user.permissions) {
            return null;
        }
        return this.user.permissions.for(
            typeof organization === 'string' ? organization : organization.id, 
            this.getPlatformRoles(), 
            await this.getOrganizationRoles(organization)
        )
    }

    async canAccessPrivateOrganizationData(organization: Organization) {
        if (!this.checkScope(organization.id)) {
            return false;
        }

        if (!await this.hasSomeAccess(organization.id)) {
            return false;
        }
        return true;
    }

    checkScope(organizationId: string|null) {
        if (organizationId) {
            // If request is scoped to a different organization
            if (this.organization && organizationId !== this.organization.id) {
                return false
            }

            // If user is limited to scope
            if (this.user.organizationId && organizationId !== this.user.organizationId) {
                return false
            }
        } else {
            // Global objects are only accessible in the platform context
            if (this.organization) {
                return false
            }

            // User is limited to a scope
            if (this.user.organizationId) {
                return false
            }
        }

        return true;
    }

    async canAccessGroup(group: Group, permissionLevel: PermissionLevel = PermissionLevel.Read): Promise<boolean> {
        // Check permissions aren't scoped to a specific organization, and they mismatch
        if (!this.checkScope(group.organizationId)) {
            return false
        }

        if (group.deletedAt || group.status === GroupStatus.Archived) {
            return await this.canAccessArchivedGroups(group.organizationId);
        }

        const organizationPermissions = await this.getOrganizationPermissions(group.organizationId)

        if (!organizationPermissions) {
            return false;
        }

        // Check global level permissions for this user
        if (group.privateSettings.permissions.hasAccess(organizationPermissions, permissionLevel)) {
            return true;
        }

        // Check parent categories
        if (this.organization && this.organization.id === group.organizationId) {
            const parentCategories = group.getParentCategories(this.organization.meta.categories)
            for (const category of parentCategories) {
                if (category.settings.permissions.groupPermissions.hasAccess(organizationPermissions, permissionLevel)) {
                    return true
                }
            }
        }

        return false;
    }

    async canAccessArchivedGroups(organizationId: string) {
        return await this.hasFullAccess(organizationId)
    }

    /**
     * Note: only checks admin permissions. Users that 'own' this member can also access it but that does not use the AdminPermissionChecker
     */
    async canAccessMember(member: MemberWithRegistrations, permissionLevel: PermissionLevel = PermissionLevel.Read) {
        // Check user has permissions
        if (!this.user.permissions) {
            return false
        }

        for (const registration of member.registrations) {
            if (await this.canAccessRegistration(registration, permissionLevel)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Only full admins can delete members permanently
     */
    async canDeleteMember(member: MemberWithRegistrations) {
        if (member.organizationId) {
            return await this.hasFullAccess(member.organizationId)
        }
        return this.hasPlatformFullAccess()
    }

    /**
     * Note: only checks admin permissions. Users that 'own' this member can also access it but that does not use the AdminPermissionChecker
     */
    async canAccessRegistration(registration: Registration, permissionLevel: PermissionLevel = PermissionLevel.Read) {
        const organizationPermissions = await this.getOrganizationPermissions(registration.organizationId)

        if (!organizationPermissions) {
            return false;
        }

        if (organizationPermissions.hasAccess(permissionLevel)) {
            return true;
        }

        const allGroups = await this.getOrganizationGroups(registration.organizationId)
        const group = allGroups.find(g => g.id === registration.groupId)
        if (!group) {
            return false;
        }

        if (await this.canAccessGroup(group, permissionLevel)) {
            return true;
        }

        return false;
    }

    async canAccessWebshop(webshop: Webshop, permissionLevel: PermissionLevel = PermissionLevel.Read) {
        const organizationPermissions = await this.getOrganizationPermissions(webshop.organizationId)

        if (!organizationPermissions) {
            return false;
        }

        if (webshop.privateMeta.permissions.hasAccess(organizationPermissions, permissionLevel)) {
            return true;
        }

        if (permissionLevel === PermissionLevel.Read && webshop.privateMeta.scanPermissions.hasAccess(organizationPermissions, PermissionLevel.Write)) {
            return true;
        }

        return false;
    }

    async canAccessWebshopTickets(webshop: Webshop, permissionLevel: PermissionLevel = PermissionLevel.Read) {
        if (!this.checkScope(webshop.organizationId)) {
            return false
        }

        const organizationPermissions = await this.getOrganizationPermissions(webshop.organizationId)

        if (!organizationPermissions) {
            return false;
        }

        if (webshop.privateMeta.permissions.hasAccess(organizationPermissions, permissionLevel)) {
            return true;
        }

        if ((permissionLevel === PermissionLevel.Read || permissionLevel === PermissionLevel.Write) && webshop.privateMeta.scanPermissions.hasAccess(organizationPermissions, PermissionLevel.Write)) {
            return true;
        }

        return false;
    }

    async canAccessOrder(webshop: Webshop, permissionLevel: PermissionLevel = PermissionLevel.Read) {
        return await this.canAccessWebshop(webshop, permissionLevel);
    }

    async canAccessPayment(payment: Payment, permissionLevel: PermissionLevel = PermissionLevel.Read) {
        return await this.canAccessPayments([payment], permissionLevel)
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

        const organizationId = payments[0].organizationId
        for (const item of payments) {
            if (item.organizationId !== organizationId) {
                // Cannot merge multiple organizations for now
                return false;
            }
        }

        // First try without queries
        if (!organizationId) {
            return this.hasPlatformFullAccess()
        }

        if (await this.canManagePayments(organizationId)) {
            return true;
        }

        const {balanceItems} = await Payment.loadBalanceItems(payments)
        return await this.canAccessBalanceItems(balanceItems, permissionLevel)
    }

    async canAccessBalanceItems(
        balanceItems: BalanceItem[],
        permissionLevel: PermissionLevel = PermissionLevel.Read,
        data?: {
            registrations: Registration[],
            orders: Order[],
            members: Member[]
        }
    ): Promise<boolean> {
        for (const balanceItem of balanceItems) {
            if (!this.checkScope(balanceItem.organizationId)) {
                // Invalid scope
                return false;
            }
        }

        if (balanceItems.length === 0) {
            return false;
        }

        const organizationId = balanceItems[0].organizationId
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
        const {registrations, orders, members} = data ?? (this.user.permissions || permissionLevel === PermissionLevel.Read) ? (await Payment.loadBalanceItemRelations(balanceItems)) : {registrations: [], members: [], orders: []}

        if (this.user.permissions) {
            // We grant permission for a whole payment when the user has at least permission for a part of that payment.
            for (const registration of registrations) {
                if (await this.canAccessRegistration(registration, permissionLevel)) {
                    return true;
                }
            }

            const webshopCache: Map<string, Webshop> = new Map()

            for (const order of orders) {
                const webshop = webshopCache.get(order.webshopId) ?? await Webshop.getByID(order.webshopId)
                if (webshop) {
                    webshopCache.set(order.webshopId, webshop)

                    if (await this.canAccessWebshop(webshop, permissionLevel)) {
                        return true;
                    }
                }
            }
        }

        if (permissionLevel === PermissionLevel.Read) {
            // Check members
            const userMembers = await Member.getMembersWithRegistrationForUser(this.user)
            for (const member of userMembers) {
                if (members.find(m => m.id === member.id)) {
                    return true;
                }
            }
        }

        return false;
    }

    async canAccessDocumentTemplate(documentTemplate: DocumentTemplate, _: PermissionLevel = PermissionLevel.Read) {
        if (!this.checkScope(documentTemplate.organizationId)) {
            return false
        }

        return await this.hasFullAccess(documentTemplate.organizationId)
    }

    async canAccessDocument(document: Document, level: PermissionLevel = PermissionLevel.Read) {
        if (!this.checkScope(document.organizationId)) {
            return false
        }

        if (await this.hasFullAccess(document.organizationId)) {
            return true
        }

        if (level === PermissionLevel.Read && document.memberId) {
            const members = await Member.getMembersWithRegistrationForUser(this.user)

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
            return this.hasPlatformFullAccess()
        }

        return await this.canManageAdmins(user.organizationId);
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
            return this.hasPlatformFullAccess()
        }

        if (await this.hasFullAccess(template.organizationId)) {
            return true;
        }

        if (template.webshopId) {
            const webshop = await Webshop.getByID(template.webshopId)
            if (!webshop || !(await this.canAccessWebshop(webshop, PermissionLevel.Full))) {
                return false;
            }

            return true;
        }

        if (template.groupId) {
            const group = await Group.getByID(template.groupId)
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

        if (await this.canManagePayments(member.organizationId)) {
            return true;
        }

        if (await this.canAccessMember(member, PermissionLevel.Write)) {
            return true;
        }

        return false;
    }

    async canManageFinances(organizationId: string) {
        const organizationPermissions = await this.getOrganizationPermissions(organizationId)

        if (!organizationPermissions) {
            return false;
        }
        
        return organizationPermissions.hasAccessRight(AccessRight.OrganizationFinanceDirector)
    }

    /**
     * Mainly for transfer payment management
     */
    async canManagePayments(organizationId: string) {
        const organizationPermissions = await this.getOrganizationPermissions(organizationId)

        if (!organizationPermissions) {
            return false;
        }
        
        return !!organizationPermissions && (
            organizationPermissions.hasAccessRight(AccessRight.OrganizationManagePayments)
            || organizationPermissions.hasAccessRight(AccessRight.OrganizationFinanceDirector)
        )
    }

    async canCreateWebshops(organizationId: string) {
        const organizationPermissions = await this.getOrganizationPermissions(organizationId)

        if (!organizationPermissions) {
            return false;
        }

        return !!organizationPermissions && organizationPermissions.hasAccessRight(AccessRight.OrganizationCreateWebshops)
    }

    async canManagePaymentAccounts(organizationId: string, level: PermissionLevel = PermissionLevel.Read) {
        if (level === PermissionLevel.Read) {
            return await this.hasSomeAccess(organizationId);
        }

        return await this.canManageFinances(organizationId)
    }

    async canActivatePackages(organizationId: string) {
        return this.canManageFinances(organizationId)
    }

    async canDeactivatePackages(organizationId: string) {
        return this.canManageFinances(organizationId)
    }

    async canManageDocuments(organizationId: string, _: PermissionLevel = PermissionLevel.Read) {
        const organizationPermissions = await this.getOrganizationPermissions(organizationId)

        if (!organizationPermissions) {
            return false;
        }

        return this.hasFullAccess(organizationId)
    }

    async canAccessEmailBounces(organizationId: string) {
        return this.hasSomeAccess(organizationId)
    }

    canSendEmails() {
        return !!this.user.permissions
    }

    async canReadEmailTemplates(organizationId: string) {
        const organizationPermissions = await this.getOrganizationPermissions(organizationId)

        if (!organizationPermissions) {
            return false;
        }

        return !!this.user.permissions
    }

    async canCreateGroupInCategory(organizationId: string, category: GroupCategory) {
        const organizationPermissions = await this.getOrganizationPermissions(organizationId)

        if (!organizationPermissions) {
            return false;
        }

        if (category.settings.permissions.getCreatePermissionLevel(organizationPermissions) !== "Create") {
            throw new SimpleError({ code: "permission_denied", message: "You do not have permissions to add new groups", statusCode: 403 })
        }

        return true;
    }

    canUpload() {
        return !!this.user.permissions
    }

    canManageOrganizationDomain(organizationId: string) {
        return this.hasFullAccess(organizationId)
    }

    canManageSSOSettings(organizationId: string) {
        return this.hasFullAccess(organizationId)
    }

    async canManageOrganizationSettings(organizationId: string) {
        return this.hasFullAccess(organizationId);
    }

    /**
     * Use this as a circuit breaker to avoid queries for non-admin users
     */
    async hasSomeAccess(organizationId: string): Promise<boolean> {
        const organizationPermissions = await this.getOrganizationPermissions(organizationId)
        return !!organizationPermissions;
    }

    async canManageAdmins(organizationId: string) {
        return !this.user.isApiUser && (await this.hasFullAccess(organizationId))
    }

    async hasFullAccess(organizationId: string): Promise<boolean> {
        const organizationPermissions = await this.getOrganizationPermissions(organizationId)

        if (!organizationPermissions) {
            return false;
        }

        return !!organizationPermissions && organizationPermissions.hasFullAccess()
    }

    hasPlatformFullAccess(): boolean {
        return !!this.user.permissions && !!this.user.permissions.globalPermissions && this.user.permissions.globalPermissions.hasFullAccess(this.getPlatformRoles())
    }

    hasSomePlatformAccess(): boolean {
        return !!this.user.permissions && !!this.user.permissions.globalPermissions
    }

    canManagePlatformAdmins() {
        return this.hasPlatformFullAccess()
    }
}