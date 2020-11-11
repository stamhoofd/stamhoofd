import { AutoEncoder, EnumDecoder, field } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Formatter } from '@stamhoofd/utility';

import { Address } from '../Address';
import { OrganizationMetaData } from '../OrganizationMetaData';
import { PaymentMethod } from '../PaymentMethod';
import { Cart } from './Cart';
import { Customer } from './Customer';
import { Webshop } from './Webshop';
import { AnyCheckoutMethodDecoder, CheckoutMethod, CheckoutMethodType, WebshopTimeSlot } from './WebshopMetaData';

export class Checkout extends AutoEncoder {
    @field({ decoder: WebshopTimeSlot, nullable: true })
    timeSlot: WebshopTimeSlot | null = null
    
    @field({ decoder: AnyCheckoutMethodDecoder, nullable: true })
    checkoutMethod: CheckoutMethod | null = null

    /**
     * Only needed for delivery
     */
    @field({ decoder: Address, nullable: true })
    address: Address | null = null

    /**
     * Only needed for delivery
     */
    @field({ decoder: Customer, version: 40 })
    customer: Customer = Customer.create({})

    @field({ decoder: Cart })
    cart: Cart = Cart.create({})

    @field({ decoder: new EnumDecoder(PaymentMethod), nullable: true })
    paymentMethod: PaymentMethod | null = null

    validateCheckoutMethod(webshop: Webshop, organizationMeta: OrganizationMetaData) {
        if (this.checkoutMethod == null) {
            if (webshop.meta.checkoutMethods.length > 0) {
                throw new SimpleError({
                    code: "missing_checkout_method",
                    message: "Checkout method is required",
                    human: "Er zijn enkele instellingen gewijzigd terwijl je aan het bestellen was. Herlaad de pagina en probeer opnieuw.",
                    field: "checkoutMethod"
                })
            }
            return
        }

        const current = this.checkoutMethod
        const checkoutMethod = webshop.meta.checkoutMethods.find(m => m.id == current.id)

        if (!checkoutMethod) {
            throw new SimpleError({
                code: "invalid_checkout_method",
                message: "Checkout method is invalid",
                human: "Er zijn enkele instellingen gewijzigd terwijl je aan het bestellen was. Herlaad de pagina en probeer opnieuw.",
                field: "checkoutMethod"
            })
        }

        this.checkoutMethod = checkoutMethod
    }

    validateDeliveryAddress(webshop: Webshop, organizationMeta: OrganizationMetaData) {
        if (!this.checkoutMethod || this.checkoutMethod.type != CheckoutMethodType.Delivery) {
            this.address = null;
            return;
        }
        if (!this.address) {
             throw new SimpleError({
                code: "missing_address",
                message: "Checkout address is invalid",
                human: "Een leveringsadres is noodzakelijk, herlaad de pagina opnieuw en vul een leveringsadres in.",
                field: "address"
            })
        }
    }

    validateTimeSlot(webshop: Webshop, organizationMeta: OrganizationMetaData) {
        if (!this.checkoutMethod || this.checkoutMethod.timeSlots.timeSlots.length == 0) {
            this.timeSlot = null;
            return;
        }

        if (!this.timeSlot) {
             throw new SimpleError({
                code: "missing_timeslot",
                message: "Checkout timeslot is missings",
                human: "Kies een tijdstip, herlaad de pagina opnieuw en maak een keuze.",
                field: "timeSlot"
            })
        }
        
        const current = this.timeSlot
        const timeSlot = this.checkoutMethod.timeSlots.timeSlots.find(s => s.id == current.id)
        
        if (!timeSlot) {
             throw new SimpleError({
                code: "invalid_timeslot",
                message: "Checkout timeslot is invalid",
                human: "Het afhaaltijdstip dat je had gekozen werd gewijzigd terwijl je aan het bestellen was, kies een nieuw tijdstip.",
                field: "timeSlot"
            })
        }
        this.timeSlot = timeSlot
    }

    validateCustomer(webshop: Webshop, organizationMeta: OrganizationMetaData) {

    }

    validatePayment(webshop: Webshop, organizationMeta: OrganizationMetaData) {

    }

    validate(webshop: Webshop, organizationMeta: OrganizationMetaData) {
        this.validateCheckoutMethod(webshop, organizationMeta)
        this.validateDeliveryAddress(webshop, organizationMeta)
        this.validateTimeSlot(webshop, organizationMeta)
        this.validateCustomer(webshop, organizationMeta)
        this.validatePayment(webshop, organizationMeta)
    }
}