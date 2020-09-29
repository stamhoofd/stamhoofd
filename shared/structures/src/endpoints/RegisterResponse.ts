import { ArrayDecoder,AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

import { EncryptedMemberWithRegistrations } from '../members/EncryptedMemberWithRegistrations';
import { Payment } from '../members/Payment';
import { RegistrationWithEncryptedMember } from '../members/RegistrationWithEncryptedMember';

export class RegisterResponse extends AutoEncoder {
    @field({ decoder: Payment, nullable: true })
    payment: Payment | null = null

    @field({ decoder: StringDecoder, nullable: true, version: 28 })
    paymentUrl: string | null = null

    @field({ decoder: new ArrayDecoder(EncryptedMemberWithRegistrations) })
    members: EncryptedMemberWithRegistrations[] = []

    @field({ decoder: new ArrayDecoder(RegistrationWithEncryptedMember), version: 19 })
    registrations: RegistrationWithEncryptedMember[] = []
}