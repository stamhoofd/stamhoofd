import { Formatter } from '@stamhoofd/utility';
import { AccessRight, AccessRightHelper } from './AccessRight.js';
import { MemberResponsibility } from './MemberResponsibility.js';
import { MemberResponsibilityRecordBase } from './members/MemberResponsibilityRecord.js';
import { getPermissionLevelNumber, PermissionLevel } from './PermissionLevel.js';
import { PermissionRoleDetailed, PermissionRoleForResponsibility } from './PermissionRole.js';
import { Permissions } from './Permissions.js';
import { PermissionsResourceType } from './PermissionsResourceType.js';
import { ResourcePermissions } from './ResourcePermissions.js';

/**
 * Identical to Permissions but with detailed roles, loaded from the organization or platform
 */
export class LoadedPermissions {
    level: PermissionLevel = PermissionLevel.None;
    resources: Map<PermissionsResourceType, Map<string, LoadedPermissions>> = new Map();
    accessRights: AccessRight[] = [];

    private constructor(data: Partial<LoadedPermissions>) {
        Object.assign(this, data);
    }

    static create(data: Partial<LoadedPermissions>) {
        return new LoadedPermissions(data);
    }

    static fromResource(permissions: ResourcePermissions) {
        return LoadedPermissions.create({
            level: permissions.level,
            resources: new Map(),
            accessRights: [...permissions.accessRights],
        });
    }

    clone() {
        const permissions = LoadedPermissions.create({
            level: this.level,
            resources: new Map(),
            accessRights: [...this.accessRights],
        });

        for (const [type, r] of this.resources) {
            if (!permissions.resources.has(type)) {
                permissions.resources.set(type, new Map());
            }
            for (const [id, resource] of r) {
                permissions.resources.get(type)!.set(id, resource.clone());
            }
        }

        return permissions;
    }

    static fromRole(role: PermissionRoleDetailed) {
        const permissions = LoadedPermissions.create({
            level: role.level,
            resources: new Map(),
            accessRights: [...role.accessRights],
        });

        for (const [type, r] of role.resources) {
            if (!permissions.resources.has(type)) {
                permissions.resources.set(type, new Map());
            }
            for (const [id, resource] of r) {
                permissions.resources.get(type)!.set(id, LoadedPermissions.fromResource(resource));
            }
        }

        return permissions;
    }

    static fromResponsibilityRecord(responsibilityRecord: MemberResponsibilityRecordBase, inheritedResponsibilityRoles: PermissionRoleForResponsibility[], allResponsibilites: MemberResponsibility[]) {
        const responsibility = allResponsibilites.find(r => r.id === responsibilityRecord.responsibilityId);
        if (!responsibility) {
            return LoadedPermissions.create({});
        }
        return this.fromResponsibility(responsibility, responsibilityRecord.groupId, inheritedResponsibilityRoles);
    }

    /**
     * old name: buildRoleForResponsibility
     */
    static fromResponsibility(responsibility: MemberResponsibility, groupId: string | null, inheritedResponsibilityRoles: PermissionRoleForResponsibility[]) {
        const permissions = responsibility.permissions
            ? this.fromRole(responsibility.permissions)
            : LoadedPermissions.create({});

        if (groupId && responsibility.groupPermissionLevel !== PermissionLevel.None) {
            const map: Map<string, LoadedPermissions> = new Map();
            map.set(groupId, LoadedPermissions.create({ level: responsibility.groupPermissionLevel }));
            permissions.resources.set(PermissionsResourceType.Groups, map);
        }

        const role = inheritedResponsibilityRoles.find(r => r.responsibilityId === responsibility.id && r.responsibilityGroupId === groupId);

        if (role) {
            permissions.add(LoadedPermissions.fromRole(role));
        }

        return permissions;
    }

    static from(permissions: Permissions, allRoles: PermissionRoleDetailed[], inheritedResponsibilityRoles: PermissionRoleForResponsibility[], allResponsibilites: MemberResponsibility[]) {
        const loaded = LoadedPermissions.create({
            level: permissions.level,
            accessRights: [],
            resources: new Map(),
        });

        for (const [type, r] of permissions.resources) {
            if (!loaded.resources.has(type)) {
                loaded.resources.set(type, new Map());
            }
            for (const [id, resource] of r) {
                loaded.resources.get(type)!.set(id, LoadedPermissions.fromResource(resource));
            }
        }

        for (const roleRecord of permissions.roles) {
            const role = allRoles.find(a => a.id === roleRecord.id);

            if (role) {
                loaded.add(LoadedPermissions.fromRole(role));
            }
        }

        for (const responsibilityRecord of permissions.responsibilities) {
            if (responsibilityRecord.endDate !== null && responsibilityRecord.endDate < new Date()) {
                continue;
            }

            if (responsibilityRecord.startDate > new Date()) {
                continue;
            }

            const responsibility = allResponsibilites.find(r => r.id === responsibilityRecord.responsibilityId);
            if (!responsibility) {
                continue;
            }

            const r = this.fromResponsibility(responsibility, responsibilityRecord.groupId, inheritedResponsibilityRoles);
            loaded.add(r);
        }

        return loaded;
    }

    getResourcePermissions(type: PermissionsResourceType, id: string): LoadedPermissions | null {
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

    getMergedResourcePermissions(type: PermissionsResourceType, id: string): LoadedPermissions {
        const clone = this.clone();

        // Remove this type from resources
        clone.resources.delete(type);

        const r = this.getResourcePermissions(type, id);
        if (r) {
            clone.add(r);
        }

        return clone;
    }

    hasAccess(level: PermissionLevel): boolean {
        if (getPermissionLevelNumber(this.level) >= getPermissionLevelNumber(level)) {
            // Someone with read / write access for the whole organization, also the same access for each group
            return true;
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

        return false;
    }

    hasResourceAccessRight(type: PermissionsResourceType, id: string, right: AccessRight): boolean {
        if (this.hasAccessRight(right)) {
            return true;
        }

        if (this.getResourcePermissions(type, id)?.hasAccessRight(right) ?? false) {
            return true;
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

    hasAccessRightForSomeResource(right: AccessRight): boolean {
        if (this.hasAccessRight(right)) {
            return true;
        }

        for (const resource of this.resources.values()) {
            if (resource) {
                for (const r of resource.values()) {
                    if (r.hasAccessRight(right)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    hasAccessRightForSomeResourceOfType(type: PermissionsResourceType, right: AccessRight): boolean {
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

        return false;
    }

    hasAccessForSomeResourceOfType(type: PermissionsResourceType, level: PermissionLevel): boolean {
        if (this.hasAccess(level)) {
            return true;
        }

        const resource = this.resources.get(type);
        if (resource) {
            for (const r of resource.values()) {
                if (r.hasAccess(level)) {
                    return true;
                }
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
        if ((gl && this.hasAccess(gl)) || this.accessRights.includes(right)) {
            return true;
        }

        const autoInherit = AccessRightHelper.autoInheritFrom(right);
        for (const r of autoInherit) {
            if (this.hasAccessRight(r)) {
                return true;
            }
        }

        return false;
    }

    add(other: LoadedPermissions) {
        if (getPermissionLevelNumber(other.level) > getPermissionLevelNumber(this.level)) {
            this.level = other.level;
        }

        for (const right of other.accessRights) {
            if (!this.accessRights.includes(right)) {
                this.accessRights.push(right);
            }
        }

        for (const [type, r] of other.resources) {
            for (const [id, resource] of r) {
                if (!this.resources.has(type)) {
                    this.resources.set(type, new Map());
                }

                const current = this.resources.get(type)!.get(id);
                if (!current) {
                    this.resources.get(type)!.set(id, resource);
                }
                else {
                    current.add(resource);
                }
            }
        }
    }

    merge(other: LoadedPermissions): LoadedPermissions {
        const cloned = this.clone();
        cloned.add(other);
        return cloned;
    }

    removeAccessRights(rights: AccessRight[]) {
        this.accessRights = this.accessRights.filter(r => !rights.includes(r));

        for (const resource of this.resources.values()) {
            for (const r of resource.values()) {
                r.removeAccessRights(rights);
            }
        }
    }

    get isEmpty() {
        if (this.accessRights.length || this.level !== PermissionLevel.None) {
            return false;
        }

        for (const resource of this.resources.values()) {
            for (const r of resource.values()) {
                if (!r.isEmpty) {
                    return false;
                }
            }
        }
        return true;
    }

    getDescription() {
        const stack: string[] = [];
        if (this.level === PermissionLevel.Read) {
            stack.push($t(`d05c78a9-7bb6-4d16-9cf4-caa0f6401452`));
        }
        if (this.level === PermissionLevel.Write) {
            stack.push($t(`82d8ac16-2b4e-430f-8322-2c4610f93cad`));
        }
        if (this.level === PermissionLevel.Full) {
            stack.push($t(`d5c41a61-1870-4dff-9422-726f8e2a1227`));
            return Formatter.capitalizeFirstLetter(Formatter.joinLast(stack, ', ', ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' '));
        }

        for (const right of this.accessRights) {
            stack.push(AccessRightHelper.getDescription(right));
        }

        stack.push(...ResourcePermissions.getMapDescription(this.resources));

        if (stack.length === 0) {
            return $t(`6802d7c7-44d0-43d3-ab91-956ab5edc1f6`);
        }

        return Formatter.capitalizeFirstLetter(Formatter.joinLast(stack, ', ', ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' '));
    }
}
