
import { AutoEncoder, AutoEncoderPatchType, field, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';

import { AccessRight, LoadedPermissions, PermissionLevel, PermissionRoleDetailed, Permissions } from './Permissions';
import { Platform } from './Platform';

export class UserPermissions extends AutoEncoder {
    @field({ decoder: Permissions, nullable: true })
    globalPermissions: Permissions | null = null

    @field({ decoder: new MapDecoder(StringDecoder, Permissions) })
    organizationPermissions: Map<string, Permissions> = new Map()

    get platform(): LoadedPermissions|null {
        return this.forPlatform(Platform.shared)
    }

    forPlatform(platform: Platform): LoadedPermissions|null {
        if (!this.globalPermissions) {
            return null;
        }

        const platformRoles = Platform.shared.getRoles()
        return LoadedPermissions.from(this.globalPermissions, platformRoles)
    }

    forOrganization(organization: {id: string, privateMeta?: {roles: PermissionRoleDetailed[]}|null}): LoadedPermissions|null {
        const platformRoles = Platform.shared.getRoles()
        return this.for(organization.id, platformRoles, organization?.privateMeta?.roles ?? [])
    }

    for(organizationId: string, platformRoles: PermissionRoleDetailed[], organizationRoles: PermissionRoleDetailed[]): LoadedPermissions|null {
        if (this.globalPermissions && this.globalPermissions.hasAccessRight(AccessRight.PlatformLoginAs, platformRoles)) {
            return LoadedPermissions.create({
                level: PermissionLevel.Full,
            })
        }

        const permissions = this.organizationPermissions.get(organizationId) ?? null
        if (!permissions) {
            return null;
        }
        return LoadedPermissions.from(permissions, organizationRoles)
    }

    static convertPlatformPatch(patch: AutoEncoderPatchType<Permissions>|null): AutoEncoderPatchType<UserPermissions> {
        return UserPermissions.patch({
            globalPermissions: patch
        })
    }

    static convertPatch(patch: AutoEncoderPatchType<Permissions>|null, organizationId: string): AutoEncoderPatchType<UserPermissions> {
        const clonedPatch = UserPermissions.patch({})
        clonedPatch.organizationPermissions.set(organizationId, patch)
        return clonedPatch
    }

    static limitedPatch(old: UserPermissions|null, patch: UserPermissions|AutoEncoderPatchType<UserPermissions>|null, organizationId: string): UserPermissions|null {
        if (patch === null) {
            return old;
        }
        
        if (patch.isPatch()) {
            // Only allow to set the permissions for the organization in scope
            if (patch.organizationPermissions.get(organizationId) !== undefined) {
                const clonedPatch = UserPermissions.patch({})
                clonedPatch.organizationPermissions.set(organizationId, patch.organizationPermissions.get(organizationId))
                return old ? old.patch(clonedPatch) : UserPermissions.create({}).patch(clonedPatch)
            }
        } else {
            // Only allow to set the permissions for the organization in scope
            if (patch.organizationPermissions.get(organizationId)) {
                const clonedPatch = UserPermissions.patch({})
                clonedPatch.organizationPermissions.set(organizationId, patch.organizationPermissions.get(organizationId))
                return old ? old.patch(clonedPatch) : UserPermissions.create({}).patch(clonedPatch)
            }
        }
        return old
    }

    static limitedAdd(old: UserPermissions|null, add: UserPermissions, organizationId: string): UserPermissions|null {
        if (add.organizationPermissions.get(organizationId)) {
            const realAdd = add.organizationPermissions.get(organizationId) as Permissions
            const realOld = old ? old.organizationPermissions.get(organizationId) : null
            if (!realOld) {
                const n = old ?? UserPermissions.create({});
                n.organizationPermissions.set(organizationId, realAdd)
                return n;
            }
            realOld.add(realAdd)
            return old
        }
        return null
    }
}