import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';

import { Address } from '../addresses/Address.js';
import { File } from '../files/File.js';
import { STInvoiceItem } from './STInvoiceItem.js';

export class STInvoiceMeta extends AutoEncoder {
    /**
     * Date the invoice was valid and given a number.
     */
    @field({ decoder: DateDecoder, optional: true })
    date?: Date;

    /**
     * Only set if the invoice is officially generated and send
     */
    @field({ decoder: File, optional: true })
    pdf?: File;

    /**
     * Only set if the invoice is officially generated and send + company has VAT number
     */
    @field({ decoder: File, optional: true })
    xml?: File;

    /**
     * Has this been charged automatically via outstanding amount?
     */
    @field({ decoder: BooleanDecoder, optional: true })
    backgroundCharge = false;

    /**
     * VATPercentage should be zero in countries outside Belgium in EU
     */
    @field({ decoder: IntegerDecoder })
    VATPercentage = 21;

    @field({ decoder: new ArrayDecoder(STInvoiceItem) })
    items: STInvoiceItem[] = [];

    /**
     * Sometimes we need to calculate an invoice in reverse when we have a fixed price including VAT,
     * but need to calculatle the price excluding VAT.
     */
    @field({ decoder: BooleanDecoder, version: 186 })
    areItemsIncludingVAT = false;

    // Cached company information (in case it is changed)
    @field({ decoder: StringDecoder })
    companyName: string;

    @field({ decoder: StringDecoder })
    companyContact: string;

    @field({ decoder: StringDecoder, optional: true, nullable: true })
    companyEmail: string | null = null;

    @field({ decoder: Address })
    companyAddress: Address;

    @field({ decoder: StringDecoder, nullable: true })
    companyVATNumber: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, optional: true })
    companyNumber: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 133 })
    ipAddress: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 133 })
    userAgent: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 210 })
    stripeAccountId: string | null = null;

    /**
     * @deprecated
     * Depending on areItemsIncludingVAT, this can either be including or excluding VAT
     */
    private get itemPrice() {
        return this.items.reduce((price, item) => price + item.price, 0);
    }

    includingVATToExcludingVAT(price: number) {
        // Always only round the VAT, not other prices
        return price - this.getVATOnIncludingVATAmount(price);
    }

    excludingVATToIncludingVAT(price: number) {
        // Always only round the VAT, not other prices
        return price + this.getVATOnExcludingVATAmount(price);
    }

    getVATOnIncludingVATAmount(price: number) {
        return Math.round(price * this.VATPercentage / (100 + this.VATPercentage));
    }

    getVATOnExcludingVATAmount(price: number) {
        // Make sure price result doesn't depend on the sign of the price
        return Math.round(Math.abs(price) * this.VATPercentage / 100) * Math.sign(price);
    }

    get useLegacyRounding() {
        // In the past we didn't round the price without VAT if we calculated starting from a price inclusive VAT
        // in that case, we only rounded the VAT
        return this.date && this.date < new Date('2025-12-01');
    }

    get priceWithoutVAT(): number {
        if (this.useLegacyRounding) {
            const itemPrice = this.itemPrice;
            if (this.areItemsIncludingVAT) {
                return itemPrice - this.VAT;
            }
            return itemPrice;
        }

        if (this.areItemsIncludingVAT) {
            // We round at individual item level
            // because PEPPOL requires prices with max 2 decimals on every line level, meaning we need to round.
            return this.items.reduce((price, item) => price + this.includingVATToExcludingVAT(item.price), 0);
        }
        return this.items.reduce((price, item) => price + item.price, 0);
    }

    get VAT(): number {
        if (this.useLegacyRounding && this.areItemsIncludingVAT) {
            // Subtract VAT and round
            // Need to be careful with circular calls
            return this.getVATOnIncludingVATAmount(this.itemPrice);
        }

        return this.getVATOnExcludingVATAmount(this.priceWithoutVAT);
    }

    get priceWithVAT(): number {
        return this.priceWithoutVAT + this.VAT;
    }

    /**
     * How much to add or remove to priceWithVAT to get to the payable amount. We can get a rounding error of 1 cent positive or negative if we calculate from a given price inclusive VAT.
     *
     * 1 cent if we need to add 1 cent
     * -1 cent if we need to remove 1 cent from the priceWithVAT to get to the payable amount
     */
    get payableRoundingAmount() {
        return this.totalPrice - this.priceWithVAT;
    }

    get totalPrice() {
        const itemPrice = this.itemPrice;
        if (this.areItemsIncludingVAT) {
            return itemPrice;
        }
        return itemPrice + this.VAT;
    }
}
