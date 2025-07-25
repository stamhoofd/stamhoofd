import { ArrayDecoder, AutoEncoder, field, IntegerDecoder, MapDecoder, PartialWithoutMethods, StringDecoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';

import { CartReservedSeat, ReservedSeat } from '../SeatingPlan.js';
import { Cart } from './Cart.js';
import { CartStockHelper, StockDefinition } from './CartStockHelper.js';
import { ProductDiscountSettings } from './Discount.js';
import { Option, OptionMenu, Product, ProductPrice, ProductType } from './Product.js';
import { Webshop } from './Webshop.js';
import { WebshopFieldAnswer } from './WebshopField.js';

export class CartItemPrice extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    price = 0;

    @field({ decoder: IntegerDecoder })
    fixedDiscount = 0;

    @field({ decoder: IntegerDecoder })
    percentageDiscount = 0;

    get discountedPrice() {
        let price = this.price;
        price = Math.min(price, Math.max(0, Math.round(price * (10000 - this.percentageDiscount) / 10000))); // Min is required to support negative prices: prices should never increase after applyign discounts
        price = Math.min(price, Math.max(0, price - this.fixedDiscount)); // Min is required to support negative prices: prices should never increase after applyign discounts
        return price;
    }
}

export class CartItemOption extends AutoEncoder {
    @field({ decoder: Option })
    option: Option;

    @field({ decoder: OptionMenu })
    optionMenu: OptionMenu;
}

export class CartItem extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4(), version: 106, upgrade: function (this: CartItem) {
        // Warning: this id will always be too long for storage in a normal database record.
        // But that is not a problem, since only new orders will use tickets that need this field
        return this.code;
    } })
    id: string;

    @field({ decoder: Product })
    product: Product;

    @field({ decoder: ProductPrice })
    productPrice: ProductPrice;

    @field({ decoder: new ArrayDecoder(CartItemOption) })
    options: CartItemOption[] = [];

    @field({ decoder: new ArrayDecoder(WebshopFieldAnswer), version: 94 })
    fieldAnswers: WebshopFieldAnswer[] = [];

    @field({ decoder: new ArrayDecoder(CartReservedSeat), version: 212 })
    seats: CartReservedSeat[] = [];

    @field({ decoder: IntegerDecoder })
    amount = 1;

    /**
     * Discounts that are actually applied
     */
    @field({ decoder: new ArrayDecoder(ProductDiscountSettings), version: 237, optional: true })
    discounts: ProductDiscountSettings[] = [];

    /**
     * When an order is correctly placed, we store the reserved amount in the stock here.
     * We need this to check the stock changes when an order is edited after placement.
     */
    @field({ decoder: IntegerDecoder, version: 115 })
    reservedAmount = 0;

    /**
     * Holds a list of what we reserved a stock for (which produce prices and which options specifically so we don't reserve the same thing multiple times or revert when it wasn't reserved earlier)
     */
    @field({ decoder: new MapDecoder(StringDecoder, IntegerDecoder), version: 224 })
    reservedOptions = new Map<string, number>();

    /**
     * Holds a list of what we reserved a stock for (which produce prices and which options specifically so we don't reserve the same thing multiple times or revert when it wasn't reserved earlier)
     */
    @field({ decoder: new MapDecoder(StringDecoder, IntegerDecoder), version: 224 })
    reservedPrices = new Map<string, number>();

    /**
     * When the seats are successfully reserved, we store them here
     * This makes editing seats possible because we know we can still use these seats even if they are blocked normally
     */
    @field({ decoder: new ArrayDecoder(CartReservedSeat), version: 213 })
    reservedSeats: CartReservedSeat[] = [];

    /**
     * @deprecated
     * Saved unitPrice (migration needed)
     */
    @field({ decoder: IntegerDecoder, nullable: true, version: 107 })
    unitPrice: number | null = null;

    /**
     * Detailed list of prices
     */
    @field({ decoder: new ArrayDecoder(CartItemPrice), version: 236, upgrade: function (this: CartItem) {
        const prices: CartItemPrice[] = [];

        const unitPrice = this.unitPrice ?? 0;
        for (const seat of this.seats) {
            const seatPrice = unitPrice + seat.price;

            prices.push(CartItemPrice.create({
                price: seatPrice,
            }));
        }

        // Others (non seats)
        const remaining = this.amount - this.seats.length;
        if (remaining > 0) {
            for (let index = 0; index < remaining; index++) {
                prices.push(CartItemPrice.create({
                    price: unitPrice,
                }));
            }
        }
        return prices;
    } })
    calculatedPrices: CartItemPrice[] = [];

    /**
     * In case this product is a UiTPAS social tarrif, we hold a list of UiTPAS numbers (length is equal to amount).
     * In case this is not a UiTPAS social tarrif, this will be an empty array.
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), version: 377 })
    uitpasNumbers: string[] = [];

    /**
     * Show an error in the cart for recovery
     */
    cartError: SimpleError | SimpleErrors | null = null;

    /**
     * @deprecated
     */
    get price() {
        return this.unitPrice ? (this.unitPrice * this.amount) : null;
    }

    getReservedAmountPrice(priceId: string) {
        return this.reservedPrices.get(priceId) || 0;
    }

    getReservedAmountOption(optionId: string) {
        return this.reservedOptions.get(optionId) || 0;
    }

    static createDefault(product: Product, cart: Cart, webshop: Webshop, data: { admin: boolean }): CartItem {
        // Return the first that still has stock or the first if none has stock
        const options: CartItemOption[] = [];

        // Fill in all default options here
        for (const optionMenu of product.optionMenus) {
            if (optionMenu.multipleChoice) {
                continue;
            }
            if (!optionMenu.autoSelectFirst) {
                continue;
            }

            let cartItemOption: CartItemOption | null = null;

            // Add first option with remaining stock
            for (const option of optionMenu.options) {
                const stock = CartStockHelper.getOptionStock({ product, option, oldItem: null, cart, webshop, admin: data.admin });
                if (!stock || stock.remaining === null || stock.remaining > 0) {
                    cartItemOption = CartItemOption.create({
                        option,
                        optionMenu,
                    });
                    break;
                }
            }

            // Add (default if no stock for all)
            options.push(cartItemOption ?? CartItemOption.create({
                option: optionMenu.options[0],
                optionMenu,
            }));
        }

        const prices = product.filteredPrices(data);
        let chosenPrice: ProductPrice | null = null;

        for (const productPrice of prices) {
            const stock = CartStockHelper.getPriceStock({ product, productPrice, oldItem: null, cart, webshop, admin: data.admin });

            if (!stock || stock.remaining === null || stock.remaining > 0) {
                chosenPrice = productPrice;
                break;
            }
        }

        // Default
        return CartItem.create({
            product: product,
            productPrice: chosenPrice ?? product.filteredPrices(data)[0],
            options,
        });
    }

    static create<T extends typeof AutoEncoder>(this: T, object: PartialWithoutMethods<CartItem>): InstanceType<T> {
        const c = super.create(object) as CartItem;

        // Fill in all default options here
        for (const optionMenu of c.product.optionMenus) {
            if (optionMenu.multipleChoice) {
                continue;
            }

            if (!optionMenu.autoSelectFirst) {
                continue;
            }

            if (c.options.find(o => o.optionMenu.id === optionMenu.id)) {
                continue;
            }

            c.options.push(CartItemOption.create({
                option: optionMenu.options[0],
                optionMenu: optionMenu,
            }));
        }

        return c as InstanceType<T>;
    }

    /**
     * Unique identifier to check if two cart items are the same
     */
    get code(): string {
        return this.codeWithoutFields + '.' + this.fieldAnswers.map(a => a.field.id + '-' + Formatter.slug(a.answer)).join('.');
    }

    get codeWithoutFields(): string {
        return this.product.id + '.' + this.productPrice.id + '.' + this.options.map(o => o.option.id).join('.');
    }

    /**
     * Return total amount of same product in the given cart. Always includes the current item, even when it isn't in the cart. Doesn't count it twice
     */
    getTotalAmount(cart: Cart) {
        return cart.items.reduce((c, item) => {
            if (item.product.id !== this.product.id) {
                return c;
            }

            if (item.id === this.id) {
                return c;
            }
            return c + item.amount;
        }, 0) + this.amount;
    }

    /**
     * Note: this resets any discounts that are applied to the cart item
     */
    calculatePrices(cart: Cart) {
        const prices: CartItemPrice[] = [];

        const unitPrice = this.calculateUnitPrice(cart);
        for (const seat of this.seats) {
            const seatPrice = unitPrice + seat.price;

            prices.push(CartItemPrice.create({
                price: seatPrice,
            }));
        }

        // Others (non seats)
        const remaining = this.amount - this.seats.length;
        if (remaining > 0) {
            for (let index = 0; index < remaining; index++) {
                prices.push(CartItemPrice.create({
                    price: unitPrice,
                }));
            }
        }
        this.calculatedPrices = prices;
    }

    private calculateUnitPrice(cart: Cart): number {
        const amount = this.getTotalAmount(cart);
        let price = this.productPrice.price;

        if (this.productPrice.discountPrice !== null && amount >= this.productPrice.discountAmount) {
            price = this.productPrice.discountPrice;
        }
        for (const option of this.options) {
            price += option.option.price;
        }

        if (this.productPrice.price >= 0) {
            this.unitPrice = Math.max(0, price);
        }
        else {
            // Allow negative
            this.unitPrice = price;
        }
        return this.unitPrice;
    }

    /**
     * @deprecated
     * Use this method if you need temporary prices in case it is not yet calculated
     */
    getUnitPrice(cart: Cart): number {
        if (this.unitPrice) {
            return this.unitPrice;
        }
        return this.calculateUnitPrice(cart);
    }

    getPriceWithDiscounts(): number {
        return this.calculatedPrices.reduce((a, b) => a + b.discountedPrice, 0);
    }

    getPriceWithoutDiscounts() {
        return this.calculatedPrices.reduce((a, b) => a + b.price, 0);
    }

    /**
     * @deprecated: use other systems
     * Prices that are only applicable to some amount, but not all (e.g. seat extra prices)
     */
    getPartialExtraPrice(cart: Cart) {
        const unitPrice = this.getUnitPrice(cart);
        const expectedPrice = unitPrice * this.amount;
        const actualPrice = this.getPriceWithoutDiscounts();
        return actualPrice - expectedPrice;
    }

    /**
     * @deprecated use getPriceWithDiscounts instead for clarity
     */
    getPrice(): number {
        return this.getPriceWithDiscounts();
    }

    private getUnitPriceCombinationsWithoutDiscount() {
        const priceCombinations = new Map<number, number>();
        for (const calculatedPrice of this.calculatedPrices) {
            const price = calculatedPrice.price;
            priceCombinations.set(price, (priceCombinations.get(price) || 0) + 1);
        }

        return priceCombinations;
    }

    private getUnitPriceCombinationsWithDiscount() {
        const priceCombinations = new Map<number, number>();
        for (const calculatedPrice of this.calculatedPrices) {
            const price = calculatedPrice.discountedPrice;
            priceCombinations.set(price, (priceCombinations.get(price) || 0) + 1);
        }

        return priceCombinations;
    }

    get formattedAmount(): string | null {
        if (!this.product.allowMultiple) {
            return '';
        }
        return Formatter.integer(this.amount);
    }

    /**
     * Without discounts
     */
    getFormattedPriceWithoutDiscount() {
        // Group by seats
        const priceCombinations = this.getUnitPriceCombinationsWithoutDiscount();
        return this.priceCombinationToString(priceCombinations);
    }

    getFormattedPriceWithDiscount(): string | null {
        const price = this.getPriceWithDiscounts();
        if (price === this.getPriceWithoutDiscounts()) {
            return null;
        }

        const priceCombinations = this.getUnitPriceCombinationsWithDiscount();
        return this.priceCombinationToString(priceCombinations);
    }

    getDiffName() {
        return this.product.name;
    }

    getDiffValue() {
        return this.formattedAmount + 'x ' + this.description;
    }

    private priceCombinationToString(priceCombinations: Map<number, number>) {
        // Sort by price
        const sorted = [...priceCombinations.entries()].map(([price, amount]) => ({ price, amount })).sort((a, b) => b.price - a.price);

        // Format
        const parts: string[] = [];
        for (const { price, amount } of sorted) {
            if (parts.length > 0 || price < 0) {
                if (price >= 0) {
                    parts.push('+');
                }
                else {
                    parts.push('-');
                }
            }

            if (!this.product.allowMultiple && amount === 1) {
                parts.push(Formatter.price(Math.abs(price)));
                continue;
            }

            if (price === 0) {
                if (sorted.length === 1) {
                    parts.push($t(`99e41cea-bce3-4329-8b17-e3487c4534ac`));
                }
                else {
                    parts.push(amount + ' ' + $t(`50af1227-4f3d-46bb-a832-b62c4e3bc6ab`));
                }
            }
            else {
                if (sorted.length === 1 || amount === 1) {
                    if (amount > 1) {
                        parts.push(Formatter.price(Math.abs(price)) + ' ' + $t(`4edf400a-ac16-4442-8561-e66ed2f785b5`));
                    }
                    else {
                        parts.push(Formatter.price(Math.abs(price)));
                    }
                }
                else {
                    parts.push(amount + ' × ' + Formatter.price(Math.abs(price)));
                }
            }
        }

        return parts.join(' ');
    }

    /**
     * Used for statistics
     */
    get descriptionWithoutFields(): string {
        const descriptions: string[] = [];

        if (this.product.prices.length > 1) {
            descriptions.push(this.productPrice.name);
        }
        for (const option of this.options) {
            descriptions.push(option.option.name);
        }

        if ((this.product.type === ProductType.Ticket || this.product.type === ProductType.Voucher) && this.product.dateRange) {
            descriptions.unshift(Formatter.capitalizeFirstLetter(this.product.dateRange.toString()));
        }

        return descriptions.filter(d => !!d).join('\n');
    }

    get descriptionWithoutDate(): string {
        const descriptions: string[] = [];

        if (this.product.prices.length > 1) {
            descriptions.push(this.productPrice.name);
        }
        for (const option of this.options) {
            descriptions.push(option.option.name);
        }

        for (const a of this.fieldAnswers) {
            if (!a.answer) {
                continue;
            }
            descriptions.push(a.field.name + ': ' + a.answer);
        }
        return descriptions.filter(d => !!d).join('\n');
    }

    get description(): string {
        const descriptions: string[] = [this.descriptionWithoutDate];

        if ((this.product.type === ProductType.Ticket || this.product.type === ProductType.Voucher) && this.product.dateRange) {
            descriptions.unshift(Formatter.capitalizeFirstLetter(this.product.dateRange.toString()));
        }

        if (this.seats.length) {
            descriptions.push(
                (this.seats.length === 1 ? $t(`8435edb8-619e-4ddf-b5c8-4d1a2bc44acc`) : $t(`2a3d1996-17cd-4ef7-827b-63f2f9b5b84a`)) + ': '
                + this.seats.slice().sort(ReservedSeat.sort).map(s => s.getShortName(this.product)).join(', '),
            );
        }

        if (this.uitpasNumbers.length) {
            if (this.uitpasNumbers.length === 1) {
                descriptions.push($t('e330f60b-d331-49a2-a437-cddc31a878de') + ': ' + this.uitpasNumbers[0]);
            }
            else {
                descriptions.push($t('83eca88a-9820-4b6e-8849-9d59ec3e4a3b') + ': ' + this.uitpasNumbers.join(', '));
            }
        }
        return descriptions.filter(d => !!d).join('\n');
    }

    validateAnswers() {
        const newAnswers: WebshopFieldAnswer[] = [];
        for (const field of this.product.customFields) {
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

    /**
     * Update self to the newest available data, and throw error if something failed (only after refreshing other ones)
     */
    refresh(webshop: Webshop) {
        const errors = new SimpleErrors();
        const product = webshop.products.find(p => p.id === this.product.id);
        if (!product) {
            errors.addError(new SimpleError({
                code: 'product_unavailable',
                message: 'Product unavailable',
                human: $t(`b3468d2d-269d-4330-9bb7-580920d2d080`, { product: this.product.name }),
            }));
        }
        else {
            this.product = product;
            const productPrice = product.prices.find(p => p.id === this.productPrice.id);
            if (!productPrice) {
                if ((this.productPrice.name.length === 0 || this.product.prices.length <= 1) && product.prices.length > 1) {
                    errors.addError(new SimpleError({
                        code: 'product_price_unavailable',
                        message: 'Product price unavailable',
                        human: $t(`349ac252-348b-42ae-aa9c-708a25db03f6`, { product: this.product.name }),
                    }));
                }
                else {
                    errors.addError(new SimpleError({
                        code: 'product_price_unavailable',
                        message: 'Product price unavailable',
                        human: $t(`c3862722-84b2-4eca-b8cd-dd3f2a9f95c7`, { price: this.productPrice.name, product: this.product.name }),
                    }));
                }
            }
            else {
                // Only set product if we did find our product price
                this.productPrice = productPrice;
            }

            // Check all options
            const remainingMenus = this.product.optionMenus.slice();

            for (const o of this.options) {
                const index = remainingMenus.findIndex(m => m.id === o.optionMenu.id);
                if (index === -1) {
                    // Check if it has a multiple choice one
                    errors.addError(new SimpleError({
                        code: 'option_menu_unavailable',
                        message: 'Option menu unavailable',
                        human: $t(`609af825-3468-407d-a033-170d75b51075`, { product: this.product.name }),
                    }));
                    continue;
                }

                const menu = remainingMenus[index];
                if (!menu.multipleChoice) {
                    // Already used: not possible to add another
                    remainingMenus.splice(index, 1);
                }

                const option = menu.options.find(m => m.id === o.option.id);

                if (!option) {
                    errors.addError(new SimpleError({
                        code: 'option_unavailable',
                        message: 'Option unavailable',
                        human: $t(`609af825-3468-407d-a033-170d75b51075`, { product: this.product.name }),
                    }));
                    continue;
                }

                // Update to latest data
                o.optionMenu = menu;
                o.option = option;
            }

            if (remainingMenus.filter(m => !m.multipleChoice).length > 0) {
                for (const remaining of remainingMenus) {
                    errors.addError(
                        new SimpleError({
                            code: 'missing_menu',
                            message: 'Missing menu',
                            human: $t(`60021a05-e01f-4fda-b12e-8aa8046a2f07`, { option_menu_name: remaining.name }),
                            field: 'optionMenus.' + remaining.id,
                            meta: { recoverable: true },
                        }),
                    );
                }
            }
        }

        try {
            this.validateAnswers();
        }
        catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                errors.addError(e);
            }
            else {
                throw e;
            }
        }

        errors.throwIfNotEmpty();
    }

    getFixedStockDefinitions(oldItem: CartItem | null | undefined, cart: Cart, webshop: Webshop, admin: boolean): StockDefinition[] {
        return CartStockHelper.getFixedStockDefinitions({ oldItem, cart, product: this.product, webshop, admin, amount: this.amount });
    }

    /**
     * Return all the stock definitions for this cart item with the currently selected options
     * = calculate how much you can order with these options
     */
    getAvailableStock(oldItem: CartItem | null | undefined, cart: Cart, webshop: Webshop, admin: boolean): StockDefinition[] {
        return CartStockHelper.getAvailableStock({ oldItem, cart, product: this.product, webshop, admin, amount: this.amount, productPrice: this.productPrice, options: this.options });
    }

    getMaximumRemaining(oldItem: CartItem | null | undefined, cart: Cart, webshop: Webshop, admin: boolean) {
        return CartStockHelper.getRemaining(this.getAvailableStock(oldItem, cart, webshop, admin));
    }

    /**
     * Update self to the newest available data and throw if it was not able to recover
     */
    validate(webshop: Webshop, cart: Cart, { refresh, admin, validateSeats }: { refresh?: boolean; admin?: boolean; validateSeats?: boolean } = { refresh: true, admin: false, validateSeats: true }) {
        this.cartError = null;

        if (admin === undefined) {
            admin = false;
        }
        if (refresh === undefined) {
            refresh = true;
        }
        if (validateSeats === undefined) {
            validateSeats = true;
        }

        if (refresh) {
            this.refresh(webshop);
        }
        const product = this.product;

        if (!product.allowMultiple) {
            this.amount = 1;
        }

        // Check stock
        if (!admin) {
            if (!product.isEnabled && this.amount > this.reservedAmount) {
                throw new SimpleError({
                    code: 'product_unavailable',
                    message: 'Product unavailable',
                    human: $t(`b3468d2d-269d-4330-9bb7-580920d2d080`, { product: this.product.name }),
                });
            }

            if (this.productPrice.hidden) {
                throw new SimpleError({
                    code: 'product_price_unavailable',
                    message: 'Product price unavailable',
                    human: $t(`325ccc3a-41a6-462e-81db-2efb0235e3eb`, { price: this.productPrice.name }),
                });
            }

            if (product.isSoldOut && this.amount > this.reservedAmount) {
                throw new SimpleError({
                    code: 'product_unavailable',
                    message: 'Product unavailable',
                    human: $t(`7701d42d-eef3-419b-b1fb-85443d117554`, { product: this.product.name }),
                });
            }

            const remaining = this.getAvailableStock(this, cart, webshop, admin);
            const minimumRemaining = CartStockHelper.getRemaining(remaining);
            if (minimumRemaining !== null && minimumRemaining < this.amount) {
                // Search for appropriate message in stock definitions
                const stockDefinition = remaining.find(r => r.remaining === minimumRemaining);
                throw new SimpleError({
                    code: 'product_unavailable',
                    message: 'Product unavailable',
                    human: stockDefinition?.text || $t(`ade1f338-f45e-4384-9520-9d20cfe5311e`, { count: minimumRemaining.toString(), product: this.product.name }),
                    meta: { recoverable: minimumRemaining > 0 },
                });
            }
        }

        if (this.product.seatingPlanId && validateSeats) {
            const seatingPlan = webshop.meta.seatingPlans.find(s => s.id === this.product.seatingPlanId);
            if (!seatingPlan) {
                throw new SimpleError({
                    code: 'seating_plan_unavailable',
                    message: 'Invalid seating plan',
                    human: $t(`6f4d58c7-25d2-407e-901a-f3c03a7e0ab3`, { product: this.product.name }),
                });
            }

            // Check seats taken already?
            const reservedSeats = this.product.reservedSeats;

            // Remove invalid seats
            const invalidSeats = this.seats.filter((s) => {
                const valid = seatingPlan.isValidSeat(s, reservedSeats, this.reservedSeats);

                if (valid) {
                    return false;
                }
                else {
                    if (!admin && seatingPlan.isAdminSeat(s)) {
                        return false;
                    }
                    return true;
                }
            });

            if (invalidSeats.length) {
                throw new SimpleError({
                    code: 'seats_unavailable',
                    message: 'Seats unavailable',
                    human: $t(`2fd43e7b-2c16-4695-bdb4-f3095952d36d`) + ' ' + invalidSeats.map(s => s.getNameString(webshop, this.product)).join(', '),
                    meta: { recoverable: true },
                });
            }

            // Seating validation
            if (this.seats.length !== this.amount) {
                if (this.seats.length > this.amount) {
                    // We need to handle this, because this can be caused by a stock limit
                    throw new SimpleError({
                        code: 'invalid_seats',
                        message: 'Invalid seats',
                        human: $t(`5d8d7f45-85ae-44d0-b8ac-b7db850003ba`, { seats: Formatter.pluralText(this.amount, $t(`886ea5ba-4715-43a2-88b6-4715df3cfa2c`), $t(`a76b6d3c-05a1-4c71-9f88-077261a4e595`)) }),
                        meta: { recoverable: true },
                    });
                }
                throw new SimpleError({
                    code: 'invalid_seats',
                    message: 'Invalid seats',
                    human: $t(`2858b401-42b8-4a95-8bd1-d67addbda5e1`, { seats: Formatter.pluralText(this.amount - this.seats.length, $t(`886ea5ba-4715-43a2-88b6-4715df3cfa2c`), $t(`a76b6d3c-05a1-4c71-9f88-077261a4e595`)) }),
                    meta: { recoverable: true },
                });
            }

            // Check other cart items have same seats
            const otherItems = cart.items.filter(i => i.product.id === this.product.id && i.id !== this.id);
            for (const item of otherItems) {
                for (const seat of item.seats) {
                    if (this.seats.find(s => s.equals(seat))) {
                        throw new SimpleError({
                            code: 'seats_unavailable',
                            message: 'Seats unavailable',
                            human: $t(`794b3f34-9dd2-4097-af25-af094431fba0`) + ' ' + seat.getNameString(webshop, this.product),
                        });
                    }
                }
            }

            // Adjust seats automatically if enabled
            if (seatingPlan.requireOptimalReservation && !admin) {
                const otherSeats = cart.items.filter(i => i.product.id === this.product.id && i.id !== this.id).flatMap(i => i.seats);
                const adjusted = seatingPlan.adjustSeatsForBetterFit(this.seats, [...reservedSeats, ...otherSeats], this.reservedSeats);
                if (adjusted) {
                    this.seats = adjusted.map(a => CartReservedSeat.create(a));
                }

                // Edge case: if seats are not optimal across multiple items, we can't fix it
                const adjusted2 = seatingPlan.adjustSeatsForBetterFit([...this.seats, ...otherSeats], reservedSeats, this.reservedSeats);
                if (adjusted2) {
                    // Not able to correct this across multiple items
                    throw new SimpleError({
                        code: 'select_connected_seats',
                        message: 'Select connected seats',
                        human: $t(`a751a023-570b-46ad-8aaa-7b0c4412cbe8`),
                        meta: { recoverable: true },
                    });
                }
            }

            // Update prices
            for (const seat of this.seats) {
                seat.calculatePrice(seatingPlan);
            }
        }

        // Update prices
        // should now happen in the checkout so discounts are in sync
        // this.calculateUnitPrice(cart)
    }
}
