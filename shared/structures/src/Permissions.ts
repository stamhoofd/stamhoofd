import { ArrayDecoder, AutoEncoder, BooleanDecoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from "uuid";

import { Group } from './Group';
import { Organization } from './Organization';
import { WebshopPreview } from './webshops/Webshop';


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
     * Allow to read members and member details
     */
    @field({ decoder: new EnumDecoder(PermissionLevel), version: 201 })
    level: PermissionLevel = PermissionLevel.None

    /**
     * Access to open transfers
     */
    @field({ decoder: BooleanDecoder })
    managePayments = false

    /**
     * Full payments access
     */
    @field({ decoder: BooleanDecoder, version: 199 })
    financeDirector = false

    /**
     * Can create new webshops = write
     */
    @field({ decoder: BooleanDecoder })
    createWebshops = false

    getDescription(webshops: WebshopPreview[], groups: Group[]) {
        const stack: string[] = []
        if (this.level === PermissionLevel.Read) {
            stack.push("alles lezen")
        }
        if (this.level === PermissionLevel.Write) {
            stack.push("alles bewerken")
        }
        if (this.level === PermissionLevel.Full) {
            stack.push("alles")
        }

        if (this.financeDirector) {
            stack.push("volledige boekhouding")
        } else if (this.managePayments) {
            stack.push("overschrijvingen")
        }

        if (this.createWebshops) {
            stack.push("webshops maken")
        }

        let webshopCount = 0
        for (const webshop of webshops) {
            if (webshop.privateMeta.permissions.roleHasAccess(this)) {
                webshopCount++
                continue;
            }
            if (webshop.privateMeta.scanPermissions.roleHasAccess(this)) {
                webshopCount++
                continue;
            }
        }

        if (webshopCount > 0) {
            stack.push(webshopCount+" webshop"+(webshopCount > 1 ? "s" : ""))
        }

        let groupCount = 0
        for (const group of groups) {
            if (group.privateSettings?.permissions.roleHasAccess(this)) {
                groupCount++
                continue;
            }
        }

        if (groupCount > 0) {
            stack.push(groupCount+" groep"+(groupCount > 1 ? "en" : ""))
        }

        if (stack.length === 0) {
            return "geen toegang"
        }

        return Formatter.capitalizeFirstLetter(Formatter.joinLast(stack, ', ', ' en '))
    }
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
    getPermissionLevel(permissions: Permissions, allRoles: PermissionRoleDetailed[]): PermissionLevel {
        if (permissions.hasFullAccess(allRoles)) {
            return PermissionLevel.Full
        }

        for (const role of this.full) {
            if (permissions.roles.find(r => r.id === role.id)) {
                return PermissionLevel.Full
            }
        }

        if (permissions.hasWriteAccess(allRoles)) {
            return PermissionLevel.Write
        }

        for (const role of this.write) {
            if (permissions.roles.find(r => r.id === role.id)) {
                return PermissionLevel.Write
            }
        }

        if (permissions.hasReadAccess(allRoles)) {
            return PermissionLevel.Read
        }

        for (const role of this.read) {
            if (permissions.roles.find(r => r.id === role.id)) {
                return PermissionLevel.Read
            }
        }

        return PermissionLevel.None
    }

     /**
     * Whetever a given user has access to the members in this group. 
     */
    getRolePermissionLevel(role: PermissionRole): PermissionLevel {
        for (const r of this.full) {
            if (r.id === role.id) {
                return PermissionLevel.Full
            }
        }

        for (const r of this.write) {
            if (r.id === role.id) {
                return PermissionLevel.Write
            }
        }
        for (const r of this.read) {
            if (r.id === role.id) {
                return PermissionLevel.Read
            }
        }

        return PermissionLevel.None
    }

    userHasAccess(user: {permissions?: Permissions|null, organization: {privateMeta: {roles: PermissionRoleDetailed[]}}}, level: PermissionLevel): boolean {
        return this.hasAccess(user.permissions, user.organization.privateMeta.roles, level)
    }

    hasAccess(permissions: Permissions|undefined|null, allRoles: PermissionRoleDetailed[], level: PermissionLevel): boolean {
        if (!permissions) {
            return false
        }
        return getPermissionLevelNumber(this.getPermissionLevel(permissions, allRoles)) >= getPermissionLevelNumber(level)
    }

    roleHasAccess(role: PermissionRole, level: PermissionLevel = PermissionLevel.Read): boolean {
        return getPermissionLevelNumber(this.getRolePermissionLevel(role)) >= getPermissionLevelNumber(level)
    }

    hasFullAccess(permissions: Permissions|undefined|null, allRoles: PermissionRoleDetailed[]): boolean {
        return this.hasAccess(permissions, allRoles, PermissionLevel.Full)
    }

    hasWriteAccess(permissions: Permissions|undefined|null, allRoles: PermissionRoleDetailed[]): boolean {
        return this.hasAccess(permissions, allRoles, PermissionLevel.Write)
    }

    hasReadAccess(permissions: Permissions|undefined|null, allRoles: PermissionRoleDetailed[]): boolean {
        return this.hasAccess(permissions, allRoles, PermissionLevel.Read)
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
    level: PermissionLevel = PermissionLevel.None

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

    hasReadAccess(allRoles: PermissionRoleDetailed[]): boolean {
        if (this.hasAccess(PermissionLevel.Read)) {
            return true;
        }

        for (const r of this.roles) {
            const f = allRoles.find(rr => r.id === rr.id)
            if (!f) {
                // Deleted role
                continue
            }
            if (getPermissionLevelNumber(f.level) >= getPermissionLevelNumber(PermissionLevel.Read)) {
                return true
            }
        }

        return false;
    }

    hasWriteAccess(allRoles: PermissionRoleDetailed[]): boolean {
        if (this.hasAccess(PermissionLevel.Write)) {
            return true;
        }

        for (const r of this.roles) {
            const f = allRoles.find(rr => r.id === rr.id)
            if (!f) {
                // Deleted role
                continue
            }
            if (getPermissionLevelNumber(f.level) >= getPermissionLevelNumber(PermissionLevel.Write)) {
                return true
            }
        }

        return false;
    }

    hasFullAccess(allRoles: PermissionRoleDetailed[]): boolean {
        if (this.hasAccess(PermissionLevel.Full)) {
            return true;
        }

        for (const r of this.roles) {
            const f = allRoles.find(rr => r.id === rr.id)
            if (!f) {
                // Deleted role
                continue
            }
            if (getPermissionLevelNumber(f.level) >= getPermissionLevelNumber(PermissionLevel.Full)) {
                return true
            }
        }

        return false;
    }

    /**
     * @param roles All available roles of the organizatino (to query)
     */
    canCreateWebshops(allRoles: PermissionRoleDetailed[]): boolean {
        if (this.hasFullAccess(allRoles)) {
            return true
        }
        for (const r of this.roles) {
            const f = allRoles.find(rr => r.id === rr.id)
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
    canManagePayments(allRoles: PermissionRoleDetailed[]): boolean {
        if (this.hasFullAccess(allRoles)) {
            return true
        }
        for (const r of this.roles) {
            const f = allRoles.find(rr => r.id === rr.id)
            if (!f) {
                // Deleted role
                continue
            }
            if (f.financeDirector) {
                return true
            }
            if (f.managePayments) {
                return true
            }
        }

        return false
    }

    /**
     */
    hasFinanceAccess(allRoles: PermissionRoleDetailed[]): boolean {
        if (this.hasFullAccess(allRoles)) {
            return true
        }
        for (const r of this.roles) {
            const f = allRoles.find(rr => r.id === rr.id)
            if (!f) {
                // Deleted role
                continue
            }
            if (f.financeDirector) {
                return true
            }
        }

        return false
    }

    add(other: Permissions) {
        if (getPermissionLevelNumber(this.level) < getPermissionLevelNumber(other.level)) {
            this.level = other.level;
        }

        for (const role of other.roles) {
            if (!this.roles.find(r => r.id === role.id)) {
                this.roles.push(role.clone());
            }
        }
    }
}