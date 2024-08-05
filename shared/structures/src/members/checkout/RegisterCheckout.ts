import { AutoEncoder, EnumDecoder, field, IntegerDecoder, StringDecoder, URLDecoder } from "@simonbackx/simple-encoding";

import { MemberBalanceItem } from "../../BalanceItemDetailed";
import { Group } from "../../Group";
import { Organization } from "../../Organization";
import { PaymentMethod } from "../../PaymentMethod";
import { PriceBreakdown } from "../../PriceBreakdown";
import { PlatformMember } from "../PlatformMember";
import { IDRegisterCart, RegisterCart } from "./RegisterCart";
import { RegisterItem } from "./RegisterItem";
import { RegistrationWithMember } from "../RegistrationWithMember";

export type RegisterContext = {
    members: PlatformMember[],
    groups: Group[],
    organizations: Organization[]
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

    /**
     * The link we'll redirect the user back too after the payment page (either succeeded or failed!)
     * The id query param will be appended with the payment id
     */
    @field({ decoder: new URLDecoder({allowedProtocols: ['https:']}), nullable: true })
    redirectUrl: URL|null = null
    
    /**
     * The link we'll redirect the user back too after the user canceled a payment (not supported for all payment methods)
     * The id query param will be appended with the payment id
     */
    @field({ decoder: new URLDecoder({allowedProtocols: ['https:']}), nullable: true })
    cancelUrl: URL|null = null

    /**
     * Register these members as the organization
     */
    @field({ decoder: StringDecoder, nullable: true })
    asOrganizationId: string | null = null

    /**
     * Cached price so we can detect inconsistencies between frontend and backend
     */
    @field({ decoder: IntegerDecoder, nullable: true })
    totalPrice: number | null = null

    hydrate(context: RegisterContext) {
        const checkout = new RegisterCheckout()
        checkout.cart = this.cart.hydrate(context)
        checkout.administrationFee = this.administrationFee
        checkout.freeContribution = this.freeContribution
        checkout.paymentMethod = this.paymentMethod
        checkout.asOrganizationId = this.asOrganizationId
        return checkout
    }
}

export class RegisterCheckout{
    cart = new RegisterCart()
    administrationFee = 0;
    freeContribution = 0
    paymentMethod: PaymentMethod | null = null
    asOrganizationId: string | null = null

    // Default hint for empty carts to know the organization to use
    defaultOrganization: Organization | null = null

    convert(): IDRegisterCheckout {
        return IDRegisterCheckout.create({
            cart: this.cart.convert(),
            administrationFee: this.administrationFee,
            freeContribution: this.freeContribution,
            paymentMethod: this.paymentMethod,
            totalPrice: this.totalPrice,
            asOrganizationId: this.asOrganizationId
        })
    }

    get paymentConfiguration() {
        return this.cart.paymentConfiguration
    }

    get singleOrganization() {
        return this.cart.singleOrganization ?? this.defaultOrganization
    }

    setDefaultOrganization(organization: Organization|null) {
        this.defaultOrganization = organization
    }

    get isAdminFromSameOrganization() {
        return !!this.asOrganizationId && this.asOrganizationId === this.singleOrganization?.id
    }

    add(item: RegisterItem, options?: {calculate?: boolean}) {
        this.cart.add(item)

        if (options?.calculate !== false) {
            this.updatePrices()
        }
    }

    remove(item: RegisterItem, options?: {calculate?: boolean}) {
        this.cart.remove(item)

        if (options?.calculate !== false) {
            this.updatePrices()
        }
    }

    removeMemberAndGroup(memberId: string, groupId: string, options?: {calculate?: boolean}) {
        this.cart.removeMemberAndGroup(memberId, groupId)
        if (options?.calculate !== false) {
            this.updatePrices()
        }
    }

    removeRegistration(registration: RegistrationWithMember, options?: {calculate?: boolean}) {
        this.cart.removeRegistration(registration)
        if (options?.calculate !== false) {
            this.updatePrices()
        }
    }

    unremoveRegistration(registration: RegistrationWithMember, options?: {calculate?: boolean}) {
        this.cart.unremoveRegistration(registration)
        if (options?.calculate !== false) {
            this.updatePrices()
        }
    }

    updatePrices() {
        this.cart.calculatePrices()

        if (this.isAdminFromSameOrganization) {
            this.administrationFee = 0;
        } else {
            this.administrationFee = this.paymentConfiguration?.administrationFee.calculate(this.cart.price) ?? 0
        }
    }

    validate(data: {memberBalanceItems?: MemberBalanceItem[]}) {
        this.cart.validate()

        // todo: validate more data
    }

    clear() {
        this.administrationFee = 0;
        this.freeContribution = 0;
        this.cart.items = []
        this.cart.balanceItems = []
        this.cart.deleteRegistrations = []
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
