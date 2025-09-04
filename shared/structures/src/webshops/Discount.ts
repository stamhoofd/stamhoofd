import { ArrayDecoder, AutoEncoder, BooleanDecoder, Data, EncodeContext, EnumDecoder, IntegerDecoder, MapDecoder, PlainObject, StringDecoder, field } from '@simonbackx/simple-encoding';
import { CartItem, CartItemPrice } from './CartItem.js';
import { v4 as uuidv4 } from 'uuid';
import { Checkout } from './Checkout.js';
import { Webshop } from './Webshop.js';
import { Formatter } from '@stamhoofd/utility';
import { OptionMenu, Option } from './Product.js';

export enum OptionSelectionRequirement {
    Required = 'Required',
    Optional = 'Optional',
    Excluded = 'Excluded',
}

export class OptionSelectionRequirementHelper {
    static getName(requirement: OptionSelectionRequirement): string {
        switch (requirement) {
            case OptionSelectionRequirement.Required: return $t(`505a7d61-77d6-4531-aed6-4b6ed1ed7807`);
            case OptionSelectionRequirement.Optional: return $t(`72fed4b0-ed62-4121-85b5-8f47c0167fc9`);
            case OptionSelectionRequirement.Excluded: return $t(`b4f8ffba-e519-44a6-b0c3-9742c615c777`);
        }
    }
}

export class ProductSelector extends AutoEncoder {
    @field({ decoder: StringDecoder })
    productId: string;

    /**
     * Empty array = doesn't matter
     * Array set = required one of the product prices from the list
     */
    @field({ decoder: new ArrayDecoder(StringDecoder) })
    productPriceIds: string[] = [];

    /**
     * Options that are missing in the list get a default value
     * depending whether the option menu is multiple choice or not.
     *
     * For multiple choice:
     * - new options are optional
     *
     * For choose one:
     * - new options are exluded unless all options are optional
     */
    @field({ decoder: new MapDecoder(StringDecoder, new EnumDecoder(OptionSelectionRequirement)) })
    optionIds: Map<string, OptionSelectionRequirement> = new Map();

    getOptionRequirement(optionMenu: OptionMenu, option: Option): OptionSelectionRequirement {
        const value = this.optionIds.get(option.id);
        if (!value) {
            if (optionMenu.multipleChoice) {
                return OptionSelectionRequirement.Optional;
            }
            else {
                for (const o of optionMenu.options) {
                    if (this.optionIds.get(o.id) ?? OptionSelectionRequirement.Optional !== OptionSelectionRequirement.Optional) {
                        return OptionSelectionRequirement.Excluded;
                    }
                }
                return OptionSelectionRequirement.Optional;
            }
        }
        return value;
    }

    doesMatch(cartItem: CartItem) {
        if (cartItem.product.id !== this.productId) {
            return false;
        }

        if (this.productPriceIds.includes(cartItem.productPrice.id)) {
            return false;
        }

        for (const option of cartItem.options) {
            const value = this.getOptionRequirement(option.optionMenu, option.option);

            if (value === OptionSelectionRequirement.Excluded) {
                return false;
            }
        }

        for (const [id, requirement] of this.optionIds) {
            if (requirement === OptionSelectionRequirement.Required) {
                const found = cartItem.options.find(o => o.option.id === id);
                if (!found) {
                    return false;
                }
            }
        }

        return true;
    }

    getName(webshop: Webshop, isAdmin = false): { name: string; footnote: string } {
        const product = webshop.products.find(p => p.id === this.productId);
        if (!product) {
            return {
                name: $t(`261191bf-7565-4444-9e4c-7fffe5f7b919`),
                footnote: '',
            };
        }

        const allPrices = product.filteredPrices({ admin: isAdmin });
        const productPrices = allPrices.filter (p => this.productPriceIds.includes(p.id));
        let suffix = '';
        if (allPrices.length > 1 && this.productPriceIds.length && productPrices.length < allPrices.length) {
            suffix = productPrices.map(p => p.name).join(', ');
        }

        let footnote = '';

        const excludedOptions = product.optionMenus.flatMap((menu) => {
            return menu.options.filter(o => this.getOptionRequirement(menu, o) === OptionSelectionRequirement.Excluded);
        });

        const requiredOptions = product.optionMenus.flatMap((menu) => {
            return menu.options.filter(o => this.getOptionRequirement(menu, o) === OptionSelectionRequirement.Required);
        });

        if (excludedOptions.length && requiredOptions.length === 0) {
            footnote = $t(`adbc415b-8253-4ecc-bfc9-5d2045eb7e7e`) + ' ' + Formatter.joinLast(excludedOptions.map(o => o.name), ', ', ' ' + $t(`411cf334-eebb-4f27-beb6-d81bd544c3f5`) + ' ');
        }
        else if (excludedOptions.length === 0 && requiredOptions.length) {
            footnote = $t(`27a1749a-4496-4cb0-a8c3-dcda0d5c3002`) + ' ' + Formatter.joinLast(requiredOptions.map(o => o.name), ', ', ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' ');
        }
        else if (excludedOptions.length && requiredOptions.length) {
            footnote = $t(`27a1749a-4496-4cb0-a8c3-dcda0d5c3002`) + ' ' + Formatter.joinLast(requiredOptions.map(o => o.name), ', ', ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' ') + ' ' + $t(`27103382-c303-4e1d-872e-ec37c499ad5c`) + ' ' + Formatter.joinLast(excludedOptions.map(o => o.name), ', ', ' ' + $t(`411cf334-eebb-4f27-beb6-d81bd544c3f5`) + ' ');
        }

        return {
            name: product.name + (suffix ? (' (' + suffix + ')') : ''),
            footnote,
        };
    }
}

export class ProductsSelector extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(ProductSelector) })
    products: ProductSelector[] = [];

    doesMatch(cartItem: CartItem) {
        for (const product of this.products) {
            if (product.doesMatch(cartItem)) {
                return true;
            }
        }

        return false;
    }

    getName(webshop: Webshop, isAdmin = false): { name: string; footnote: string } {
        const names: string[] = [];
        const footnotes: string[] = [];

        for (const product of this.products) {
            const n = product.getName(webshop, isAdmin);
            names.push(n.name);
            if (n.footnote) {
                footnotes.push(n.footnote);
            }
        }

        return {
            name: Formatter.joinLast(names, ', ', ' of '),
            footnote: footnotes.join('\n'),
        };
    }

    static override decode<T extends typeof AutoEncoder>(this: T, data: Data): InstanceType<T> {
        if (data.optionalField('productId') && !data.optionalField('products')) {
            // Soft version upgrade: decode as ProductSelector
            const ps = ProductSelector.decode(data);
            const pss = ProductsSelector.create({
                products: [ps],
            });
            return pss as InstanceType<T>;
        }
        const decoded = super.decode<T>(data);

        return decoded;
    }

    override encode(context: EncodeContext): PlainObject {
        if (this.products.length === 1) {
            // Soft version upgrade: encode as ProductSelector
            return this.products[0].encode(context);
        }
        return super.encode(context);
    }
}

export class DiscountRequirement extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: ProductsSelector })
    product: ProductsSelector;

    /**
     * Minimum amount to trigger this requirement
     */
    @field({ decoder: IntegerDecoder })
    amount = 1;

    /**
     * Requirements can match multiple times (for X + Y discount systems)
     */
    getMatchCount(checkout: Checkout) {
        if (this.amount === 0) {
            return 0;
        }

        let amount = 0;
        for (const item of checkout.cart.items) {
            if (this.product.doesMatch(item)) {
                amount += item.amount;
            }
        }

        return Math.floor(amount / this.amount);
    }
}

export class GeneralDiscount extends AutoEncoder {
    /**
     * Fixed discount on order
     */
    @field({ decoder: IntegerDecoder })
    fixedDiscount = 0;

    /**
     * Percentage discount on order, in pertenthousand 1 / 10 000
     * 10 = 0,1% discount
     * 1 = 0,01% discount
     */
    @field({ decoder: IntegerDecoder })
    percentageDiscount = 0;

    multiply(amount: number): GeneralDiscount {
        return GeneralDiscount.create({
            fixedDiscount: Math.round(this.fixedDiscount * amount),
            percentageDiscount: Math.round(this.percentageDiscount * amount),
        });
    }
}

export class ProductDiscount extends AutoEncoder {
    /**
     * Id determines uniqueness so should not be reused between discounts
     */
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: IntegerDecoder })
    discountPerPiece = 0;

    /**
     * Percentage discount on order, in pertenthousand 1 / 10 000
     * 10 = 0,1% discount
     * 1 = 0,01% discount
     */
    @field({ decoder: IntegerDecoder })
    percentageDiscount = 0;

    calculate(price: number): number {
        price = Math.min(price, Math.max(0, Math.round(price * (10000 - this.percentageDiscount) / 10000))); // Min is required to support negative prices: prices should never increase after applyign discounts
        price = Math.min(price, Math.max(0, price - this.discountPerPiece)); // Min is required to support negative prices: prices should never increase after applyign discounts
        return price;
    }

    applyTo(item: CartItemPrice) {
        // Percentage discounts are always applied to the original price without other discounts
        item.percentageDiscount = Math.min(10000, item.percentageDiscount + this.percentageDiscount);
        item.fixedDiscount = item.fixedDiscount + this.discountPerPiece;
    }

    calculatePotential(item: CartItemPrice): number {
        const current = item;
        const potential = item.clone();
        this.applyTo(potential);

        return current.discountedPrice - potential.discountedPrice;
    }
}

export enum ProductDiscountRepeatBehaviour {
    Once = 'Once',
    RepeatLast = 'RepeatLast',
    RepeatPattern = 'RepeatPattern',
}

export class ProductDiscountSettings extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: ProductsSelector })
    product: ProductsSelector;

    @field({ decoder: new ArrayDecoder(ProductDiscount) })
    discounts = [ProductDiscount.create({})];

    @field({ decoder: new EnumDecoder(ProductDiscountRepeatBehaviour) })
    repeatBehaviour = ProductDiscountRepeatBehaviour.Once;

    @field({ decoder: StringDecoder, nullable: true, version: 238 })
    cartLabel: string | null = null;

    @field({ decoder: BooleanDecoder, optional: true })
    allowMultipleDiscountsToSameItem = true;

    getApplicableDiscounts(offset: number, amount: number): ProductDiscount[] {
        const d = this.discounts.slice();
        if (this.repeatBehaviour === ProductDiscountRepeatBehaviour.RepeatLast) {
            while (d.length < offset + amount) {
                d.push(this.discounts[this.discounts.length - 1]);
            }
        }
        else if (this.repeatBehaviour === ProductDiscountRepeatBehaviour.RepeatPattern) {
            while (d.length < offset + amount) {
                d.push(this.discounts[d.length % this.discounts.length]);
            }
        }

        return d.slice(offset, offset + amount);
    }

    getTitle(webshop: Webshop, isAdmin = false): { title: string; description: string; footnote: string } {
        const n = this.product.getName(webshop, isAdmin);

        const titles: string[] = [n.name];
        let descriptions: string[] = [];
        const footnotes: string[] = [];

        if (n.footnote) {
            const index = '*'.repeat(footnotes.length + 1);
            titles.push(index);
            footnotes.push(index + ' ' + n.footnote);
        }

        if (this.cartLabel) {
            descriptions.push(this.cartLabel);
        }
        else if (this.discounts.length === 1) {
            const discount = this.discounts[0];

            if (discount.percentageDiscount) {
                if (discount.percentageDiscount >= 100 * 100) {
                    if (this.repeatBehaviour !== ProductDiscountRepeatBehaviour.Once) {
                        descriptions.push($t(`99e41cea-bce3-4329-8b17-e3487c4534ac`));
                    }
                    else {
                        descriptions.push($t(`8177904b-bbd1-4755-a877-1739e4ce9bfd`));
                    }
                }
                else {
                    if (this.repeatBehaviour !== ProductDiscountRepeatBehaviour.Once) {
                        descriptions.push(Formatter.percentage(discount.percentageDiscount) + ' ' + $t(`c40c17f9-974a-401f-9728-f10fb0ab123b`));
                    }
                    else {
                        descriptions.push(
                            $t(`f9a69315-3aab-475f-844d-5f56097ad2cd`) + ' ' + Formatter.percentage(discount.percentageDiscount) + ' ' + $t(`c40c17f9-974a-401f-9728-f10fb0ab123b`),
                        );
                    }
                }
            }

            if (discount.discountPerPiece) {
                if (this.repeatBehaviour !== ProductDiscountRepeatBehaviour.Once) {
                    descriptions.push(Formatter.price(discount.discountPerPiece) + ' ' + $t(`d7434363-1b1d-4415-ac5a-10638ffd44f1`));
                }
                else {
                    descriptions.push(
                        $t(`f9a69315-3aab-475f-844d-5f56097ad2cd`) + ' ' + Formatter.price(discount.discountPerPiece) + ' ' + $t(`c40c17f9-974a-401f-9728-f10fb0ab123b`),
                    );
                }
            }
        }
        else {
            let index = 0;
            for (const discount of this.repeatBehaviour === ProductDiscountRepeatBehaviour.RepeatPattern ? [...this.discounts, ...this.discounts, ...this.discounts] : this.discounts) {
                index += 1;
                let s = Formatter.ordinalNumber(index) + ' ' + $t(`86e03c52-25db-45f7-a129-5f165b289324`);

                if (index === this.discounts.length) {
                    if (this.repeatBehaviour === ProductDiscountRepeatBehaviour.RepeatLast) {
                        if (descriptions.length > 0) {
                            s = $t(`43d37b46-05f0-48b9-83c7-860fde833b69`);
                        }
                        else {
                            s = $t(`12473d4b-d675-433b-ae5c-6b5854b066ba`) + ' ' + s;
                        }
                    }
                }

                if (discount.percentageDiscount) {
                    if (discount.percentageDiscount >= 100 * 100) {
                        descriptions.push(s + ' ' + $t(`50af1227-4f3d-46bb-a832-b62c4e3bc6ab`));
                    }
                    else {
                        descriptions.push(Formatter.percentage(discount.percentageDiscount) + ' ' + $t(`a22b8194-113e-4c0b-b818-a94ce39ed701`) + ' ' + s);
                    }
                }

                if (discount.discountPerPiece) {
                    descriptions.push(Formatter.price(discount.discountPerPiece) + ' ' + $t(`a22b8194-113e-4c0b-b818-a94ce39ed701`) + ' ' + s);
                }
            }

            if (this.repeatBehaviour === ProductDiscountRepeatBehaviour.RepeatPattern) {
                if (descriptions.length === 3 && this.discounts[this.discounts.length - 1].percentageDiscount === 100 * 100) {
                    descriptions = [(this.discounts.length - 1) + ' ' + $t(`1e976e4a-16ac-4d73-ad9b-f46720270c01`)];
                }
                else {
                    descriptions.push('...');
                }
            }
        }

        if (descriptions.length === 0) {
            descriptions.push($t(`fa7573e5-bcd0-4973-a9e3-29592d37f48e`));
        }

        return {
            title: titles.join(' '),
            description: Formatter.capitalizeFirstLetter(Formatter.joinLast(descriptions, ', ', ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' ')),
            footnote: footnotes.join('\n'),
        };
    }
}

export class ProductDiscountTracker {
    discount: ProductDiscountSettings;
    usageCount = 0;
    cartItemQueue: { price: CartItemPrice; item: CartItem }[] = [];

    constructor(discount: ProductDiscountSettings) {
        this.discount = discount;
    }

    getNextDiscount(offset = 0): ProductDiscount | null {
        const d = this.discount.getApplicableDiscounts(this.usageCount + offset, 1);
        if (d.length === 1) {
            return d[0];
        }
        return null;
    }

    sortQueue() {
        // Sort queue from highest price to lowest price
        this.cartItemQueue.sort((a, b) => {
            return b.price.discountedPrice - a.price.discountedPrice;
        });
    }

    get filteredQueue() {
        if (this.discount.allowMultipleDiscountsToSameItem) {
            return this.cartItemQueue;
        }
        return this.cartItemQueue.filter(i => i.price.fixedDiscount === 0 && i.price.percentageDiscount === 0);
    }

    apply() {
        // Make sure we use the next one in the discount applicable discounts
        this.sortQueue();
        this.cartItemQueue = this.filteredQueue;
        const item = this.cartItemQueue.shift();
        if (item) {
            const discount = this.getNextDiscount();
            if (discount) {
                const potential = discount.calculatePotential(item.price);
                this.usageCount += 1;
                discount.applyTo(item.price);
                if (potential > 0 && !item.item.discounts.find(d => d.id === this.discount.id)) {
                    item.item.discounts.push(this.discount);
                }
            }
        }
    }

    addItemToQueue(cartItem: CartItem) {
        this.cartItemQueue.push(...cartItem.calculatedPrices.map((price) => {
            return { price, item: cartItem };
        }));
    }

    getPotentialDiscount() {
        let offset = 0;
        let potential = 0;

        this.sortQueue();
        for (const item of this.filteredQueue) {
            const d = this.getNextDiscount(offset);
            if (d) {
                potential += d.calculatePotential(item.price);
            }
            else {
                break;
            }
            offset += 1;
        }
        return potential;
    }
}

export class Discount extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    /**
     * Empty list = no requirements
     */
    @field({ decoder: new ArrayDecoder(DiscountRequirement) })
    requirements: DiscountRequirement[] = [];

    /**
     * If the requirements match x times, apply the discount x times
     */
    @field({ decoder: BooleanDecoder })
    applyMultipleTimes = false;

    @field({ decoder: GeneralDiscount })
    orderDiscount = GeneralDiscount.create({});

    @field({ decoder: new ArrayDecoder(ProductDiscountSettings) })
    productDiscounts: ProductDiscountSettings[] = [];

    getTitle(webshop: Webshop, isAdmin = false): { title: string; description: string; footnote: string } {
        const titles: string[] = [];
        const footnotes: string[] = [];
        const descriptions: string[] = [];

        if (this.orderDiscount.percentageDiscount) {
            titles.push(
                Formatter.percentage(this.orderDiscount.percentageDiscount) + ' ' + $t(`c40c17f9-974a-401f-9728-f10fb0ab123b`),
            );
        }
        if (this.orderDiscount.fixedDiscount) {
            titles.push(
                Formatter.price(this.orderDiscount.fixedDiscount) + ' ' + $t(`c40c17f9-974a-401f-9728-f10fb0ab123b`),
            );
        }

        for (const productDiscount of this.productDiscounts) {
            const t = productDiscount.getTitle(webshop, isAdmin);

            titles.push(
                t.description + ' ' + $t(`4e1fc59e-32c1-4e36-a40e-af4f747e6e3b`) + ' ' + t.title,
            );

            if (t.footnote) {
                footnotes.push(t.footnote);
            }
        }

        if (titles.length === 0) {
            return {
                title: $t(`fa7573e5-bcd0-4973-a9e3-29592d37f48e`),
                description: '',
                footnote: '',
            };
        }

        if (this.requirements.length) {
            if (this.applyMultipleTimes) {
                if (this.requirements.length > 1) {
                    descriptions.push($t(`10b47f7b-8038-4678-9787-32054c30c7e4`));
                }
                else {
                    descriptions.push($t(`2f3c8b2c-96ce-44a2-a6d1-7238a03e3793`));
                }
            }
            else {
                descriptions.push($t(`ed3ec055-9777-49c1-8a77-c108114153b4`));
            }

            const subdescriptions: string[] = [];

            for (const requirement of this.requirements) {
                const n = requirement.product.getName(webshop, isAdmin);
                subdescriptions.push(requirement.amount + ' x ' + n.name);

                if (n.footnote) {
                    const index = '*'.repeat(footnotes.length + 1);
                    subdescriptions[subdescriptions.length - 1] = subdescriptions[subdescriptions.length - 1] + index;
                    footnotes.push(index + ' ' + n.footnote);
                }
            }

            descriptions.push(Formatter.joinLast(subdescriptions, ', ', ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' '));
        }

        return {
            title: titles.join(' '),
            description: descriptions.join(' '),
            footnote: footnotes.join('\n'),
        };
    }

    applyToCheckout(checkout: Checkout): ProductDiscountTracker[] {
        let matchCount: null | number = null;
        if (this.requirements.length > 0) {
            for (const requirement of this.requirements) {
                const amount = requirement.getMatchCount(checkout);

                if (amount === 0) {
                    // Not applicable
                    return [];
                }

                matchCount = matchCount === null ? amount : Math.min(amount, matchCount);
            }
        }

        if (matchCount === null) {
            matchCount = 1;
        }

        if (!this.applyMultipleTimes) {
            matchCount = 1;
        }

        // Fixed part to the whole order
        const multipliedOrderDiscount = this.orderDiscount.multiply(matchCount ?? 1);
        checkout.fixedDiscount += multipliedOrderDiscount.fixedDiscount;
        checkout.percentageDiscount = Math.min(10000, checkout.percentageDiscount + multipliedOrderDiscount.percentageDiscount);

        const trackers: ProductDiscountTracker[] = [];

        // Per product
        for (const discount of this.productDiscounts) {
            for (let index = 0; index < matchCount; index++) {
                const tracker = new ProductDiscountTracker(discount);

                for (const item of checkout.cart.items) {
                    if (discount.product.doesMatch(item)) {
                        tracker.addItemToQueue(item);
                        // item.applicableDiscounts.push(tracker);
                    }
                }

                trackers.push(tracker);
            }
        }

        return trackers;
    }
}
