import { AutoEncoder, field, StringDecoder, EnumDecoder, ArrayDecoder, AutoEncoderPatchType, PatchMap } from '@simonbackx/simple-encoding';
import { AccessRight, AccessRightHelper } from './AccessRight.js';
import { PermissionLevel, getPermissionLevelNumber } from './PermissionLevel.js';
import { PermissionRoleDetailed } from './PermissionRole.js';
import { getPermissionResourceTypeName, PermissionsResourceType } from './PermissionsResourceType.js';
import { Formatter } from '@stamhoofd/utility';

type ResourceLike = { accessRights: AccessRight[]; level: PermissionLevel; isEmpty: boolean; resourceName?: string };

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

    getDiffName() {
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

    removeAccessRights(rights: AccessRight[]) {
        this.accessRights = this.accessRights.filter(r => !rights.includes(r));
    }

    get isEmpty() {
        return this.level === PermissionLevel.None && this.accessRights.length === 0;
    }

    static getMapDescription(map: Map<PermissionsResourceType, Map<string, ResourceLike>>): string[] {
        const stack: string[] = [];

        const resourceDescription = (resource: ResourceLike) => {
            const accessRights = resource.accessRights.map(a => AccessRightHelper.getDescription(a));
            if (resource.level === PermissionLevel.None) {
                return Formatter.joinLast(accessRights, ', ', ' en ');
            }

            let prefix = 'lezen';

            if (resource.level === PermissionLevel.Write) {
                prefix = 'bewerken';
            }
            else if (resource.level === PermissionLevel.Full) {
                prefix = 'volledige toegang';
            }

            return prefix + (accessRights.length > 0 ? ' met ' + Formatter.joinLast(accessRights, ', ', ' en ') : '');
        };

        for (const [type, resources] of map) {
            const all = resources.get('');
            let allDescription: string | null = null;

            if (all && !all.isEmpty) {
                const accessRights = all.accessRights.map(a => AccessRightHelper.getDescription(a));
                if (all.level === PermissionLevel.None) {
                    stack.push('alle ' + getPermissionResourceTypeName(type, true) + ': ' + Formatter.joinLast(accessRights, ', ', ' en '));
                }

                let prefix = 'alle ';
                let suffix = ' lezen';

                if (all.level === PermissionLevel.Write) {
                    suffix = ' bewerken';
                }
                else if (all.level === PermissionLevel.Full) {
                    prefix = 'volledige toegang tot alle ';
                    suffix = '';
                }

                stack.push(prefix + getPermissionResourceTypeName(type, true) + suffix + (accessRights.length > 0 ? ' met ' + Formatter.joinLast(accessRights, ', ', ' en ') : ''));
                allDescription = resourceDescription(all);
            }

            const countsPer = new Map<string, { count: number; firstName: string | null }>();

            for (const resource of resources.values()) {
                if (!resource.isEmpty) {
                    const description = resourceDescription(resource);
                    if (description === allDescription) {
                        continue;
                    }
                    if (!countsPer.has(description)) {
                        countsPer.set(description, { count: 0, firstName: resource.resourceName ?? null });
                    }
                    countsPer.get(description)!.count += 1;
                }
            }

            for (const [description, { count, firstName }] of countsPer) {
                stack.push((count === 1 && firstName ? firstName : (count + ' ' + getPermissionResourceTypeName(type, count > 1))) + ' (' + description + ')');
            }
        }

        return stack;
    }
}
