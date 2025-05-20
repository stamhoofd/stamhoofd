import { AutoEncoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';

export class AppliedRegistrationDiscount extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    /**
     * Snapshot of the discount that was applied to this registration.
     * This contains the name of the discount and settings.
     */
    @field({ decoder: StringDecoder })
    name: string;

    /**
     * Discount in cents
     */
    @field({ decoder: IntegerDecoder })
    amount: number;
}
