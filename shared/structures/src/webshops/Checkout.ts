import { ArrayDecoder, AutoEncoder, BooleanDecoder, EnumDecoder, field, NumberDecoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';

import { ValidatedAddress } from '../addresses/Address';
import { I18n } from '../I18nInterface';
import { OrganizationMetaData } from '../OrganizationMetaData';
import { PaymentMethod } from '../PaymentMethod';
import { Cart } from './Cart';
import { Customer } from './Customer';
import { Webshop } from './Webshop';
import { WebshopFieldAnswer } from './WebshopField';
import { AnyCheckoutMethodDecoder, CheckoutMethod, CheckoutMethodType, WebshopDeliveryMethod, WebshopTimeSlot } from './WebshopMetaData';

export class Checkout extends AutoEncoder {
    @field({ decoder: WebshopTimeSlot, nullable: true })
    timeSlot: WebshopTimeSlot | null = null
    
    @field({ decoder: AnyCheckoutMethodDecoder, nullable: true })
    checkoutMethod: CheckoutMethod | null = null

    /**
     * Only needed for delivery
     */
    @field({ decoder: ValidatedAddress, nullable: true })
    address: ValidatedAddress | null = null

    @field({ decoder: Customer, version: 40 })
    customer: Customer = Customer.create({})

    @field({ decoder: new ArrayDecoder(WebshopFieldAnswer), version: 94 })
    fieldAnswers: WebshopFieldAnswer[] = []

    @field({ decoder: Cart })
    cart: Cart = Cart.create({})

    @field({ decoder: new EnumDecoder(PaymentMethod), nullable: true })
    paymentMethod: PaymentMethod | null = null

    /**
     * Number of persons we did reserve in webshop time slots (and maybe future other maximums)
     */
    @field({ decoder: NumberDecoder, version: 143 })
    reservedPersons = 0;

    /**
     * Whether we reserved order stock in webshop time slots (and maybe future other maximums)
     */
    @field({ decoder: BooleanDecoder, version: 143 })
    reservedOrder = false;

    get paymentContext(): null | "takeout" | "delivery" {
        if (this.checkoutMethod?.type == CheckoutMethodType.Takeout) {
            return "takeout"
        }
        if (this.checkoutMethod?.type == CheckoutMethodType.Delivery) {
            return "delivery"
        }
        return null
    }

    get deliveryPrice() {
        if (!this.checkoutMethod || this.checkoutMethod.type != CheckoutMethodType.Delivery) {
            return 0;
        }

        if (!(this.checkoutMethod instanceof WebshopDeliveryMethod)) {
            // will throw in validation
            return 0;
        }

        if (this.checkoutMethod.price.minimumPrice !== null && this.cart.price >= this.checkoutMethod.price.minimumPrice) {
            return this.checkoutMethod.price.discountPrice
        }

        return this.checkoutMethod.price.price
    }

    get totalPrice() {
        return this.cart.price + this.deliveryPrice
    }

    validateAnswers(webshop: Webshop) {
        const newAnswers: WebshopFieldAnswer[] = []
        for (const field of webshop.meta.customFields) {
            const answer = this.fieldAnswers.find(a => a.field.id === field.id)

            try {
                if (!answer) {
                    const a = WebshopFieldAnswer.create({ field, answer: "" })
                    a.validate()
                    newAnswers.push(a)
                } else {
                    answer.field = field
                    answer.validate()
                    newAnswers.push(answer)
                }
            } catch (e) {
                if (isSimpleError(e) || isSimpleErrors(e)) {
                    e.addNamespace("fieldAnswers."+field.id)
                }
                throw e
            }
            
        }
        this.fieldAnswers = newAnswers
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

        if (webshop.meta.availableUntil && webshop.meta.availableUntil < new Date()) {
            throw new SimpleError({
                code: "closed",
                message: "Orders are closed",
                human: "Helaas! Je bent te laat. De bestellingen zijn gesloten.",
            })
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

        this.checkoutMethod = checkoutMethod
    }

    validateDeliveryAddress(webshop: Webshop, organizationMeta: OrganizationMetaData) {
        if (!this.checkoutMethod || this.checkoutMethod.type != CheckoutMethodType.Delivery) {
            this.address = null;
            return;
        }

        if (!(this.checkoutMethod instanceof WebshopDeliveryMethod)) {
            throw new SimpleError({
                code: "invalid_data_type",
                message: "Invalid data type",
                human: "Er ontbreekt data. Probeer het opnieuw of neem contact op met de webshop eigenaar om dit te melden.",
                field: "address"
            })
        }

        if (!this.address) {
             throw new SimpleError({
                code: "missing_address",
                message: "Checkout address is invalid",
                human: "Een leveringsadres is noodzakelijk, herlaad de pagina opnieuw en vul een leveringsadres in.",
                field: "address"
            })
        }

        // Check country
        if (this.checkoutMethod.countries.includes(this.address.country)) {
            return
        }

        if (this.checkoutMethod.provinces.map(p => p.id).includes(this.address.provinceId)) {
            return
        }

        if (this.checkoutMethod.cities.map(c => c.id).includes(this.address.cityId)) {
            return
        }

        if (this.address.parentCityId && this.checkoutMethod.cities.map(c => c.id).includes(this.address.parentCityId)) {
            return
        }

        throw new SimpleError({
            code: "region_not_supported",
            message: "Region not supported",
            human: "We leveren jammer genoeg niet op dit adres.",
            field: "address"
        })
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

        // Check maximum
        if (!this.reservedOrder && timeSlot.remainingOrders === 0) {
            throw new SimpleError({
                code: "timeslot_full",
                message: "Timeslot has reached maximum orders",
                human: "Het gekozen tijdstip is helaas volzet. Kies een ander tijdstip indien mogelijk.",
                field: "timeSlot"
            })
        }

        // Check maximum
        if (timeSlot.remainingPersons !== null && this.cart.persons - this.reservedPersons > timeSlot.remainingPersons) {
            const remaingPersons = timeSlot.remainingPersons
            if (remaingPersons === 0) {
                throw new SimpleError({
                    code: "timeslot_full",
                    message: "Timeslot has reached maximum orders",
                    human: "Het gekozen tijdstip is helaas volzet. Kies een ander tijdstip indien mogelijk.",
                    field: "timeSlot"
                })
            }
            throw new SimpleError({
                code: "timeslot_full",
                message: "Timeslot has reached maximum persons",
                human: "Er "+(remaingPersons != 1 ? "zijn" : "is")+" nog maar "+remaingPersons+" "+(remaingPersons != 1 ? "plaatsen" : "plaats")+" vrij op het gekozen tijdstip. Jouw mandje is voor " + this.cart.persons + " "+(this.cart.persons != 1 ? "personen" : "persoon")+". Kies een ander tijdstip indien mogelijk.",
                field: "timeSlot"
            })
        }


        this.timeSlot = timeSlot
    }

    validateCustomer(webshop: Webshop, organizationMeta: OrganizationMetaData, i18n: I18n) {
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
                human: i18n.t('webshop.inputs.phone.invalidMessage').toString(),
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

        this.validateAnswers(webshop)
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

    validate(webshop: Webshop, organizationMeta: OrganizationMetaData, i18n: I18n) {
        this.validateCart(webshop, organizationMeta)
        this.validateCheckoutMethod(webshop, organizationMeta)
        this.validateDeliveryAddress(webshop, organizationMeta)
        this.validateTimeSlot(webshop, organizationMeta)
        this.validateCustomer(webshop, organizationMeta, i18n)

        if (this.totalPrice != 0) {
            this.validatePayment(webshop, organizationMeta)
        }
    }


    /**
     * Convenience mapper
     */
    get deliveryMethod() {
        if (!this.checkoutMethod || this.checkoutMethod.type != CheckoutMethodType.Delivery) {
            return null;
        }

        if (!(this.checkoutMethod instanceof WebshopDeliveryMethod)) {
            // will throw in validation
            return null;
        }

        return this.checkoutMethod
    }
}