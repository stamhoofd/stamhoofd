import { ArrayDecoder, AutoEncoder, field } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@simonbackx/simple-errors';

import { ProductType } from './Product.js';
import { Webshop } from './Webshop.js';
import { CartItem } from './CartItem.js';
import { Formatter } from '@stamhoofd/utility';
import { error } from 'console';

export class Cart extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(CartItem) })
    items: CartItem[] = [];

    clear() {
        this.items = [];
    }

    addItem(item: CartItem, allowMerge = true) {
        if (item.amount === 0) {
            return;
        }
        const c = item.code;
        for (const i of this.items) {
            if (i.code === c && allowMerge) {
                i.amount += item.amount;
                i.seats.push(...item.seats);
                i.uitpasNumbers.push(...item.uitpasNumbers);
                return;
            }
        }
        this.items.push(item);
    }

    removeItem(item: CartItem) {
        const c = item.code;
        for (const [index, i] of this.items.entries()) {
            if (i.code === c) {
                this.items.splice(index, 1);
                return;
            }
        }
    }

    replaceItem(old: CartItem, item: CartItem) {
        // First check if code is already used
        const c = item.code;
        const oldCode = old.code;

        for (const i of this.items) {
            if (i.code === c && i.code !== oldCode) {
                i.amount += item.amount;
                i.seats.push(...item.seats);
                i.uitpasNumbers.push(...item.uitpasNumbers);
                this.removeItem(old);
                return;
            }
        }

        for (const [index, i] of this.items.entries()) {
            if (i.code === oldCode) {
                this.items.splice(index, 1, item);
                return;
            }
        }

        if (item.amount === 0) {
            return;
        }
        this.removeItem(old);
        this.addItem(item);
    }

    /**
     * @deprecated
     * Be careful when to use the price with and without discounts
     */
    get price() {
        return this.priceWithDiscounts;
    }

    get priceWithDiscounts() {
        return Math.max(0, this.items.reduce((c, item) => c + item.getPriceWithDiscounts(), 0));
    }

    get priceWithoutDiscounts() {
        return Math.max(0, this.items.reduce((c, item) => c + item.getPriceWithoutDiscounts(), 0));
    }

    get count() {
        return this.items.reduce((c, item) => c + item.amount, 0);
    }

    get persons() {
        return this.items.reduce((sum, item) => sum + (item.product.type === ProductType.Person ? item.amount : 0), 0);
    }

    /**
     * Refresh all items with the newest data, throw if something failed (at the end)
     */
    refresh(webshop: Webshop) {
        const errors = new SimpleErrors();
        for (const item of this.items) {
            try {
                item.refresh(webshop);
            }
            catch (e) {
                if (isSimpleError(e) || isSimpleErrors(e)) {
                    errors.addError(e);
                }
                else {
                    throw e;
                }
            }
        }

        errors.throwIfNotEmpty();
    }

    validateUitpasNumbers() {
        // avoid duplicate UiTPAS-numbers on the same UiTPAS-event
        const officialUitpasSales = new Map<string, string[]>(); // Event URL -> UiTPAS numbers
        for (const item of this.items) {
            if (!item.product.uitpasEvent) {
                continue; // skip unofficial flow
            }
            if (officialUitpasSales.has(item.product.uitpasEvent.url)) {
                officialUitpasSales.get(item.product.uitpasEvent.url)!.push(...item.uitpasNumbers.map(p => p.uitpasNumber));
            }
            else {
                officialUitpasSales.set(item.product.uitpasEvent.url, item.uitpasNumbers.map(p => p.uitpasNumber));
            }
        }
        for (const [, uitpasNumbers] of officialUitpasSales.entries()) {
            if (uitpasNumbers.length !== Formatter.uniqueArray(uitpasNumbers).length) {
                throw new SimpleError({
                    code: 'duplicate_uitpas_numbers',
                    message: 'Duplicate uitpas numbers used',
                    human: $t('Een UiTPAS-nummer kan maar één keer gebruikt worden, per UiTPAS-evenement.'),
                    field: 'cart.items.uitpasNumbers',
                });
            }
        }
    }

    validate(webshop: Webshop, asAdmin = false) {
        const newItems: CartItem[] = [];
        const errors = new SimpleErrors();
        for (const item of this.items) {
            try {
                item.validate(webshop, this, {
                    refresh: true,
                    admin: asAdmin,
                });
                newItems.push(item);

                if (!webshop.meta.cartEnabled) {
                    break;
                }
            }
            catch (e) {
                if (isSimpleError(e) || isSimpleErrors(e)) {
                    e.addNamespace('cart');
                    errors.addError(e);
                }
                else {
                    throw e;
                }

                if (isSimpleError(e) && (e.meta as any)?.recoverable) {
                    item.cartError = e;
                    newItems.push(item);

                    if (!webshop.meta.cartEnabled) {
                        break;
                    }
                }
            }
        }

        this.items = newItems;

        if (errors.errors.length === 0) {
            // Only validate uitpas usage across items when all items are valid
            try {
                this.validateUitpasNumbers();
            }
            catch (e) {
                if (isSimpleError(e) || isSimpleErrors(e)) {
                    errors.addError(e);
                }
                else {
                    throw e;
                }
            }
        }

        errors.throwIfNotEmpty();
    }
}
