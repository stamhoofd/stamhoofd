import { ArrayDecoder, AutoEncoder, AutoEncoderPatchType, BooleanDecoder, EnumDecoder, field, IntegerDecoder, MapDecoder, NonScalarIdentifiable, NumberDecoder, PatchableArray, StringDecoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Formatter } from '@stamhoofd/utility';

import { ValidatedAddress } from '../addresses/Address';
import { ChoicesFilterChoice, ChoicesFilterDefinition, ChoicesFilterMode } from '../filters/ChoicesFilter';
import { FilterDefinition } from '../filters/FilterDefinition';
import { StamhoofdFilter } from '../filters/new/StamhoofdFilter';
import { I18n } from '../I18nInterface';
import { ObjectWithRecords, PatchAnswers } from '../members/ObjectWithRecords';
import { RecordAnswer, RecordAnswerDecoder } from '../members/records/RecordAnswer';
import { Filterable, RecordCategory } from '../members/records/RecordCategory';
import { RecordSettings } from '../members/records/RecordSettings';
import { OrganizationMetaData } from '../OrganizationMetaData';
import { PaymentMethod } from '../PaymentMethod';
import { User } from '../User';
import { Cart } from './Cart';
import { Customer } from './Customer';
import { Discount, ProductDiscountTracker } from './Discount';
import { DiscountCode } from './DiscountCode';
import { Webshop } from './Webshop';
import { WebshopFieldAnswer } from './WebshopField';
import { AnyCheckoutMethodDecoder, CheckoutMethod, CheckoutMethodType, WebshopDeliveryMethod, WebshopTimeSlot } from './WebshopMetaData';

export class Checkout extends AutoEncoder implements ObjectWithRecords {
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
    @field({ 
        decoder: new MapDecoder(StringDecoder, RecordAnswerDecoder), 
        version: 252, 
        optional: true,
        upgrade: (old: RecordAnswer[]) => {
            const map = new Map<string, RecordAnswer>()
            for (const answer of old) {
                map.set(answer.settings.id, answer)
            }
            return map;
        } 
    })
    recordAnswers: Map<string, RecordAnswer> = new Map()

    @field({ decoder: Cart })
    cart: Cart = Cart.create({})

    @field({ decoder: new EnumDecoder(PaymentMethod), nullable: true })
    paymentMethod: PaymentMethod | null = null

    @field({ decoder: IntegerDecoder, version: 207 })
    administrationFee = 0;

    @field({ decoder: new ArrayDecoder(Discount), version: 235 })
    discounts: Discount[] = []

    @field({ decoder: new ArrayDecoder(DiscountCode), version: 239 })
    discountCodes: DiscountCode[] = []

    /**
     * Applied fixed discount (not applicable to a specific cart item)
     */
    @field({ decoder: IntegerDecoder, version: 235 })
    fixedDiscount = 0

    /**
     * Applied percentage discount (not applicable to a specific cart item)
     * in pertenthousand
     */
    @field({ decoder: IntegerDecoder, version: 235 })
    percentageDiscount = 0
    

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

    get appliedPercentageDiscount() {
        return Math.round(this.cart.price * this.percentageDiscount / 10000)
    }

    get totalPrice() {
        // Percentage discount
        
        // + this.administrationFee;
        return Math.max(0, this.cart.price - this.appliedPercentageDiscount - this.fixedDiscount) + this.deliveryPrice + this.administrationFee
    }

    get priceBreakown() {
        const all = [
            {
                name: Formatter.percentage(this.percentageDiscount) + ' korting',
                price: -this.appliedPercentageDiscount
            },
            {
                name: 'Korting',
                price: -this.fixedDiscount
            },
            {
                name: 'Leveringskost',
                price: this.deliveryPrice
            },
            {
                name: 'Administratiekost',
                price: this.administrationFee
            },
        ].filter(a => a.price !== 0)

        if (all.length > 0) {
            all.unshift({
                name: 'Subtotaal',
                price: this.cart.priceWithDiscounts
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

    get totalPriceWithoutAdministrationFee() {
        return this.totalPrice - this.administrationFee
    }

    doesMatchFilter(filter: StamhoofdFilter): boolean {
        throw new Error('Method not implemented.');
    }

    isRecordEnabled(record: RecordSettings): boolean {
        return true;
    }

    getRecordAnswers(): Map<string, RecordAnswer> {
        return new Map();
        //return this.recordAnswers
    }

    patchRecordAnswers(patch: PatchAnswers): this {
        throw new Error("Method not implemented.");
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

            // also update discounts on errors
            this.updateDiscounts(webshop);
            this.calculatePrices();
            throw e
        }

        this.updateDiscounts(webshop);
        this.calculatePrices();

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
        RecordCategory.validate([category], this)
    }

    validateRecordAnswers(webshop: Webshop) {
        RecordCategory.validate(webshop.meta.recordCategories, this)
    }

    private updateAdministrationFee(webshop: Webshop) {
        this.administrationFee = webshop.meta.paymentConfiguration.administrationFee.calculate(this.totalPriceWithoutAdministrationFee)
    }

    private updateDiscounts(webshop: Webshop) {
        this.discounts = webshop.meta.defaultDiscounts.slice()
        this.discounts.push(...this.discountCodes.flatMap(c => c.discounts))
    }

    private calculatePrices() {
        // Group discounts by discounts that can get applied together with other discounts
        // for now: everything can get combined
        const discountOrders = [this.discounts]

        for (const discounts of discountOrders) {
            this.fixedDiscount = 0;
            this.percentageDiscount = 0;

            for (const item of this.cart.items) {
                item.discounts = [];
                
                // Reset all discounts on this item
                item.calculatePrices(this.cart);
            }

            const trackers: ProductDiscountTracker[] = []

            for (const discount of discounts) {
                trackers.push(...discount.applyToCheckout(this));
            }

            // Loop trackers and apply the one with the current highest potential
            while (true) {
                let bestPotential: {tracker: ProductDiscountTracker, potential: number}|null = null;

                for (const tracker of trackers) {
                    const potential = tracker.getPotentialDiscount();
                    if (potential !== 0 && (bestPotential === null || potential > bestPotential.potential)) {
                        bestPotential = {tracker, potential}
                    }
                }
                if (bestPotential) {
                    bestPotential.tracker.apply()
                } else {
                    break;
                }
            }
        }
    }

    update(webshop: Webshop) {
        this.updateDiscounts(webshop)
        this.calculatePrices();
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
}
