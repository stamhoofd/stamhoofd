import { ArrayDecoder,AutoEncoder, BooleanDecoder,DateDecoder, EnumDecoder,field, IntegerDecoder,MapDecoder,RecordDecoder,StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from "uuid";

import { Image } from './files/Image';
import { GroupGenderType } from './GroupGenderType';
import { OldGroupPrices } from './OldGroupPrices';

export class ReduceablePrice extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    price = 0

    @field({ decoder: IntegerDecoder, nullable: true })
    reducedPrice: number | null = null
}

export class GroupPrice extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = 'Standaardtarief'

    @field({ decoder: ReduceablePrice })
    price = ReduceablePrice.create({})

    @field({ decoder: BooleanDecoder, version: 290 })
    hidden = false

    /**
     * Total stock, excluding already sold items into account
     */
    @field({ decoder: IntegerDecoder, nullable: true, version: 290 })
    stock: number | null = null

    @field({ decoder: IntegerDecoder, version: 290 })
    usedStock = 0

    get isSoldOut(): boolean {
        if (this.stock === null) {
            return false
        }
        return this.usedStock >= this.stock
    }

    get remainingStock(): number | null {
        if (this.stock === null) {
            return null
        }
        return Math.max(0, this.stock - this.usedStock)
    }
}

export class GroupOption extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: BooleanDecoder, version: 290 })
    hidden = false

    /**
     * Price added (can be negative) is always in cents, to avoid floating point errors
     */
    @field({ decoder: ReduceablePrice })
    price = ReduceablePrice.create({})

    /**
     * Minimum you need to choose
     */
    @field({ decoder: IntegerDecoder })
    mininum = 0

    /**
     * Maximum (if > 1, you can choose an amount for this option)
     */
    @field({ decoder: IntegerDecoder })
    maximum = 1

    /**
     * Total stock, excluding already sold items into account
     */
    @field({ decoder: IntegerDecoder, nullable: true, version: 290 })
    stock: number | null = null

    @field({ decoder: IntegerDecoder, version: 290 })
    usedStock = 0

    get isSoldOut(): boolean {
        if (this.stock === null) {
            return false
        }
        return this.usedStock >= this.stock
    }

    get remainingStock(): number | null {
        if (this.stock === null) {
            return null
        }
        return Math.max(0, this.stock - this.usedStock)
    }
}

export class GroupOptionMenu extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: StringDecoder })
    description = ""

    @field({ decoder: BooleanDecoder })
    multipleChoice = false;

    @field({ decoder: new ArrayDecoder(GroupOption) })
    options: GroupOption[] = [
        GroupOption.create({})
    ]
}


export enum WaitingListType {
    None = "None",
    PreRegistrations = "PreRegistrations",
    ExistingMembersFirst = "ExistingMembersFirst",
    All = "All"
}

export class CycleInformation extends AutoEncoder {
    @field({ decoder: DateDecoder, nullable: true })
    startDate: Date | null = null

    @field({ decoder: DateDecoder, nullable: true })
    endDate: Date | null = null

    @field({ 
        decoder: IntegerDecoder, 
        nullable: true
    })
    registeredMembers: number | null = 0

    /**
     * Amount of members that is reserved (e.g in payment process, or a member on the waiting list that is invited)
     */
    @field({ 
        decoder: IntegerDecoder, 
        nullable: true, 
        version: 139
    })
    reservedMembers: number | null = 0

    /**
     * Amount of members on the waiting list
     */
    @field({ 
        decoder: IntegerDecoder, 
        nullable: true, 
        version: 139
    })
    waitingListSize: number | null = 0

}

export class GroupDefaultEventTime extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    dayOfWeek = 1 // 1 = monday, 7 = sunday

    @field({ decoder: IntegerDecoder })
    startTime = 0 // minutes since midnight

    @field({ decoder: IntegerDecoder })
    endTime = 0 // minutes since midnight
}

export class GroupSettings extends AutoEncoder {
    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: StringDecoder })
    description = ""

    @field({ decoder: new ArrayDecoder(GroupPrice), version: 285})
    prices: GroupPrice[] = [GroupPrice.create({})]

    @field({ decoder: new ArrayDecoder(GroupOptionMenu), version: 285 })
    optionMenus: GroupOptionMenu[] = []

    @field({ decoder: DateDecoder, nullable: false, version: 73, upgrade: function(this: GroupSettings){ return this.startDate } })
    @field({ decoder: DateDecoder, nullable: true, version: 192, downgrade: function(this: GroupSettings){ return this.registrationStartDate ?? this.startDate } })
    registrationStartDate: Date | null = null

    @field({ decoder: DateDecoder, nullable: false, version: 73, upgrade: function(this: GroupSettings){ return this.endDate } })
    @field({ decoder: DateDecoder, nullable: true, version: 192, downgrade: function(this: GroupSettings){ return this.registrationEndDate ?? this.endDate } })
    registrationEndDate: Date | null = null

    @field({ decoder: GroupDefaultEventTime, nullable: true, version: 283 })
    defaultEventTime: GroupDefaultEventTime|null = null

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
    registeredMembers: number | null = 0

    /**
     * Amount of members that is reserved (e.g in payment process, or a member on the waiting list that is invited)
     */
    @field({ 
        decoder: IntegerDecoder, 
        nullable: true, 
        version: 139
    })
    reservedMembers: number | null = 0

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

    get canHaveWaitingList() {
        return (this.waitingListType !== WaitingListType.None && this.waitingListType !== WaitingListType.PreRegistrations) || (this.waitingListIfFull && this.isFull)
    }

    get canHaveWaitingListWithoutMax() {
        return (this.waitingListType !== WaitingListType.None && this.waitingListType !== WaitingListType.PreRegistrations)
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

    @field({ decoder: Image, nullable: true, version: 65 })
    coverPhoto: Image | null = null

    @field({ decoder: Image, nullable: true, version: 66 })
    squarePhoto: Image | null = null

    /**
     * @deprecated
     */
    @field({ decoder: new ArrayDecoder(OldGroupPrices), field: 'prices' })
    @field({ decoder: new ArrayDecoder(OldGroupPrices), field: 'oldPrices', optional: true, version: 284 })
    oldPrices: OldGroupPrices[] = []

    /**
     * @deprecated
     */
    @field({ decoder: new ArrayDecoder(Image), version: 58 })
    images: Image[] = []

    /**
     * @deprecated
     */
    @field({ decoder: StringDecoder, version: 76 })
    location = ""

    /**
     * Require that the member is already registered for one of these groups before allowing to register for this group.
     * If it is empty, then it is not enforced
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), version: 83 })
    requireGroupIds: string[] = []

    /**
     * @deprecated
     * Require that the member is already registered for one of these groups before allowing to register for this group.
     * If it is empty, then it is not enforced
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), version: 100 })
    requirePreviousGroupIds: string[] = []

    /**
     * @deprecated
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), version: 102 })
    preventPreviousGroupIds: string[] = []

    /**
     * @deprecated
     * Information about previous cycles
     */
    @field({ decoder: new MapDecoder(IntegerDecoder, CycleInformation), version: 193 })
    cycleSettings: Map<number, CycleInformation> = new Map()

    /**
     * @deprecated
     * Use registration periods instead
     * + replaced by activities
     */
    @field({ decoder: DateDecoder })
    @field({ decoder: DateDecoder, version: 33, upgrade: (d: Date) => {
        const d2 = new Date(d)
        d2.setUTCHours(-2, 0, 0, 0) // brussels time
        return d2
    } })
    startDate: Date = new Date()

    /**
     * @deprecated
     * Use registration periods instead
     * + replaced by activities
     */
    @field({ decoder: DateDecoder })
    @field({ decoder: DateDecoder, version: 33, upgrade: (d: Date) => {
        const d2 = new Date(d)
        d2.setUTCHours(23-2, 59, 0, 0) // brussels time
        return d2
    } })
    endDate: Date = new Date()

    /**
     * @deprecated
     * Dispay start and end date times
     */
    @field({ decoder: BooleanDecoder, version: 78 })
    displayStartEndTime = false

    /**
     * @deprecated
     */
    getGroupPrices(date: Date) {
        let foundPrice: OldGroupPrices | undefined = undefined

        // Determine price
        for (const price of this.oldPrices) {
            if (!price.startDate || price.startDate <= date) {
                foundPrice = price
            }
        }
        return foundPrice
    }

    get maxYear() {
        if (this.minAge === null) {
            return null
        }
        return (this.startDate.getFullYear() - this.minAge)
    }

    get minYear() {
        if (this.maxAge === null) {
            return null
        }
        return (this.startDate.getFullYear() - this.maxAge)
    }

    get forAdults() {
        return ((this.minAge && this.minAge >= 18) || (this.maxAge && this.maxAge > 18))
    }

    getAgeGenderDescription({includeAge = false, includeGender = false}: {includeAge?: boolean, includeGender?: boolean} = {}) {
        let who = '';

        if (includeAge && this.minYear && this.maxYear) {
            if (includeGender && this.genderType === GroupGenderType.OnlyMale) {
                if (this.forAdults) {
                    who += "mannen geboren in"
                } else {
                    who += "jongens geboren in"
                }
            } else if (includeGender && this.genderType === GroupGenderType.OnlyFemale) {
                if (this.forAdults) {
                    who += "vrouwen geboren in"
                } else {
                    who += "meisjes geboren in"
                }
            } else {
                who += "geboren in"
            }
            who += " " + (this.minYear) + " - " + (this.maxYear);
        } else if (includeAge && this.maxYear) {
            if (includeGender && this.genderType === GroupGenderType.OnlyMale) {
                if (this.forAdults) {
                    who += "mannen geboren in of voor"
                } else {
                    who += "jongens geboren in of voor"
                }
            } else if (includeGender && this.genderType === GroupGenderType.OnlyFemale) {
                if (this.forAdults) {
                    who += "vrouwen geboren in of voor"
                } else {
                    who += "meisjes geboren in of voor"
                }
            } else {
                who += "geboren in of voor"
            }
            who += " " + (this.maxYear);
        } else if (includeAge && this.minYear) {
            if (includeGender && this.genderType === GroupGenderType.OnlyMale) {
                if (this.forAdults) {
                    who += "mannen geboren in of na"
                } else {
                    who += "jongens geboren in of na"
                }
            } else if (includeGender && this.genderType === GroupGenderType.OnlyFemale) {
                if (this.forAdults) {
                    who += "vrouwen geboren in of na"
                } else {
                    who += "meisjes geboren in of na"
                }
            } else {
                who += "geboren in of na"
            }
            who += " " + (this.minYear);
        } else if (includeGender) {
            if (this.genderType === GroupGenderType.OnlyMale) {
                if (this.forAdults) {
                    who += "mannen"
                } else {
                    who += "jongens"
                }
            } else if (this.genderType === GroupGenderType.OnlyFemale) {
                if (this.forAdults) {
                    who += "vrouwen"
                } else {
                    who += "meisjes"
                }
            }
        }

        if (!who) {
            return null;
        }
        return who;
    }

    getMemberCount({waitingList}: {waitingList?: boolean}) {
        if (waitingList) {
            return this.waitingListSize;
        }

        return this.registeredMembers;
    }

    getShortCode(maxLength: number) {
        return Formatter.firstLetters(this.name, maxLength)
    }
}

export const GroupSettingsPatch = GroupSettings.patchType()
