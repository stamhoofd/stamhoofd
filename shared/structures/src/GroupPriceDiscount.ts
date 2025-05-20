import { AutoEncoder, EnumDecoder, field } from '@simonbackx/simple-encoding';
import { ReduceablePrice } from './ReduceablePrice.js';
import { type PlatformMember } from './members/PlatformMember.js';

export enum GroupPriceDiscountType {
    Fixed = 'Fixed',
    Percentage = 'Percentage',
}

export class GroupPriceDiscount extends AutoEncoder {
    @field({ decoder: ReduceablePrice })
    value = ReduceablePrice.create({});

    @field({ decoder: new EnumDecoder(GroupPriceDiscountType) })
    type = GroupPriceDiscountType.Percentage;

    calculateDiscount(price: number, member: PlatformMember) {
        if (this.type === GroupPriceDiscountType.Fixed) {
            return Math.max(0, Math.min(price, this.value.forMember(member)));
        }
        return Math.max(0, Math.min(price,
            Math.round(price * this.value.forMember(member) / 100_00)),
        );
    }
}
