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

        let more = '';
        if (inCart > 0) {
            if (inCart === 1) {
                more = $t('dca6ed7e-348a-46e0-b3d4-1f0b21945312', { inCart: inCart.toString() });
            }
            else {
                more = $t('339ecfa6-d5c3-4126-bdbb-66c1a9b1fd7d', { inCart: inCart.toString() });
            }
        }
        const text: string | null = `Er ${remainingStock === 1 ? $t(`af839b8a-1367-4655-ad1c-ee658843e9f1`) : $t(`31bacb3a-2920-4bf3-9e68-d7887ef17fe4`)} nog maar ${product.getRemainingStockText(remainingStock)} beschikbaar${more}`;
        return {
            stock: remainingStock,
            remaining: admin ? null : remaining,
            text: remainingStock === 0 ? `${Formatter.capitalizeFirstLetter(product.name)} is uitverkocht` : (remaining < 25 || (amount && remaining <= amount) ? text : null),
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

        let more = '';
        if (inCart > 0) {
            more = `, waarvan er al ${inCart} in jouw winkelmandje ${inCart === 1 ? $t(`5842a365-ee3e-452c-85d8-2967e4e172ef`) : $t(`75168b46-1dcc-4154-b7c7-70fac5e3578b`)}`;
        }
        const text = `Er ${remainingStock === 1 ? $t(`af839b8a-1367-4655-ad1c-ee658843e9f1`) : $t(`31bacb3a-2920-4bf3-9e68-d7887ef17fe4`)} nog maar ${product.getRemainingStockText(remainingStock)} van ${productPrice.name} beschikbaar${more}`;
        return {
            stock: remainingStock,
            remaining: admin ? null : remaining,
            text: remainingStock === 0 ? `${Formatter.capitalizeFirstLetter(productPrice.name)} is uitverkocht` : (remaining < 25 || (amount && remaining <= amount) ? text : null),
            shortText: remainingStock === 0 ? $t(`44ba544c-3db6-4f35-b7d1-b63fdcadd9ab`) : (remaining === 0 ? $t(`b1c82354-0aa6-4bef-bef6-84261180919a`) : (remaining < 25 ? `Nog ${product.getRemainingStockText(remaining)}` : null)),
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

        let more = '';
        if (inCart > 0) {
            more = `, waarvan er al ${inCart} in jouw winkelmandje ${inCart === 1 ? $t(`5842a365-ee3e-452c-85d8-2967e4e172ef`) : $t(`75168b46-1dcc-4154-b7c7-70fac5e3578b`)}`;
        }
        const text = `Er ${remainingStock === 1 ? $t(`af839b8a-1367-4655-ad1c-ee658843e9f1`) : $t(`31bacb3a-2920-4bf3-9e68-d7887ef17fe4`)} nog maar ${product.getRemainingStockText(remainingStock)} van ${option.name} beschikbaar${more}`;

        return {
            stock: remainingStock,
            remaining: admin ? null : remaining,
            text: remainingStock === 0 ? `${Formatter.capitalizeFirstLetter(option.name)} is uitverkocht` : (remaining < 25 || (amount && remaining <= amount) ? text : null),
            shortText: remainingStock === 0 ? $t(`44ba544c-3db6-4f35-b7d1-b63fdcadd9ab`) : (remaining === 0 ? $t(`b1c82354-0aa6-4bef-bef6-84261180919a`) : (remaining < 25 ? `Nog ${product.getRemainingStockText(remaining)}` : null)),
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

        let more = '';
        if (inCart > 0) {
            more = `, waarvan er al ${inCart} in jouw winkelmandje ${inCart === 1 ? $t(`5842a365-ee3e-452c-85d8-2967e4e172ef`) : $t(`75168b46-1dcc-4154-b7c7-70fac5e3578b`)}`;
        }
        const text = `Er ${remainingStock === 1 ? $t(`af839b8a-1367-4655-ad1c-ee658843e9f1`) : $t(`31bacb3a-2920-4bf3-9e68-d7887ef17fe4`)} nog maar ${Formatter.pluralText(remainingStock, $t(`886ea5ba-4715-43a2-88b6-4715df3cfa2c`), $t(`a76b6d3c-05a1-4c71-9f88-077261a4e595`))} beschikbaar${more}`;

        return {
            stock: remainingStock,
            remaining,
            text: remainingStock === 0 ? $t(`460b1ea5-15c9-4b4f-8de3-76b5f319aa0f`) : (remaining < 25 || (amount && remaining <= amount) ? text : null),
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

        let more = '';
        if (inCart > 0) {
            more = `, waarvan er al ${inCart} in jouw winkelmandje ${inCart === 1 ? $t(`5842a365-ee3e-452c-85d8-2967e4e172ef`) : $t(`75168b46-1dcc-4154-b7c7-70fac5e3578b`)}`;
        }

        const remaining = product.maxPerOrder - inCart;

        const show = (amount === undefined || (remaining <= amount));

        return {
            stock: product.maxPerOrder,
            remaining: product.maxPerOrder - inCart,
            text: !show ? null : ($t(`045e381b-d772-4fb8-b06b-b21247110ad3`) + ' ' + product.getRemainingStockText(product.maxPerOrder) + ' ' + $t(`c9ded123-9810-4bc8-815e-77e9ca9ae717`) + more),
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
