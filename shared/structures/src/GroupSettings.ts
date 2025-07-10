import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, Decoder, EnumDecoder, field, IntegerDecoder, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';

import { BundleDiscountGroupPriceSettings } from './BundleDiscountGroupPriceSettings.js';
import { Group } from './Group.js';
import { GroupGenderType } from './GroupGenderType.js';
import { OldGroupPrices } from './OldGroupPrices.js';
import { ReduceablePrice } from './ReduceablePrice.js';
import { RegistrationPeriodBase } from './RegistrationPeriodBase.js';
import { StockReservation } from './StockReservation.js';
import { TranslatedString } from './TranslatedString.js';
import { Image } from './files/Image.js';
import { OrganizationRecordsConfiguration } from './members/OrganizationRecordsConfiguration.js';
import { RegisterItem } from './members/checkout/RegisterItem.js';
import { RecordCategory } from './members/records/RecordCategory.js';

export class GroupPrice extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    @field(TranslatedString.field({ version: 370 }))
    name = new TranslatedString($t(`e3ef8c27-f909-4725-b97b-2cbbd9f24bb5`));

    @field({ decoder: ReduceablePrice })
    price = ReduceablePrice.create({});

    @field({ decoder: BooleanDecoder, version: 290 })
    hidden = false;

    /**
     * Total stock, excluding already sold items into account
     */
    @field({ decoder: IntegerDecoder, nullable: true, version: 290 })
    stock: number | null = null;

    /**
     * @deprecated removed
     */
    @field({ decoder: IntegerDecoder, optional: true, field: 'usedStock' })
    _usedStock = 0;

    /**
     * @deprecated removed
     */
    @field({ decoder: IntegerDecoder, optional: true, field: 'reserved' })
    _reserved = 0;

    /**
     * Bundle discounts that are enabled for this group price, and possible custom settings
     */
    @field({ decoder: new MapDecoder(StringDecoder, BundleDiscountGroupPriceSettings), version: 374 })
    bundleDiscounts: Map<string, BundleDiscountGroupPriceSettings> = new Map();

    @field({ decoder: DateDecoder, nullable: true, ...NextVersion })
    startDate: Date | null = null;

    @field({ decoder: DateDecoder, nullable: true, ...NextVersion })
    endDate: Date | null = null;

    getUsedStock(group: Group) {
        const groupStockReservations = group.stockReservations;
        return StockReservation.getAmount('GroupPrice', this.id, groupStockReservations);
    }

    /**
     * Can be negative is we are editing items, positive if other items in the cart cause stock changes
     */
    getPendingStock(item: RegisterItem) {
        const stock = item.getCartPendingStockReservations(); // this is positive if it will be used
        return StockReservation.getAmount(
            'GroupPrice',
            this.id,
            StockReservation.filter('Group', item.group.id, stock),
        );
    }

    isSoldOut(item: RegisterItem | Group): boolean {
        if (this.stock === null) {
            return false;
        }
        if (item instanceof Group) {
            return this.getUsedStock(item) >= this.stock;
        }
        return this.getUsedStock(item.group) + this.getPendingStock(item) >= this.stock;
    }

    getRemainingStock(item: RegisterItem | Group): number | null {
        if (this.stock === null) {
            return null;
        }
        if (item instanceof Group) {
            return Math.max(0, this.stock - this.getUsedStock(item));
        }
        return Math.max(0, this.stock - this.getPendingStock(item) - this.getUsedStock(item.group));
    }
}

export class GroupOption extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: BooleanDecoder, version: 290 })
    hidden = false;

    /**
     * Price added (can be negative) is always in cents, to avoid floating point errors
     */
    @field({ decoder: ReduceablePrice })
    price = ReduceablePrice.create({});

    /**
     * Maximum per registration (if > 1, you can choose an amount for this option)
     * If null = infinite
     */
    @field({ decoder: BooleanDecoder })
    allowAmount = false;

    /**
     * Maximum per registration (in case allowAmount is true)
     * If null = infinite
     */
    @field({ decoder: IntegerDecoder, nullable: true })
    maximum: number | null = null;

    /**
     * Total stock, excluding already sold items into account
     */
    @field({ decoder: IntegerDecoder, nullable: true, version: 290 })
    stock: number | null = null;

    /**
     * @deprecated removed
     */
    @field({ decoder: IntegerDecoder, optional: true, field: 'usedStock' })
    _usedStock = 0;

    /**
     * @deprecated removed
     */
    @field({ decoder: IntegerDecoder, optional: true, field: 'reserved' })
    _reserved = 0;

    getUsedStock(group: Group) {
        const groupStockReservations = group.stockReservations;
        return StockReservation.getAmount('GroupOption', this.id, groupStockReservations);
    }

    /**
     * Can be negative is we are editing items, positive if other items in the cart cause stock changes
     */
    getPendingStock(item: RegisterItem) {
        const stock = item.getCartPendingStockReservations(); // this is positive if it will be used
        return StockReservation.getAmount(
            'GroupOption',
            this.id,
            StockReservation.filter('Group', item.group.id, stock),
        );
    }

    isSoldOut(item: RegisterItem | Group): boolean {
        if (this.stock === null) {
            return false;
        }
        if (item instanceof Group) {
            return this.getUsedStock(item) >= this.stock;
        }
        return this.getUsedStock(item.group) + this.getPendingStock(item) >= this.stock;
    }

    getRemainingStock(item: RegisterItem | Group): number | null {
        if (this.stock === null) {
            return null;
        }
        if (item instanceof Group) {
            return Math.max(0, this.stock - this.getUsedStock(item));
        }
        return Math.max(0, this.stock - this.getPendingStock(item) - this.getUsedStock(item.group));
    }

    getMaximumSelection(item: RegisterItem) {
        if (this.maximum === null) {
            return this.getRemainingStock(item);
        }

        const remaining = this.getRemainingStock(item);
        if (remaining === null) {
            return this.maximum;
        }

        return Math.min(this.maximum, remaining);
    }
}

export class GroupOptionMenu extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: StringDecoder })
    description = '';

    @field({ decoder: BooleanDecoder })
    multipleChoice = false;

    @field({ decoder: new ArrayDecoder(GroupOption) })
    options: GroupOption[] = [
        GroupOption.create({}),
    ];

    get hidden() {
        return this.options.length > 0 && this.options.every(o => o.hidden);
    }

    getFilteredOptions(options?: { admin?: boolean }) {
        return this.options.filter((p) => {
            if (p.hidden && !options?.admin) {
                return false;
            }
            return true;
        });
    }

    getDefaultOption(options?: { admin?: boolean }) {
        if (options?.admin || this.hidden) {
            return this.options[0];
        }

        return this.options.filter(o => !o.hidden)[0];
    }
}

export enum WaitingListType {
    None = 'None',
    PreRegistrations = 'PreRegistrations',
    ExistingMembersFirst = 'ExistingMembersFirst',
    All = 'All',
}

export class CycleInformation extends AutoEncoder {
    @field({ decoder: DateDecoder, nullable: true })
    startDate: Date | null = null;

    @field({ decoder: DateDecoder, nullable: true })
    endDate: Date | null = null;

    @field({
        decoder: IntegerDecoder,
        nullable: true,
    })
    registeredMembers: number | null = 0;

    /**
     * Amount of members that is reserved (e.g in payment process, or a member on the waiting list that is invited)
     */
    @field({
        decoder: IntegerDecoder,
        nullable: true,
        version: 139,
    })
    reservedMembers: number | null = 0;

    /**
     * Amount of members on the waiting list
     */
    @field({
        decoder: IntegerDecoder,
        nullable: true,
        version: 139,
    })
    waitingListSize: number | null = 0;
}

export class GroupDefaultEventTime extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    dayOfWeek = 1; // 1 = monday, 7 = sunday

    @field({ decoder: IntegerDecoder })
    startTime = 0; // minutes since midnight

    @field({ decoder: IntegerDecoder })
    endTime = 0; // minutes since midnight
}

export class GroupSettings extends AutoEncoder {
    @field({ decoder: StringDecoder })
    @field(TranslatedString.field({ version: 370 }))
    name = new TranslatedString();

    @field({ decoder: StringDecoder })
    @field(TranslatedString.field({ version: 370 }))
    description = new TranslatedString();

    @field({ decoder: StringDecoder, version: 350, nullable: true })
    eventId: string | null = null;

    /**
     * Cached value so we know what period this group is in, to calculate the age requirements,
     * and to display the time period in the UI
     */
    @field({ decoder: RegistrationPeriodBase, nullable: true, version: 329 })
    period: RegistrationPeriodBase | null = null;

    @field({ decoder: new ArrayDecoder(GroupPrice), version: 285, upgrade: () => { return []; } }) // Upgrade uses empty array to prevent generating random ids every time
    prices: GroupPrice[] = [GroupPrice.create({})];

    @field({ decoder: new ArrayDecoder(GroupOptionMenu), version: 285 })
    optionMenus: GroupOptionMenu[] = [];

    @field({
        decoder: OrganizationRecordsConfiguration,
        version: 291,
        defaultValue: () => OrganizationRecordsConfiguration.create({}),
    })
    recordsConfiguration: OrganizationRecordsConfiguration;

    /**
     * Note: these are saved in the registration, not the member.
     * Do not confuse with the member's record categories in recordsConfiguration
     */
    @field({ decoder: new ArrayDecoder(RecordCategory as Decoder<RecordCategory>), version: 338 })
    recordCategories: RecordCategory[] = [];

    /**
     * Date when the online registrations open automatically (note: the group should be open for this to work)
     */
    @field({ decoder: DateDecoder, nullable: false, version: 73, upgrade: function (this: GroupSettings) { return this.startDate; } })
    @field({ decoder: DateDecoder, nullable: true, version: 192, downgrade: function (this: GroupSettings) { return this.registrationStartDate ?? this.startDate; } })
    registrationStartDate: Date | null = null;

    /**
     * Date when the online registrations close automatically
     */
    @field({ decoder: DateDecoder, nullable: false, version: 73, upgrade: function (this: GroupSettings) { return this.endDate; } })
    @field({ decoder: DateDecoder, nullable: true, version: 192, downgrade: function (this: GroupSettings) { return this.registrationEndDate ?? this.endDate; } })
    registrationEndDate: Date | null = null;

    /**
     * Experimental feature to suggest when to create new activities in the calendar.
     */
    @field({ decoder: GroupDefaultEventTime, nullable: true, version: 283 })
    defaultEventTime: GroupDefaultEventTime | null = null;

    @field({ decoder: new EnumDecoder(GroupGenderType) })
    genderType: GroupGenderType = GroupGenderType.Mixed;

    /**
     * Number of days on trial for new members
     */
    @field({ decoder: IntegerDecoder, version: 353 })
    trialDays = 0;

    @field({ decoder: IntegerDecoder, nullable: true, field: 'maxBirthYear' })
    @field({ decoder: IntegerDecoder, nullable: true, version: 12, upgrade: (year) => {
        if (year === null) {
            return null;
        }
        return 2020 - year;
    } })
    minAge: number | null = null;

    @field({ decoder: IntegerDecoder, nullable: true, field: 'minBirthYear' })
    @field({
        decoder: IntegerDecoder, nullable: true, version: 12, upgrade: (year) => {
            if (year === null) {
                return null;
            }
            return 2020 - year;
        },
    })
    maxAge: number | null = null;

    @field({ decoder: new EnumDecoder(WaitingListType), version: 16 })
    waitingListType: WaitingListType = WaitingListType.None;

    /**
     * Only used for waitingListType = PreRegistrations
     */
    @field({ decoder: DateDecoder, nullable: true, version: 16 })
    preRegistrationsDate: Date | null = null;

    @field({
        decoder: IntegerDecoder, nullable: true, version: 16,
    })
    @field({
        decoder: IntegerDecoder,
        nullable: true,
        version: 74,
        upgrade: function (this: GroupSettings, old: number | null): number | null {
            // Clear value if waiting list type is none
            if ((this.waitingListType as any as WaitingListType) !== WaitingListType.None) {
                return old;
            }
            return null;
        },
    })
    maxMembers: number | null = null;

    /**
     * @deprecated
     * Use waitinglist instead to determine if a waiting list is enabled
     */
    @field({
        decoder: BooleanDecoder, version: 79,
    })
    waitingListIfFull = true;

    /**
     * @deprecated
     * If maxMembers is not null, this will get filled in by the backend
     */
    @field({
        decoder: IntegerDecoder,
        nullable: true,
        version: 77,
    })
    registeredMembers: number | null = 0;

    /**
     * @deprecated
     * Amount of members that is reserved (e.g in payment process, or a member on the waiting list that is invited)
     */
    @field({
        decoder: IntegerDecoder,
        nullable: true,
        version: 139,
    })
    reservedMembers: number | null = 0;

    /**
     * @deprecated
     * Amount of members on the waiting list
     */
    @field({
        decoder: IntegerDecoder,
        nullable: true,
        version: 139,
        optional: true,
    })
    waitingListSize: number | null = null;

    getUsedStock(group: Group) {
        const groupStockReservations = group.stockReservations;
        return StockReservation.getAmount('GroupPrice', null, groupStockReservations);
    }

    /**
     * Can be negative is we are editing items, positive if other items in the cart cause stock changes
     */
    getPendingStock(item: RegisterItem) {
        const stock = item.getCartPendingStockReservations(); // this is positive if it will be used
        return StockReservation.getAmount(
            'Group',
            item.group.id,
            stock,
        );
    }

    isSoldOut(item: RegisterItem | Group): boolean {
        if (this.maxMembers === null) {
            return false;
        }
        if (item instanceof Group) {
            return this.getUsedStock(item) >= this.maxMembers;
        }
        return this.getUsedStock(item.group) + this.getPendingStock(item) >= this.maxMembers;
    }

    getRemainingStock(item: RegisterItem | Group): number | null {
        if (this.maxMembers === null) {
            return null;
        }
        if (item instanceof Group) {
            return Math.max(0, this.maxMembers - this.getUsedStock(item));
        }
        return Math.max(0, this.maxMembers - this.getPendingStock(item) - this.getUsedStock(item.group));
    }

    get isFull() {
        return this.maxMembers !== null && this.registeredMembers !== null && (this.registeredMembers + (this.reservedMembers ?? 0)) >= this.maxMembers;
    }

    get availableMembers() {
        if (this.maxMembers === null) {
            return null;
        }
        if (this.registeredMembers === null) {
            return null;
        }
        return this.maxMembers - this.registeredMembers - (this.reservedMembers ?? 0);
    }

    /**
     * Of er voorrang moet gegeven worden aan broers en/of zussen als er wachtlijsten of voorinschrijvingen zijn
     */
    @field({ decoder: BooleanDecoder, version: 16 })
    priorityForFamily = true;

    @field({ decoder: Image, nullable: true, version: 65 })
    coverPhoto: Image | null = null;

    @field({ decoder: Image, nullable: true, version: 66 })
    squarePhoto: Image | null = null;

    /**
     * @deprecated
     */
    @field({ decoder: new ArrayDecoder(OldGroupPrices), field: 'prices' })
    @field({ decoder: new ArrayDecoder(OldGroupPrices), field: 'oldPrices', optional: true, version: 284 })
    oldPrices: OldGroupPrices[] = [];

    /**
     * @deprecated
     */
    @field({ decoder: new ArrayDecoder(Image), version: 58, optional: true })
    images: Image[] = [];

    /**
     * @deprecated
     */
    @field({ decoder: StringDecoder, version: 76, optional: true })
    location = '';

    /**
     * Require that the member is already registered for one of these groups before allowing to register for this group.
     * If it is empty, then it is not enforced
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), version: 83 })
    requireGroupIds: string[] = [];

    /**
     * Require that the member is already registered for one of these groups before allowing to register for this group.
     * If it is empty, then it is not enforced
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), version: 297 })
    requireDefaultAgeGroupIds: string[] = [];

    /**
     * The member should have a platform membership for the provided date before being able to register
     * OR on the date of the registration
     */
    @field({ decoder: DateDecoder, nullable: true, version: 297 })
    requirePlatformMembershipOn: Date | null = null;

    /**
     * The member should have a platform membership on the date of the registration before being able to register
     */
    @field({ decoder: BooleanDecoder, version: 358 })
    requirePlatformMembershipOnRegistrationDate: boolean = false;

    /**
     * The member should have a valid registration (type = GroupType.Membership) for one of these organization ids
     *
     * If empty and requireOrganizationTags empty: new members without registrations can also register
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), version: 297 })
    requireOrganizationIds: string[] = [];

    /**
     * The member should have a valid registration (type = GroupType.Membership) for one of these organization tags
     *
     * If empty AND requireOrganizationIds empty: new members without registrations can also register
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), version: 297 })
    requireOrganizationTags: string[] = [];

    /**
     * Allow other organizations to register members in this group
     * This would create a payment between the organizations instead, so that often requires invoicing
     */
    @field({ decoder: BooleanDecoder, version: 303 })
    allowRegistrationsByOrganization = false;

    /**
     * @deprecated
     * Require that the member is already registered for one of these groups before allowing to register for this group.
     * If it is empty, then it is not enforced
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), version: 100, optional: true })
    requirePreviousGroupIds: string[] = [];

    /**
     * @deprecated
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), version: 102, optional: true })
    preventPreviousGroupIds: string[] = [];

    /**
     * @deprecated
     * Information about previous cycles
     */
    @field({ decoder: new MapDecoder(IntegerDecoder, CycleInformation), version: 193, optional: true })
    cycleSettings: Map<number, CycleInformation> = new Map();

    @field({ decoder: DateDecoder })
    @field({ decoder: DateDecoder, version: 33, upgrade: (d: Date) => {
        const d2 = new Date(d);
        d2.setUTCHours(-2, 0, 0, 0); // brussels time
        return d2;
    }, optional: true })
    startDate: Date = new Date();

    @field({ decoder: DateDecoder })
    @field({ decoder: DateDecoder, version: 33, upgrade: (d: Date) => {
        const d2 = new Date(d);
        d2.setUTCHours(23 - 2, 59, 0, 0); // brussels time
        return d2;
    }, optional: true })
    endDate: Date = new Date();

    /**
     * @deprecated
     * Dispay start and end date times
     */
    @field({ decoder: BooleanDecoder, version: 78, optional: true })
    displayStartEndTime = false;

    /**
     * @deprecated
     */
    getGroupPrices(date: Date) {
        let foundPrice: OldGroupPrices | undefined = undefined;

        // Determine price
        for (const price of this.oldPrices) {
            if (!price.startDate || price.startDate <= date) {
                foundPrice = price;
            }
        }
        return foundPrice;
    }

    get maxYear() {
        if (this.minAge === null) {
            return null;
        }
        return (this.startDate.getFullYear() - this.minAge);
    }

    get minYear() {
        if (this.maxAge === null) {
            return null;
        }
        return (this.startDate.getFullYear() - this.maxAge);
    }

    get forAdults() {
        return ((this.minAge && this.minAge >= 18) || (this.maxAge && this.maxAge > 18));
    }

    getAgeGenderDescription({ includeAge = false, includeGender = false }: { includeAge?: boolean; includeGender?: boolean } = {}) {
        let who = '';

        if (includeAge && this.minYear && this.maxYear) {
            if (includeGender && this.genderType === GroupGenderType.OnlyMale) {
                if (this.forAdults) {
                    who += $t(`8e4c1895-286b-47e7-94c6-fceb63947706`);
                }
                else {
                    who += $t(`901e5ba0-d0f3-41f8-a611-0a93f469cecd`);
                }
            }
            else if (includeGender && this.genderType === GroupGenderType.OnlyFemale) {
                if (this.forAdults) {
                    who += $t(`48f7fb2e-28fc-433d-8834-37c9fcfbe862`);
                }
                else {
                    who += $t(`d3a6a788-8354-46f1-911e-a452763a5ae8`);
                }
            }
            else {
                who += $t(`77019f85-9898-4fda-8ae3-d6ac3bc9ad3b`);
            }
            who += ' ' + (this.minYear) + ' - ' + (this.maxYear);
        }
        else if (includeAge && this.maxYear) {
            if (includeGender && this.genderType === GroupGenderType.OnlyMale) {
                if (this.forAdults) {
                    who += $t(`2d09d9be-60e7-4872-8f01-aabd51be4f1a`);
                }
                else {
                    who += $t(`b9f4f3d8-8f34-4a20-9361-071079b64cf5`);
                }
            }
            else if (includeGender && this.genderType === GroupGenderType.OnlyFemale) {
                if (this.forAdults) {
                    who += $t(`6c4c2f13-07ce-4ac6-950b-5d28971a753d`);
                }
                else {
                    who += $t(`3447343b-372f-4b3c-88ed-8263a8a34557`);
                }
            }
            else {
                who += $t(`e3d49378-ea73-4fcd-9113-7c5bc0cc7591`);
            }
            who += ' ' + (this.maxYear);
        }
        else if (includeAge && this.minYear) {
            if (includeGender && this.genderType === GroupGenderType.OnlyMale) {
                if (this.forAdults) {
                    who += $t(`521b46d2-0e9b-43e8-9a1a-a5e5cb84934a`);
                }
                else {
                    who += $t(`e00ec6db-06f6-4a11-affe-d79c30fdd17a`);
                }
            }
            else if (includeGender && this.genderType === GroupGenderType.OnlyFemale) {
                if (this.forAdults) {
                    who += $t(`441ecbc8-3e95-4820-ac06-253de87162e1`);
                }
                else {
                    who += $t(`8d49f3be-7c08-4526-af54-783466d3d40d`);
                }
            }
            else {
                who += $t(`6e4da2b1-9694-49f1-9238-94e784044897`);
            }
            who += ' ' + (this.minYear);
        }
        else if (includeGender) {
            if (this.genderType === GroupGenderType.OnlyMale) {
                if (this.forAdults) {
                    who += $t(`da7c4439-18f9-4f20-a1f0-f5f1815d1bb9`);
                }
                else {
                    who += $t(`06ab1d42-107d-46d8-8eba-cb62d12068b9`);
                }
            }
            else if (this.genderType === GroupGenderType.OnlyFemale) {
                if (this.forAdults) {
                    who += $t(`128eb9e9-d470-49b0-8342-012e484c4daa`);
                }
                else {
                    who += $t(`43e158dd-aab2-4f5c-9e35-f56ff556cc51`);
                }
            }
        }

        if (!who) {
            return null;
        }
        return who;
    }

    getMemberCount({ waitingList }: { waitingList?: boolean }) {
        if (waitingList) {
            return this.waitingListSize;
        }

        return this.registeredMembers;
    }

    getShortCode(maxLength: number) {
        return Formatter.firstLetters(this.name, maxLength);
    }

    getFilteredPrices(options?: { admin?: boolean }) {
        return this.prices.filter((p) => {
            if (p.hidden && !options?.admin) {
                return false;
            }
            return true;
        });
    }

    getFilteredOptionMenus(options?: { admin?: boolean }) {
        return this.optionMenus.filter((p) => {
            return p.getFilteredOptions(options).length > 0;
        });
    }

    get isFree() {
        return !this.prices.find(p => p.price.price > 0) && !this.optionMenus.find(o => o.options.find(p => p.price.price > 0));
    }
}

export const GroupSettingsPatch = GroupSettings.patchType();
