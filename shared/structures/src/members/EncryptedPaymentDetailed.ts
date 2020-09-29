import { ArrayDecoder,field } from '@simonbackx/simple-encoding';

import { Payment } from './Payment';
import { RegistrationWithEncryptedMember } from './RegistrationWithEncryptedMember';


export class EncryptedPaymentDetailed extends Payment {
    @field({ decoder: new ArrayDecoder(RegistrationWithEncryptedMember) })
    registrations: RegistrationWithEncryptedMember[]
}