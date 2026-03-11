import { Formatter } from '@stamhoofd/utility';

import { Cart } from './Cart.js';
import { CartItem, CartItemOption } from './CartItem.js';
import { Option, Product, ProductPrice } from './Product.js';
import { Webshop } from './Webshop.js';

export type StockLookupData = {
    product: Product;
    oldItem?: CartItem | null | undefined;
    cart: Cart;
    webshop: Webshop;
    admin: boolean;
    amount?: number;
};

export type StockDefinition = {
    /**
     * How much actually left in stock, not taking into account what is in the cart (except the reserved items in the cart)
     */
    stock: number;

    /**
     * The maximum amount we can select with the current options when editing our item
     */
    remaining: number | null;
    text: string | null;
    shortText?: string | null; // Context aware text
};

export class CartStockHelper {
    static getProductStock({ oldItem, cart, product, admin, amount }: StockLookupData): StockDefinition | null {
        if (product.remainingStock === null) {
            return null;
        }

        const inCart = cart.items.reduce((prev, item) => {
            if (item.id === oldItem?.id) {
                return prev;
            }
            if (item.product.id !== product.id) {
                return prev;
            }
            return prev + item.amount;
        }, 0);

        const reserved = cart.items.reduce((prev, item) => {
            if (item.product.id !== product.id) {
                return prev;
            }
            return prev + item.reservedAmount;
        }, 0);

        const remainingStock = product.remainingStock + reserved;
        const remaining = Math.max(0, remainingStock - inCart);

        let text = $t('%1Da', {
            '1-item-or-person-or-ticket': product.getRemainingStockText(remainingStock),
        });

        if (inCart > 0) {
            text = $t('%1Db', {
                '1-item-or-person-or-ticket': product.getRemainingStockText(remainingStock),
            });
        }

        if (remainingStock !== 1) {
            text = $t('%1Dc', {
                '5-items-or-persons-or-tickets': product.getRemainingStockText(remainingStock),
            });

            if (inCart === 1) {
                text = $t('%1Dd', {
                    '5-items-or-persons-or-tickets': product.getRemainingStockText(remainingStock),
                });
            }
            else if (inCart > 0) {
                text = $t('%1De', {
                    '5-items-or-persons-or-tickets': product.getRemainingStockText(remainingStock),
                    '4': inCart.toString(),
                });
            }
        }

        const showStockBelow = product.showStockBelow ?? Infinity;
        return {
            stock: remainingStock,
            remaining: admin ? null : remaining,
            text: remainingStock === 0 ? $t('%1DY', { 'product-name': product.name }) : (remaining < showStockBelow || (amount && remaining <= amount) ? text : null),
        };
    }

    static getPriceStock({ productPrice, oldItem, cart, product, admin, amount }: StockLookupData & { productPrice: ProductPrice }): StockDefinition | null {
        if (productPrice.remainingStock === null) {
            return null;
        }

        const inCart = cart.items.reduce((prev, item) => {
            if (item.id === oldItem?.id) {
                return prev;
            }
            if (item.product.id !== product.id) {
                return prev;
            }
            if (item.productPrice.id !== productPrice.id) {
                return prev;
            }
            return prev + item.amount;
        }, 0);

        const reserved = cart.items.reduce((prev, item) => {
            if (item.product.id !== product.id) {
                return prev;
            }
            if (item.productPrice.id !== productPrice.id) {
                return prev;
            }
            return prev + item.reservedAmount;
        }, 0);

        const remainingStock = productPrice.remainingStock + reserved;
        const remaining = Math.max(0, remainingStock - inCart);

        let text = $t('%1Df', {
            '1-item-or-person-or-ticket': product.getRemainingStockText(remainingStock),
            'product-price-name': productPrice.name,
        });

        if (inCart > 0) {
            text = $t('%1Dg', {
                '1-item-or-person-or-ticket': product.getRemainingStockText(remainingStock),
                'product-price-name': productPrice.name,
            });
        }

        if (remainingStock !== 1) {
            text = $t('%1Dh', {
                '5-items-or-persons-or-tickets': product.getRemainingStockText(remainingStock),
                'product-price-name': productPrice.name,
            });

            if (inCart === 1) {
                text = $t('%1Di', {
                    '5-items-or-persons-or-tickets': product.getRemainingStockText(remainingStock),
                    'product-price-name': productPrice.name,
                });
            }
            else if (inCart > 0) {
                text = $t('%1Dj', {
                    '5-items-or-persons-or-tickets': product.getRemainingStockText(remainingStock),
                    'product-price-name': productPrice.name,
                    '4': inCart.toString(),
                });
            }
        }

        const showStockBelow = product.showStockBelow ?? Infinity;
        return {
            stock: remainingStock,
            remaining: admin ? null : remaining,
            text: remainingStock === 0 ? $t('%1DZ', { 'product-price-name': productPrice.name }) : (remaining < showStockBelow || (amount && remaining <= amount) ? text : null),
            shortText: remainingStock === 0 ? $t(`%12p`) : (remaining === 0 ? $t(`%zD`) : (remaining < showStockBelow ? $t('%1H4', { 'x-items': product.getRemainingStockText(remaining) }) : null)),
        };
    }

    static getOptionStock({ option, oldItem, cart, product, admin, amount }: StockLookupData & { option: Option }): StockDefinition | null {
        if (option.remainingStock === null) {
            return null;
        }

        function hasOption(item: CartItem) {
            return item.options.some(o => o.option.id === option.id);
        }

        const inCart = cart.items.reduce((prev, item) => {
            if (item.id === oldItem?.id) {
                return prev;
            }
            if (item.product.id !== product.id) {
                return prev;
            }
            if (!hasOption(item)) {
                return prev;
            }
            return prev + item.amount;
        }, 0);

        const reserved = cart.items.reduce((prev, item) => {
            if (item.product.id !== product.id) {
                return prev;
            }
            if (!hasOption(item)) {
                return prev;
            }
            return prev + item.reservedAmount;
        }, 0);

        const remainingStock = option.remainingStock + reserved;
        const remaining = Math.max(0, remainingStock - inCart);

        let text = $t('%1Df', {
            '1-item-or-person-or-ticket': product.getRemainingStockText(remainingStock),
            'product-price-name': option.name,
        });

        if (inCart > 0) {
            text = $t('%1Dg', {
                '1-item-or-person-or-ticket': product.getRemainingStockText(remainingStock),
                'product-price-name': option.name,
            });
        }

        if (remainingStock !== 1) {
            text = $t('%1Dh', {
                '5-items-or-persons-or-tickets': product.getRemainingStockText(remainingStock),
                'product-price-name': option.name,
            });

            if (inCart === 1) {
                text = $t('%1Di', {
                    '5-items-or-persons-or-tickets': product.getRemainingStockText(remainingStock),
                    'product-price-name': option.name,
                });
            }
            else if (inCart > 0) {
                text = $t('%1Dj', {
                    '5-items-or-persons-or-tickets': product.getRemainingStockText(remainingStock),
                    'product-price-name': option.name,
                    '4': inCart.toString(),
                });
            }
        }

        const showStockBelow = product.showStockBelow ?? Infinity;
        return {
            stock: remainingStock,
            remaining: admin ? null : remaining,
            text: remainingStock === 0 ? `${Formatter.capitalizeFirstLetter(option.name)} is uitverkocht` : (remaining < showStockBelow || (amount && remaining <= amount) ? text : null),
            shortText: remainingStock === 0 ? $t(`%12p`) : (remaining === 0 ? $t(`%zD`) : (remaining < showStockBelow ? $t('%1H4', { 'x-items': product.getRemainingStockText(remaining) }) : null)),
        };
    }

    static getSeatsStock({ oldItem, cart, product, webshop, admin, amount }: StockLookupData): StockDefinition | null {
        const remainingSeats = product.getRemainingSeats(webshop, admin);
        if (remainingSeats === null) {
            return null;
        }
        const inCart = cart.items.reduce((prev, item) => {
            if (item.id === oldItem?.id) {
                return prev;
            }
            if (item.product.id !== product.id) {
                return prev;
            }
            return prev + item.seats.length;
        }, 0);

        const reserved = cart.items.reduce((prev, item) => {
            if (item.product.id !== product.id) {
                return prev;
            }
            return prev + item.reservedSeats.length;
        }, 0);

        const remainingStock = remainingSeats + reserved;
        const remaining = Math.max(0, remainingStock - inCart);

        let text = $t('%1H5');

        if (inCart > 0) {
            text = $t('%1H6');
        }

        if (remainingStock !== 1) {
            text = $t('%1H7', {
                x: Formatter.integer(remainingStock),
            });

            if (inCart === 1) {
                text = $t('%1H8', {
                    x: Formatter.integer(remainingStock),
                });
            }
            else if (inCart > 0) {
                text = $t('%1H9', {
                    x: Formatter.integer(remainingStock),
                    4: Formatter.integer(inCart),
                });
            }
        }

        const showStockBelow = product.showStockBelow ?? Infinity;
        return {
            stock: remainingStock,
            remaining,
            text: remainingStock === 0 ? $t(`%sP`) : (remaining < showStockBelow || (amount && remaining <= amount) ? text : null),
        };
    }

    static getOrderMaximum({ amount, oldItem, cart, product, admin }: StockLookupData): StockDefinition | null {
        if (product.maxPerOrder === null) {
            return null;
        }

        if (admin) {
            return null;
        }

        const inCart = cart.items.reduce((prev, item) => {
            if (item.id === oldItem?.id) {
                return prev;
            }
            if (item.product.id !== product.id) {
                return prev;
            }
            return prev + item.amount;
        }, 0);

        const remaining = product.maxPerOrder - inCart;
        const show = (amount === undefined || (remaining <= amount));

        let text = $t('%1HA', {
            '1-item-or-person-or-ticket': product.getRemainingStockText(product.maxPerOrder),
        });

        if (inCart > 0) {
            text = $t('%1HB', {
                '1-item-or-person-or-ticket': product.getRemainingStockText(product.maxPerOrder),
            });
        }

        if (product.maxPerOrder !== 1) {
            text = $t('%1HC', {
                '5-items-or-persons-or-tickets': product.getRemainingStockText(product.maxPerOrder),
            });

            if (inCart === 1) {
                text = $t('%1HD', {
                    '5-items-or-persons-or-tickets': product.getRemainingStockText(product.maxPerOrder),
                });
            }
            else if (inCart > 0) {
                text = $t('%1HE', {
                    '5-items-or-persons-or-tickets': product.getRemainingStockText(product.maxPerOrder),
                    '4': Formatter.integer(inCart),
                });
            }
        }

        return {
            stock: product.maxPerOrder,
            remaining: product.maxPerOrder - inCart,
            text: !show ? null : text,
        };
    }

    static getAllowMultiple({ amount, oldItem, cart, product, admin }: StockLookupData): StockDefinition | null {
        if (product.allowMultiple) {
            return null;
        }

        const inCart = cart.items.reduce((prev, item) => {
            if (item.id === oldItem?.id) {
                return prev;
            }
            if (item.product.id !== product.id) {
                return prev;
            }
            if (item.code !== oldItem?.code) {
                return prev;
            }
            return prev + item.amount;
        }, 0);

        if (inCart > 0) {
            return {
                stock: 1,
                remaining: 0,
                text: $t(`%sQ`),
                shortText: $t(`%zD`),
            };
        }

        return {
            stock: 1,
            remaining: 1,
            text: null,
        };
    }

    static getFixedStockDefinitions(data: StockLookupData, options: { excludeOrder?: boolean } = {}): StockDefinition[] {
        const definitions: StockDefinition[] = [];

        // General product amount
        const productStock = CartStockHelper.getProductStock(data);
        if (productStock) {
            definitions.push(productStock);
        }

        // Seats stock
        const seatsStock = CartStockHelper.getSeatsStock(data);
        if (seatsStock) {
            definitions.push(seatsStock);
        }

        // Maximum per order
        if (!options.excludeOrder) {
            const orderMaximum = CartStockHelper.getOrderMaximum(data);
            if (orderMaximum) {
                definitions.push(orderMaximum);
            }

            const allowMultiple = CartStockHelper.getAllowMultiple(data);
            if (allowMultiple) {
                definitions.push(allowMultiple);
            }
        }

        return definitions;
    }

    /**
     * Return all the stock definitions for this cart item with the currently selected options
     * = calculate how much you can order with these options
     */
    static getAvailableStock(data: StockLookupData & { productPrice: ProductPrice; options: CartItemOption[] }): StockDefinition[] {
        const definitions: StockDefinition[] = this.getFixedStockDefinitions(data);

        const priceStock = CartStockHelper.getPriceStock(data);
        if (priceStock) {
            definitions.push(priceStock);
        }

        for (const option of data.options) {
            const optionStock = CartStockHelper.getOptionStock({ ...data, option: option.option });
            if (optionStock) {
                definitions.push(optionStock);
            }
        }

        return definitions;
    }

    static getRemainingAcrossOptions(data: StockLookupData, options: { inMultipleCartItems?: boolean; excludeOrder?: boolean } = {}): number | null {
        let remaining = this.getRemaining(this.getFixedStockDefinitions(data, options));

        // We sum the amount of product price stock remaining
        // We can for example order 5 medium + 10 large, so total stock is 15 remaining
        let maximumPriceStock: number | null = 0;
        for (const productPrice of data.product.filteredPrices({ admin: data.admin })) {
            const priceStock = CartStockHelper.getPriceStock({ ...data, productPrice });
            if (priceStock && priceStock.remaining !== null) {
                if (options.inMultipleCartItems) {
                    maximumPriceStock += priceStock.remaining;
                }
                else {
                    if (priceStock.remaining > maximumPriceStock) {
                        maximumPriceStock = priceStock.remaining;
                    }
                }
            }
            else {
                // Infinite price stock
                maximumPriceStock = null;
                break;
            }
        }
        if (maximumPriceStock !== null) {
            if (remaining === null) {
                remaining = maximumPriceStock;
            }
            else {
                remaining = Math.min(remaining, maximumPriceStock);
            }
        }

        // Options
        for (const optionMenu of data.product.optionMenus) {
            if (optionMenu.multipleChoice) {
                // Not affecting maximum stock because choice is optional
                continue;
            }

            let maximumOptionStock: number | null = 0;
            for (const option of optionMenu.options) {
                const optionStock = CartStockHelper.getOptionStock({ ...data, option });
                if (optionStock && optionStock.remaining !== null) {
                    if (options.inMultipleCartItems) {
                        maximumOptionStock += optionStock.remaining;
                    }
                    else {
                        if (optionStock.remaining > maximumOptionStock) {
                            maximumOptionStock = optionStock.remaining;
                        }
                    }
                }
                else {
                    // Infinite option stock
                    maximumOptionStock = null;
                    break;
                }
            }
            if (maximumOptionStock !== null) {
                if (remaining === null) {
                    remaining = maximumOptionStock;
                }
                else {
                    remaining = Math.min(remaining, maximumOptionStock);
                }
            }
        }

        return remaining;
    }

    static getRemaining(definitions: StockDefinition[]): number | null {
        const minArr = definitions.map(s => s.remaining).filter(v => v !== null) as number[];

        if (minArr.length === 0) {
            return null;
        }

        return Math.min(...minArr);
    }
}
