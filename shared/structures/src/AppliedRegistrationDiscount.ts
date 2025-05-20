import { AutoEncoder, field, IntegerDecoder } from '@simonbackx/simple-encoding';
import { TranslatedString } from './TranslatedString';

export class AppliedRegistrationDiscount extends AutoEncoder {
    /**
     * Snapshot of the discount that was applied to this registration.
     * This contains the name of the discount and settings.
     */
    @field(TranslatedString.field({}))
    name = new TranslatedString('');

    /**
     * Discount in cents
     */
    @field({ decoder: IntegerDecoder })
    amount: number;
}
