import { ArrayDecoder, field } from '@simonbackx/simple-encoding';

import { Payment } from './Payment.js';
import { RegistrationWithMember } from './RegistrationWithMember.js';

export class PaymentWithRegistrations extends Payment {
    @field({ decoder: new ArrayDecoder(RegistrationWithMember) })
    registrations: RegistrationWithMember[];
}
