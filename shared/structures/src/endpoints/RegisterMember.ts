import { ArrayDecoder,AutoEncoder, BooleanDecoder,EnumDecoder,field, StringDecoder } from '@simonbackx/simple-encoding';

import { PaymentMethod } from '../PaymentMethod';

/**
 * @deprecated
 */
export class RegisterMember extends AutoEncoder {
    @field({ decoder: StringDecoder })
    memberId: string

    @field({ decoder: StringDecoder })
    groupId: string

    @field({ decoder: BooleanDecoder })
    reduced: boolean

    /**
     * Set to true to put a member on the waiting list instead of registering it. Please note that the value of this property is validated. You cannot register a new member when waiting lists are enabled
     */
    @field({ decoder: BooleanDecoder, version: 16 })
    waitingList = false
}

/**
 * @deprecated
 */
export class RegisterMembers extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(RegisterMember) })
    members: RegisterMember[]

    @field({ decoder: new EnumDecoder(PaymentMethod) })
    paymentMethod: PaymentMethod
}