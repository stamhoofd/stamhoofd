import { AutoEncoder, field, IntegerDecoder } from '@simonbackx/simple-encoding';
import { upgradePriceFrom2To4DecimalPlaces } from '../upgradePriceFrom2To4DecimalPlaces.js';

export class CartItemPrice extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    price = 0;

    @field({ decoder: IntegerDecoder })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    fixedDiscount = 0;

    @field({ decoder: IntegerDecoder })
    percentageDiscount = 0;

    get discountedPrice() {
        let price = this.price;
        price = Math.min(
            price,
            Math.max(
                0,
                100 * Math.round(price * (10000 - this.percentageDiscount) / 10000_00), // Round up to 1 cent, not smaller
            ),
        ); // Min is required to support negative prices: prices should never increase after applyign discounts
        price = Math.min(price, Math.max(0, price - this.fixedDiscount)); // Min is required to support negative prices: prices should never increase after applyign discounts
        return price;
    }
}
