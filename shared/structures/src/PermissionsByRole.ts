import { AutoEncoder, field, ArrayDecoder } from '@simonbackx/simple-encoding';
import { PermissionLevel, getPermissionLevelNumber } from './PermissionLevel.js';
import { PermissionRole } from './PermissionRole.js';

/**
 * @deprecated
 * Use resource types
 * Give access to a given resouce based by the roles of a user
 */
export class PermissionsByRole extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(PermissionRole) })
    read: PermissionRole[] = [];

    @field({ decoder: new ArrayDecoder(PermissionRole) })
    write: PermissionRole[] = [];

    @field({ decoder: new ArrayDecoder(PermissionRole) })
    full: PermissionRole[] = [];

    getPermissionLevel(permissions: import('./LoadedPermissions.js').LoadedPermissions): PermissionLevel {
        if (permissions.hasFullAccess()) {
            return PermissionLevel.Full;
        }

        for (const role of this.full) {
            if (permissions.roles.find(r => r.id === role.id)) {
                return PermissionLevel.Full;
            }
        }

        if (permissions.hasWriteAccess()) {
            return PermissionLevel.Write;
        }

        for (const role of this.write) {
            if (permissions.roles.find(r => r.id === role.id)) {
                return PermissionLevel.Write;
            }
        }

        if (permissions.hasReadAccess()) {
            return PermissionLevel.Read;
        }

        for (const role of this.read) {
            if (permissions.roles.find(r => r.id === role.id)) {
                return PermissionLevel.Read;
            }
        }

        return PermissionLevel.None;
    }

    /**
     * Whetever a given user has access to the members in this group.
     */
    getRolePermissionLevel(role: PermissionRole): PermissionLevel {
        for (const r of this.full) {
            if (r.id === role.id) {
                return PermissionLevel.Full;
            }
        }

        for (const r of this.write) {
            if (r.id === role.id) {
                return PermissionLevel.Write;
            }
        }
        for (const r of this.read) {
            if (r.id === role.id) {
                return PermissionLevel.Read;
            }
        }

        return PermissionLevel.None;
    }

    hasAccess(permissions: import('./LoadedPermissions.js').LoadedPermissions | undefined | null, level: PermissionLevel): boolean {
        if (!permissions) {
            return false;
        }
        return getPermissionLevelNumber(this.getPermissionLevel(permissions)) >= getPermissionLevelNumber(level);
    }

    roleHasAccess(role: PermissionRole, level: PermissionLevel = PermissionLevel.Read): boolean {
        return getPermissionLevelNumber(this.getRolePermissionLevel(role)) >= getPermissionLevelNumber(level);
    }

    hasFullAccess(permissions: import('./LoadedPermissions.js').LoadedPermissions | undefined | null): boolean {
        return this.hasAccess(permissions, PermissionLevel.Full);
    }

    hasWriteAccess(permissions: import('./LoadedPermissions.js').LoadedPermissions | undefined | null): boolean {
        return this.hasAccess(permissions, PermissionLevel.Write);
    }

    hasReadAccess(permissions: import('./LoadedPermissions.js').LoadedPermissions | undefined | null): boolean {
        return this.hasAccess(permissions, PermissionLevel.Read);
    }
}
