import { ArrayDecoder, AutoEncoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";

import { PaymentMethod } from "./PaymentMethod";
import { TransferSettings } from "./webshops/TransferSettings";

export class PayconiqAccount extends AutoEncoder {
    /**
     * Internal reference (update/delete/...)
     */
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    apiKey: string

    @field({ decoder: StringDecoder, nullable: true })
    merchantId: string|null = null

    @field({ decoder: StringDecoder, nullable: true })
    profileId: string|null = null

    @field({ decoder: StringDecoder, nullable: true })
    name: string|null = null

    @field({ decoder: StringDecoder, nullable: true })
    iban: string|null = null

    @field({ decoder: StringDecoder, nullable: true })
    callbackUrl: string|null = null
}

/**
 * Should remain private
 */
export class PrivatePaymentConfiguration extends AutoEncoder {
    /**
     * Warning: internal id is used instead of the stripe id
     */
    @field({ decoder: StringDecoder, nullable: true, version: 174 })
    stripeAccountId: string | null = null
}

export class AdministrationFeeSettings extends AutoEncoder {
    /**
     * In permyriad (‱) 0 - 10000 (= 100)
     */
    @field({ decoder: IntegerDecoder })
    percentage = 0

    /**
     * In cents
     */
    @field({ decoder: IntegerDecoder })
    fixed = 0

    calculate(price: number) {
        return Math.round(price * this.percentage / 10000) + this.fixed
    }

    isEqual(other: AdministrationFeeSettings) {
        return this.percentage === other.percentage && this.fixed === other.fixed
    }

    isZero() {
        return this.percentage === 0 && this.fixed === 0
    }
}

export class PaymentConfiguration extends AutoEncoder {
    @field({ decoder: TransferSettings })
    transferSettings = TransferSettings.create({})

    @field({ decoder: new ArrayDecoder(new EnumDecoder(PaymentMethod)) })
    paymentMethods: PaymentMethod[] = []

    @field({ decoder: AdministrationFeeSettings })
    administrationFee = AdministrationFeeSettings.create({})
}
