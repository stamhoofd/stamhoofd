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

        let text = $t('8e07d5a3-f396-47a0-a6a1-4840fa3a896b', {
            '1-item-or-person-or-ticket': product.getRemainingStockText(remainingStock),
        });

        if (inCart > 0) {
            text = $t('a692b530-6f04-48a1-b2a0-75816ec408b0', {
                '1-item-or-person-or-ticket': product.getRemainingStockText(remainingStock),
            });
        }

        if (remainingStock !== 1) {
            text = $t('5a535712-c618-43a3-8eed-59a547db6c91', {
                '5-items-or-persons-or-tickets': product.getRemainingStockText(remainingStock),
            });

            if (inCart === 1) {
                text = $t('d5cbe857-9b30-4809-bfd1-b74a6938fdd4', {
                    '5-items-or-persons-or-tickets': product.getRemainingStockText(remainingStock),
                });
            }
            else if (inCart > 0) {
                text = $t('cdb66c67-f212-48d1-a5bc-f969748f6bfa', {
                    '5-items-or-persons-or-tickets': product.getRemainingStockText(remainingStock),
                    '4': inCart.toString(),
                });
            }
        }

        const showStockBelow = product.showStockBelow ?? Infinity;
        return {
            stock: remainingStock,
            remaining: admin ? null : remaining,
            text: remainingStock === 0 ? $t('6a33dbcd-25ae-462a-897c-d7e33a9acdd9', { 'product-name': product.name }) : (remaining < showStockBelow || (amount && remaining <= amount) ? text : null),
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

        let text = $t('380b897e-c3b8-418f-9c46-ef10724c6cf2', {
            '1-item-or-person-or-ticket': product.getRemainingStockText(remainingStock),
            'product-price-name': productPrice.name,
        });

        if (inCart > 0) {
            text = $t('50be5122-c04e-4d53-a059-5c40e34a92b6', {
                '1-item-or-person-or-ticket': product.getRemainingStockText(remainingStock),
                'product-price-name': productPrice.name,
            });
        }

        if (remainingStock !== 1) {
            text = $t('a50f1798-62eb-4980-8678-17abe9bfded4', {
                '5-items-or-persons-or-tickets': product.getRemainingStockText(remainingStock),
                'product-price-name': productPrice.name,
            });

            if (inCart === 1) {
                text = $t('5e0f0a60-2cb9-4093-8f85-a3f37c62b27f', {
                    '5-items-or-persons-or-tickets': product.getRemainingStockText(remainingStock),
                    'product-price-name': productPrice.name,
                });
            }
            else if (inCart > 0) {
                text = $t('04301229-4cbe-4ea0-bfdf-03284120f09f', {
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
            text: remainingStock === 0 ? $t('f9083abe-bb56-4e5d-9af6-f73a91c2666b', { 'product-price-name': productPrice.name }) : (remaining < showStockBelow || (amount && remaining <= amount) ? text : null),
            shortText: remainingStock === 0 ? $t(`44ba544c-3db6-4f35-b7d1-b63fdcadd9ab`) : (remaining === 0 ? $t(`b1c82354-0aa6-4bef-bef6-84261180919a`) : (remaining < showStockBelow ? $t('Nog {x-items}', { 'x-items': product.getRemainingStockText(remaining) }) : null)),
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

        let text = $t('380b897e-c3b8-418f-9c46-ef10724c6cf2', {
            '1-item-or-person-or-ticket': product.getRemainingStockText(remainingStock),
            'product-price-name': option.name,
        });

        if (inCart > 0) {
            text = $t('50be5122-c04e-4d53-a059-5c40e34a92b6', {
                '1-item-or-person-or-ticket': product.getRemainingStockText(remainingStock),
                'product-price-name': option.name,
            });
        }

        if (remainingStock !== 1) {
            text = $t('a50f1798-62eb-4980-8678-17abe9bfded4', {
                '5-items-or-persons-or-tickets': product.getRemainingStockText(remainingStock),
                'product-price-name': option.name,
            });

            if (inCart === 1) {
                text = $t('5e0f0a60-2cb9-4093-8f85-a3f37c62b27f', {
                    '5-items-or-persons-or-tickets': product.getRemainingStockText(remainingStock),
                    'product-price-name': option.name,
                });
            }
            else if (inCart > 0) {
                text = $t('04301229-4cbe-4ea0-bfdf-03284120f09f', {
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
            shortText: remainingStock === 0 ? $t(`44ba544c-3db6-4f35-b7d1-b63fdcadd9ab`) : (remaining === 0 ? $t(`b1c82354-0aa6-4bef-bef6-84261180919a`) : (remaining < showStockBelow ? $t('Nog {x-items}', { 'x-items': product.getRemainingStockText(remaining) }) : null)),
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

        let text = $t('Er is nog maar één plaats beschikbaar');

        if (inCart > 0) {
            text = $t('Er is nog maar één plaats beschikbaar, en die zit al in jouw winkelmandje');
        }

        if (remainingStock !== 1) {
            text = $t('Er zijn nog maar {x} plaatsen beschikbaar', {
                x: Formatter.integer(remainingStock),
            });

            if (inCart === 1) {
                text = $t('Er zijn nog maar {x} plaatsen beschikbaar, waarvan er al één in jouw winkelmandje zit', {
                    x: Formatter.integer(remainingStock),
                });
            }
            else if (inCart > 0) {
                text = $t('Er zijn nog maar {x} plaatsen beschikbaar, waarvan er al {4} in jouw winkelmandje zitten', {
                    x: Formatter.integer(remainingStock),
                    4: Formatter.integer(inCart),
                });
            }
        }

        const showStockBelow = product.showStockBelow ?? Infinity;
        return {
            stock: remainingStock,
            remaining,
            text: remainingStock === 0 ? $t(`460b1ea5-15c9-4b4f-8de3-76b5f319aa0f`) : (remaining < showStockBelow || (amount && remaining <= amount) ? text : null),
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

        let text = $t('Je kan maximaal {1-item-or-person-or-ticket} bestellen', {
            '1-item-or-person-or-ticket': product.getRemainingStockText(product.maxPerOrder),
        });

        if (inCart > 0) {
            text = $t('Je kan maximaal {1-item-or-person-or-ticket} bestellen, en die zit al in jouw winkelmandje', {
                '1-item-or-person-or-ticket': product.getRemainingStockText(product.maxPerOrder),
            });
        }

        if (product.maxPerOrder !== 1) {
            text = $t('Je kan maximaal {5-items-or-persons-or-tickets} bestellen', {
                '5-items-or-persons-or-tickets': product.getRemainingStockText(product.maxPerOrder),
            });

            if (inCart === 1) {
                text = $t('Je kan maximaal {5-items-or-persons-or-tickets} bestellen, waarvan er al één in jouw winkelmandje zit', {
                    '5-items-or-persons-or-tickets': product.getRemainingStockText(product.maxPerOrder),
                });
            }
            else if (inCart > 0) {
                text = $t('Je kan maximaal {5-items-or-persons-or-tickets} bestellen, waarvan er al {4} in jouw winkelmandje zitten', {
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
                text: $t(`5a6717be-0f1e-47b3-b9a8-76d6eb0057be`),
                shortText: $t(`b1c82354-0aa6-4bef-bef6-84261180919a`),
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
