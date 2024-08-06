import { AccessRight, Group, Organization, OrganizationTag, PaymentGeneral, PermissionLevel, Permissions, PermissionsResourceType, Platform, PlatformMember, User } from "@stamhoofd/structures";
import { Ref, unref } from "vue";

export class ContextPermissions {
    reactiveUser: User|null|Ref<User|null>
    reactiveOrganization: Organization|null|Ref<Organization|null>
    reactivePlatform: Platform|Ref<Platform>

    /**
     * Whether to allow inheriting platoform permissions
     * (mosty disabled when editing permissions)
     */
    allowInheritingPermissions = true
    
    constructor(
        user: User|null|undefined|Ref<User|null>, 
        organization: Organization|null|undefined|Ref<Organization|null>,
        platform: Platform|Ref<Platform>,
        options?: {allowInheritingPermissions?: boolean}
    ) {
        this.reactiveUser = user ?? null
        this.reactiveOrganization = organization ?? null
        this.reactivePlatform = platform
        if (options?.allowInheritingPermissions !== undefined) {
            this.allowInheritingPermissions = options.allowInheritingPermissions
        }
    }

    get user() {
        return unref(this.reactiveUser)
    }

    get userPermissions() {
        return this.user?.permissions ?? null
    }

    get organization() {
        return unref(this.reactiveOrganization)
    }

    get platform() {
        return unref(this.reactivePlatform)
    }

    get platformPermissions() {
        return unref(this.userPermissions)?.forPlatform(this.platform) ?? null
    }

    get permissions() {
        if (!this.organization) {
            return this.platformPermissions
        }
        return unref(this.userPermissions)?.forOrganization(this.organization, this.allowInheritingPermissions ? Platform.shared : null) ?? null
    }

    getPermissionsForOrganization(organization: Organization) {
        return unref(this.userPermissions)?.forOrganization(organization, this.allowInheritingPermissions ? Platform.shared : null) ?? null
    }

    get unloadedPermissions(): Permissions|null {
        if (!this.organization) {
            return unref(this.userPermissions)?.globalPermissions ?? null
        }
        return unref(this.userPermissions)?.organizationPermissions.get(this.organization.id) ?? null
    }

    hasFullAccess() {
        return this.permissions?.hasFullAccess() ?? false
    }

    hasFullPlatformAccess() {
        return this.platformPermissions?.hasFullAccess() ?? false
    }

    hasAccessRight(right: AccessRight) {
        return this.permissions?.hasAccessRight(right) ?? false
    }

    hasResourceAccessRight(resourceType: PermissionsResourceType, resourceId: string, right: AccessRight) {
        return this.permissions?.hasResourceAccessRight(resourceType, resourceId, right) ?? false
    }

    canManagePayments() {
        return this.hasAccessRight(AccessRight.OrganizationManagePayments) || this.hasAccessRight(AccessRight.OrganizationFinanceDirector)
    }

    canAccessGroup(group: Group, permissionLevel: PermissionLevel = PermissionLevel.Read) {
        if (!this.organization || group.organizationId !== this.organization.id) {
            return this.hasFullPlatformAccess()
        }

        return group.hasAccess(this.permissions, this.organization.period.settings.categories, permissionLevel)
    }

    canAccessPlatformMember(member: PlatformMember, permissionLevel: PermissionLevel = PermissionLevel.Read) {
        if (this.hasFullPlatformAccess()) {
            return true;
        }

        for (const registration of member.member.registrations) {
            const organization = member.family.getOrganization(registration.organizationId);
            if (organization) {
                if (registration.group.hasAccess(this.getPermissionsForOrganization(organization), organization.period.settings.categories, permissionLevel)) {
                    return true;
                }
            }
        }
        return false;
    }

    canAccessPayment(payment: PaymentGeneral|null|undefined, level: PermissionLevel) {
        if (this.canManagePayments() || this.hasFullAccess()) {
            return true;
        }

        if (!payment) {
            return false
        }

        if (this.organization) {
            for (const order of payment.orders) {
                const webshop = this.organization.webshops.find(w => w.id === order.webshopId)
                if (webshop && webshop.privateMeta.permissions.hasAccess(this.permissions, level)) {
                    return true
                }
            }

            for (const registration of payment.registrations) {
                const group = this.organization.groups.find(w => w.id === registration.groupId)

                if (group && group.privateSettings?.permissions.hasAccess(this.permissions, level)) {
                    return true
                }
            }
        }
        return false
    }

    canAccessMemberPayments(member: PlatformMember, level: PermissionLevel) {
        if (this.canManagePayments()) {
            return true;
        }

        if (this.canAccessPlatformMember(member, level)) {
            return true;
        }

        return false;
    }

    hasSomePlatformAccess(): boolean {
        return !!this.platformPermissions
    }

    hasPlatformFullAccess(): boolean {
        return !!this.platformPermissions && !!this.platformPermissions.hasFullAccess()
    }

    getPlatformAccessibleOrganizationTags(level: PermissionLevel): OrganizationTag[] | 'all' {
        if (!this.hasSomePlatformAccess()) {
            return [];
        }

        if (this.hasPlatformFullAccess()) {
            return 'all'
        }

        if (this.platformPermissions?.hasResourceAccess(PermissionsResourceType.OrganizationTags, '', level)) {
            return 'all'
        }

        const allTags = this.platform.config.tags
        const tags: OrganizationTag[] = []

        for (const tag of allTags) {
            if (this.platformPermissions?.hasResourceAccess(PermissionsResourceType.OrganizationTags, tag.id, level)) {
                tags.push(tag)
            }
        }

        if (tags.length === allTags.length) {
            return 'all'
        }

        return tags
    }
}
