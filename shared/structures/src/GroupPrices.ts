import { AutoEncoder, DateDecoder,field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from "uuid";

/**
 * A group can have multiple prices, stored in an array. The pricing with the highest date or index is applied.
 */
export class GroupPrices extends AutoEncoder {
    @field({ decoder: StringDecoder, version: 2, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: DateDecoder, nullable: true })
    startDate: Date | null = null

    @field({ decoder: IntegerDecoder })
    price = 0

    @field({ decoder: IntegerDecoder, nullable: true })
    reducedPrice: number | null = null

    /**
     * Second member in the family
     */
    @field({ decoder: IntegerDecoder, nullable: true, version: 22 })
    familyPrice: number | null = null

    /**
     * Third or later member
     */
    @field({ decoder: IntegerDecoder, nullable: true, version: 22 })
    extraFamilyPrice: number | null = null

    getPriceFor(reduced: boolean, alreadyRegisteredCount = 0) {
        let price = reduced && this.reducedPrice !== null ? this.reducedPrice : this.price
        if (this.familyPrice && alreadyRegisteredCount == 1 && this.familyPrice < price) {
            price = this.familyPrice
        }
        if (this.extraFamilyPrice && alreadyRegisteredCount >= 2 && this.extraFamilyPrice < price) {
            price = this.extraFamilyPrice
        }
        return price
    }
}