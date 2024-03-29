import { ArrayDecoder, AutoEncoder, BooleanDecoder, EnumDecoder, field, IntegerDecoder, NumberDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from "uuid";

import { ValidatedAddress } from '../addresses/Address';
import { ChoicesFilterChoice, ChoicesFilterDefinition, ChoicesFilterMode } from '../filters/ChoicesFilter';
import { FilterDefinition } from '../filters/FilterDefinition';
import { I18n } from '../I18nInterface';
import { RecordAnswer, RecordAnswerDecoder } from '../members/records/RecordAnswer';
import { RecordCategory } from '../members/records/RecordCategory';
import { OrganizationMetaData } from '../OrganizationMetaData';
import { PaymentMethod } from '../PaymentMethod';
import { User } from '../User';
import { Cart } from './Cart';
import { Customer } from './Customer';
import { Webshop, WebshopPreview } from './Webshop';
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

    @field({ decoder: new ArrayDecoder(RecordAnswerDecoder), optional: true })
    recordAnswers: RecordAnswer[] = []

    @field({ decoder: Cart })
    cart: Cart = Cart.create({})

    @field({ decoder: new EnumDecoder(PaymentMethod), nullable: true })
    paymentMethod: PaymentMethod | null = null

    @field({ decoder: IntegerDecoder, version: 207 })
    administrationFee = 0;

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
        return this.cart.price + this.deliveryPrice + this.administrationFee
    }

    get totalPriceWithoutAdministrationFee() {
        return this.totalPrice - this.administrationFee
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

    validateCart(webshop: Webshop, organizationMeta: OrganizationMetaData, asAdmin = false) {
        if (this.cart.items.length == 0) {
            throw new SimpleError({
                code: "cart_empty",
                message: "Cart is empty",
                human: "Jouw winkelmandje is leeg",
                field: "cart"
            })
        }

        try {
            this.cart.validate(webshop, asAdmin)
        } catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                e.addNamespace("cart")
            }
            throw e
        }

        if (!asAdmin && webshop.meta.availableUntil && webshop.meta.availableUntil < new Date()) {
            throw new SimpleError({
                code: "closed",
                message: "Orders are closed",
                human: "Helaas! Je bent te laat. De bestellingen zijn gesloten.",
            })
        }

        if (!asAdmin && webshop.meta.openAt && webshop.meta.openAt > new Date()) {
            throw new SimpleError({
                code: "closed",
                message: "Orders are closed",
                human: "Nog even geduld. Bestellen kan vanaf " + Formatter.dateTime(webshop.meta.openAt) + ".",
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
            if (webshop.meta.checkoutMethods.length === 0) {
                this.checkoutMethod = null
                return
            }
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
        const availableTimeslots = this.checkoutMethod.timeSlots.timeSlots.length
        
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
                human: (availableTimeslots !=1 ? "Het gekozen tijdstip is helaas volzet. Kies een ander tijdstip indien mogelijk." : "Het evenement is helaas volzet. We aanvaarden geen verdere bestellingen."),
                field: "timeSlot"
            })
        }

        // Check maximum
        if (timeSlot.remainingPersons !== null && this.cart.persons - this.reservedPersons > timeSlot.remainingPersons) {
            const remainingPersons = timeSlot.remainingPersons
            if (remainingPersons === 0) {
                throw new SimpleError({
                    code: "timeslot_full",
                    message: "Timeslot has reached maximum orders",
                    human: (availableTimeslots !=1 ? "Het gekozen tijdstip is helaas volzet. Kies een ander tijdstip indien mogelijk." : "Het evenement is helaas volzet. We aanvaarden geen verdere bestellingen."),
                    field: "timeSlot"
                })
            }
            throw new SimpleError({
                code: "timeslot_full",
                message: "Timeslot has reached maximum persons",
                human: "Er "+(remainingPersons != 1 ? "zijn" : "is")+" nog maar "+remainingPersons+" "+(remainingPersons != 1 ? "plaatsen" : "plaats")+" vrij "+(availableTimeslots !=1 ? "op het gekozen tijdstip" : "voor dit evenement")+". Jouw mandje is voor " + this.cart.persons + " "+(this.cart.persons != 1 ? "personen" : "persoon")+(availableTimeslots !=1 ? ". Kies een ander tijdstip indien mogelijk." : ""),
                field: "timeSlot"
            })
        }


        this.timeSlot = timeSlot
    }

    validateCustomer(webshop: Webshop, organizationMeta: OrganizationMetaData, i18n: I18n, asAdmin = false, user: User | null = null) {
        if (user) {
            if (user.firstName) {
                this.customer.firstName = user.firstName
            }
            if (user.lastName) {
                this.customer.lastName = user.lastName
            }
            this.customer.email = user.email
        }

        if (this.customer.firstName.length < 2) {
            throw new SimpleError({
                code: "invalid_first_name",
                message: "Invalid first name",
                human: "De voornaam die je hebt opgegeven is ongeldig, corrigeer het voor je verder gaat.",
                field: "customer.firstName"
            })
        }

        if (this.customer.lastName.length < 2) {
            throw new SimpleError({
                code: "invalid_last_name",
                message: "Invalid last name",
                human: "De achternaam die je hebt opgegeven is ongeldig, corrigeer het voor je verder gaat.",
                field: "customer.lastName"
            })
        }

        if (webshop.meta.phoneEnabled) {
            if (this.customer.phone.length < 6 && !asAdmin) {
                throw new SimpleError({
                    code: "invalid_phone",
                    message: "Invalid phone",
                    human: i18n.t('shared.inputs.mobile.invalidMessage').toString(),
                    field: "customer.phone"
                })
            }
        } else {
            this.customer.phone = ""
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
                code: "missing_payment_method",
                message: "Missing payment method",
                human: "Kies een betaalmethode",
                field: "paymentMethod"
            })
        }
        if (!webshop.meta.paymentMethods.includes(this.paymentMethod)) {
            throw new SimpleError({
                code: "invalid_payment_method",
                message: "Invalid payment method",
                human: "Deze betaalmethode is niet meer beschikbaar. Herlaad eventueel de pagina en probeer opnieuw.",
                field: "paymentMethod"
            })
        }
    }

    validateRecordAnswersFor(webshop: Webshop, category: RecordCategory) {
        RecordCategory.validate([category], this.recordAnswers, this, Checkout.getFilterDefinitions(webshop, webshop.meta.recordCategories), true)
    }

    validateRecordAnswers(webshop: Webshop) {
        const answers = RecordCategory.validate(webshop.meta.recordCategories, this.recordAnswers, this, Checkout.getFilterDefinitions(webshop, webshop.meta.recordCategories), true)
        this.recordAnswers = answers
    }

    updateAdministrationFee(webshop: Webshop) {
        this.administrationFee = webshop.meta.paymentConfiguration.administrationFee.calculate(this.totalPriceWithoutAdministrationFee)
    }

    update(webshop: Webshop) {
        this.updateAdministrationFee(webshop)
    }

    validate(webshop: Webshop, organizationMeta: OrganizationMetaData, i18n: I18n, asAdmin = false, user: User | null = null) {
        try {
            this.validateCart(webshop, organizationMeta, asAdmin)
        
            this.validateCheckoutMethod(webshop, organizationMeta)
            this.validateDeliveryAddress(webshop, organizationMeta)
            this.validateTimeSlot(webshop, organizationMeta)
            this.validateCustomer(webshop, organizationMeta, i18n, asAdmin, user)
            this.validateRecordAnswers(webshop)

            if (this.totalPrice !== 0 && !asAdmin) {
                this.validatePayment(webshop, organizationMeta)
            } else if (this.totalPrice === 0) {
                this.paymentMethod = PaymentMethod.Unknown
            }
        } finally {
            this.update(webshop)
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

    static getFilterDefinitions(webshop: Webshop, categories: RecordCategory[]): FilterDefinition<Checkout>[] {
        const filters = RecordCategory.getRecordCategoryDefinitions(categories, (checkout: Checkout) => {
            return checkout.recordAnswers
        })

        if (webshop.meta.checkoutMethods.length) {
            filters.push(new ChoicesFilterDefinition<Checkout>({
                id: "order_checkoutMethod",
                name: "Afhaal/leveringsmethode",
                choices: (webshop.meta.checkoutMethods ?? []).flatMap(method => {
                    // TODO: also add checkout methods that are not valid anymore from existing orders
                    const choices: ChoicesFilterChoice[] = []

                    if (method.timeSlots.timeSlots.length == 0) {
                        choices.push(
                            new ChoicesFilterChoice(method.id, method.type+": "+method.name)
                        )
                    }
                    
                    for (const time of method.timeSlots.timeSlots) {
                        choices.push(
                            new ChoicesFilterChoice(method.id+"-"+time.id, method.type+": "+method.name, time.toString())
                        )
                    }
                    return choices
                }),
                defaultMode: ChoicesFilterMode.Or,
                getValue: (checkout) => {
                    const ids: string[] = []
                    if (checkout.checkoutMethod) {
                        ids.push(checkout.checkoutMethod.id)
                        
                        if (checkout.timeSlot) {
                            ids.push(checkout.checkoutMethod.id+"-"+checkout.timeSlot.id)
                        }
                    }
                    return ids
                }
            }))
        }

        filters.push(
            new ChoicesFilterDefinition<Checkout>({
                id: "order_products",
                name: "Bestelde artikels",
                choices: (webshop.products ?? []).map(product => {
                    return new ChoicesFilterChoice(product.id, product.name+(product.dateRange ? " ("+product.dateRange.toString()+")" : ""))
                }),
                defaultMode: ChoicesFilterMode.Or,
                getValue: (checkout) => {
                    return checkout.cart.items.flatMap(i => i.product.id)
                }
            })
        )

        const priceChoices: ChoicesFilterChoice[]= [];
        for (const product of webshop.products) {
            if (product.prices.length > 1) {
                for (const price of product.prices) {
                    priceChoices.push(new ChoicesFilterChoice(product.id + ':' + price.id, product.name+": "+price.name))
                }
            }
        }

        if (priceChoices.length > 0) {
            filters.push(
                new ChoicesFilterDefinition<Checkout>({
                    id: "order_product_prices",
                    name: "Bestelde prijskeuzes",
                    choices: priceChoices,
                    defaultMode: ChoicesFilterMode.Or,
                    getValue: (checkout) => {
                        return checkout.cart.items.flatMap(i => i.product.id + ':' + i.productPrice.id)
                    }
                })
            )
        }

        return filters;
    }
}
