import { AccessRight, Event, EventPermissionChecker, Group, GroupCategory, GroupType, LoadedPermissions, Organization, OrganizationForPermissionCalculation, OrganizationTag, PaymentGeneral, PermissionLevel, Permissions, PermissionsResourceType, Platform, PlatformMember, Registration, UserWithMembers } from '@stamhoofd/structures';
import { Ref, toRaw, unref } from 'vue';

export class ContextPermissions {
    reactiveUser: UserWithMembers | null | Ref<UserWithMembers | null>;
    reactiveOrganization: Organization | null | Ref<Organization | null>;
    reactivePlatform: Platform | Ref<Platform>;

    /**
     * Whether to allow inheriting platoform permissions
     * (mosty disabled when editing permissions)
     */
    allowInheritingPermissions = true;

    constructor(
        user: UserWithMembers | null | undefined | Ref<UserWithMembers | null>,
        organization: Organization | null | undefined | Ref<Organization | null>,
        platform: Platform | Ref<Platform>,
        options?: { allowInheritingPermissions?: boolean },
    ) {
        this.reactiveUser = user ?? null;
        this.reactiveOrganization = organization ?? null;
        this.reactivePlatform = platform;
        if (options?.allowInheritingPermissions !== undefined) {
            this.allowInheritingPermissions = options.allowInheritingPermissions;
        }
    }

    get user() {
        return unref(this.reactiveUser);
    }

    get userPermissions() {
        return this.user?.permissions ?? null;
    }

    get organization() {
        // We mark organization as raw, because the permission calculation is too expensive to run on every change of an organization
        // to reload permissions, a user needs to reload the page or app
        return toRaw(unref(this.reactiveOrganization));
    }

    get platform() {
        // We mark platform as raw, because the permission calculation is too expensive to run on every change of the platform
        // to reload permissions, a user needs to reload the page or app
        return toRaw(unref(this.reactivePlatform));
    }

    _cachedPlatformPermissions: LoadedPermissions | null = null;
    get platformPermissions() {
        if (this._cachedPlatformPermissions) {
            return this._cachedPlatformPermissions;
        }

        const c = this._platformPermissions;
        this._cachedPlatformPermissions = c;
        return c;
    }

    get _platformPermissions() {
        return unref(this.userPermissions)?.forPlatform(this.platform) ?? null;
    }

    _cachedPermissions: LoadedPermissions | null = null;
    get permissions() {
        if (this._cachedPermissions) {
            return this._cachedPermissions;
        }

        const c = this._permissions;
        this._cachedPermissions = c;
        return c;
    }

    get _permissions() {
        if (!this.organization) {
            return this.platformPermissions;
        }
        return unref(this.userPermissions)?.forOrganization(this.organization, this.allowInheritingPermissions ? Platform.shared : null) ?? null;
    }

    getPermissionsForOrganization(organization: OrganizationForPermissionCalculation) {
        return unref(this.userPermissions)?.forOrganization(organization, this.allowInheritingPermissions ? Platform.shared : null) ?? null;
    }

    get unloadedPermissions(): Permissions | null {
        if (!this.organization) {
            return unref(this.userPermissions)?.globalPermissions ?? null;
        }
        return unref(this.userPermissions)?.organizationPermissions.get(this.organization.id) ?? null;
    }

    hasFullAccess() {
        return this.permissions?.hasFullAccess() ?? false;
    }

    /**
     * @deprecated
     * Use hasPlatformFullAccess instead
     */
    hasFullPlatformAccess() {
        return this.platformPermissions?.hasFullAccess() ?? false;
    }

    hasAccessRight(right: AccessRight) {
        return this.permissions?.hasAccessRight(right) ?? false;
    }

    hasResourceAccess(resourceType: PermissionsResourceType, resourceId: string, level: PermissionLevel = PermissionLevel.Read) {
        return this.permissions?.hasResourceAccess(resourceType, resourceId, level) ?? false;
    }

    hasResourceAccessRight(resourceType: PermissionsResourceType, resourceId: string, right: AccessRight) {
        return this.permissions?.hasResourceAccessRight(resourceType, resourceId, right) ?? false;
    }

    hasAccessRightForSomeResourceOfType(resourceType: PermissionsResourceType, right: AccessRight) {
        return this.permissions?.hasAccessRightForSomeResourceOfType(resourceType, right) ?? false;
    }

    hasAccessForSomeResourceOfType(resourceType: PermissionsResourceType, level: PermissionLevel = PermissionLevel.Read) {
        return this.permissions?.hasAccessForSomeResourceOfType(resourceType, level) ?? false;
    }

    canManagePayments() {
        return this.hasAccessRight(AccessRight.OrganizationManagePayments) || this.hasAccessRight(AccessRight.OrganizationFinanceDirector);
    }

    canManageEmailTemplates() {
        return this.hasAccessRight(AccessRight.ManageEmailTemplates);
    }

    canAccessGroup(group: Group, permissionLevel: PermissionLevel = PermissionLevel.Read, organization?: Organization | null) {
        if (organization === undefined || (organization === null && this.organization)) {
            organization = this.organization;
        }

        if (!organization || group.organizationId !== organization.id) {
            return this.hasFullPlatformAccess();
        }

        if (group.periodId !== organization.period.period.id) {
            if (STAMHOOFD.userMode === 'organization' || group.periodId !== this.platform.period.id) {
                if (!this.hasFullAccess()) {
                    return false;
                }
            }
        }

        const permissions = this.getPermissionsForOrganization(organization);
        if (!permissions) {
            return false;
        }

        if (permissions.hasResourceAccess(PermissionsResourceType.Groups, group.id, permissionLevel)) {
            return true;
        }

        // Check parent categories
        if (group.type === GroupType.Membership) {
            const parentCategories = group.getParentCategories(organization.period.settings.categories);
            for (const category of parentCategories) {
                if (permissions.hasResourceAccess(PermissionsResourceType.GroupCategories, category.id, permissionLevel)) {
                    return true;
                }
            }
        }

        if (group.type === GroupType.EventRegistration && group.event && group.event.organizationId === organization.id) {
            // we'll need to check the event permissions
            return this.canWriteEventForOrganization(group.event, organization);
        }

        if (group.type === GroupType.WaitingList && group.parentGroup && group.parentGroup.type === GroupType.EventRegistration && group.parentGroup.event && group.parentGroup.event.organizationId === organization.id) {
            // we'll need to check the event permissions
            return this.canWriteEventForOrganization(group.parentGroup.event, organization);
        }

        return false;
    }

    canRegisterMembersInGroup(group: Group, organization?: Organization | null) {
        if (this.canAccessGroup(group, PermissionLevel.Write, organization)) {
            return true;
        }
        if (this.organization && this.organization.id !== group.organizationId) {
            if (group.settings.allowRegistrationsByOrganization && !group.closed) {
                return this.hasFullAccess();
            }
        }
        return false;
    }

    canCreateGroupInCategory(category: GroupCategory) {
        if (!this.organization) {
            return this.hasFullPlatformAccess();
        }

        return category.canCreate(this.permissions, this.organization.period.settings.categories);
    }

    canAccessRegistration(registration: Registration, organization: Organization, permissionLevel: PermissionLevel = PermissionLevel.Read) {
        if (this.canAccessGroup(registration.group, permissionLevel, organization)) {
            return true;
        }
        return false;
    }

    canAccessPlatformMember(member: PlatformMember, permissionLevel: PermissionLevel = PermissionLevel.Read) {
        if (member.hasFullAccess || member.isNew) {
            return true;
        }

        if (this.hasFullPlatformAccess()) {
            return true;
        }

        if (this.user && 'members' in this.user && this.user.members.members.some(m => m.id === member.id)) {
            return true;
        }

        if (this.getPlatformAccessibleOrganizationTags(permissionLevel) === 'all') {
            // Can access all members: even members without any registration
            return true;
        }

        for (const registration of member.filterRegistrations({ currentPeriod: true })) {
            const organization = member.family.getOrganization(registration.organizationId);
            if (organization) {
                if (this.canAccessRegistration(registration, organization, permissionLevel)) {
                    return true;
                }
            }
        }
        return false;
    }

    canAccessPayment(payment: PaymentGeneral | null | undefined, level: PermissionLevel) {
        if (!payment) {
            return false;
        }

        if (this.organization && payment.organizationId !== this.organization.id) {
            return false;
        }

        if (this.canManagePayments() || this.hasFullAccess()) {
            return true;
        }

        if (this.organization) {
            for (const webshopId of payment.webshopIds) {
                const webshop = this.organization.webshops.find(w => w.id === webshopId);
                if (webshop && this.canAccessWebshop(webshop, level)) {
                    return true;
                }
            }

            for (const groupId of payment.groupIds) {
                const group = this.organization.groups.find(w => w.id === groupId);
                if (group && this.canAccessGroup(group, level)) {
                    return true;
                }
            }
        }
        return false;
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

    canAccessWebshop(webshop: { id: string }, permissionLevel: PermissionLevel = PermissionLevel.Read, autoIncludeScanTickets = true) {
        if (!this.permissions) {
            return false;
        }

        if (this.permissions.hasResourceAccess(PermissionsResourceType.Webshops, webshop.id, permissionLevel)) {
            return true;
        }

        if (autoIncludeScanTickets && permissionLevel === PermissionLevel.Read && this.permissions.hasResourceAccessRight(PermissionsResourceType.Webshops, webshop.id, AccessRight.WebshopScanTickets)) {
            return true;
        }

        return false;
    }

    canAccessWebshopTickets(webshop: { id: string }, permissionLevel: PermissionLevel = PermissionLevel.Read) {
        if (!this.permissions) {
            return false;
        }

        if (this.permissions.hasResourceAccess(PermissionsResourceType.Webshops, webshop.id, permissionLevel)) {
            return true;
        }

        if ((permissionLevel === PermissionLevel.Read || permissionLevel === PermissionLevel.Write) && this.permissions.hasResourceAccessRight(PermissionsResourceType.Webshops, webshop.id, AccessRight.WebshopScanTickets)) {
            return true;
        }

        return false;
    }

    hasSomePlatformAccess(): boolean {
        return !!this.platformPermissions;
    }

    hasPlatformFullAccess(): boolean {
        return !!this.platformPermissions && !!this.platformPermissions.hasFullAccess();
    }

    getPlatformAccessibleOrganizationTags(level: PermissionLevel): OrganizationTag[] | 'all' {
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
        const tags: OrganizationTag[] = [];

        for (const tag of allTags) {
            if (this.platformPermissions?.hasResourceAccess(PermissionsResourceType.OrganizationTags, tag.id, level)) {
                tags.push(tag);
            }
        }

        if (tags.length === allTags.length) {
            return 'all';
        }

        return tags;
    }

    canWriteEventForCurrentOrganization(event: Event) {
        return this.canWriteEventForOrganization(event, this.organization);
    }

    canWriteEventForOrganization(event: Event, organization: Organization | null) {
        return EventPermissionChecker.hasPermissionToWriteEvent(
            event,
            {
                userPermissions: this.userPermissions,
                platform: this.platform,
                organization,
            });
    }
}
