import { AccessRight, LoadedPermissions, Organization, PaymentGeneral, PermissionLevel } from "@stamhoofd/structures";

export class FrontendOrganizationPermissionChecker {
    permissions: LoadedPermissions|null
    organization: Organization|null
    
    constructor(permissions: LoadedPermissions|null, organization: Organization|null) {
        this.permissions = permissions
        this.organization = organization
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