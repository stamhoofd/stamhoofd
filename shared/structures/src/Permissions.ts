import { ArrayDecoder, AutoEncoder, BooleanDecoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

import { Organization } from './Organization';


export enum PermissionLevel {
    /** No access */
    None = "None",

    /** Read all data, but not allowed to write */
    Read = "Read",
    
    /** Read, write, add, delete child data, but not allowed to modify settings */
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

export class PermissionRole extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = "";
}

export class PermissionRoleDetailed extends PermissionRole {
    /**
     * Access to payments
     */
    @field({ decoder: BooleanDecoder })
    managePayments = false

    /**
     * Can create new webshops = write
     */
    @field({ decoder: BooleanDecoder })
    createWebshops = false
}

/**
 * Give access to a given resouce based by the roles of a user
 */
export class PermissionsByRole extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(PermissionRole) })
    read: PermissionRole[] = []

    @field({ decoder: new ArrayDecoder(PermissionRole) })
    write: PermissionRole[] = []

    @field({ decoder: new ArrayDecoder(PermissionRole) })
    full: PermissionRole[] = []

    /**
     * Whetever a given user has access to the members in this group. 
     */
    getPermissionLevel(permissions: Permissions): PermissionLevel {
        if (permissions.hasFullAccess()) {
            return PermissionLevel.Full
        }

        for (const role of this.full) {
            if (permissions.roles.find(r => r.id === role.id)) {
                return PermissionLevel.Full
            }
        }

        if (permissions.hasWriteAccess()) {
            return PermissionLevel.Write
        }

        for (const role of this.write) {
            if (permissions.roles.find(r => r.id === role.id)) {
                return PermissionLevel.Write
            }
        }

        if (permissions.hasReadAccess()) {
            return PermissionLevel.Read
        }

        for (const role of this.read) {
            if (permissions.roles.find(r => r.id === role.id)) {
                return PermissionLevel.Read
            }
        }

        return PermissionLevel.None
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

    /**
     * @deprecated
     */
    @field({ decoder: new ArrayDecoder(GroupPermissions) })
    groups: GroupPermissions[] = []

    @field({ decoder: new ArrayDecoder(PermissionRole), version: 60 })
    roles: PermissionRole[] = []

    hasAccess(level: PermissionLevel): boolean {
        if (getPermissionLevelNumber(this.level) >= getPermissionLevelNumber(level)) {
            // Someone with read / write access for the whole organization, also the same access for each group
            return true;
        }

        return false
    }

    hasReadAccess(): boolean {
        return this.hasAccess(PermissionLevel.Read)
    }

    hasWriteAccess(): boolean {
        return this.hasAccess(PermissionLevel.Write)
    }

    hasFullAccess(): boolean {
        return this.hasAccess(PermissionLevel.Full)
    }

    /**
     * @param roles All available roles of the organizatino (to query)
     */
    canCreateWebshops(roles: PermissionRoleDetailed[]): boolean {
        if (this.hasFullAccess()) {
            return true
        }
        for (const r of this.roles) {
            const f = roles.find(rr => r.id === r.id)
            if (!f) {
                // Deleted role
                continue
            }
            if (f.createWebshops) {
                return true
            }
        }

        return false
    }

    /**
     * @param roles All available roles of the organizatino (to query)
     */
    canManagePayments(roles: PermissionRoleDetailed[]): boolean {
        if (this.hasFullAccess()) {
            return true
        }
        for (const r of this.roles) {
            const f = roles.find(rr => r.id === r.id)
            if (!f) {
                // Deleted role
                continue
            }
            if (f.managePayments) {
                return true
            }
        }

        return false
    }
}