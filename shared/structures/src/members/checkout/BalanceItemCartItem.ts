import { AutoEncoder, field, IntegerDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem } from '../../BalanceItem.js';
import { upgradePriceFrom2To4DecimalPlaces } from '../../upgradePriceFrom2To4DecimalPlaces.js';

/**
 * Contains an intention to pay for an outstanding balance item
 */
export class BalanceItemCartItem extends AutoEncoder {
    get id() {
        return this.item.id;
    }

    @field({ decoder: BalanceItem })
    item: BalanceItem;

    /**
     * Amount you want to pay of that balance item
     */
    @field({ decoder: IntegerDecoder })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    price = 0;

    validate(data: { balanceItems?: BalanceItem[] }) {
        if (data.balanceItems !== undefined) {
            const found = data.balanceItems.find(b => b.id === this.item.id);
            if (!found) {
                throw new SimpleError({
                    code: 'not_found',
                    message: $t(`d0c91429-b8c8-4142-b95f-0bc249b9506c`),
                });
            }
            this.item = found;
        }

        const maxPrice = this.item.priceOpen;

        if (maxPrice === 0) {
            throw new SimpleError({
                code: 'not_found',
                message: $t(`fa3d21c6-c7a8-43b5-9d36-2ee2ca595055`),
            });
        }

        if (maxPrice < 0) {
            // Allow negative prices

            if (this.price > 0) {
                this.price = maxPrice;
            }

            if (this.price < maxPrice) {
                // Don't throw: we'll throw a different error during checkout if the price has changed
                this.price = maxPrice;
            }

            return;
        }
        if (this.price < 0) {
            this.price = maxPrice;
        }
        if (this.price > maxPrice) {
            // Don't throw: we'll throw a different error during checkout if the price has changed
            this.price = maxPrice;
        }
    }
}
