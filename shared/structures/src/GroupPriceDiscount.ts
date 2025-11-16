import { AutoEncoder, EnumDecoder, field } from '@simonbackx/simple-encoding';
import { ReduceablePrice } from './ReduceablePrice.js';
import { type PlatformMember } from './members/PlatformMember.js';
import { Formatter } from '@stamhoofd/utility';

export enum GroupPriceDiscountType {
    Fixed = 'Fixed',
    Percentage = 'Percentage',
}

export class GroupPriceDiscount extends AutoEncoder {
    /** */
    @field({ decoder: ReduceablePrice })
    @field({
        decoder: ReduceablePrice,
        upgrade: function (this: GroupPriceDiscount, old: ReduceablePrice) {
            if (this.type === GroupPriceDiscountType.Percentage) {
                // Undo *100
                return ReduceablePrice.create({
                    price: Math.round(old.price / 100),
                    reducedPrice: old.reducedPrice ? Math.round(old.reducedPrice / 100) : old.reducedPrice,
                });
            }
            return old;
        },
        downgrade: function (this: GroupPriceDiscount, old: ReduceablePrice) {
            if (this.type === GroupPriceDiscountType.Percentage) {
                // Redo
                return ReduceablePrice.create({
                    price: Math.round(old.price * 100),
                    reducedPrice: old.reducedPrice ? Math.round(old.reducedPrice * 100) : old.reducedPrice,
                });
            }
            return old;
        },
        version: 389,
    })
    value = ReduceablePrice.create({});

    @field({ decoder: new EnumDecoder(GroupPriceDiscountType) })
    type = GroupPriceDiscountType.Percentage;

    calculateDiscount(price: number, member: PlatformMember) {
        if (this.type === GroupPriceDiscountType.Fixed) {
            return Math.max(0, Math.min(price, this.value.forMember(member)));
        }

        // Discounts should always be rounded to 2 decimals
        return Math.max(0,
            Math.min(price,
                100 * Math.round(price * this.value.forMember(member) / 100_00_00),
            ),
        );
    }

    toString() {
        if (this.type === GroupPriceDiscountType.Percentage) {
            return Formatter.percentage(this.value.price);
        }
        return Formatter.price(this.value.price);
    }
}
