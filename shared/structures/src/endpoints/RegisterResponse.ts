import { ArrayDecoder,AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

import { MemberWithRegistrationsBlob } from '../members/MemberWithRegistrationsBlob';
import { Payment } from '../members/Payment';
import { RegistrationWithMember } from '../members/RegistrationWithMember';

export class RegisterResponse extends AutoEncoder {
    @field({ decoder: Payment, nullable: true })
    payment: Payment | null = null

    @field({ decoder: StringDecoder, nullable: true, version: 28 })
    paymentUrl: string | null = null

    @field({ decoder: new ArrayDecoder(MemberWithRegistrationsBlob) })
    members: MemberWithRegistrationsBlob[] = []

    @field({ decoder: new ArrayDecoder(RegistrationWithMember), version: 19 })
    registrations: RegistrationWithMember[] = []
}
