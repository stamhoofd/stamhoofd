import { AutoEncoder, EnumDecoder, field, IntegerDecoder } from "@simonbackx/simple-encoding";

import { MemberBalanceItem } from "../../BalanceItemDetailed";
import { PaymentMethod } from "../../PaymentMethod";
import { PriceBreakdown } from "../../PriceBreakdown";
import { PlatformFamily } from "../PlatformMember";
import { IDRegisterCart, RegisterCart } from "./RegisterCart";


export type RegisterContext = {
    family: PlatformFamily
}


export class IDRegisterCheckout extends AutoEncoder {
    @field({ decoder: IDRegisterCart })
    cart: IDRegisterCart = IDRegisterCart.create({})

    @field({ decoder: IntegerDecoder })
    administrationFee = 0

    @field({ decoder: IntegerDecoder })
    freeContribution = 0

    @field({ decoder: new EnumDecoder(PaymentMethod), nullable: true })
    paymentMethod: PaymentMethod | null = null

    hydrate(context: RegisterContext) {
        const checkout = new RegisterCheckout()
        checkout.cart = this.cart.hydrate(context)
        checkout.administrationFee = this.administrationFee
        checkout.freeContribution = this.freeContribution
        checkout.paymentMethod = this.paymentMethod
        return checkout
    }
}

export class RegisterCheckout{
    cart = new RegisterCart()
    administrationFee = 0;
    freeContribution = 0
    paymentMethod: PaymentMethod | null = null

    convert(): IDRegisterCheckout {
        return IDRegisterCheckout.create({
            cart: this.cart.convert(),
            administrationFee: this.administrationFee,
            freeContribution: this.freeContribution,
            paymentMethod: this.paymentMethod
        })
    }

    get paymentConfiguration() {
        return this.cart.paymentConfiguration
    }

    get singleOrganization() {
        return this.cart.singleOrganization
    }

    updatePrices() {
        this.cart.calculatePrices()
        this.administrationFee = this.paymentConfiguration?.administrationFee.calculate(this.cart.price) ?? 0
    }

    validate(data: {memberBalanceItems?: MemberBalanceItem[]}) {
        // todo
    }

    clear() {
        this.administrationFee = 0;
        this.freeContribution = 0;
        this.cart.items = []
        this.cart.balanceItems = []
    }

    get totalPrice() {
        return Math.max(0, this.cart.price + this.administrationFee + this.freeContribution)
    }

    get priceBreakown(): PriceBreakdown {
        const all = [
            {
                name: 'Administratiekost',
                price: this.administrationFee,
            },
            {
                name: 'Vrije bijdrage',
                price: this.freeContribution,
            }
        ].filter(a => a.price !== 0)

        if (all.length > 0) {
            all.unshift({
                name: 'Subtotaal',
                price: this.cart.price
            })
        }

        return [
            ...all,
            {
                name: 'Totaal',
                price: this.totalPrice
            }
        ];
    }

}
