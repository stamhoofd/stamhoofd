import { ArrayDecoder,field } from '@simonbackx/simple-encoding';

import { Payment } from './Payment';
import { RegistrationWithMember } from './RegistrationWithMember';

export class PaymentWithRegistrations extends Payment {
    @field({ decoder: new ArrayDecoder(RegistrationWithMember) })
    registrations: RegistrationWithMember[]
}