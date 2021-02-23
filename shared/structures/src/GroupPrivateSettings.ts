import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

import { PermissionsByRole } from './Permissions';


export class GroupPrivateSettings extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true, version: 10 })
    defaultEmailId: string | null = null

    @field({ decoder: PermissionsByRole, version: 60 })
    roles = PermissionsByRole.create({})
}

export const GroupPrivateSettingsPatch = GroupPrivateSettings.patchType()