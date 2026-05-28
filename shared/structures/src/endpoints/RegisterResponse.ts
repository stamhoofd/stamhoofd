import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

import { MembersBlob } from '../members/MemberWithRegistrationsBlob.js';
import { PaymentGeneral } from '../members/PaymentGeneral.js';
import { RegistrationWithTinyMember } from '../members/RegistrationWithTinyMember.js';

export class RegisterResponse extends AutoEncoder {
    @field({ decoder: PaymentGeneral, nullable: true })
    payment: PaymentGeneral | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 28 })
    paymentUrl: string | null = null;

    /**
     * Data to put in a QR-code
     */
    @field({ decoder: StringDecoder, nullable: true, optional: true })
    paymentQRCode: string | null = null;

    @field({ decoder: MembersBlob as Decoder<MembersBlob> })
    members: MembersBlob;

    @field({ decoder: new ArrayDecoder(RegistrationWithTinyMember), version: 19 })
    registrations: RegistrationWithTinyMember[] = [];
}
