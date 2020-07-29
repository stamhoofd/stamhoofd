import { ArrayDecoder, AutoEncoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';

export enum PermissionLevel {
    /** No access */
    None = "None",

    /** Read all data, but not allowed to write */
    Read = "Read",
    
    /** Read and write child data, but not allowed to modify settings */
    Write = "Write",
    
    /** Full access */
    Full = "Full",
}

export function getPermissionLevelNumber(level: PermissionLevel): number {
    switch (level) {
        case PermissionLevel.None: return 0;
        case PermissionLevel.Read: return 1;
        case PermissionLevel.Write: return 2;
        case PermissionLevel.Full: return 3;
        default: {
            const l: never = level; // will throw compile error if new levels are added without editing this method
            throw new Error("Unknown permission level "+l);
        }
    }
}

export class GroupPermissions extends AutoEncoder {
    @field({ decoder: StringDecoder })
    groupId: string

    /**
     * Allow to read members and member details
     */
    @field({ decoder: new EnumDecoder(PermissionLevel) })
    level: PermissionLevel
}

export class Permissions extends AutoEncoder {
    /**
     * Automatically have all permissions (e.g. when someone created a new group)
     * Also allows creating new groups
     */
    @field({ decoder: new EnumDecoder(PermissionLevel) })
    level: PermissionLevel

    @field({ decoder: new ArrayDecoder(GroupPermissions) })
    groups: GroupPermissions[] = []

    hasReadAccess(groupId: string | null = null) {
        if (this.level != PermissionLevel.None) {
            // Has read access
            return true
        }

        if (!groupId) {
            return false
        }

        const permission = this.groups.find(g => g.groupId === groupId)
        if (permission) {
            if (permission.level != PermissionLevel.None) {
                return true
            }
        }

        return false
    }

    hasWriteAccess(groupId: string | null = null) {
        if (this.level == PermissionLevel.Write || this.level == PermissionLevel.Full) {
            // Has read access
            return true
        }

        if (!groupId) {
            return false
        }

        const permission = this.groups.find(g => g.groupId === groupId)
        if (permission) {
            if (permission.level == PermissionLevel.Write || permission.level == PermissionLevel.Full) {
                return true
            }
        }

        return false
    }

    hasFullAccess(groupId: string | null = null) {
        if (this.level == PermissionLevel.Full) {
            // Has read access
            return true
        }

        if (!groupId) {
            return false
        }

        const permission = this.groups.find(g => g.groupId === groupId)
        if (permission) {
            if (permission.level == PermissionLevel.Full) {
                return true
            }
        }

        return false
    }
}