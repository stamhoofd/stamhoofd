import { ArrayDecoder,field } from '@simonbackx/simple-encoding';

import { Payment } from './Payment';
import { RegistrationWithMember } from './RegistrationWithMember';


export class PaymentDetailed extends Payment {
    @field({ decoder: new ArrayDecoder(RegistrationWithMember) })
    registrations: RegistrationWithMember[]

    getMemberNames() {
        return this.registrations.map(r => r.member.details?.name ?? "Onbekend").join(", ")
    }
}