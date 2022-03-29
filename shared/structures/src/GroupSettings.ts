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

    /**
     * Dispay start and end date times
     */
    @field({ decoder: BooleanDecoder, version: 78 })
    displayStartEndTime = false

    @field({ decoder: DateDecoder, nullable: true, version: 73, upgrade: function(this: GroupSettings){ return this.startDate } })
    registrationStartDate: Date

    @field({ decoder: DateDecoder, nullable: true, version: 73, upgrade: function(this: GroupSettings){ return this.endDate } })
    registrationEndDate: Date

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

    /**
     * Only used for waitingListType = PreRegistrations
     */
    @field({ decoder: DateDecoder, nullable: true, version: 16 })
    preRegistrationsDate: Date | null = null

    @field({ 
        decoder: IntegerDecoder, nullable: true, version: 16, 
    })
    @field({ 
        decoder: IntegerDecoder, 
        nullable: true, 
        version: 74, 
        upgrade: function(this: GroupSettings, old: number | null): number | null {
            // Clear value if waiting list type is none
            if ((this.waitingListType as any as WaitingListType) !== WaitingListType.None) {
                return old
            }
            return null
        }
    })
    maxMembers: number | null = null

    @field({ 
        decoder: BooleanDecoder, version: 79, 
    })
    waitingListIfFull = true

    /**
     * If maxMembers is not null, this will get filled in by the backend
     */
    @field({ 
        decoder: IntegerDecoder, 
        nullable: true, 
        version: 77
    })
    registeredMembers: number | null = null

    /**
     * Amount of members that is reserved (e.g in payment process, or a member on the waiting list that is invited)
     */
    @field({ 
        decoder: IntegerDecoder, 
        nullable: true, 
        version: 139
    })
    reservedMembers: number | null = null

    /**
     * Amount of members on the waiting list
     */
    @field({ 
        decoder: IntegerDecoder, 
        nullable: true, 
        version: 139
    })
    waitingListSize: number | null = null

    get isFull() {
        return this.maxMembers !== null && this.registeredMembers !== null && (this.registeredMembers + (this.reservedMembers ?? 0)) >= this.maxMembers
    }

    get availableMembers() {
        if (this.maxMembers === null) {
            return null
        }
        if (this.registeredMembers === null) {
            return null
        }
        return this.maxMembers - this.registeredMembers - (this.reservedMembers ?? 0)
    }

    /**
     * Of er voorrang moet gegeven worden aan broers en/of zussen als er wachtlijsten of voorinschrijvingen zijn
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

    @field({ decoder: StringDecoder, version: 76 })
    location = ""

    /**
     * Require that the member is already registered for one of these groups before allowing to register for this group.
     * If it is empty, then it is not enforced
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), version: 83 })
    requireGroupIds: string[] = []

    /**
     * Require that the member is already registered for one of these groups before allowing to register for this group.
     * If it is empty, then it is not enforced
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), version: 100 })
    requirePreviousGroupIds: string[] = []
    
    @field({ decoder: new ArrayDecoder(StringDecoder), version: 102 })  //geen idee wat dat versienummer doet
    preventGroupIds: string[] = []

    @field({ decoder: new ArrayDecoder(StringDecoder), version: 102 })
    preventPreviousGroupIds: string[] = []

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
