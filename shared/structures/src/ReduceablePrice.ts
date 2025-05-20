import { AutoEncoder, field, IntegerDecoder } from '@simonbackx/simple-encoding';

import { type PlatformMember } from './members/PlatformMember.js';

export class ReduceablePrice extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    price = 0;

    @field({ decoder: IntegerDecoder, nullable: true })
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
