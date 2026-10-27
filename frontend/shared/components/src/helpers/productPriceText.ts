import type { Product, Webshop } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

/**
 * The price of a product in an overview of products: one price, a range, or that the customer chooses the price.
 * Empty when there is nothing useful to show (e.g. a free product in a free webshop).
 */
export function getProductPriceText(product: Product, webshop: Webshop, { admin }: { admin: boolean }): string {
    const prices = product.filteredPrices({ admin });
    const fixedPrices = prices.filter(p => !p.allowCustomPrice);
    if (fixedPrices.length === 0) {
        // The customer chooses the price
        return prices.length > 0 ? $t('%ZkI') : '';
    }

    if (fixedPrices.length < prices.length) {
        // Hide ugly selection list
        return '';
    }

    const priceRanges = Formatter.uniqueArray(fixedPrices.map(p => p.price));
    if (priceRanges.length === 1) {
        if (priceRanges[0] === 0) {
            if (webshop.isAllFree) {
                return '';
            }
            return $t(`%1Mn`);
        }
        return Formatter.price(priceRanges[0]);
    }
    const minimum = Math.min(...priceRanges);
    const maximum = Math.max(...priceRanges);
    return Formatter.price(minimum) + ' - ' + Formatter.price(maximum);
}
