import { AutoEncoder, field, IntegerDecoder } from '@common/encoding';
import { TranslatedString } from './TranslatedString.js';
import { TranslatedText } from './TranslatedText.js';
import { upgradePriceFrom2To4DecimalPlaces } from './upgradePriceFrom2To4DecimalPlaces.js';

export class AppliedRegistrationDiscount extends AutoEncoder {
    /**
     * Snapshot of the discount that was applied to this registration.
     * This contains the name of the discount and settings.
     */
    @field(TranslatedString.field({}))
    @field(TranslatedText.field({ version: 426 }))
    name = TranslatedText.create();

    /**
     * Discount in hunderd cents.
     * Positive means discount, negative means extra cost.
     */
    @field({ decoder: IntegerDecoder })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    amount: number;
}
