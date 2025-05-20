import { ArrayDecoder, AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { GroupPriceDiscount } from './GroupPriceDiscount.js';
import { TranslatedString } from './TranslatedString.js';

/**
 * Indicates that a certain bundle discount is activated for a certain group price.
 * It also allows you to override the discount amount for this group price.
 */
export class BundleDiscountGroupPriceSettings extends AutoEncoder {
    /**
     * Cached name of this bundle discount.
     */
    @field(TranslatedString.field({}))
    name: TranslatedString = new TranslatedString();

    @field({ decoder: new ArrayDecoder(GroupPriceDiscount), nullable: true })
    customDiscounts: GroupPriceDiscount[] | null = null;
}
