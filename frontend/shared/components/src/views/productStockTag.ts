import type { Product, Webshop } from '@stamhoofd/structures';
import { Cart, CartStockHelper } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

export interface ProductStockTag {
    text: string;
    style: 'warn' | 'error' | '';
}

/**
 * Availability tag of a product in a product list, given the current cart.
 * `editExisting` = the cart item of this product gets edited instead of adding a new one, so the cart contents don't count as used stock.
 */
export function getProductStockTag({ product, webshop, cart, admin, editExisting }: { product: Product; webshop: Webshop; cart: Cart; admin: boolean; editExisting: boolean }): ProductStockTag | null {
    if (product.enableInFuture) {
        return {
            text: $t(`%kR`, { date: product.enableAfter ? Formatter.dateTime(product.enableAfter) : '?' }),
            style: '',
        };
    }

    if (!product.isEnabled && !admin) {
        return {
            text: $t(`%Tk`),
            style: 'error',
        };
    }

    if (product.isSoldOut) {
        return {
            text: $t(`%12p`),
            style: 'error',
        };
    }

    const remainingWithoutCart = CartStockHelper.getRemainingAcrossOptions({ cart: Cart.create({}), product, webshop, admin }, { inMultipleCartItems: true, excludeOrder: true });

    if (remainingWithoutCart === 0) {
        return {
            text: $t(`%12p`),
            style: 'error',
        };
    }
    const showStockBelow = product.showStockBelow ?? Infinity;

    if (editExisting) {
        if (remainingWithoutCart === null || remainingWithoutCart > showStockBelow) {
            return null;
        }

        return {
            text: $t(`%12q`, { count: product.getRemainingStockText(remainingWithoutCart) }),
            style: 'warn',
        };
    }

    // How much we can still order from this product
    const maxOrder = CartStockHelper.getOrderMaximum({ cart, product, webshop, admin });
    const remaining = CartStockHelper.getRemainingAcrossOptions({ cart, product, webshop, admin }, { inMultipleCartItems: true, excludeOrder: true });

    if (maxOrder && maxOrder.remaining === 0) {
        return {
            text: $t(`%zD`),
            style: 'error',
        };
    }

    if (remaining === null) {
        return null;
    }

    if (remaining > showStockBelow) {
        return null;
    }

    if (remaining === 0) {
        return {
            text: $t(`%zD`),
            style: 'error',
        };
    }

    return {
        text: $t(`%12q`, { count: product.getRemainingStockText(remaining) }),
        style: 'warn',
    };
}
