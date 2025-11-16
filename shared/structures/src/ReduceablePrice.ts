import { AutoEncoder, field, IntegerDecoder } from '@simonbackx/simple-encoding';

import { type PlatformMember } from './members/PlatformMember.js';
import { upgradePriceFrom2To4DecimalPlaces } from './upgradePriceFrom2To4DecimalPlaces.js';

export class ReduceablePrice extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    price = 0;

    @field({ decoder: IntegerDecoder, nullable: true })
    @field({ ...upgradePriceFrom2To4DecimalPlaces, nullable: true })
    reducedPrice: number | null = null;

    getPrice(isReduced: boolean) {
        if (this.reducedPrice === null) {
            return this.price;
        }

        return isReduced ? this.reducedPrice : this.price;
    }

    forMember(member: PlatformMember) {
        return this.getPrice(member.patchedMember.details.shouldApplyReducedPrice);
    }
}
