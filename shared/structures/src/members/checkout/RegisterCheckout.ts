import { AutoEncoder, EnumDecoder, field } from '@simonbackx/simple-encoding';

// eslint bug marks types as "unused"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Organization } from '../../Organization';
import { PaymentMethod } from '../../PaymentMethod';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MemberWithRegistrations } from '../MemberWithRegistrations';
import { IDRegisterCart, RegisterCart } from './RegisterCart';


/**
 * Contains all information about a given checkout
 */
export class RegisterCheckout {
    cart = new RegisterCart()
    paymentMethod = PaymentMethod.Unknown

    convert(): IDRegisterCheckout {
        return IDRegisterCheckout.create(Object.assign({}, this, {
            cart: this.cart.convert(),
        }))
    }
}


/**
 * Contains all information about a given checkout
 */
export class IDRegisterCheckout extends AutoEncoder {
    @field({ decoder: IDRegisterCart })
    cart = IDRegisterCart.create({})

    @field({ decoder: new EnumDecoder(PaymentMethod) })
    paymentMethod = PaymentMethod.Unknown

    convert(organization: Organization, members: MemberWithRegistrations[]): RegisterCheckout {
        const checkout = new RegisterCheckout()
        checkout.cart = this.cart.convert(organization, members)
        checkout.paymentMethod = this.paymentMethod
        return checkout
    }
}



