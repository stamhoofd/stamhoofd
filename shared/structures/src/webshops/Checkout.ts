import { AutoEncoder, EnumDecoder, field } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
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

    get totalPrice() {
        return this.cart.price
    }

    validateCart(webshop: Webshop, organizationMeta: OrganizationMetaData) {
        if (this.cart.items.length == 0) {
            throw new SimpleError({
                code: "cart_empty",
                message: "Cart is empty",
                human: "Jouw winkelmandje is leeg",
                field: "cart"
            })
        }

        try {
            this.cart.validate(webshop)
        } catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                e.addNamespace("cart")
            }
            throw e
        }
    }

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

        if (webshop.meta.availableUntil && webshop.meta.availableUntil < new Date()) {
            throw new SimpleError({
                code: "closed",
                message: "Orders are closed",
                human: "Helaas! Je bent te laat. De bestellingen zijn gesloten.",
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
        if (this.customer.firstName.length < 2) {
            throw new SimpleError({
                code: "invalid_first_name",
                message: "Invalid first name",
                human: "Het voornaam dat je hebt opgegeven is ongeldig, corrigeer het voor je verder gaat.",
                field: "customer.firstName"
            })
        }

        if (this.customer.lastName.length < 2) {
            throw new SimpleError({
                code: "invalid_last_name",
                message: "Invalid last name",
                human: "Het achternaam dat je hebt opgegeven is ongeldig, corrigeer het voor je verder gaat.",
                field: "customer.lastName"
            })
        }

        if (this.customer.phone.length < 6) {
            throw new SimpleError({
                code: "invalid_phone",
                message: "Invalid phone",
                human: "Het GSM-nummer dat je hebt opgegeven is ongeldig, corrigeer het voor je verder gaat.",
                field: "customer.phone"
            })
        }

        const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        
        if (!regex.test(this.customer.email)) {
            throw new SimpleError({
                code: "invalid_email",
                message: "Invalid email",
                human: "Het e-mailadres dat je hebt opgegeven is ongeldig, corrigeer het voor je verder gaat.",
                field: "customer.email"
            })
        }
    }

    validatePayment(webshop: Webshop, organizationMeta: OrganizationMetaData) {
        if (!this.paymentMethod) {
            throw new SimpleError({
                code: "missing_payment_ethod",
                message: "Missing payment method",
                human: "Kies een betaalmethode",
                field: "paymentMethod"
            })
        }
        if (!webshop.meta.paymentMethods.includes(this.paymentMethod)) {
            throw new SimpleError({
                code: "missing_payment_ethod",
                message: "Missing payment method",
                human: "Deze betaalmethode is niet meer beschikbaar. Herlaad eventueel de pagina en probeer opnieuw.",
                field: "paymentMethod"
            })
        }
    }

    validate(webshop: Webshop, organizationMeta: OrganizationMetaData) {
        this.validateCart(webshop, organizationMeta)
        this.validateCheckoutMethod(webshop, organizationMeta)
        this.validateDeliveryAddress(webshop, organizationMeta)
        this.validateTimeSlot(webshop, organizationMeta)
        this.validateCustomer(webshop, organizationMeta)
        this.validatePayment(webshop, organizationMeta)
    }
}