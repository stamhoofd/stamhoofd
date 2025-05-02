import { ArrayDecoder, field } from '@simonbackx/simple-encoding';

import { Payment } from './Payment.js';
import { RegistrationWithTinyMember } from './RegistrationWithTinyMember.js';

export class PaymentWithRegistrations extends Payment {
    @field({ decoder: new ArrayDecoder(RegistrationWithTinyMember) })
    registrations: RegistrationWithTinyMember[];
}
