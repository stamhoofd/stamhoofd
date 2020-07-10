import { AutoEncoder, DateDecoder,field, IntegerDecoder } from '@simonbackx/simple-encoding';

/**
 * A group can have multiple prices, stored in an array. The pricing with the highest date or index is applied.
 */
export class GroupPrices extends AutoEncoder {
    @field({ decoder: DateDecoder, nullable: true })
    startDate: Date | null = null

    @field({ decoder: IntegerDecoder })
    price = 0

    @field({ decoder: IntegerDecoder, nullable: true })
    reducedPrice: number | null = null
}