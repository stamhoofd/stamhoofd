import { ArrayDecoder,AutoEncoder, BooleanDecoder,EnumDecoder,field, StringDecoder } from '@simonbackx/simple-encoding';

import { PaymentMethod } from '../PaymentMethod';

export class RegisterMember extends AutoEncoder {
    @field({ decoder: StringDecoder })
    memberId: string

    @field({ decoder: StringDecoder })
    groupId: string

    @field({ decoder: BooleanDecoder })
    reduced: boolean
}

export class RegisterMembers extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(RegisterMember) })
    members: RegisterMember[]

    @field({ decoder: new EnumDecoder(PaymentMethod) })
    paymentMethod: PaymentMethod
}