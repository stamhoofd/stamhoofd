import { ArrayDecoder, AutoEncoder, field, IntegerDecoder, MapDecoder, PartialWithoutMethods, RecordDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from "uuid";

import { CartReservedSeat } from '../SeatingPlan';
import { CartStockHelper, StockDefinition } from './CartStockHelper';
import { Option, OptionMenu, Product, ProductPrice, ProductType } from './Product';
import { Webshop } from './Webshop';
import { WebshopFieldAnswer } from './WebshopField';
import { ProductDiscount, ProductDiscountTracker } from './Discount';

export class CartItemOption extends AutoEncoder {
    @field({ decoder: Option })
    option: Option;

    @field({ decoder: OptionMenu })
    optionMenu: OptionMenu;
}

export class CartItem extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4(), version: 106, upgrade: function(this: CartItem) {
        // Warning: this id will always be too long for storage in a normal database record.
        // But that is not a problem, since only new orders will use tickets that need this field
        return this.code
    } })
    id: string;
    
    @field({ decoder: Product })
    product: Product;

    @field({ decoder: ProductPrice })
    productPrice: ProductPrice;
    
    @field({ decoder: new ArrayDecoder(CartItemOption) })
    options: CartItemOption[] = []

    @field({ decoder: new ArrayDecoder(WebshopFieldAnswer), version: 94 })
    fieldAnswers: WebshopFieldAnswer[] = []

    @field({ decoder: new ArrayDecoder(CartReservedSeat), version: 212 })
    seats: CartReservedSeat[] = []

    @field({ decoder: IntegerDecoder })
    amount = 1;

    /**
     * Discounts that are actually applied
     */
    @field({ decoder: new ArrayDecoder(ProductDiscount), version: 235 })
    discounts: ProductDiscount[] = []

    /**
     * Only used during calculation of discounts
     */
    applicableDiscounts: ProductDiscountTracker[] = []

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
    reservedSeats: CartReservedSeat[] = []

    /**
     * Saved unitPrice (migration needed)
     */
    @field({ decoder: IntegerDecoder, nullable: true, version: 107 })
    unitPrice: number | null = null;

    /**
     * Show an error in the cart for recovery
     */
    cartError: SimpleError|SimpleErrors | null = null;

    /**
     * @deprecated
     */
    get price() {
        return this.unitPrice ? (this.unitPrice * this.amount) : null
    }

    getReservedAmountPrice(priceId: string) {
        return this.reservedPrices.get(priceId) || 0
    }

    getReservedAmountOption(optionId: string) {
        return this.reservedOptions.get(optionId) || 0
    }

    static createDefault(product: Product, cart: Cart, webshop: Webshop, data: {admin: boolean}): CartItem {
        // Return the first that still has stock or the first if none has stock
        const options: CartItemOption[] = []

        // Fill in all default options here
        for (const optionMenu of product.optionMenus) {
            if (optionMenu.multipleChoice) {
                continue;
            }

            let cartItemOption: CartItemOption|null = null

            // Add first option with remaining stock
            for (const option of optionMenu.options) {
                const stock = CartStockHelper.getOptionStock({ product, option, oldItem: null, cart, webshop, admin: data.admin })
                if (!stock || stock.remaining === null || stock.remaining > 0) {
                    cartItemOption = CartItemOption.create({
                        option,
                        optionMenu
                    })
                    break;
                }
            }

            // Add (default if no stock for all)
            options.push(cartItemOption ?? CartItemOption.create({
                option: optionMenu.options[0],
                optionMenu
            }))
        }
        
        const prices = product.filteredPrices(data);
        let chosenPrice: ProductPrice|null = null

        for (const productPrice of prices) {
            const stock = CartStockHelper.getPriceStock({ product, productPrice, oldItem: null, cart, webshop, admin: data.admin })
            
            if (!stock || stock.remaining === null || stock.remaining > 0) {
                chosenPrice = productPrice
                break;
            }
        }

        // Default
        return CartItem.create({
            product: product,
            productPrice: chosenPrice ?? product.filteredPrices(data)[0],
            options
        })
    }

    static create<T extends typeof AutoEncoder>(this: T, object: PartialWithoutMethods<CartItem>): InstanceType<T>  {
        const c = super.create(object) as CartItem

        // Fill in all default options here
        for (const optionMenu of c.product.optionMenus) {
            if (optionMenu.multipleChoice) {
                continue;
            }

            if (c.options.find(o => o.optionMenu.id === optionMenu.id)) {
                continue
            }

            c.options.push(CartItemOption.create({
                option: optionMenu.options[0],
                optionMenu: optionMenu
            }))

        }

        return c as InstanceType<T>
    }

    /**
     * Unique identifier to check if two cart items are the same
     */
    get code(): string {
        return this.codeWithoutFields+"."+this.fieldAnswers.map(a => a.field.id+"-"+Formatter.slug(a.answer)).join(".");
    }


    get codeWithoutFields(): string {
        return this.product.id+"."+this.productPrice.id+"."+this.options.map(o => o.option.id).join(".")
    }

    /**
     * Return total amount of same product in the given cart. Always includes the current item, even when it isn't in the cart. Doesn't count it twice
     */
    getTotalAmount(cart: Cart) {
        return cart.items.reduce((c, item) => {
            if (item.product.id !== this.product.id) {
                return c
            }

            if (item.id === this.id) {
                return c
            }
            return c + item.amount
        }, 0) + this.amount
    }

    calculateUnitPrice(cart: Cart): number {
        const amount = this.getTotalAmount(cart)
        let price = this.productPrice.price

        if (this.productPrice.discountPrice !== null && amount >= this.productPrice.discountAmount) {
            price = this.productPrice.discountPrice
        }
        for (const option of this.options) {
            price += option.option.price
        }

        if (this.productPrice.price >= 0) {
            this.unitPrice = Math.max(0, price)
        } else {
            // Allow negative
            this.unitPrice = price
        }
        return this.unitPrice
    }

    /**
     * Use this method if you need temporary prices in case it is not yet calculated
     */
    getUnitPrice(cart: Cart): number {
        if (this.unitPrice) {
            return this.unitPrice
        }
        return this.calculateUnitPrice(cart)
    }

    getPriceWithDiscounts(cart: Cart): number {
        return this.calculatePrice(cart, this.discounts)
    }

    getPriceWithoutDiscounts(cart: Cart) {
        return this.calculatePrice(cart, [])
    }

    calculatePrice(cart: Cart, discounts: ProductDiscount[] = []) {
        const prices = this.getIndividualUnitPrices(cart, discounts);
        return prices.reduce((a, b) => a + b, 0)
    }

    getIndividualUnitPrices(cart: Cart, discounts: ProductDiscount[] = []): number[] {
        const combinations = this.getUnitPriceCombinationsWithoutDiscount(cart);

        // For reliable calculation, we'll need individual prices
        const prices: number[] = [];

        for (const [price, amount] of combinations) {
            for (let index = 0; index < amount; index++) {
                prices.push(price);
            }
        }

        let discountsQueue = discounts.slice();

        for (let index = 0; index < prices.length; index++) {
            const discount = discountsQueue.shift();
            if (discount) {
                prices[index] = discount.calculate(prices[index])
            }
        }

        return prices;
    }

    /**
     * This should get called after the Checkout object
     * added all the applicable discounts to all cart items.
     * After that, it calls this method for each cart item (starting with the most expensive cart items).
     * Every cart item can claim a discount if it is the best discount it can get.
     */
    calculateAppliedDiscounts(cart: Cart): number[] {
        const combinations = this.getUnitPriceCombinationsWithoutDiscount(cart);

        // For reliable calculation, we'll need individual prices
        const prices: number[] = [];

        for (const [price, amount] of combinations) {
            for (let index = 0; index < amount; index++) {
                prices.push(price);
            }
        }

        // Discounts should get applied to the most expensive prices first
        prices.sort((a, b) => b - a);

        // Reset applied discounts
        this.discounts = [];

        // Loop prices and look for the best discount
        for (let index = 0; index < prices.length; index++) {
            const price = prices[index];
            let bestPrice = price;
            let bestDiscount: ProductDiscountTracker|null = null;
            let bestDiscountUsed: ProductDiscount|null = null;

            for (const discount of this.applicableDiscounts) {
                const d = discount.getNextDiscount();
                if (d) {
                    const c = d.calculate(price);
                    if (c < bestPrice || bestDiscount === null) { // Price can also be equal, if discount = 0% (we need to count it because otherwise X + y discounts don't work)
                        bestPrice = c;
                        bestDiscount = discount;
                        bestDiscountUsed = d;
                    }
                }
            }

            if (bestDiscount && bestDiscountUsed) {
                this.discounts.push(bestDiscountUsed);
                bestDiscount.markUsed();
                prices[index] = bestPrice;
            }
        }

        return prices;
    }

    /**
     * Use this method if you need temporary prices in case it is not yet calculated
     */
    getUnitPriceWithDiscount(cart: Cart): number {
        // Get all discounts that are applied on all items without a limit
        return this.getUnitPrice(cart)
    }

    /**
     * @deprecated: use other systems
     * Prices that are only applicable to some amount, but not all (e.g. seat extra prices)
     */
    getPartialExtraPrice(cart: Cart) {
        const combinations = this.getUnitPriceCombinationsWithoutDiscount(cart)
        const unitPrice = this.getUnitPrice(cart);

        let extra = 0;
        for (const [price, amount] of combinations) {
            extra += Math.max(0, amount * (price - unitPrice))
        }

        return extra;
    }

    /**
     * @deprecated use getPriceWithDiscounts instead for clarity
     */
    getPrice(cart: Cart): number {
        return this.getPriceWithDiscounts(cart)
    }

    getUnitPriceCombinationsWithoutDiscount(cart: Cart) {
        const priceCombinations = new Map<number, number>()
        const unitPrice = this.getUnitPrice(cart)
        for (const seat of this.seats) {
            const seatPrice = unitPrice + seat.price
            priceCombinations.set(seatPrice, (priceCombinations.get(seatPrice) || 0) + 1)
        }

        // Others (non seats)
        const remaining = this.amount - this.seats.length
        if (remaining > 0) {
            priceCombinations.set(unitPrice, (priceCombinations.get(unitPrice) || 0) + remaining)
        }
        return priceCombinations;
    }

    /**
     * Without discounts
     */
    getFormattedPriceAmount(cart: Cart) {
        if (cart.price === 0) {
            if (!this.product.allowMultiple && this.amount <= 1) {
                return ""
            }
            return this.amount + " x ";
        }

        if (this.getPriceWithoutDiscounts(cart) === 0) {
            if (!this.product.allowMultiple && this.amount <= 1) {
                return "Gratis"
            }
            return this.amount + " x Gratis";
        }

        // Group by seats
        const priceCombinations = this.getUnitPriceCombinationsWithoutDiscount(cart);
        return this.priceCombinationToString(priceCombinations)
    }

    getFormattedDiscountPriceAmount(cart: Cart): string|null {
        const price = this.getPriceWithDiscounts(cart);
        if (price === this.getPriceWithoutDiscounts(cart)) {
            return null;
        }

        const prices = this.getIndividualUnitPrices(cart, this.discounts)
        const priceCombinations: Map<number, number> = new Map()
        for (const price of prices) {
            priceCombinations.set(price, (priceCombinations.get(price) ?? 0) + 1)
        }
        return this.priceCombinationToString(priceCombinations)
    }

    priceCombinationToString(priceCombinations:  Map<number, number>) {
        // Sort map by amount, keeping the price amount combination
        const sorted = [...priceCombinations.entries()].map(([price, amount]) => ({ price, amount })).sort((a, b) => b.amount - a.amount)

        // Format
        const parts: string[] = []
        for (const { price, amount } of sorted) {
            if (parts.length > 0 || price < 0) {
                if (price >= 0) {
                    parts.push("+")
                } else {
                    parts.push("-")
                }
            }

            if (!this.product.allowMultiple && amount === 1) {
                parts.push(Formatter.price(Math.abs(price)))
                continue
            }

            if (parts.length > 0 && price === 0) {
                parts.push(amount + " gratis")
            } else {
                parts.push(amount + " x " + Formatter.price(Math.abs(price)))
            }
        }

        return parts.join(" ")
    }

    /**
     * Used for statistics
     */
    get descriptionWithoutFields(): string {
        const descriptions: string[] = []

        if (this.product.prices.length > 1) {
            descriptions.push(this.productPrice.name)
        }
        for (const option of this.options) {
            descriptions.push(option.option.name)
        }

        if ((this.product.type === ProductType.Ticket || this.product.type === ProductType.Voucher) && this.product.dateRange) {
            descriptions.unshift(Formatter.capitalizeFirstLetter(this.product.dateRange.toString()))
        }

        return descriptions.filter(d => !!d).join("\n")
    }

    get descriptionWithoutDate(): string {
        const descriptions: string[] = []

        if (this.product.prices.length > 1) {
            descriptions.push(this.productPrice.name)
        }
        for (const option of this.options) {
            descriptions.push(option.option.name)
        }

        for (const a of this.fieldAnswers) {
            if (!a.answer) {
                continue
            }
            descriptions.push(a.field.name+": "+a.answer)
        }
        return descriptions.filter(d => !!d).join("\n")
    }

    get description(): string {
        const descriptions: string[] = [this.descriptionWithoutDate]

        if ((this.product.type === ProductType.Ticket || this.product.type === ProductType.Voucher) && this.product.dateRange) {
            descriptions.unshift(Formatter.capitalizeFirstLetter(this.product.dateRange.toString()))
        }
        return descriptions.filter(d => !!d).join("\n")
    }

    validateAnswers() {
        const newAnswers: WebshopFieldAnswer[] = []
        for (const field of this.product.customFields) {
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

    /**
     * Update self to the newest available data, and throw error if something failed (only after refreshing other ones)
     */
    refresh(webshop: Webshop) {
        const errors = new SimpleErrors()
        const product = webshop.products.find(p => p.id == this.product.id)
        if (!product) {
            errors.addError(new SimpleError({
                code: "product_unavailable",
                message: "Product unavailable",
                human: this.product.name+" is niet meer beschikbaar"
            }))
        } else {
            this.product = product
            const productPrice = product.prices.find(p => p.id === this.productPrice.id)
            if (!productPrice) {
                if (this.productPrice.name.length == 0 || this.product.prices.length <= 1 && product.prices.length > 1) {
                    errors.addError(new SimpleError({
                        code: "product_price_unavailable",
                        message: "Product price unavailable",
                        human: "Er werden keuzemogelijkheden toegevoegd aan "+this.product.name+", waar je nu eerst moet uit kiezen."
                    }))
                } else {
                    errors.addError(new SimpleError({
                        code: "product_price_unavailable",
                        message: "Product price unavailable",
                        human: "De keuzemogelijkheid '"+this.productPrice.name+"' van "+this.product.name+" is niet meer beschikbaar. Kies een andere."
                    }))
                }
            } else {
                // Only set product if we did find our product price
                this.productPrice = productPrice
            }

            // Check all options
            const remainingMenus = this.product.optionMenus.slice()

            for (const o of this.options) {
                let index = remainingMenus.findIndex(m => m.id === o.optionMenu.id)
                if (index == -1) {
                    // Check if it has a multiple choice one
                    index = this.product.optionMenus.findIndex(m => m.id === o.optionMenu.id)
                    errors.addError(new SimpleError({
                        code: "option_menu_unavailable",
                        message: "Option menu unavailable",
                        human: "Eén of meerdere keuzemogelijkheden van "+this.product.name+" zijn niet meer beschikbaar"
                    }))
                    continue
                }

                const menu = remainingMenus[index]
                if (!menu.multipleChoice) {
                    // Already used: not possible to add another
                    remainingMenus.splice(index, 1)[0]
                }
                
                const option = menu.options.find(m => m.id === o.option.id)

                if (!option) {
                    errors.addError(new SimpleError({
                        code: "option_unavailable",
                        message: "Option unavailable",
                        human: "Eén of meerdere keuzemogelijkheden van "+this.product.name+" zijn niet meer beschikbaar"
                    }))
                    continue
                }

                // Update to latest data
                o.optionMenu = menu
                o.option = option
            }

            if (remainingMenus.filter(m => !m.multipleChoice).length > 0) {
                errors.addError(
                    new SimpleError({
                        code: "missing_menu",
                        message: "Missing menu's "+remainingMenus.filter(m => !m.multipleChoice).map(m => m.name).join(", "),
                        human: "Er zijn nieuwe keuzemogelijkheden voor "+this.product.name+" waaruit je moet kiezen"
                    })
                )
            }
        }

        try {
            this.validateAnswers()
        } catch (e) {
            errors.addError(e)
        }

        errors.throwIfNotEmpty()
    }

    getFixedStockDefinitions(oldItem: CartItem|null|undefined, cart: Cart, webshop: Webshop, admin: boolean): StockDefinition[] {
        return CartStockHelper.getFixedStockDefinitions({ oldItem, cart, product: this.product, webshop, admin, amount: this.amount })
    }

    /**
     * Return all the stock definitions for this cart item with the currently selected options
     * = calculate how much you can order with these options
     */
    getAvailableStock(oldItem: CartItem|null|undefined, cart: Cart, webshop: Webshop, admin: boolean): StockDefinition[] {
        return CartStockHelper.getAvailableStock({ oldItem, cart, product: this.product, webshop, admin, amount: this.amount, productPrice: this.productPrice, options: this.options })
    }

    getMaximumRemaining(oldItem: CartItem|null|undefined, cart: Cart, webshop: Webshop, admin: boolean) {
        return CartStockHelper.getRemaining(this.getAvailableStock(oldItem, cart, webshop, admin))
    }

    /**
     * Update self to the newest available data and throw if it was not able to recover
     */
    validate(webshop: Webshop, cart: Cart, {refresh, admin, validateSeats}: {refresh?: boolean, admin?: boolean, validateSeats?: boolean} = {refresh: true, admin: false, validateSeats: true}) {
        this.cartError = null;

        if (admin === undefined) {
            admin = false
        }
        if (refresh === undefined) {
            refresh = true;
        }
        if (validateSeats === undefined) {
            validateSeats = true;
        }

        if (refresh) {
            this.refresh(webshop)
        }
        const product = this.product

        if (!product.allowMultiple) {
            this.amount = 1;
        }

        // Check stock
        if (!admin) {
            if (!product.isEnabled && this.amount > this.reservedAmount) {
                throw new SimpleError({
                    code: "product_unavailable",
                    message: "Product unavailable",
                    human: this.product.name+" is niet meer beschikbaar"
                })
            }

            if (this.productPrice.hidden) {
                throw new SimpleError({
                    code: "product_price_unavailable",
                    message: "Product price unavailable",
                    human: this.productPrice.name+" is niet meer beschikbaar"
                })
            }

            if (product.isSoldOut && this.amount > this.reservedAmount) {
                throw new SimpleError({
                    code: "product_unavailable",
                    message: "Product unavailable",
                    human: this.product.name+" is uitverkocht"
                })
            }

            const remaining = this.getAvailableStock(this, cart, webshop, admin)
            const minimumRemaining = CartStockHelper.getRemaining(remaining)
            if (minimumRemaining !== null && minimumRemaining < this.amount) {
                // Search for appropriate message in stock definitions
                const stockDefinition = remaining.find(r => r.remaining === minimumRemaining)
                throw new SimpleError({
                    code: "product_unavailable",
                    message: "Product unavailable",
                    human: stockDefinition?.text || "Er zijn nog maar "+minimumRemaining+" stuks beschikbaar van "+this.product.name,
                    meta: {recoverable: minimumRemaining > 0}
                })
            }
        }

        if (this.product.seatingPlanId && validateSeats) {
            const seatingPlan = webshop.meta.seatingPlans.find(s => s.id === this.product.seatingPlanId)
            if (!seatingPlan) {
                throw new SimpleError({
                    code: "seating_plan_unavailable",
                    message: "Invalid seating plan",
                    human: "Het zaalplan van "+this.product.name+" is niet meer beschikbaar. Herlaad de pagina en probeer opnieuw. Neem contact met ons op als het probleem zich herhaalt."
                })
            }

            // Check seats taken already?
            const reservedSeats = this.product.reservedSeats

            // Remove invalid seats
            const invalidSeats = this.seats.filter(s => {
                const valid = seatingPlan.isValidSeat(s, reservedSeats, this.reservedSeats);

                if (valid) {
                    return false
                } else {
                    if (!admin && seatingPlan.isAdminSeat(s)) {
                        return false
                    }
                    return true
                }
            })

            if (invalidSeats.length) {
                throw new SimpleError({
                    code: "seats_unavailable",
                    message: "Seats unavailable",
                    human: "De volgende plaatsen zijn niet meer beschikbaar: "+invalidSeats.map(s => s.getNameString(webshop, this.product)).join(", "),
                    meta: {recoverable: true}
                })
            }

            // Seating validation
            if (this.seats.length !== this.amount) {
                if (this.seats.length > this.amount) {
                    // We need to handle this, because this can be caused by a stock limit
                    throw new SimpleError({
                        code: "invalid_seats",
                        message: "Invalid seats",
                        human: `Kies ${Formatter.pluralText(this.amount, 'plaats', 'plaatsen')}`,
                        meta: {recoverable: true}
                    })
                }
                throw new SimpleError({
                    code: "invalid_seats",
                    message: "Invalid seats",
                    human: `Kies nog ${Formatter.pluralText(this.amount - this.seats.length, 'plaats', 'plaatsen')}`,
                    meta: {recoverable: true}
                })
            }

            // Check other cart items have same seats
            const otherItems = cart.items.filter(i => i.product.id === this.product.id && i.id != this.id)
            for (const item of otherItems) {
                for (const seat of item.seats) {
                    if (this.seats.find(s => s.equals(seat))) {
                        throw new SimpleError({
                            code: "seats_unavailable",
                            message: "Seats unavailable",
                            human: "De volgende plaatsen heb je twee keer gekozen: "+seat.getNameString(webshop, this.product)
                        })
                    }
                }
            }

            // Adjust seats automatically if enabled
            if (seatingPlan.requireOptimalReservation && !admin) {
                const otherSeats = cart.items.filter(i => i.product.id === this.product.id && i.id !== this.id).flatMap(i => i.seats)
                const adjusted = seatingPlan.adjustSeatsForBetterFit(this.seats, [...reservedSeats, ...otherSeats], this.reservedSeats)
                if (adjusted) {
                    this.seats = adjusted.map(a => CartReservedSeat.create(a))
                }

                // Edge case: if seats are not optimal across multiple items, we can't fix it
                const adjusted2 = seatingPlan.adjustSeatsForBetterFit([...this.seats, ...otherSeats], reservedSeats, this.reservedSeats)
                if (adjusted2) {
                    // Not able to correct this across multiple items
                    throw new SimpleError({
                        code: "select_connected_seats",
                        message: "Select connected seats",
                        human: "Pas de plaatsen aan zodat ze aansluiten en geen enkele plaatsen openlaten.",
                        meta: {recoverable: true}
                    })
                }
            }

            // Update prices
            for (const seat of this.seats) {
                seat.calculatePrice(seatingPlan)
            }
        }

        // Update prices
        this.calculateUnitPrice(cart)
    }
}

export class Cart extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(CartItem) })
    items: CartItem[] = []

    clear() {
        this.items = []
    }

    addItem(item: CartItem) {
        if (item.amount === 0) {
            return
        }
        const c = item.code
        for (const i of this.items) {
            if (i.code === c) {
                i.amount += item.amount
                i.seats.push(...item.seats)
                return
            }
        }
        this.items.push(item)
    }

    removeItem(item: CartItem) {
        const c = item.code
        for (const [index, i] of this.items.entries()) {
            if (i.code === c) {
                this.items.splice(index, 1)
                return
            }
        }
    }

    get price() {
        return Math.max(0, this.items.reduce((c, item) => c + item.getPrice(this), 0))
    }

    get count() {
        return this.items.reduce((c, item) => c + item.amount, 0)
    }

    get persons() {
        return this.items.reduce((sum, item) => sum + (item.product.type === ProductType.Person ? item.amount : 0), 0)
    }

    /**
     * Refresh all items with the newest data, throw if something failed (at the end)
     */
    refresh(webshop: Webshop) {
        const errors = new SimpleErrors()
        for (const item of this.items) {
            try {
                item.refresh(webshop)
            } catch (e) {
                errors.addError(e)
            }
        }

        errors.throwIfNotEmpty()
    }

    validate(webshop: Webshop, asAdmin = false) {
        const newItems: CartItem[] = []
        const errors = new SimpleErrors()
        for (const item of this.items) {
            try {
                item.validate(webshop, this, {
                    refresh: true,
                    admin: asAdmin
                })
                newItems.push(item)

                if (!webshop.meta.cartEnabled) {
                    break;
                }
            } catch (e) {
                if (isSimpleError(e) || isSimpleErrors(e)) {
                    e.addNamespace('cart')
                }
                errors.addError(e)

                if (isSimpleError(e) && (e.meta as any)?.recoverable) {
                    item.cartError = e;
                    newItems.push(item)

                    if (!webshop.meta.cartEnabled) {
                        break;
                    }
                }
            }
        }

        this.items = newItems
        errors.throwIfNotEmpty()
    }
}