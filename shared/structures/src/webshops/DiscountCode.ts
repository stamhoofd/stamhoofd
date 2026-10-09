import { AutoEncoder, field, StringDecoder, ArrayDecoder, IntegerDecoder, BooleanDecoder, DateDecoder, EmailDecoder } from '@simonbackx/simple-encoding';
import { Discount } from './Discount.js';
import { v4 as uuidv4 } from 'uuid';

export class DiscountCode extends AutoEncoder {
    static readonly maxPerWebshop = 1000;

    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    code: string;

    @field({ decoder: StringDecoder, version: 241 })
    description = '';

    @field({ decoder: new ArrayDecoder(Discount) })
    discounts: Discount[] = [];

    @field({ decoder: IntegerDecoder })
    usageCount = 0;

    @field({ decoder: IntegerDecoder, nullable: true })
    maximumUsage: number | null = null;

    /**
     * When an order is correctly placed, we store the reserved amount in the stock here.
     * We need this to check the stock changes when an order is edited after placement.
     */
    @field({ decoder: BooleanDecoder })
    reserved = false;

    @field({ decoder: DateDecoder, version: 240 })
    createdAt: Date = new Date();

    @field({ decoder: DateDecoder, version: 240 })
    updatedAt: Date = new Date();
}

/**
 * Dashboard only: the public DiscountCode is returned to shoppers who enter a code.
 */
export class PrivateDiscountCode extends DiscountCode {
    /**
     * Only used to email the code to someone and to match rows on import. Not unique, and not
     * checked against the email of the person placing the order.
     */
    @field({ decoder: EmailDecoder, nullable: true, version: 421 })
    email: string | null = null;
}
