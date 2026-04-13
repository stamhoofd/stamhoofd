

import type { Checkout } from '../Checkout.js';
import type { Discount, ProductDiscountSettings } from '../Discount.js';
import type { CartItem } from './CartItem.js';

export class DiscountCalculator {
    // general discounts
    private generalDiscount = {
        fixed: 0,
        percentage: 0
    }

    constructor(private readonly checkout: Checkout) {
        this.calculate();
    }

    private calculate() {

        /**
         * Discount can be fixed or percentage
         * 
         * Type of discounts:
         * - discount codes
         * - discounts:
         *     - product discounts
         *      => possible to have different discount for nth item
         *      => possible to repeat last discount or pattern, or to not repeat at all
         *      => sorting: for now highest price first -> shoud be possible to choose?
         *      => possible to choose if multiple discounts can be applied to the same item (allowMultipleDiscountsToSameItem)
         * 
         * Requirements:
         * 
         * Current discounts that are not possible:
         * - discount on group of products (cannot exceed total price of group)
         * - now all discounts can be combined -> make possible to prevent combining with certain other discounts?
         * 
         * Ideas:
         * - show different default discount types in frontend (for example 2nd free)
         * - also show advanced discount that can be configured completely
         * - only check cheapest discount in frontend? in backend only check if discount is possible
         */

        const discounts = this.checkout.discounts;
        const items = this.checkout.cart.items;

        // todo: check which combination is cheapest

        const discountMatchCounts: {discount: Discount, timesApplicable: number}[] = [];
        let hasProductDiscounts = false;

        for (const discount of discounts) {
            const timesApplicable = this.getTimesApplicable(discount);
            if (timesApplicable) {
                discountMatchCounts.push({discount, timesApplicable});
            }

            if (!hasProductDiscounts && discount.productDiscounts.length > 0) {
                hasProductDiscounts = true;
            }
        }

        if (!hasProductDiscounts) {
            // easiest => get biggest discount

            // todo
        }

        // apply general discounts
        for (const {discount, timesApplicable} of discountMatchCounts) {
            this.applyGeneralDiscount(discount, timesApplicable);
        }

        const itemDiscountTrackers: {item: CartItem, discounts: Map<CartItem, number>}[] = [];

        const itemsPerDiscount: {discount: ProductDiscountSettings, timesApplicable: number, items: CartItem[], timesApplied: Map<CartItem, number>}[] = discountMatchCounts.flatMap(({discount, timesApplicable}) => {
            const results: {discount: ProductDiscountSettings, items: CartItem[], timesApplicable: number}[] = [];

            for (const productDiscount of discount.productDiscounts) {
                const items = this.checkout.cart.items.filter(item => productDiscount.product.doesMatch(item));
                if (items.length) {
                    results.push({discount: productDiscount, items, timesApplicable, timesApplied: new Map()});
                }
            }

            return results;
        });

        // check product discounts
        // const discountsPerItem: {item: CartItem, discounts: {settings: ProductDiscountSettings, timesApplicable: number}[]}[] = this.checkout.cart.items.flatMap(item => {
        //     const discounts: {settings: ProductDiscountSettings, timesApplicable: number}[] = []

        //     for(const {discount, timesApplicable} of discountMatchCounts) {
        //         for(const productDiscount of discount.productDiscounts) {
        //             if(productDiscount.product.doesMatch(item)) {
        //                 discounts.push({settings: productDiscount, timesApplicable});
        //             }
        //         }
        //     }

        //     if(discounts.length === 0) {
        //         return [];
        //     }

        //     return {item, discounts};
        // });
    }

    private getTimesApplicable(discount: Discount) {
        // check requirements
        if (discount.requirements.length === 0) {
            return 1;
        }

        let leastMatchCount: null | number = null;

        for (const requirement of discount.requirements) {
            const requirementMatchCount = requirement.getMatchCount(this.checkout);

            // all requirements must match (requirements can have multiple products, these act as OR, but each requirement in the array is AND)
            if (requirementMatchCount === 0) {
                return 0;
            }

            // the requirement that matchest the least
            leastMatchCount = leastMatchCount === null ? requirementMatchCount : Math.min(requirementMatchCount, leastMatchCount);
        }

        if (!discount.applyMultipleTimes || leastMatchCount === null) {
            leastMatchCount = 1;
        }
        
        return leastMatchCount;
    }

    private applyGeneralDiscount(discount: Discount, timesApplicable: number): void {
        // calculate the general discount for the total cart
        const multipliedOrderDiscount = discount.orderDiscount.multiply(timesApplicable);
        this.generalDiscount.fixed += multipliedOrderDiscount.fixedDiscount;
        this.generalDiscount.percentage =  Math.min(10000, this.generalDiscount.percentage + multipliedOrderDiscount.percentageDiscount);
    }
}
