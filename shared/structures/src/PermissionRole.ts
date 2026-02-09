import { ArrayDecoder, AutoEncoder, BooleanDecoder, EnumDecoder, MapDecoder, StringDecoder, field } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { AccessRight, AccessRightHelper } from './AccessRight.js';
import { PermissionLevel, getPermissionLevelNumber } from './PermissionLevel.js';
import { PermissionsResourceType } from './PermissionsResourceType.js';
import { ResourcePermissions } from './ResourcePermissions.js';

export class PermissionRole extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = '';
}

export class PermissionRoleDetailed extends PermissionRole {
    /**
     * Generic access to all resources
     */
    @field({ decoder: new EnumDecoder(PermissionLevel), version: 201 })
    level: PermissionLevel = PermissionLevel.None;

    @field({
        decoder: new ArrayDecoder(new EnumDecoder(AccessRight)),
        version: 246,
        upgrade: function () {
            const base: AccessRight[] = [];
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
        },
    })
    accessRights: AccessRight[] = [];

    @field({
        decoder: new MapDecoder(
            new EnumDecoder(PermissionsResourceType),
            new MapDecoder(
                // ID
                StringDecoder,
                ResourcePermissions,
            ),
        ),
        version: 248,
    })
    resources: Map<PermissionsResourceType, Map<string, ResourcePermissions>> = new Map();

    /**
     * @deprecated
     * Required for migration
     */
    @field({ decoder: BooleanDecoder, field: 'managePayments', optional: true })
    legacyManagePayments = false;

    /**
     * @deprecated
     * Required for migration
     */
    @field({ decoder: BooleanDecoder, version: 199, field: 'financeDirector', optional: true })
    legacyFinanceDirector = false;

    /**
     * @deprecated
     * Required for migration
     */
    @field({ decoder: BooleanDecoder, field: 'createWebshops', optional: true })
    legacyCreateWebshops = false;

    compress() {
        if (this.level === PermissionLevel.Full) {
            this.accessRights = [];
            this.resources = new Map();
        }
    }

    getDiffValue() {
        return this.getDescription();
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

    hasAccess(level: PermissionLevel): boolean {
        return getPermissionLevelNumber(this.level) >= getPermissionLevelNumber(level);
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

        if (getPermissionLevelNumber(this.level) > getPermissionLevelNumber(base?.level ?? PermissionLevel.None)) {
            if (!base) {
                base = ResourcePermissions.create({ level: this.level });
            }
            base.level = this.level;
        }

        return base;
    }

    hasResourceAccess(type: PermissionsResourceType, id: string, level: PermissionLevel): boolean {
        if (this.hasAccess(level)) {
            return true;
        }

        return this.getResourcePermissions(type, id)?.hasAccess(level) ?? false;
    }

    hasResourceAccessRight(type: PermissionsResourceType, id: string, right: AccessRight): boolean {
        if (this.hasAccessRight(right)) {
            return true;
        }

        return this.getResourcePermissions(type, id)?.hasAccessRight(right) ?? false;
    }

    hasAccessRightForSomeResourceOfType(type: PermissionsResourceType, right: AccessRight): boolean {
        if (this.hasAccessRight(right)) {
            return true;
        }

        const resource = this.resources.get(type);
        if (!resource) {
            return false;
        }

        for (const r of resource.values()) {
            if (r.hasAccessRight(right)) {
                return true;
            }
        }

        return false;
    }

    add(other: PermissionRoleDetailed) {
        if (getPermissionLevelNumber(this.level) < getPermissionLevelNumber(other.level)) {
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
                    this.resources.get(type)!.set(id, current.merge(resource));
                }
            }
        }
    }

    get isEmpty() {
        let resourcesEmpty = true;
        for (const resource of this.resources.values()) {
            for (const r of resource.values()) {
                if (!r.isEmpty) {
                    resourcesEmpty = false;
                    break;
                }
            }
        }
        return this.level === PermissionLevel.None && this.accessRights.length === 0 && resourcesEmpty;
    }

    removeAccessRights(rights: AccessRight[]) {
        this.accessRights = this.accessRights.filter(r => !rights.includes(r));

        for (const resource of this.resources.values()) {
            for (const r of resource.values()) {
                r.removeAccessRights(rights);
            }
        }
    }
}

export class PermissionRoleForResponsibility extends PermissionRoleDetailed {
    @field({ decoder: StringDecoder })
    responsibilityId: string;

    @field({ decoder: StringDecoder, nullable: true })
    responsibilityGroupId: string | null = null;
}
