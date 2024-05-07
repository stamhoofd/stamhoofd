import { AnyDecoder, ArrayDecoder, AutoEncoder, BooleanDecoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from "uuid";

import { Group } from './Group';
import { WebshopPreview } from './webshops/Webshop';

/**
 * PermissionLevels are used to grant permissions to specific resources or system wide
 */
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

/**
 * More granular access rights to specific things in the system
 */
export enum AccessRight {
    // Platform level permissions
    /**
     * Allows the user to log in as a full-access admin to a specific organization
     */
    PlatformLoginAs = "PlatformLoginAs",

    // Organization level permissions
    OrganizationCreateWebshops = "OrganizationCreateWebshops",
    OrganizationManagePayments = "OrganizationManagePayments",
    OrganizationFinanceDirector = "OrganizationFinanceDirector",
}

export class AccessRightHelper {
    static getDescription(right: AccessRight) {
        switch (right) {
            case AccessRight.PlatformLoginAs: return 'inloggen als hoofdbeheerder'
            case AccessRight.OrganizationCreateWebshops: return 'volledige boekhouding'
            case AccessRight.OrganizationManagePayments: return 'overschrijvingen'
            case AccessRight.OrganizationFinanceDirector: return 'webshops maken'
        }
    }
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
     * Generic access to all resources
     */
    @field({ decoder: new EnumDecoder(PermissionLevel), version: 201 })
    level: PermissionLevel = PermissionLevel.None

    @field({ 
        decoder: new ArrayDecoder(new EnumDecoder(AccessRight)), 
        version: 246,
        upgrade: function() {
            const base: AccessRight[] = []
            if (this.legacyManagePayments) {
                base.push(AccessRight.OrganizationManagePayments);
            }

            if (this.legacyFinanceDirector) {
                base.push(AccessRight.OrganizationFinanceDirector);
            }

            if (this.legacyCreateWebshops) {
                base.push(AccessRight.OrganizationCreateWebshops);
            }
            return base;
        }
    })
    accessRights: AccessRight[] = []

    @field({ decoder: BooleanDecoder, field: 'managePayments', optional: true })
    legacyManagePayments = false

    @field({ decoder: BooleanDecoder, version: 199, field: 'financeDirector', optional: true })
    legacyFinanceDirector = false
    
    @field({ decoder: BooleanDecoder, field: 'createWebsops', optional: true })
    legacyCreateWebshops = false

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

        for (const right of this.accessRights) {
            stack.push(AccessRightHelper.getDescription(right))
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

    hasAccessRight(right: AccessRight): boolean {
        return this.level === PermissionLevel.Full || this.accessRights.includes(right)
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

    getPermissionLevel(permissions: LoadedPermissions): PermissionLevel {
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

    hasAccess(permissions: LoadedPermissions|undefined|null, level: PermissionLevel): boolean {
        if (!permissions) {
            return false
        }
        return getPermissionLevelNumber(this.getPermissionLevel(permissions)) >= getPermissionLevelNumber(level)
    }

    roleHasAccess(role: PermissionRole, level: PermissionLevel = PermissionLevel.Read): boolean {
        return getPermissionLevelNumber(this.getRolePermissionLevel(role)) >= getPermissionLevelNumber(level)
    }

    hasFullAccess(permissions: LoadedPermissions|undefined|null): boolean {
        return this.hasAccess(permissions, PermissionLevel.Full)
    }

    hasWriteAccess(permissions: LoadedPermissions|undefined|null): boolean {
        return this.hasAccess(permissions, PermissionLevel.Write)
    }

    hasReadAccess(permissions: LoadedPermissions|undefined|null): boolean {
        return this.hasAccess(permissions, PermissionLevel.Read)
    }
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
    @field({ decoder: new ArrayDecoder(AnyDecoder), optional: true })
    groups: never[] = []

    @field({ decoder: new ArrayDecoder(PermissionRole), version: 60 })
    roles: PermissionRole[] = []

    hasRole(role: PermissionRole): boolean {
        return this.roles.find(r => r.id === role.id) !== undefined
    }

    hasAccess(allRoles: PermissionRoleDetailed[], level: PermissionLevel): boolean {
        if (getPermissionLevelNumber(this.level) >= getPermissionLevelNumber(level)) {
            // Someone with read / write access for the whole organization, also the same access for each group
            return true;
        }

        for (const r of this.roles) {
            const f = allRoles.find(rr => r.id === rr.id)
            if (!f) {
                // Deleted role
                continue
            }
            if (getPermissionLevelNumber(f.level) >= getPermissionLevelNumber(level)) {
                return true
            }
        }

        return false
    }

    hasReadAccess(allRoles: PermissionRoleDetailed[]): boolean {
        return this.hasAccess(allRoles, PermissionLevel.Read)
    }

    hasWriteAccess(allRoles: PermissionRoleDetailed[]): boolean {
        return this.hasAccess(allRoles, PermissionLevel.Write)
    }

    hasFullAccess(allRoles: PermissionRoleDetailed[]): boolean {
        return this.hasAccess(allRoles, PermissionLevel.Full);
    }

    hasAccessRight(right: AccessRight, allRoles: PermissionRoleDetailed[]): boolean {
        if (this.hasFullAccess(allRoles)) {
            return true
        }
        for (const r of this.roles) {
            const f = allRoles.find(rr => r.id === rr.id)
            if (!f) {
                // Deleted role
                continue
            }
            if (f.hasAccessRight(right)) {
                return true
            }
        }

        return false
    }

    /**
     * @deprecated
     * @param roles All available roles of the organizatino (to query)
     */
    canCreateWebshops(allRoles: PermissionRoleDetailed[]): boolean {
        return this.hasAccessRight(AccessRight.OrganizationCreateWebshops, allRoles)
    }

    /**
     * @deprecated
     * @param roles All available roles of the organizatino (to query)
     */
    canManagePayments(allRoles: PermissionRoleDetailed[]): boolean {
        return this.hasAccessRight(AccessRight.OrganizationManagePayments, allRoles) || this.hasAccessRight(AccessRight.OrganizationFinanceDirector, allRoles)
    }

    /**
     * @deprecated
     */
    hasFinanceAccess(allRoles: PermissionRoleDetailed[]): boolean {
        return this.hasAccessRight(AccessRight.OrganizationFinanceDirector, allRoles)
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

/**
 * Identical to Permissions but with detailed roles, loaded from the organization or platform
 */
export class LoadedPermissions {
    level: PermissionLevel = PermissionLevel.None
    roles: PermissionRoleDetailed[] = []

    constructor(data: Partial<LoadedPermissions>) {
        Object.assign(this, data)
    }

    static create(data: Partial<LoadedPermissions>) {
        return new LoadedPermissions(data)
    }

    static from(permissions: Permissions, allRoles: PermissionRoleDetailed[]) {
        return this.create({
            level: permissions.level,
            roles: permissions.roles.flatMap(role => {
                const d = allRoles.find(a => a.id === role.id);
                if (d) {
                    return [d]
                }
                return []
            })
        })
    }

    hasRole(role: PermissionRole): boolean {
        return this.roles.find(r => r.id === role.id) !== undefined
    }

    hasAccess(level: PermissionLevel): boolean {
        if (getPermissionLevelNumber(this.level) >= getPermissionLevelNumber(level)) {
            // Someone with read / write access for the whole organization, also the same access for each group
            return true;
        }

        for (const f of this.roles) {
            if (getPermissionLevelNumber(f.level) >= getPermissionLevelNumber(level)) {
                return true
            }
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
        return this.hasAccess(PermissionLevel.Full);
    }


    hasAccessRight(right: AccessRight): boolean {
        if (this.hasFullAccess()) {
            return true
        }
        for (const f of this.roles) {
            if (f.hasAccessRight(right)) {
                return true
            }
        }

        return false
    }
}