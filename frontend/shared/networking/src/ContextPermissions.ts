import { AutoEncoderPatchType, PartialWithoutMethods, PatchType } from "@simonbackx/simple-encoding";
import { AccessRight, Organization, PaymentGeneral, PermissionLevel, Platform, User, UserPermissions, Permissions } from "@stamhoofd/structures";
import { Ref, unref } from "vue";

export class ContextPermissions {
    reactiveUser: User|null|Ref<User|null>
    reactiveOrganization: Organization|null|Ref<Organization|null>
    reactivePlatform: Platform|Ref<Platform>
    
    constructor(
        user: User|null|undefined|Ref<User|null>, 
        organization: Organization|null|undefined|Ref<Organization|null>,
        platform: Platform|Ref<Platform>
    ) {
        this.reactiveUser = user ?? null
        this.reactiveOrganization = organization ?? null
        this.reactivePlatform = platform
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

    get permissions() {
        if (!this.organization) {
            return unref(this.userPermissions)?.forPlatform(this.platform) ?? null
        }
        return unref(this.userPermissions)?.forOrganization(this.organization) ?? null
    }

    createPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<Permissions>>|null): AutoEncoderPatchType<UserPermissions> {
        if (this.organization) {
            return UserPermissions.convertPatch(patch === null ? null : Permissions.patch(patch), this.organization.id)
        }
        return UserPermissions.convertPlatformPatch(patch === null ? null : Permissions.patch(patch))
    }

    hasFullAccess() {
        return this.permissions?.hasFullAccess() ?? false
    }

    hasAccessRight(right: AccessRight) {
        return this.permissions?.hasAccessRight(right) ?? false
    }

    canManagePayments() {
        return this.hasAccessRight(AccessRight.OrganizationManagePayments) || this.hasAccessRight(AccessRight.OrganizationFinanceDirector)
    }

    canAccessPayment(payment?: PaymentGeneral|null, level: PermissionLevel) {
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
}