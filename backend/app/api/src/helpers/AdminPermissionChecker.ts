import { SimpleError } from "@simonbackx/simple-errors"
import { BalanceItem, Document, DocumentTemplate, EmailTemplate, Group, Member, MemberWithRegistrations, Order, Organization, Payment, Registration, User, Webshop } from "@stamhoofd/models"
import { GroupCategory, GroupStatus, PermissionLevel } from "@stamhoofd/structures"
import { Formatter } from "@stamhoofd/utility"

/**
 * One class with all the responsabilities of checking permissions to each resource in the system by a given user, possibly in an organization context.
 * This helps when dependencies of permissions change, such as parent categories for groups
 */
export class AdminPermissionChecker {
    organization: Organization|null
    user: User
    
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

    getAllRoles() {
        // todo: add platform roles if user has global roles
        return [...(this.organization?.privateMeta.roles ?? [])]
    }

    canAccessPrivateOrganizationData(organization: Organization) {
        if (this.organization && this.organization.id === organization.id && this.hasSomeAccess()) {
            return true;
        }
        return false;
    }

    checkScope(organizationId: string|null) {
        if (organizationId) {
            if (this.organization && organizationId !== this.organization.id) {
                return false
            }
        } else {
            // Global objects are only accessible in the platform context
            if (this.organization) {
                return false
            }
        }

        return true;
    }

    canAccessGroup(group: Group, permissionLevel: PermissionLevel = PermissionLevel.Read): boolean {
        // Check permissions aren't scoped to a specific organization, and they mismatch
        if (!this.checkScope(group.organizationId)) {
            return false
        }

        if (group.deletedAt || group.status === GroupStatus.Archived) {
            return this.canAccessArchivedGroups();
        }

        // Check user has permissions
        if (!this.user.permissions) {
            return false
        }

        // Check global level permissions for this user
        if (group.privateSettings.permissions.hasAccess(this.user.permissions, this.getAllRoles(), permissionLevel)) {
            return true;
        }

        // Check parent categories
        if (this.organization) {
            const parentCategories = group.getParentCategories(this.organization.meta.categories)
            for (const category of parentCategories) {
                if (category.settings.permissions.groupPermissions.hasAccess(this.user.permissions, this.getAllRoles(), permissionLevel)) {
                    return true
                }
            }
        }

        return false;
    }

    canAccessArchivedGroups() {
        if (!this.organization) {
            return false;
        }

        return this.hasFullAccess()
    }

    /**
     * Note: only checks admin permissions. Users that 'own' this member can also access it but that does not use the AdminPermissionChecker
     */
    canAccessMember(member: MemberWithRegistrations, allGroups: Group[], permissionLevel: PermissionLevel = PermissionLevel.Read) {
        // Check user has permissions
        if (!this.user.permissions) {
            return false
        }

        if (this.user.permissions.hasAccess(this.getAllRoles(), permissionLevel)) {
            return true;
        }

        for (const registration of member.registrations) {
            if (this.canAccessRegistration(registration, allGroups, permissionLevel)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Only full admins can delete members permanently
     */
    canDeleteMember(_: MemberWithRegistrations) {
        return this.hasFullAccess()
    }

    /**
     * Note: only checks admin permissions. Users that 'own' this member can also access it but that does not use the AdminPermissionChecker
     */
    canAccessRegistration(registration: Registration, allGroups: Group[], permissionLevel: PermissionLevel = PermissionLevel.Read) {
        // Check user has permissions
        if (!this.user.permissions) {
            return false
        }

        if (this.user.permissions.hasAccess(this.getAllRoles(), permissionLevel)) {
            return true;
        }

        const group = allGroups.find(g => g.id === registration.groupId)
        if (!group) {
            return false;
        }

        if (this.canAccessGroup(group, permissionLevel)) {
            return true;
        }

        return false;
    }

    canAccessWebshop(webshop: Webshop, permissionLevel: PermissionLevel = PermissionLevel.Read) {
        if (!this.checkScope(webshop.organizationId)) {
            return false
        }

        if (webshop.privateMeta.permissions.hasAccess(this.user.permissions, this.getAllRoles(), permissionLevel)) {
            return true;
        }

        if (permissionLevel === PermissionLevel.Read && webshop.privateMeta.scanPermissions.hasAccess(this.user.permissions, this.getAllRoles(), PermissionLevel.Write)) {
            return true;
        }

        return false;
    }

    canAccessWebshopTickets(webshop: Webshop, permissionLevel: PermissionLevel = PermissionLevel.Read) {
        if (!this.checkScope(webshop.organizationId)) {
            return false
        }

        if (webshop.privateMeta.permissions.hasAccess(this.user.permissions, this.getAllRoles(), permissionLevel)) {
            return true;
        }

        if ((permissionLevel === PermissionLevel.Read || permissionLevel === PermissionLevel.Write) && webshop.privateMeta.scanPermissions.hasAccess(this.user.permissions, this.getAllRoles(), PermissionLevel.Write)) {
            return true;
        }

        return false;
    }

    canAccessOrder(webshop: Webshop, permissionLevel: PermissionLevel = PermissionLevel.Read) {
        return this.canAccessWebshop(webshop, permissionLevel);
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

        // First try without queries
        if (this.canManagePayments()) {
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
        if (this.organization) {
            for (const balanceItem of balanceItems) {
                if (!this.checkScope(balanceItem.organizationId)) {
                    // Invalid scope
                    return false;
                }
            }
        }

        // First try without queries
        if (this.canManagePayments()) {
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
            const groupIds = Formatter.uniqueArray(registrations.flatMap(b => b.groupId ? [b.groupId] : []))
            const groups = await Group.getByIDs(...groupIds)

            // We grant permission for a whole payment when the user has at least permission for a part of that payment.
            for (const registration of registrations) {
                if (this.canAccessRegistration(registration, groups, permissionLevel)) {
                    return true;
                }
            }

            const webshopCache: Map<string, Webshop> = new Map()

            for (const order of orders) {
                const webshop = webshopCache.get(order.webshopId) ?? await Webshop.getByID(order.webshopId)
                if (webshop) {
                    webshopCache.set(order.webshopId, webshop)

                    if (this.canAccessWebshop(webshop, permissionLevel)) {
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

    canAccessDocumentTemplate(documentTemplate: DocumentTemplate, _: PermissionLevel = PermissionLevel.Read) {
        if (!this.checkScope(documentTemplate.organizationId)) {
            return false
        }

        return this.hasFullAccess()
    }

    async canAccessDocument(document: Document, level: PermissionLevel = PermissionLevel.Read) {
        if (!this.checkScope(document.organizationId)) {
            return false
        }

        if (this.hasFullAccess()) {
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
    canAccessUser(user: User, level: PermissionLevel = PermissionLevel.Read) {
        if (!this.checkScope(user.organizationId)) {
            return false;
        }

        // Write = edit email, name
        // full = edit permissions
        if (user.id === this.user.id && (level === PermissionLevel.Read || level === PermissionLevel.Write)) {
            return true;
        }

        return this.canManageAdmins();
    }

    async canAccessEmailTemplate(template: EmailTemplate, level: PermissionLevel = PermissionLevel.Read) {
        if (level === PermissionLevel.Read) {
            return this.canReadEmailTemplates();
        }
        
        // Note: if the template has an organizationId of null, everyone can access it, but only for reading
        // that is why we only check the scope afterwards
        if (!this.checkScope(template.organizationId)) {
            return false;
        }

        if (this.hasFullAccess()) {
            return true;
        }

        if (template.webshopId) {
            const webshop = await Webshop.getByID(template.webshopId)
            if (!webshop || !this.canAccessWebshop(webshop, PermissionLevel.Full)) {
                return false;
            }

            return true;
        }

        if (template.groupId) {
            const group = await Group.getByID(template.groupId)
            if (!group || !this.canAccessGroup(group, PermissionLevel.Full)) {
                return false;
            }

            return true;
        }

        return false;
    }
    
    canLinkBalanceItemToUser(linkingUser: User) {
        if (!this.checkScope(linkingUser.organizationId)) {
            return false;
        }

        if (this.canManagePayments()) {
            return true;
        }

        return false;
    }

    async canLinkBalanceItemToMember(member: MemberWithRegistrations) {
        if (!this.checkScope(member.organizationId)) {
            return false;
        }

        if (this.canManagePayments()) {
            return true;
        }

        const groups = await Group.where({ organizationId: member.organizationId })
        if (this.canAccessMember(member, groups, PermissionLevel.Write)) {
            return true;
        }

        return false;
    }

    canManageFinances() {
        if (!this.organization) {
            // For now restricted: only platform admins in the future
            return false;
        }
        
        return !!this.user.permissions && this.user.permissions.hasFinanceAccess(this.getAllRoles())
    }

    /**
     * Mainly for transfer payment management
     */
    canManagePayments() {
        if (!this.organization) {
            // For now restricted: only platform admins in the future
            return false;
        }
        
        return !!this.user.permissions && this.user.permissions.canManagePayments(this.getAllRoles())
    }

    canCreateWebshops() {
        if (!this.organization) {
            // For now restricted: only platform admins in the future
            return false;
        }

        return !!this.user.permissions && this.user.permissions.canCreateWebshops(this.getAllRoles())
    }

    canManagePaymentAccounts(level: PermissionLevel = PermissionLevel.Read) {
        if (!this.organization) {
            // For now restricted: only platform admins in the future
            return false;
        }

        if (level === PermissionLevel.Read) {
            return this.hasSomeAccess();
        }

        return this.canManageFinances()
    }

    canActivatePackages() {
        return this.canManageFinances()
    }

    canDeactivatePackages() {
        return this.canManageFinances()
    }

    canManageDocuments(_: PermissionLevel = PermissionLevel.Read) {
        if (!this.organization) {
            // For now restricted: only platform admins in the future
            return false;
        }

        return this.hasFullAccess()
    }

    canAccessEmailBounces() {
        if (!this.organization) {
            // For now restricted: only platform admins in the future
            return false;
        }

        return this.hasFullAccess()
    }

    canSendEmails() {
        if (!this.organization) {
            // For now restricted: only platform admins in the future
            return false;
        }

        return !!this.user.permissions
    }

    canReadEmailTemplates() {
        if (!this.organization) {
            // For now restricted: only platform admins in the future
            return false;
        }

        return !!this.user.permissions
    }

    canCreateGroupInCategory(category: GroupCategory) {
        if (!this.organization) {
            // For now restricted: only platform admins in the future
            return false;
        }

        if (!this.user.permissions) {
            return false;
        }

        if (category.settings.permissions.getCreatePermissionLevel(this.user.permissions, this.getAllRoles()) !== "Create") {
            throw new SimpleError({ code: "permission_denied", message: "You do not have permissions to add new groups", statusCode: 403 })
        }

        return true;
    }

    canUpload() {
        return !!this.user.permissions
    }

    canManageOrganizationDomain() {
        if (!this.organization) {
            return false;
        }

        return this.hasFullAccess()
    }

    canManageSSOSettings() {
        if (!this.organization) {
            return false;
        }

        return this.hasFullAccess()
    }

    canManageOrganizationSettings() {
        if (!this.organization) {
            // For now restricted: only platform admins in the future
            return false;
        }

        return this.hasFullAccess();
    }

    /**
     * Use this as a circuit breaker to avoid queries for non-admin users
     */
    hasSomeAccess(): boolean {
        if (!this.organization) {
            // For now restricted: only platform admins in the future
            return false;
        }

        return !!this.user.permissions;
    }

    canManageAdmins() {
        return this.hasFullAccess() && !this.user.isApiUser
    }

    hasFullAccess(): boolean {
        if (!this.organization) {
            // For now restricted: only platform admins in the future
            return false;
        }

        return !!this.user.permissions && this.user.permissions.hasFullAccess(this.getAllRoles())
    }

    hasPlatformFullAccess(): boolean {
        return (this.user.email.endsWith('@stamhoofd.be') || this.user.email.endsWith('@stamhoofd.nl')) && this.user.verified && this.hasFullAccess()
    }

}