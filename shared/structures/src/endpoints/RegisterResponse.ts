import { ArrayDecoder, AutoEncoder, Decoder, field, StringDecoder } from '@simonbackx/simple-encoding';

import { MembersBlob } from '../members/MemberWithRegistrationsBlob.js';
import { Payment } from '../members/Payment.js';
import { RegistrationWithMember } from '../members/RegistrationWithMember.js';

export class RegisterResponse extends AutoEncoder {
    @field({ decoder: Payment, nullable: true })
    payment: Payment | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 28 })
    paymentUrl: string | null = null;

    @field({ decoder: MembersBlob as Decoder<MembersBlob> })
    members: MembersBlob;

    @field({ decoder: new ArrayDecoder(RegistrationWithMember), version: 19 })
    registrations: RegistrationWithMember[] = [];
}
