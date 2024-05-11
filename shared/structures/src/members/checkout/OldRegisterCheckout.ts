import { AutoEncoder, EnumDecoder, field } from '@simonbackx/simple-encoding';

// eslint bug marks types as "unused"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Organization } from '../../Organization';
import { PaymentMethod } from '../../PaymentMethod';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MemberWithRegistrations } from '../MemberWithRegistrations';
import { OldIDRegisterCart, OldRegisterCart } from './OldRegisterCart';


/**
 * Contains all information about a given checkout
 */
export class OldRegisterCheckout {
    cart = new OldRegisterCart()
    paymentMethod = PaymentMethod.Unknown

    convert(): OldIDRegisterCheckout {
        return OldIDRegisterCheckout.create(Object.assign({}, this, {
            cart: this.cart.convert(),
        }))
    }
}


/**
 * Contains all information about a given checkout
 */
export class OldIDRegisterCheckout extends AutoEncoder {
    @field({ decoder: OldIDRegisterCart })
    cart = OldIDRegisterCart.create({})

    @field({ decoder: new EnumDecoder(PaymentMethod) })
    paymentMethod = PaymentMethod.Unknown

    convert(organization: Organization, members: MemberWithRegistrations[]): OldRegisterCheckout {
        const checkout = new OldRegisterCheckout()
        checkout.cart = this.cart.convert(organization, members)
        checkout.paymentMethod = this.paymentMethod
        return checkout
    }
}



