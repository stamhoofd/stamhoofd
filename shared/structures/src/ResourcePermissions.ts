import { AutoEncoder, field, StringDecoder, EnumDecoder, ArrayDecoder, AutoEncoderPatchType, PatchMap } from '@simonbackx/simple-encoding';
import { AccessRight, AccessRightHelper } from './AccessRight.js';
import { PermissionLevel, getPermissionLevelNumber } from './PermissionLevel.js';
import { PermissionRoleDetailed } from './PermissionRole.js';
import { PermissionsResourceType } from './PermissionsResourceType.js';

/**
 * More granular access rights to specific things in the system
 */
export class ResourcePermissions extends AutoEncoder {
    /**
     * This is a cache so we can display the role description without fetching all resources
     */
    @field({ decoder: StringDecoder, field: 'n' })
    resourceName = '';

    /**
     * Setting it to full gives all possible permissions for the resource
     * Read/Write depends on resource
     */
    @field({ decoder: new EnumDecoder(PermissionLevel), field: 'l' })
    level: PermissionLevel = PermissionLevel.None;

    /**
     * More granular permissions related to this resource
     */
    @field({ decoder: new ArrayDecoder(new EnumDecoder(AccessRight)), field: 'r' })
    accessRights: AccessRight[] = [];

    getPatchName() {
        return this.resourceName;
    }

    hasAccess(level: PermissionLevel): boolean {
        return getPermissionLevelNumber(this.level) >= getPermissionLevelNumber(level);
    }

    hasAccessRight(right: AccessRight): boolean {
        const gl = AccessRightHelper.autoGrantRightForLevel(right);
        return (gl && this.hasAccess(gl)) || this.accessRights.includes(right);
    }

    createInsertPatch(type: PermissionsResourceType, resourceId: string, roleOrPermissions: PermissionRoleDetailed): AutoEncoderPatchType<PermissionRoleDetailed>;
    createInsertPatch(type: PermissionsResourceType, resourceId: string, roleOrPermissions: import('./Permissions.js').Permissions): AutoEncoderPatchType<import('./Permissions.js').Permissions>;
    createInsertPatch(type: PermissionsResourceType, resourceId: string, roleOrPermissions: PermissionRoleDetailed | import('./Permissions.js').Permissions): AutoEncoderPatchType<PermissionRoleDetailed> | AutoEncoderPatchType<import('./Permissions.js').Permissions> {
        const patch = roleOrPermissions.static.patch({}) as AutoEncoderPatchType<PermissionRoleDetailed> | AutoEncoderPatchType<import('./Permissions.js').Permissions>;

        // First check if we need to insert the type
        if (roleOrPermissions.resources.get(type)) {
            // We need to patch
            const p = new PatchMap<string, ResourcePermissions | AutoEncoderPatchType<ResourcePermissions> | null>();
            p.set(resourceId, this);
            patch.resources.set(type, p);
        }
        else {
            // No resources with this type yet
            const p = new Map<string, ResourcePermissions>();
            p.set(resourceId, this);
            patch.resources.set(type, p);
        }

        return patch;
    }

    merge(other: ResourcePermissions): ResourcePermissions {
        const p = new ResourcePermissions();
        p.level = this.level;
        p.accessRights = this.accessRights.slice();

        if (getPermissionLevelNumber(other.level) > getPermissionLevelNumber(p.level)) {
            p.level = other.level;
        }

        for (const right of other.accessRights) {
            if (!p.accessRights.includes(right)) {
                p.accessRights.push(right);
            }
        }
        return p;
    }
}
