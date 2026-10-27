import { ArrayDecoder, AutoEncoder, field } from '@common/encoding';
import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from '@common/errors';
import { v4 as uuidv4 } from 'uuid';

import { ProductType } from './Product.js';
import type { Webshop } from './Webshop.js';
import { CartItem } from './CartItem.js';
import { Formatter } from '@stamhoofd/utility';
import { WebshopOrderMode } from './WebshopMetaData.js';

export class Cart extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(CartItem) })
    items: CartItem[] = [];

    clear() {
        this.items = [];
    }

    /**
     * Validates one item of this cart like validate does: only the items before it count against the stock
     */
    validateItem(webshop: Webshop, item: CartItem, options: { validateSeats?: boolean } = {}) {
        const index = this.items.indexOf(item);
        item.validate(webshop, this, {
            refresh: true,
            validateSeats: options.validateSeats ?? true,
            validateDetails: true,
            stockCart: Cart.create({ items: this.items.slice(0, index + 1) }),
        });
    }

    /**
     * The bulk order mode has one item per unit. Splits items with a larger amount, e.g. from a cart that was saved
     * before the webshop switched to bulk mode. Every unit keeps its own seat.
     */
    splitIntoUnits() {
        this.items = this.items.flatMap((item) => {
            if (item.amount <= 1) {
                return [item];
            }
            return Array.from({ length: item.amount }, (_, index) => {
                const unit = item.clone();
                if (index > 0) {
                    unit.id = uuidv4();
                }
                unit.amount = 1;
                unit.seats = item.seats.slice(index, index + 1);
                unit.uitpasNumbers = item.uitpasNumbers.slice(index, index + 1);
                return unit;
            });
        });
    }

    /**
     * A copy in which the items with the same code are combined like addItem does, e.g. the units of the bulk order
     * mode with the same choices, for the overview and the order
     */
    grouped(): Cart {
        const cart = Cart.create({});
        for (const item of this.items) {
            cart.addItem(item.clone());
        }
        return cart;
    }

    addItem(item: CartItem, allowMerge = true) {
        if (item.amount === 0) {
            return;
        }
        const c = item.code;
        // One person per item: never merge items with a customer, even with identical data
        const merge = allowMerge && !item.product.enableCustomer;
        for (const i of this.items) {
            if (i.code === c && merge) {
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
            if (i.code === c && i.code !== oldCode && !item.product.enableCustomer) {
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
            } catch (e) {
                if (isSimpleError(e) || isSimpleErrors(e)) {
                    errors.addError(e);
                } else {
                    throw e;
                }
            }
        }

        errors.throwIfNotEmpty();
    }

    validateUitpasNumbers() {
        // The units of the bulk order mode are combined in the order, which then checks its items again
        for (const item of this.grouped().items) {
            item.validateUitpasNumbers();
        }

        // avoid duplicate UiTPAS-numbers on the same UiTPAS-event
        const officialUitpasSales = new Map<string, string[]>(); // Event URL -> UiTPAS numbers
        for (const item of this.items) {
            if (!item.product.uitpasEvent) {
                continue; // skip unofficial flow
            }
            if (officialUitpasSales.has(item.product.uitpasEvent.url)) {
                officialUitpasSales.get(item.product.uitpasEvent.url)!.push(...item.uitpasNumbers.map(p => p.uitpasNumber));
            } else {
                officialUitpasSales.set(item.product.uitpasEvent.url, item.uitpasNumbers.map(p => p.uitpasNumber));
            }
        }
        for (const [, uitpasNumbers] of officialUitpasSales.entries()) {
            if (uitpasNumbers.length !== Formatter.uniqueArray(uitpasNumbers).length) {
                throw new SimpleError({
                    code: 'duplicate_uitpas_numbers',
                    message: 'Duplicate uitpas numbers used',
                    human: $t('%1DU'),
                    field: 'cart.items.uitpasNumbers',
                });
            }
        }
    }

    /**
     * In bulk order mode the seats and the item details are entered in separate checkout steps after the items
     * are chosen. Pass validateSeats or validateDetails = false while that step hasn't been reached yet, so items
     * aren't rejected for data the customer still has to enter. See CartItem.validate for what validateDetails covers.
     */
    validate(webshop: Webshop, asAdmin = false, { validateSeats = true, validateDetails = true }: { validateSeats?: boolean; validateDetails?: boolean } = {}) {
        const newItems: CartItem[] = [];
        const errors = new SimpleErrors();
        const singleItem = webshop.orderMode === WebshopOrderMode.Single;

        for (const [index, item] of this.items.entries()) {
            try {
                item.validate(webshop, Cart.create({ items: [...newItems, ...this.items.slice(index)] }), {
                    refresh: true,
                    admin: asAdmin,
                    validateSeats,
                    validateDetails,
                    // Only the items kept so far count against the stock, so the first units within stock stay. Otherwise
                    // every unit of a product with one item per unit (bulk, per-item customers) sees all the others.
                    // Seats are still checked against every other item.
                    stockCart: Cart.create({ items: [...newItems, item] }),
                });
                newItems.push(item);

                if (singleItem) {
                    break;
                }
            } catch (e) {
                if (isSimpleError(e) || isSimpleErrors(e)) {
                    e.addNamespace('cart');
                    errors.addError(e);
                } else {
                    throw e;
                }

                if (isSimpleError(e) && (e.meta as any)?.recoverable) {
                    item.cartError = e;
                    newItems.push(item);

                    if (singleItem) {
                        break;
                    }
                }
            }
        }

        this.items = newItems;

        if (errors.errors.length === 0 && validateDetails) {
            // Only validate uitpas usage across items when all items are valid
            try {
                this.validateUitpasNumbers();
            } catch (e) {
                if (isSimpleError(e) || isSimpleErrors(e)) {
                    errors.addError(e);
                } else {
                    throw e;
                }
            }
        }

        errors.throwIfNotEmpty();
    }
}
