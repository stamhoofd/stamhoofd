import { ArrayDecoder,AutoEncoder, DateDecoder, EnumDecoder,field, IntegerDecoder,StringDecoder } from '@simonbackx/simple-encoding';

import { GroupGenderType } from './GroupGenderType';
import { GroupPrices } from './GroupPrices';

export class GroupSettings extends AutoEncoder {
    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: StringDecoder })
    description = ""

    @field({ decoder: DateDecoder })
    startDate: Date

    @field({ decoder: DateDecoder })
    endDate: Date

    @field({ decoder: new ArrayDecoder(GroupPrices) })
    prices: GroupPrices[] = []

    @field({ decoder: new EnumDecoder(GroupGenderType) })
    genderType: GroupGenderType = GroupGenderType.Mixed

    @field({ decoder: IntegerDecoder, nullable: true })
    minBirthYear: number | null = null

    @field({ decoder: IntegerDecoder, nullable: true })
    maxBirthYear: number | null = null
}

export const GroupSettingsPatch = GroupSettings.patchType()