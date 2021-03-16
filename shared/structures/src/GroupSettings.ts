import { ArrayDecoder,AutoEncoder, BooleanDecoder,DateDecoder, EnumDecoder,field, IntegerDecoder,StringDecoder } from '@simonbackx/simple-encoding';

import { Image } from './files/Image';
import { GroupGenderType } from './GroupGenderType';
import { GroupPrices } from './GroupPrices';

export enum WaitingListType {
    None = "None",
    PreRegistrations = "PreRegistrations",
    ExistingMembersFirst = "ExistingMembersFirst",
    All = "All"
}

export enum WaitingListSkipReason {
    None = "None", // we can skip because there is no waiting list
    ExistingMember = "ExistingMember",
    Family = "Family",
    Invitation = "Invitation"
}

export class GroupSettings extends AutoEncoder {
    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: StringDecoder })
    description = ""

    @field({ decoder: DateDecoder })
    @field({ decoder: DateDecoder, version: 33, upgrade: (d: Date) => {
        const d2 = new Date(d)
        d2.setUTCHours(-2, 0, 0, 0) // brussels time
        return d2
    } })
    startDate: Date

    @field({ decoder: DateDecoder })
    @field({ decoder: DateDecoder, version: 33, upgrade: (d: Date) => {
        const d2 = new Date(d)
        d2.setUTCHours(23-2, 59, 0, 0) // brussels time
        return d2
    } })
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

    @field({ decoder: new EnumDecoder(WaitingListType), version: 16 })
    waitingListType: WaitingListType = WaitingListType.None

    @field({ decoder: DateDecoder, nullable: true, version: 16 })
    preRegistrationsDate: Date | null = null

    @field({ decoder: IntegerDecoder, nullable: true, version: 16 })
    maxMembers: number | null = null

    /**
     * Of er voorrang moet gegeven worden aan broers en/of zussen als er wachtlijsten zijn
     */
    @field({ decoder: BooleanDecoder, version: 16 })
    priorityForFamily = true

    /**
     * @deprecated
     */
    @field({ decoder: new ArrayDecoder(Image), version: 58 })
    images: Image[] = []

    @field({ decoder: Image, nullable: true, version: 65 })
    coverPhoto: Image | null = null

    @field({ decoder: Image, nullable: true, version: 66 })
    squarePhoto: Image | null = null

    getGroupPrices(date: Date) {
        let foundPrice: GroupPrices | undefined = undefined

        // Determine price
        for (const price of this.prices) {
            if (!price.startDate || price.startDate <= date) {
                foundPrice = price
            }
        }
        return foundPrice
    }
}

export const GroupSettingsPatch = GroupSettings.patchType()