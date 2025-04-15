import { AutoEncoder, field, IntegerDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { BalanceItem } from '../../BalanceItem.js';

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
    price = 0;

    validate(data: { balanceItems?: BalanceItem[] }) {
        if (data.balanceItems !== undefined) {
            const found = data.balanceItems.find(b => b.id === this.item.id);
            if (!found) {
                throw new SimpleError({
                    code: 'not_found',
                    message: $t(`Eén van de openstaande bedragen is niet meer beschikbaar.`),
                });
            }
            this.item = found;
        }

        const maxPrice = this.item.priceOpen;

        if (maxPrice === 0) {
            throw new SimpleError({
                code: 'not_found',
                message: $t(`Eén van de openstaande bedragen is ondertussen al betaald.`),
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
