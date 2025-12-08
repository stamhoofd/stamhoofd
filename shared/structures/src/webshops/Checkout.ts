import { ArrayDecoder, AutoEncoder, BooleanDecoder, EnumDecoder, field, IntegerDecoder, MapDecoder, NumberDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Formatter } from '@stamhoofd/utility';

import { ValidatedAddress } from '../addresses/Address.js';
import { compileToInMemoryFilter } from '../filters/InMemoryFilter.js';
import { checkoutInMemoryFilterCompilers } from '../filters/inMemoryFilterDefinitions.js';
import { StamhoofdFilter } from '../filters/StamhoofdFilter.js';
import { I18n } from '../I18nInterface.js';
import { ObjectWithRecords, PatchAnswers } from '../members/ObjectWithRecords.js';
import { RecordAnswer, RecordAnswerDecoder } from '../members/records/RecordAnswer.js';
import { RecordCategory } from '../members/records/RecordCategory.js';
import { RecordSettings } from '../members/records/RecordSettings.js';
import { OrganizationMetaData } from '../OrganizationMetaData.js';
import { PaymentMethod } from '../PaymentMethod.js';
import { PriceBreakdown } from '../PriceBreakdown.js';
import { upgradePriceFrom2To4DecimalPlaces } from '../upgradePriceFrom2To4DecimalPlaces.js';
import { User } from '../User.js';
import { Cart } from './Cart.js';
import { Customer } from './Customer.js';
import { Discount, ProductDiscountTracker } from './Discount.js';
import { DiscountCode } from './DiscountCode.js';
import { Webshop } from './Webshop.js';
import { WebshopFieldAnswer } from './WebshopField.js';
import { AnyCheckoutMethodDecoder, CheckoutMethod, CheckoutMethodType, WebshopDeliveryMethod, WebshopTimeSlot } from './WebshopMetaData.js';

export class Checkout extends AutoEncoder implements ObjectWithRecords {
    @field({ decoder: WebshopTimeSlot, nullable: true })
    timeSlot: WebshopTimeSlot | null = null;

    @field({ decoder: AnyCheckoutMethodDecoder, nullable: true })
    checkoutMethod: CheckoutMethod | null = null;

    /**
     * Only needed for delivery
     */
    @field({ decoder: ValidatedAddress, nullable: true })
    address: ValidatedAddress | null = null;

    @field({ decoder: Customer, version: 40 })
    customer: Customer = Customer.create({});

    @field({ decoder: new ArrayDecoder(WebshopFieldAnswer), version: 94 })
    fieldAnswers: WebshopFieldAnswer[] = [];

    @field({ decoder: new ArrayDecoder(RecordAnswerDecoder), optional: true })
    @field({
        decoder: new MapDecoder(StringDecoder, RecordAnswerDecoder),
        version: 252,
        optional: true,
        upgrade: (old: RecordAnswer[]) => {
            const map = new Map<string, RecordAnswer>();
            for (const answer of old) {
                map.set(answer.settings.id, answer);
            }
            return map;
        },
    })
    recordAnswers: Map<string, RecordAnswer> = new Map();

    @field({ decoder: Cart })
    cart: Cart = Cart.create({});

    @field({ decoder: new EnumDecoder(PaymentMethod), nullable: true })
    paymentMethod: PaymentMethod | null = null;

    @field({ decoder: IntegerDecoder, version: 207 })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    administrationFee = 0;

    @field({ decoder: new ArrayDecoder(Discount), version: 235 })
    discounts: Discount[] = [];

    @field({ decoder: new ArrayDecoder(DiscountCode), version: 239 })
    discountCodes: DiscountCode[] = [];

    /**
     * Applied fixed discount (not applicable to a specific cart item)
     */
    @field({ decoder: IntegerDecoder, version: 235 })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    fixedDiscount = 0;

    /**
     * Applied percentage discount (not applicable to a specific cart item)
     * in pertenthousand
     */
    @field({ decoder: IntegerDecoder, version: 235 })
    percentageDiscount = 0;

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

    get paymentContext(): null | 'takeout' | 'delivery' {
        if (this.checkoutMethod?.type === CheckoutMethodType.Takeout) {
            return 'takeout';
        }
        if (this.checkoutMethod?.type === CheckoutMethodType.Delivery) {
            return 'delivery';
        }
        return null;
    }

    get deliveryPrice() {
        if (!this.checkoutMethod || this.checkoutMethod.type !== CheckoutMethodType.Delivery) {
            return 0;
        }

        if (!(this.checkoutMethod instanceof WebshopDeliveryMethod)) {
            // will throw in validation
            return 0;
        }

        if (this.checkoutMethod.price.minimumPrice !== null && this.cart.price >= this.checkoutMethod.price.minimumPrice) {
            return this.checkoutMethod.price.discountPrice;
        }

        return this.checkoutMethod.price.price;
    }

    get appliedPercentageDiscount() {
        return 100 * Math.round(this.cart.price * this.percentageDiscount / 10000_00);
    }

    get totalPrice() {
        // Percentage discount

        // + this.administrationFee;
        return Math.max(0, this.cart.price - this.appliedPercentageDiscount - this.fixedDiscount) + this.deliveryPrice + this.administrationFee;
    }

    get amount(): number {
        return this.cart.items.reduce((acc, item) => acc + item.amount, 0);
    }

    get priceBreakown(): PriceBreakdown {
        const all = [
            {
                name: Formatter.percentage(this.percentageDiscount) + ' ' + $t(`c40c17f9-974a-401f-9728-f10fb0ab123b`),
                price: -this.appliedPercentageDiscount,
            },
            {
                name: $t(`f177a8e3-ae76-4894-af0a-56936b79100f`),
                price: -this.fixedDiscount,
            },
            {
                name: $t(`482bd766-39fa-4340-91b4-ae22a23d5fa5`),
                price: this.deliveryPrice,
            },
            {
                name: $t(`307f8b34-7f74-4045-9335-c7f0d7649b70`),
                price: this.administrationFee,
            },
        ].filter(a => a.price !== 0);

        if (all.length > 0) {
            all.unshift({
                name: $t(`8a04f032-01e5-4ee0-98fb-6f36bf971080`),
                price: this.cart.priceWithDiscounts,
            });
        }

        return [
            ...all,
            {
                name: $t(`e67d0122-6f15-46c6-af94-92a79268710a`),
                price: this.totalPrice,
            },
        ];
    }

    get totalPriceWithoutAdministrationFee() {
        return this.totalPrice - this.administrationFee;
    }

    doesMatchFilter(filter: StamhoofdFilter) {
        try {
            const compiledFilter = compileToInMemoryFilter(filter, checkoutInMemoryFilterCompilers);
            return compiledFilter(this);
        }
        catch (e) {
            console.error('Error while compiling filter', e, filter);
        }
        return false;
    }

    isRecordEnabled(_record: RecordSettings): boolean {
        return true;
    }

    getRecordAnswers(): Map<string, RecordAnswer> {
        return this.recordAnswers;
    }

    patchRecordAnswers(patch: PatchAnswers): this {
        return (this as Checkout).patch({
            recordAnswers: patch,
        }) as this;
    }

    validateAnswers(webshop: Webshop) {
        const newAnswers: WebshopFieldAnswer[] = [];
        for (const field of webshop.meta.customFields) {
            const answer = this.fieldAnswers.find(a => a.field.id === field.id);

            try {
                if (!answer) {
                    const a = WebshopFieldAnswer.create({ field, answer: '' });
                    a.validate();
                    newAnswers.push(a);
                }
                else {
                    answer.field = field;
                    answer.validate();
                    newAnswers.push(answer);
                }
            }
            catch (e) {
                if (isSimpleError(e) || isSimpleErrors(e)) {
                    e.addNamespace('fieldAnswers.' + field.id);
                }
                throw e;
            }
        }
        this.fieldAnswers = newAnswers;
    }

    validateCart(webshop: Webshop, organizationMeta: OrganizationMetaData, asAdmin = false) {
        if (this.cart.items.length === 0) {
            throw new SimpleError({
                code: 'cart_empty',
                message: 'Cart is empty',
                human: $t(`db37b836-f898-4f9d-8a5f-488e65dd5480`),
                field: 'cart',
            });
        }

        const totalItems = this.cart.items.reduce(
            (a, b) => a + b.amount,
            0,
        );

        if (totalItems > 1000) {
            throw new SimpleError({
                code: 'too_many_items',
                message: 'Too many items',
                human: 'Je kan maximaal 1000 items tegelijkertijd bestellen',
                field: 'cart',
            });
        }

        try {
            this.cart.validate(webshop, asAdmin);
        }
        catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                e.addNamespace('cart');
            }

            // also update discounts on errors
            this.updateDiscounts(webshop);
            this.calculatePrices();
            throw e;
        }

        this.updateDiscounts(webshop);
        this.calculatePrices();

        if (!asAdmin && webshop.meta.availableUntil && webshop.meta.availableUntil < new Date()) {
            throw new SimpleError({
                code: 'closed',
                message: 'Orders are closed',
                human: $t(`83fc18c2-54a1-4d2c-a624-995d5999cd89`),
            });
        }

        if (!asAdmin && webshop.meta.openAt && webshop.meta.openAt > new Date()) {
            throw new SimpleError({
                code: 'closed',
                message: 'Orders are closed',
                human: $t(`a654d6d0-2ada-492a-8090-a78a9486da5a`, { date: Formatter.dateTime(webshop.meta.openAt) }),
            });
        }

        if (!asAdmin && webshop.isClosed()) {
            throw new SimpleError({
                code: 'closed',
                message: 'Orders are closed',
                human: $t(`836b4de1-ca21-4e0c-8798-b582dae5607e`),
            });
        }
    }

    validateCheckoutMethod(webshop: Webshop, organizationMeta: OrganizationMetaData) {
        if (this.checkoutMethod === null) {
            if (webshop.meta.checkoutMethods.length > 0) {
                throw new SimpleError({
                    code: 'missing_checkout_method',
                    message: 'Checkout method is required',
                    human: $t(`d14046b4-7ea4-4b13-bdd2-ead917215458`),
                    field: 'checkoutMethod',
                });
            }
            return;
        }

        const current = this.checkoutMethod;
        const checkoutMethod = webshop.meta.checkoutMethods.find(m => m.id === current.id);

        if (!checkoutMethod) {
            if (webshop.meta.checkoutMethods.length === 0) {
                this.checkoutMethod = null;
                return;
            }
            throw new SimpleError({
                code: 'invalid_checkout_method',
                message: 'Checkout method is invalid',
                human: $t(`d14046b4-7ea4-4b13-bdd2-ead917215458`),
                field: 'checkoutMethod',
            });
        }
        this.checkoutMethod = checkoutMethod;
    }

    validateDeliveryAddress(webshop: Webshop, organizationMeta: OrganizationMetaData) {
        if (!this.checkoutMethod || this.checkoutMethod.type !== CheckoutMethodType.Delivery) {
            this.address = null;
            return;
        }

        if (!(this.checkoutMethod instanceof WebshopDeliveryMethod)) {
            throw new SimpleError({
                code: 'invalid_data_type',
                message: 'Invalid data type',
                human: $t(`e20397e0-daac-447e-b267-1474ca90f76c`),
                field: 'address',
            });
        }

        if (!this.address) {
            throw new SimpleError({
                code: 'missing_address',
                message: 'Checkout address is invalid',
                human: $t(`28e59971-5697-4463-9dea-91d49a7673e6`),
                field: 'address',
            });
        }

        // Check country
        if (this.checkoutMethod.countries.includes(this.address.country)) {
            return;
        }

        if (this.checkoutMethod.provinces.map(p => p.id).includes(this.address.provinceId)) {
            return;
        }

        if (this.checkoutMethod.cities.map(c => c.id).includes(this.address.cityId)) {
            return;
        }

        if (this.address.parentCityId && this.checkoutMethod.cities.map(c => c.id).includes(this.address.parentCityId)) {
            return;
        }

        throw new SimpleError({
            code: 'region_not_supported',
            message: 'Region not supported',
            human: $t(`a19f8038-410a-48c8-88f0-62c1d8cc0b9c`),
            field: 'address',
        });
    }

    validateTimeSlot(_webshop: Webshop, _organizationMeta: OrganizationMetaData) {
        if (!this.checkoutMethod || this.checkoutMethod.timeSlots.timeSlots.length === 0) {
            this.timeSlot = null;
            return;
        }

        if (!this.timeSlot) {
            throw new SimpleError({
                code: 'missing_timeslot',
                message: 'Checkout timeslot is missings',
                human: $t(`44f62830-5f3d-4af0-87ae-c8ab1bc28d7a`),
                field: 'timeSlot',
            });
        }

        const current = this.timeSlot;
        const timeSlot = this.checkoutMethod.timeSlots.timeSlots.find(s => s.id === current.id);
        const availableTimeslots = this.checkoutMethod.timeSlots.timeSlots.length;

        if (!timeSlot) {
            throw new SimpleError({
                code: 'invalid_timeslot',
                message: 'Checkout timeslot is invalid',
                human: $t(`acc6ca8e-7eac-4d32-b310-ba8eec941346`),
                field: 'timeSlot',
            });
        }

        // Check maximum
        if (!this.reservedOrder && timeSlot.remainingOrders === 0) {
            throw new SimpleError({
                code: 'timeslot_full',
                message: 'Timeslot has reached maximum orders',
                human: (availableTimeslots !== 1 ? $t(`3fdcbfbf-51b4-46f3-8074-5419ee9acc7e`) : $t(`92c49e88-f1de-4a43-b6be-65f3c1685810`)),
                field: 'timeSlot',
            });
        }

        // Check maximum
        if (timeSlot.remainingPersons !== null && this.cart.persons - this.reservedPersons > timeSlot.remainingPersons) {
            const remainingPersons = timeSlot.remainingPersons;
            if (remainingPersons === 0) {
                throw new SimpleError({
                    code: 'timeslot_full',
                    message: 'Timeslot has reached maximum orders',
                    human: (availableTimeslots !== 1 ? $t(`3fdcbfbf-51b4-46f3-8074-5419ee9acc7e`) : $t(`92c49e88-f1de-4a43-b6be-65f3c1685810`)),
                    field: 'timeSlot',
                });
            }
            throw new SimpleError({
                code: 'timeslot_full',
                message: 'Timeslot has reached maximum persons',
                // todo translation
                human: $t(`1310bb11-6ed9-44e9-bec3-9da905e10404`) + ' ' + (remainingPersons !== 1 ? $t(`31bacb3a-2920-4bf3-9e68-d7887ef17fe4`) : $t(`af839b8a-1367-4655-ad1c-ee658843e9f1`)) + ' ' + $t(`decbc1e7-7ce8-467c-a41a-69a713bb59ab`) + ' ' + remainingPersons + ' ' + (remainingPersons !== 1 ? $t(`a76b6d3c-05a1-4c71-9f88-077261a4e595`) : $t(`886ea5ba-4715-43a2-88b6-4715df3cfa2c`)) + ' ' + $t(`deadeba1-191f-471a-8501-8bb3e4c6e72f`) + ' ' + (availableTimeslots !== 1 ? $t(`773799cf-d924-49a6-8670-41d0b2b3b1b2`) : $t(`46ac8b35-f54e-4b3b-a2b4-36daad8561e8`)) + $t(`a045462a-ed9a-4a3f-9569-bb1b7a0f7cd1`) + ' ' + this.cart.persons + ' ' + (this.cart.persons !== 1 ? $t(`b78c8455-7e28-47b2-b2fd-ba6a82302976`) : $t(`61ab3304-e7b1-4ffc-ab43-110f232f8e23`)) + (availableTimeslots !== 1 ? $t(`2af4961f-b316-452a-9063-622bb4864d01`) : ''),
                field: 'timeSlot',
            });
        }

        this.timeSlot = timeSlot;
    }

    validateCustomer(webshop: Webshop, organizationMeta: OrganizationMetaData, i18n: I18n, asAdmin = false, user: User | null = null) {
        if (user) {
            if (user.firstName) {
                this.customer.firstName = user.firstName;
            }
            if (user.lastName) {
                this.customer.lastName = user.lastName;
            }
            this.customer.email = user.email;
        }

        if (this.customer.firstName.length < 2) {
            throw new SimpleError({
                code: 'invalid_first_name',
                message: 'Invalid first name',
                human: $t(`7cd99473-cc44-44e3-b9be-8c6385711ffa`),
                field: 'customer.firstName',
            });
        }

        if (this.customer.lastName.length < 2) {
            throw new SimpleError({
                code: 'invalid_last_name',
                message: 'Invalid last name',
                human: $t(`311c26e0-7170-4099-9fd7-417ebe22dd7b`),
                field: 'customer.lastName',
            });
        }

        if (webshop.meta.phoneEnabled) {
            if (this.customer.phone.length < 6 && !asAdmin) {
                throw new SimpleError({
                    code: 'invalid_phone',
                    message: 'Invalid phone',
                    human: i18n.t('shared.inputs.mobile.invalidMessage'),
                    field: 'customer.phone',
                });
            }
        }
        else {
            this.customer.phone = '';
        }

        const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

        if (!regex.test(this.customer.email)) {
            throw new SimpleError({
                code: 'invalid_email',
                message: 'Invalid email',
                human: $t('da207832-8a8b-4aee-8f88-17f9ad323e21'),
                field: 'customer.email',
            });
        }

        this.validateAnswers(webshop);
    }

    validatePayment(webshop: Webshop, organizationMeta: OrganizationMetaData) {
        if (!this.paymentMethod) {
            throw new SimpleError({
                code: 'missing_payment_method',
                message: 'Missing payment method',
                human: $t('6f2975aa-d60f-4abb-b597-c30e2382da12'),
                field: 'paymentMethod',
            });
        }
        if (!webshop.meta.paymentMethods.includes(this.paymentMethod)) {
            throw new SimpleError({
                code: 'invalid_payment_method',
                message: 'Invalid payment method',
                human: $t('321f027a-3a4d-479e-9c17-5db19358aa3b'),
                field: 'paymentMethod',
            });
        }
    }

    validateRecordAnswersFor(webshop: Webshop, category: RecordCategory) {
        RecordCategory.validate([category], this);
    }

    validateRecordAnswers(webshop: Webshop) {
        RecordCategory.validate(webshop.meta.recordCategories, this);
    }

    private updateAdministrationFee(webshop: Webshop) {
        this.administrationFee = webshop.meta.paymentConfiguration.administrationFee.calculate(this.totalPriceWithoutAdministrationFee);
    }

    private updateDiscounts(webshop: Webshop) {
        this.discounts = webshop.meta.defaultDiscounts.slice();
        this.discounts.push(...this.discountCodes.flatMap(c => c.discounts));
    }

    private calculatePrices() {
        // Group discounts by discounts that can get applied together with other discounts
        // for now: everything can get combined
        const discountOrders = [this.discounts];

        for (const discounts of discountOrders) {
            this.fixedDiscount = 0;
            this.percentageDiscount = 0;

            for (const item of this.cart.items) {
                item.discounts = [];

                // Reset all discounts on this item
                item.calculatePrices(this.cart);
            }

            const trackers: ProductDiscountTracker[] = [];

            for (const discount of discounts) {
                trackers.push(...discount.applyToCheckout(this));
            }

            // Loop trackers and apply the one with the current highest potential
            while (true) {
                let bestPotential: { tracker: ProductDiscountTracker; potential: number } | null = null;

                for (const tracker of trackers) {
                    const potential = tracker.getPotentialDiscount();
                    if (potential !== 0 && (bestPotential === null || potential > bestPotential.potential)) {
                        bestPotential = { tracker, potential };
                    }
                }
                if (bestPotential) {
                    bestPotential.tracker.apply();
                }
                else {
                    break;
                }
            }
        }
    }

    update(webshop: Webshop) {
        this.updateDiscounts(webshop);
        this.calculatePrices();
        this.updateAdministrationFee(webshop);
    }

    validate(webshop: Webshop, organizationMeta: OrganizationMetaData, i18n: I18n, asAdmin = false, user: User | null = null) {
        try {
            this.validateCart(webshop, organizationMeta, asAdmin);

            this.validateCheckoutMethod(webshop, organizationMeta);
            this.validateDeliveryAddress(webshop, organizationMeta);
            this.validateTimeSlot(webshop, organizationMeta);
            this.validateCustomer(webshop, organizationMeta, i18n, asAdmin, user);
            this.validateRecordAnswers(webshop);

            if (this.totalPrice !== 0 && !asAdmin) {
                this.validatePayment(webshop, organizationMeta);
            }
            else if (this.totalPrice === 0) {
                this.paymentMethod = PaymentMethod.Unknown;
            }
        }
        finally {
            this.update(webshop);
        }
    }

    /**
     * Convenience mapper
     */
    get deliveryMethod() {
        if (!this.checkoutMethod || this.checkoutMethod.type !== CheckoutMethodType.Delivery) {
            return null;
        }

        if (!(this.checkoutMethod instanceof WebshopDeliveryMethod)) {
            // will throw in validation
            return null;
        }

        return this.checkoutMethod;
    }
}
