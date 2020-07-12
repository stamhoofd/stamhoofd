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
}