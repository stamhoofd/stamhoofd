import type { CartItem, CartItemPrice } from '../CartItem.js';

export class CartItemPriceTracker {
    private _amountLeft: number;

    get amountLeft() {
        return this._amountLeft;
    }

    constructor(readonly item: CartItem, readonly price: CartItemPrice) {
        this._amountLeft = price.amount;
    }

    removeOne() {
        this._amountLeft--;
    }
}
