import { AutoEncoder, field, IntegerDecoder } from "@simonbackx/simple-encoding"
import { SimpleError } from "@simonbackx/simple-errors"
import { MemberBalanceItem } from "../../BalanceItemDetailed"

/**
 * Contains an intention to pay for an outstanding balance item
 */
export class BalanceItemCartItem extends AutoEncoder {
    get id() {
        return this.item.id
    }

    @field({ decoder: MemberBalanceItem })
    item: MemberBalanceItem

    /**
     * Amount you want to pay of that balance item
     */
    @field({ decoder: IntegerDecoder })
    price = 0

    validate(balanceItems: MemberBalanceItem[]) {
        const found = balanceItems.find(b => b.id === this.item.id)
        if (!found) {
            throw new SimpleError({
                code: "not_found",
                message: "Eén van de openstaande bedragen is niet meer beschikbaar."
            })
        }
        this.item = found
        const maxPrice = MemberBalanceItem.getOutstandingBalance([found]).total // Allow to start multiple payments for pending balance items in case of payment cancellations

        if (maxPrice === 0) {
            throw new SimpleError({
                code: "not_found",
                message: "Eén van de openstaande bedragen is ondertussen al betaald."
            })
        }

        if (maxPrice < 0) {
            // Allow negative prices

            if (this.price > 0) {
                this.price = maxPrice
            }
            
            if (this.price < maxPrice) {
                // Don't throw: we'll throw a different error during checkout if the price has changed
                this.price = maxPrice
            }

            return;
        }
        if (this.price < 0) {
            this.price = maxPrice
        }
        if (this.price > maxPrice) {
            // Don't throw: we'll throw a different error during checkout if the price has changed
            this.price = maxPrice
        }
    }
}
