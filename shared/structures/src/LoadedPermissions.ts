import { AccessRight, AccessRightHelper } from './AccessRight.js';
import { MemberResponsibility } from './MemberResponsibility.js';
import { PermissionLevel, getPermissionLevelNumber } from './PermissionLevel.js';
import { PermissionRole, PermissionRoleDetailed, PermissionRoleForResponsibility } from './PermissionRole.js';
import { Permissions } from './Permissions.js';
import { PermissionsResourceType } from './PermissionsResourceType.js';
import { ResourcePermissions } from './ResourcePermissions.js';

/**
 * Identical to Permissions but with detailed roles, loaded from the organization or platform
 */
export class LoadedPermissions {
    level: PermissionLevel = PermissionLevel.None;
    roles: PermissionRoleDetailed[] = [];
    resources: Map<PermissionsResourceType, Map<string, ResourcePermissions>> = new Map();

    constructor(data: Partial<LoadedPermissions>) {
        Object.assign(this, data);
    }

    static create(data: Partial<LoadedPermissions>) {
        return new LoadedPermissions(data);
    }

    static buildRoleForResponsibility(groupId: string | null, responsibilityData: MemberResponsibility, inheritedResponsibilityRoles: PermissionRoleForResponsibility[]) {
        const role = inheritedResponsibilityRoles.find(r => r.responsibilityId === responsibilityData.id && r.responsibilityGroupId === groupId);

        const r = responsibilityData.permissions?.clone() ?? PermissionRoleForResponsibility.create({
            id: responsibilityData.id,
            name: responsibilityData.name,
            level: PermissionLevel.None,
            responsibilityId: responsibilityData.id,
            responsibilityGroupId: groupId,
            resources: new Map(),
        });

        r.name = responsibilityData.name;
        r.id = responsibilityData.id + (groupId ? '-' + groupId : '');
        r.responsibilityId = responsibilityData.id;
        r.responsibilityGroupId = groupId;

        if (groupId && responsibilityData.groupPermissionLevel !== PermissionLevel.None) {
            const map: Map<string, ResourcePermissions> = new Map();
            map.set(groupId, ResourcePermissions.create({ level: responsibilityData.groupPermissionLevel }));
            r.resources.set(PermissionsResourceType.Groups, map);
        }
        if (role) {
            r.id = role.id;
            r.add(role);
        }
        return r;
    }

    static from(permissions: Permissions, allRoles: PermissionRoleDetailed[], inheritedResponsibilityRoles: PermissionRoleForResponsibility[], allResponsibilites: MemberResponsibility[]) {
        const roles = permissions.roles.flatMap((role) => {
            const d = allRoles.find(a => a.id === role.id);
            if (d) {
                return [d];
            }
            return [];
        });

        for (const responsibility of permissions.responsibilities) {
            if (responsibility.endDate !== null && responsibility.endDate < new Date()) {
                continue;
            }

            if (responsibility.startDate > new Date()) {
                continue;
            }

            const responsibilityData = allResponsibilites.find(r => r.id === responsibility.responsibilityId);
            if (!responsibilityData) {
                continue;
            }

            const r = this.buildRoleForResponsibility(responsibility.groupId, responsibilityData, inheritedResponsibilityRoles);
            roles.push(r);
        }

        const result = this.create({
            level: permissions.level,
            roles,
            resources: permissions.resources,
        });

        return result;
    }

    getResourcePermissions(type: PermissionsResourceType, id: string): ResourcePermissions | null {
        const resource = this.resources.get(type);
        if (!resource) {
            return null;
        }
        const rInstance = resource.get(id);
        const allInstance = resource.get('');
        if (!rInstance) {
            if (allInstance) {
                return allInstance;
            }
            return null;
        }

        if (allInstance) {
            return rInstance.merge(allInstance);
        }

        return rInstance;
    }

    getMergedResourcePermissions(type: PermissionsResourceType, id: string): ResourcePermissions | null {
        let base = this.getResourcePermissions(type, id);

        for (const role of this.roles) {
            const r = role.getMergedResourcePermissions(type, id);
            if (r) {
                if (base) {
                    base.merge(r);
                }
                else {
                    base = r;
                }
            }
        }

        if (getPermissionLevelNumber(this.level) > getPermissionLevelNumber(base?.level ?? PermissionLevel.None)) {
            if (!base) {
                base = ResourcePermissions.create({ level: this.level });
            }
            base.level = this.level;
        }

        return base;
    }

    hasRole(role: PermissionRole): boolean {
        return this.roles.find(r => r.id === role.id) !== undefined;
    }

    hasAccess(level: PermissionLevel): boolean {
        if (getPermissionLevelNumber(this.level) >= getPermissionLevelNumber(level)) {
            // Someone with read / write access for the whole organization, also the same access for each group
            return true;
        }

        for (const f of this.roles) {
            if (f.hasAccess(level)) {
                return true;
            }
        }

        return false;
    }

    hasResourceAccess(type: PermissionsResourceType, id: string, level: PermissionLevel): boolean {
        if (this.hasAccess(level)) {
            return true;
        }

        if (this.getResourcePermissions(type, id)?.hasAccess(level) ?? false) {
            return true;
        }

        for (const r of this.roles) {
            if (r.hasResourceAccess(type, id, level)) {
                return true;
            }
        }

        return false;
    }

    hasResourceAccessRight(type: PermissionsResourceType, id: string, right: AccessRight): boolean {
        if (this.hasAccessRight(right)) {
            return true;
        }

        if (this.getResourcePermissions(type, id)?.hasAccessRight(right) ?? false) {
            return true;
        }

        for (const r of this.roles) {
            if (r.hasResourceAccessRight(type, id, right)) {
                return true;
            }
        }

        const autoInherit = AccessRightHelper.autoInheritFrom(right);
        for (const r of autoInherit) {
            if (this.hasResourceAccessRight(type, id, r)) {
                return true;
            }
        }
        return false;
    }

    hasAccessRightForAllResourcesOfType(type: PermissionsResourceType, right: AccessRight): boolean {
        return this.hasResourceAccessRight(type, '', right);
    }

    hasAccessRightForSomeResource(type: PermissionsResourceType, right: AccessRight): boolean {
        if (this.hasAccessRight(right)) {
            return true;
        }

        const resource = this.resources.get(type);
        if (resource) {
            for (const r of resource.values()) {
                if (r.hasAccessRight(right)) {
                    return true;
                }
            }
        }

        for (const r of this.roles) {
            if (r.hasAccessRightForSomeResource(type, right)) {
                return true;
            }
        }

        return false;
    }

    hasReadAccess(): boolean {
        return this.hasAccess(PermissionLevel.Read);
    }

    hasWriteAccess(): boolean {
        return this.hasAccess(PermissionLevel.Write);
    }

    hasFullAccess(): boolean {
        return this.hasAccess(PermissionLevel.Full);
    }

    hasAccessRight(right: AccessRight): boolean {
        const gl = AccessRightHelper.autoGrantRightForLevel(right);
        if (gl && this.hasAccess(gl)) {
            return true;
        }
        for (const f of this.roles) {
            if (f.hasAccessRight(right)) {
                return true;
            }
        }

        const autoInherit = AccessRightHelper.autoInheritFrom(right);
        for (const r of autoInherit) {
            if (this.hasAccessRight(r)) {
                return true;
            }
        }

        return false;
    }

    merge(other: LoadedPermissions): LoadedPermissions {
        const p = LoadedPermissions.create({});
        p.level = this.level;
        p.roles = this.roles.slice();
        p.resources = new Map(this.resources);

        if (getPermissionLevelNumber(other.level) > getPermissionLevelNumber(p.level)) {
            p.level = other.level;
        }

        for (const [type, r] of other.resources) {
            for (const [id, resource] of r) {
                if (!p.resources.has(type)) {
                    p.resources.set(type, new Map());
                }

                const current = p.resources.get(type)!.get(id);
                if (!current) {
                    p.resources.get(type)!.set(id, resource);
                }
                else {
                    p.resources.get(type)!.set(id, current.merge(resource));
                }
            }
        }

        for (const role of other.roles) {
            const current = p.roles.find(r => r.id === role.id);
            if (!current) {
                p.roles.push(role);
            }
        }
        return p;
    }

    removeAccessRights(rights: AccessRight[]) {
        for (const role of this.roles) {
            role.removeAccessRights(rights);
        }
        for (const resource of this.resources.values()) {
            for (const r of resource.values()) {
                r.removeAccessRights(rights);
            }
        }
    }

    get isEmpty() {
        return this.level === PermissionLevel.None && (this.roles.length === 0 || this.roles.every(r => r.isEmpty)) && this.resources.size === 0;
    }
}
