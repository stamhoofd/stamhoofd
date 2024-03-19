import { ArrayDecoder, AutoEncoder, BooleanDecoder, IntegerDecoder, StringDecoder, field } from "@simonbackx/simple-encoding";
import { CartItem } from "./Cart";
import { v4 as uuidv4 } from "uuid";
import { Checkout } from "./Checkout";
import { Webshop } from "./Webshop";
import { Formatter } from "@stamhoofd/utility";

export class ProductSelector extends AutoEncoder {
    @field({ decoder: StringDecoder })
    productId: string;

    /**
     * Empty array = doesn't matter
     * Array set = required one of the product prices from the list
     */
    @field({ decoder: new ArrayDecoder(StringDecoder) })
    productPriceIds: string[] = []

    @field({ decoder: new ArrayDecoder(StringDecoder) })
    excludeOptionIds: string[] = []

    @field({ decoder: new ArrayDecoder(StringDecoder), optional: true })
    requiredOptionIds: string[] = []

    doesMatch(cartItem: CartItem) {
        if (cartItem.product.id !== this.productId) {
            return false;
        }

        if (this.productPriceIds.includes(cartItem.productPrice.id)) {
            return false;
        }

        for (const option of cartItem.options) {
            if (this.excludeOptionIds.includes(option.option.id)) {
                return false;
            }
        }

        return true;
    }

    getName(webshop: Webshop, isAdmin = false): {name: string, footnote: string} {
        const product = webshop.products.find(p => p.id === this.productId);
        if (!product) {
            return {
                name: 'Onbekend artikel',
                footnote: ''
            }
        }

        const allPrices = product.filteredPrices({admin: isAdmin});
        const productPrices = allPrices.filter (p => this.productPriceIds.includes(p.id));
        let suffix = '';
        if (allPrices.length > 1 && this.productPriceIds.length && productPrices.length < allPrices.length) {
            suffix = productPrices.map(p => p.name).join(', ')
        }

        const excludedOptions = product.optionMenus.flatMap(o => o.options).filter(p => this.excludeOptionIds.includes(p.id))
        let footnote = '';

        if (excludedOptions.length) {
            footnote = 'Behalve voor keuzes met ' + Formatter.joinLast(excludedOptions.map(o => o.name), ', ', ' of ');
        }

        return {
            name: product.name + (suffix ? (' (' + suffix + ')') : ''),
            footnote
        }
    }
}

export class DiscountRequirement extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;
    
    @field({ decoder: ProductSelector })
    product: ProductSelector;

    /**
     * Minimum amount to trigger this requirement
     */
    @field({ decoder: IntegerDecoder })
    amount = 1

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
                amount += item.amount
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
    fixedDiscount = 0

    /**
     * Percentage discount on order, in pertenthousand 1 / 10 000
     * 10 = 0,1% discount
     * 1 = 0,01% discount
     */
    @field({ decoder: IntegerDecoder })
    percentageDiscount = 0

    @field({ decoder: BooleanDecoder })
    stackable = false

    multiply(amount: number): GeneralDiscount {
        return GeneralDiscount.create({
            fixedDiscount: Math.round(this.fixedDiscount * amount),
            percentageDiscount: this.percentageDiscount,
            stackable: this.stackable
        })
    }
}

export class ProductDiscount extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    discountPerPiece = 0

    /**
     * Percentage discount on order, in pertenthousand 1 / 10 000
     * 10 = 0,1% discount
     * 1 = 0,01% discount
     */
    @field({ decoder: IntegerDecoder })
    percentageDiscount = 0

    @field({ decoder: IntegerDecoder, nullable: true })
    amount: number|null = null

    @field({ decoder: BooleanDecoder })
    stackable = false

    multiply(amount: number): ProductDiscount {
        return ProductDiscount.create({
            discountPerPiece: this.discountPerPiece,
            percentageDiscount: this.percentageDiscount,
            amount: this.amount === null ? null : Math.round(this.amount * amount),
            stackable: this.stackable
        })
    }

    calculateTotalValue(item: CartItem) {

    }

    /**
     * Returns bundles of discounts that can get applied together
     */
    static stackDiscounts(discounts: ProductDiscount[]): ProductDiscount[][] {
        const stackableDiscounts: ProductDiscount[] = []
        const list: ProductDiscount[][] = [];
        for (const discount of discounts) {
            if (!discount.stackable) {
                list.push([discount])
            } else {
                stackableDiscounts.push(discount)
            }
        }
        if (stackableDiscounts.length) {
            list.push(stackableDiscounts)
        }
        return list
    }
}

export class ProductDiscountSettings extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;
    
    @field({ decoder: ProductSelector })
    product: ProductSelector;

    @field({ decoder: ProductDiscount })
    discount = ProductDiscount.create({})
}

export class Discount extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    /**
     * Empty list = no requirements
     */
     @field({ decoder: new ArrayDecoder(DiscountRequirement) })
    requirements: DiscountRequirement[] = []

    /**
     * If the requirements match x times, apply the discount x times
     */
    @field({ decoder: BooleanDecoder })
    applyMultipleTimes = false

    @field({ decoder: GeneralDiscount })
    orderDiscount = GeneralDiscount.create({})

    @field({ decoder: new ArrayDecoder(ProductDiscountSettings) })
    productDiscounts: ProductDiscountSettings[] = []

    getTitle(webshop: Webshop, isAdmin = false): {title: string, description: string, footnote: string} {
        let titles: string[] = [];
        let footnotes: string[] = [];
        let descriptions: string[] = [];

        if (this.orderDiscount.percentageDiscount) {
            titles.push(
                Formatter.percentage(this.orderDiscount.percentageDiscount) + " korting"
            )
        }
        if (this.orderDiscount.fixedDiscount) {
            titles.push(
                Formatter.price(this.orderDiscount.fixedDiscount) + " korting"
            )
        }

        for (const productDiscount of this.productDiscounts) {
            if (productDiscount.discount.percentageDiscount) {
                const n = productDiscount.product.getName(webshop, isAdmin)
                titles.push(
                    Formatter.percentage(productDiscount.discount.percentageDiscount) + " korting op " + n.name
                )
                if (n.footnote) {
                    const index = '*'.repeat(footnotes.length + 1);
                    titles.push(index)
                    footnotes.push(index + ' ' + n.footnote)
                }
            }
            if (productDiscount.discount.discountPerPiece) {
                const n = productDiscount.product.getName(webshop, isAdmin)
                titles.push(
                    Formatter.price(productDiscount.discount.discountPerPiece) + " korting per stuk op " + n.name
                )
                if (n.footnote) {
                    const index = '*'.repeat(footnotes.length + 1);
                    titles.push(index)
                    footnotes.push(index + ' ' + n.footnote)
                }
            }
        }

        if (titles.length === 0) {
            return {
                title: 'Geen korting',
                description: '',
                footnote: ''
            }
        }

        if (this.requirements.length) {
            if (this.applyMultipleTimes) {
                if (this.requirements.length > 1) {
                    descriptions.push('Per bestelde combinatie van')
                } else {
                    descriptions.push('Per besteld')
                }
            } else {
                descriptions.push('Bij bestellen van minstens')
            }

            const subdescriptions: string[] = [];

            for (const requirement of this.requirements) {
                const n = requirement.product.getName(webshop, isAdmin)
                subdescriptions.push(requirement.amount + ' x ' + n.name)

                if (n.footnote) {
                    const index = '*'.repeat(footnotes.length + 1);
                    subdescriptions[subdescriptions.length - 1] = subdescriptions[subdescriptions.length - 1]+index;
                    footnotes.push(index + ' ' + n.footnote)
                }
            }

            descriptions.push(Formatter.joinLast(subdescriptions, ', ', ' en '))
        }

        return {
            title: titles.join(' '),
            description: descriptions.join(' '),
            footnote: footnotes.join('\n')
        }
    }

    applyToCheckout(checkout: Checkout) {
        let matchCount: null|number = null;
        if (this.requirements.length > 0) {
            for (const requirement of this.requirements) {
                const amount = requirement.getMatchCount(checkout)

                if (amount === 0) {
                    // Not applicable
                    return;
                }

                matchCount = matchCount === null ? amount : Math.min(amount, matchCount)
            }
        }

        if (!this.applyMultipleTimes) {
            matchCount = 1;
        }

        // Fixed part to the whole order
        const multipliedOrderDiscount = this.orderDiscount.multiply(matchCount ?? 1)
        checkout.fixedDiscount += multipliedOrderDiscount.fixedDiscount
        checkout.percentageDiscount = Math.max(checkout.percentageDiscount , multipliedOrderDiscount.percentageDiscount)

        // Per product
        for (const item of checkout.cart.items) {
            for (const discount of this.productDiscounts) {
                if (discount.product.doesMatch(item)) {
                    const multipliedDiscount = discount.discount.multiply(matchCount ?? 1)
                    item.discounts.push(multipliedDiscount);
                    // item.discountPerPiece = Math.max(item.discountPerPiece, multipliedDiscount.discountPerPiece);
                    // item.percentageDiscount = Math.max(item.percentageDiscount, multipliedDiscount.percentageDiscount);
                }
            }
        }
    }
}