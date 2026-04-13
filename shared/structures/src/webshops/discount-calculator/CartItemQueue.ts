import { CartItem } from "../CartItem.js";
import { CartItemPriceTracker } from "./CartItemPriceTracker.js";

export class CartItemQueue {
    /**
     * A queue of cart items and their prices
     */
    items: CartItemPriceTracker[];

    constructor(items: CartItemPriceTracker[] = []) {
        this.items = items;
    }

    get hasNext(): boolean {
        return this.items.length > 0;
    }

    get itemsWithoutDiscounts() {
        return this.items.filter(i => i.price.fixedDiscount === 0 && i.price.percentageDiscount === 0);
    }

    add(cartItem: CartItem) {
        // todo
        this.items.push(...cartItem.calculatedPrices.map(price => new CartItemPriceTracker(cartItem, price)));
    }

    sort() {
        // Sort from highest price to lowest price
        this.items.sort((a, b) => b.price.discountedPrice - a.price.discountedPrice);
    }

    poll() {
        const firstItem = this.items[0];
        if (firstItem.amountLeft === 1) {
            return this.items.shift();
        }

        firstItem.removeOne();
        return firstItem;
    }



    // apply(discount: ProductDiscount): boolean {
    //     if (!this.hasNext) {
    //         return false;
    //     }

    //     const item = this.poll()!;
    //     const potential = discount.calculatePotential(item.price);
    //             this.usageCount += 1;
    //             discount.applyTo(item.price);
    //             if (potential > 0 && !item.item.discounts.find(d => d.id === this.discount.id)) {
    //                 item.item.discounts.push(this.discount);
    //             }

    // }

}
