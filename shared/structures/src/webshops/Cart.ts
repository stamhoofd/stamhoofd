import { ArrayDecoder, AutoEncoder, field } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleErrors } from '@simonbackx/simple-errors';

import { ProductType } from './Product';
import { Webshop } from './Webshop';
import { CartItem } from './CartItem';

export class Cart extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(CartItem) })
    items: CartItem[] = []

    clear() {
        this.items = []
    }

    addItem(item: CartItem, allowMerge = true) {
        if (item.amount === 0) {
            return
        }
        const c = item.code
        for (const i of this.items) {
            if (i.code === c && allowMerge) {
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

    replaceItem(old: CartItem, item: CartItem) {
        // First check if code is already used
        const c = item.code
        const oldCode = old.code
        
        for (const i of this.items) {
            if (i.code === c && i.code !== oldCode) {
                i.amount += item.amount
                i.seats.push(...item.seats)
                this.removeItem(old)
                return
            }
        }
        
        for (const [index, i] of this.items.entries()) {
            if (i.code === oldCode) {
                this.items.splice(index, 1, item)
                return
            }
        }

        if (item.amount === 0) {
            return
        }
        this.removeItem(old)
        this.addItem(item)
    }

    /**
     * @deprecated
     * Be careful when to use the price with and without discounts
     */
    get price() {
        return this.priceWithDiscounts
    }

    get priceWithDiscounts() {
        return Math.max(0, this.items.reduce((c, item) => c + item.getPriceWithDiscounts(), 0))
    }

    get priceWithoutDiscounts() {
        return Math.max(0, this.items.reduce((c, item) => c + item.getPriceWithoutDiscounts(), 0))
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