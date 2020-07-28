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

    @field({ decoder: IntegerDecoder, nullable: true, field: "maxBirthYear" })
    @field({ decoder: IntegerDecoder, nullable: true, version: 12, upgrade: (year) => {
        if (year === null) {
            return null;
        }
        return 2020 - year
    } })
    minAge: number | null = null

    @field({ decoder: IntegerDecoder, nullable: true, field: "minBirthYear" })
    @field({
        decoder: IntegerDecoder, nullable: true, version: 12, upgrade: (year) => {
            if (year === null) {
                return null;
            }
            return 2020 - year
        }
    })
    maxAge: number | null = null
}

export const GroupSettingsPatch = GroupSettings.patchType()