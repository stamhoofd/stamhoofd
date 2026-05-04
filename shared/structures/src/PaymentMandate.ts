import { AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { PaymentProvider } from './PaymentProvider.js';

export enum PaymentMandateType {
    DirectDebit = 'DirectDebit',
    CreditCard = 'CreditCard' 
}

/**
 * The status of the mandate. A status can be pending for mandates when the first payment is not yet finalized, or when we did not received the IBAN yet from the first payment.
 */
export enum PaymentMandateStatus {
    Valid = 'Valid',
    Pending = 'Pending',
    Invalid = 'Invalid'
}

export class PaymentMandateDetails extends AutoEncoder {
    /**
     * Name of the card holder
     */
    @field({ decoder: StringDecoder, nullable: true })
    name: string | null = null

    /**
     * Full iban if direct debit
     */
    @field({ decoder: StringDecoder, nullable: true })
    iban: string | null = null

    /**
     * Last 4 digits if credit card
     */
    @field({ decoder: StringDecoder, nullable: true })
    cardNumber: string | null = null

    /**
     * Bic code for iban numbers
     */
    @field({ decoder: StringDecoder, nullable: true })
    bic: string | null = null

    // Card expiry date (timezone Brussels for now)
    @field({ decoder: DateDecoder, nullable: true })
    expiryDate: Date | null = null
    
    // Brand name: American Express Carta Si Carte Bleue Dankort Diners Club Discover JCB Laser Maestro Mastercard Unionpay Visa
    @field({ decoder: StringDecoder, nullable: true })
    brand: string | null = null
}

export class PaymentMandate extends AutoEncoder {
    /**
     * External mandate id of the provider.
     */
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: BooleanDecoder })
    isDefault = false;

    @field({ decoder: new EnumDecoder(PaymentMandateStatus) })
    status: PaymentMandateStatus

    @field({ decoder: new EnumDecoder(PaymentProvider) })
    provider: PaymentProvider;

    @field({ decoder: new EnumDecoder(PaymentMandateType) })
    type: PaymentMandateType

    @field({ decoder: PaymentMandateDetails })
    details: PaymentMandateDetails;

    @field({decoder: DateDecoder})
    createdAt: Date
}
