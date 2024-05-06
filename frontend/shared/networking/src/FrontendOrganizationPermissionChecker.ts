import { AccessRight, LoadedPermissions } from "@stamhoofd/structures";

export class FrontendOrganizationPermissionChecker {
    permissions: LoadedPermissions|null
    
    constructor(permissions: LoadedPermissions|null) {
        this.permissions = permissions
    }

    hasFullAccess() {
        return this.permissions?.hasFullAccess() ?? false
    }

    hasAccessRight(right: AccessRight) {
        return this.permissions?.hasAccessRight(right) ?? false
    }
}