import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

import { Payment } from '../members/Payment.js';
import { Invoice } from '../billing/Invoice.js';

/**
 * If needed, you can extend this class to add extra fields in custom checkout flows.
 */
export class CheckoutResponse extends AutoEncoder {
    /**
     * Used for polling the payment status or showing transfer instructions.
     * Also used for showing a summary on the success page.
     */
    @field({ decoder: Payment, nullable: true })
    payment: Payment | null = null;

    /**
     * If an invoice is available and created, it will be set here already.
     * When asked for a pro forma invoice, this will be set.
     */
    @field({ decoder: Invoice, nullable: true })
    invoice: Invoice | null = null;

    /**
     * External page to finish the payment
     */
    @field({ decoder: StringDecoder, nullable: true })
    paymentUrl: string | null = null;

    /**
     * Data to put in a QR-code (alternative for the paymentUrl)
     * E.g. Payconiq/Wero payment QR-code
     */
    @field({ decoder: StringDecoder, nullable: true })
    paymentQRCode: string | null = null;
}
