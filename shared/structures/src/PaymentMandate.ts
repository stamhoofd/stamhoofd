import { AutoEncoder } from '@simonbackx/simple-encoding';
import { PaymentProvider } from './PaymentProvider.js';

export class PaymentMandate extends AutoEncoder {
    /**
     * External mandate id of the provider
     */
    id: string;

    /**
     * Provider that was used for this mandate
     */
    provider: PaymentProvider;

    // todo: mandate type (creditcard or SEPA)
    // todo: mandate identification (last4, card type...)
}
