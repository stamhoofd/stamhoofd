import { ArrayDecoder, AutoEncoder, field } from '@simonbackx/simple-encoding';
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

    roleHasAccess(role: PermissionRole, level: PermissionLevel = PermissionLevel.Read): boolean {
        return getPermissionLevelNumber(this.getRolePermissionLevel(role)) >= getPermissionLevelNumber(level);
    }
}
