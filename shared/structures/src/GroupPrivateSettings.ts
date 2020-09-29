import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';


export class GroupPrivateSettings extends AutoEncoder {
    @field({ decoder: StringDecoder, nullable: true, version: 10 })
    defaultEmailId: string | null = null
}

export const GroupPrivateSettingsPatch = GroupPrivateSettings.patchType()