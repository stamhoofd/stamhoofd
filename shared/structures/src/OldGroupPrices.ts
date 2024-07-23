import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder,field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

export class OldGroupPrice extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    price = 0

    @field({ decoder: IntegerDecoder, nullable: true })
    reducedPrice: number | null = null
}

/**
 * A group can have multiple prices, stored in an array. The pricing with the highest date or index is applied.
 */
export class OldGroupPrices extends AutoEncoder {
    @field({ decoder: StringDecoder, version: 2, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: DateDecoder, nullable: true })
    startDate: Date | null = null

    /**
     * Whether the array count is per member of the same family (true) or only the same member (false)
     */
    @field({ decoder: BooleanDecoder, upgrade: () => false, version: 99 })
    sameMemberOnlyDiscount = false

    /**
     * Count members in same category or only for the same group?
     */
    @field({ decoder: BooleanDecoder, upgrade: () => false, version: 99 })
    onlySameGroup = false
    
    /**
     * The array contains prices: for first member, second member... If more members are present in a family (or member itself), the last price is used
     */
    @field({ decoder: new ArrayDecoder(OldGroupPrice), version: 98, upgrade: function(this: OldGroupPrices) {
        const arr: OldGroupPrice[] = [
            OldGroupPrice.create({
                price: this.price,
                reducedPrice: this.reducedPrice
            })
        ]
        if (this.familyPrice !== null) {
            arr.push(
                OldGroupPrice.create({
                    price: this.familyPrice,
                    reducedPrice: (this.reducedPrice !== null && this.familyPrice < this.reducedPrice) ? null : this.reducedPrice
                })
            )

            if (this.extraFamilyPrice !== null) {
                arr.push(
                    OldGroupPrice.create({
                        price: this.extraFamilyPrice,
                        reducedPrice: (this.reducedPrice !== null && this.extraFamilyPrice < this.reducedPrice) ? null : this.reducedPrice
                    })
                )
            }
        }
        return arr
    } })
    prices: OldGroupPrice[] = [OldGroupPrice.create({})]

    getPriceFor(reduced: boolean, alreadyRegisteredCount = 0) {
        if (this.prices.length == 0 || alreadyRegisteredCount < 0) {
            return 0
        }
        const price = this.prices[Math.min(this.prices.length - 1, alreadyRegisteredCount)]
        if (reduced) {
            return price.reducedPrice ?? price.price
        }

        return price.price
    }

    /** 
     * @deprecated
     */
    @field({ decoder: IntegerDecoder })
    private price = 0

    /**
     * @deprecated
     */
    @field({ decoder: IntegerDecoder, nullable: true })
    private reducedPrice: number | null = null

    /**
     * @deprecated
     * Second member in the family
     */
    @field({ decoder: IntegerDecoder, nullable: true, version: 22 })
    private familyPrice: number | null = null

    /**
     * @deprecated
     * Third or later member
     */
    @field({ decoder: IntegerDecoder, nullable: true, version: 22 })
    private extraFamilyPrice: number | null = null
}
