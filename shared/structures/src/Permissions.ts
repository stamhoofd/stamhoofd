import { ArrayDecoder, AutoEncoder, EnumDecoder, field, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';

import { MemberResponsibilityRecordBase } from './members/MemberResponsibilityRecord';
import { getPermissionLevelNumber, PermissionLevel } from './PermissionLevel';
import { PermissionRole } from './PermissionRole';
import { PermissionsResourceType } from './PermissionsResourceType';
import { ResourcePermissions } from './ResourcePermissions';

export class Permissions extends AutoEncoder {
    /**
     * Automatically have all permissions (e.g. when someone created a new group)
     * Also allows creating new groups
     */
    @field({ decoder: new EnumDecoder(PermissionLevel) })
    level: PermissionLevel = PermissionLevel.None

    @field({ decoder: new ArrayDecoder(PermissionRole), version: 60 })
    roles: PermissionRole[] = []

    @field({ decoder: new ArrayDecoder(MemberResponsibilityRecordBase), version: 274 })
    responsibilities: MemberResponsibilityRecordBase[] = []

    /**
     * Mostly for temporary access
     */
    @field({ 
        decoder: new MapDecoder(
            new EnumDecoder(PermissionsResourceType), 
            new MapDecoder(
                // ID
                StringDecoder, 
                ResourcePermissions
            )
        ), 
        version: 249
    })
    resources: Map<PermissionsResourceType, Map<string, ResourcePermissions>> = new Map()

    hasRole(role: PermissionRole): boolean {
        return this.roles.find(r => r.id === role.id) !== undefined
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

        for (const responsibility of other.responsibilities) {
            if (!this.responsibilities.find(r => r.id === responsibility.id)) {
                this.responsibilities.push(responsibility.clone());
            }
        }
    }

    get isEmpty() {
        return this.level === PermissionLevel.None && this.roles.length === 0 && this.responsibilities.length === 0 && this.resources.size === 0
    }
}

