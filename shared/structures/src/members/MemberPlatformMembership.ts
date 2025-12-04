import { AutoEncoder, BooleanDecoder, DateDecoder, IntegerDecoder, StringDecoder, field } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';
import { upgradePriceFrom2To4DecimalPlaces } from '../upgradePriceFrom2To4DecimalPlaces.js';

export class MemberPlatformMembership extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    memberId: string;

    @field({ decoder: StringDecoder })
    membershipTypeId: string;

    @field({ decoder: StringDecoder })
    organizationId: string;

    @field({ decoder: StringDecoder })
    periodId: string;

    @field({ decoder: DateDecoder })
    startDate = new Date();

    @field({ decoder: DateDecoder, nullable: true, version: 354 })
    trialUntil: Date | null = null;

    @field({ decoder: DateDecoder })
    endDate = new Date();

    @field({ decoder: DateDecoder, nullable: true })
    expireDate: Date | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    balanceItemId: string | null = null;

    @field({ decoder: IntegerDecoder })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    price = 0;

    @field({ decoder: IntegerDecoder })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    priceWithoutDiscount = 0;

    @field({ decoder: IntegerDecoder, version: 336 })
    freeAmount = 0;

    @field({ decoder: BooleanDecoder })
    generated = false;

    @field({ decoder: DateDecoder })
    createdAt = new Date();

    @field({ decoder: DateDecoder })
    updatedAt = new Date();

    // prevent deleting or changing price if true
    @field({ decoder: BooleanDecoder, version: 364 })
    locked = false;

    isActive(date: Date = new Date()) {
        return this.startDate <= date && this.endDate >= date;
    }

    get isTrial() {
        return this.trialUntil !== null && (this.trialUntil > new Date() || this.endDate <= this.trialUntil);
    }
}
