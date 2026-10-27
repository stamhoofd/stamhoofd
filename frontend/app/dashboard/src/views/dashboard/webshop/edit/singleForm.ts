import type { Product, Webshop } from '@stamhoofd/structures';
import { WebshopOrderMode } from '@stamhoofd/structures';

/**
 * A webshop that orders one at a time with only one product shows that product as a single form: it is edited on the
 * product offer page itself and takes the name of the webshop
 */
export function getSingleFormProduct(webshop: Webshop): Product | null {
    if (webshop.meta.orderMode !== WebshopOrderMode.Single || webshop.products.length !== 1 || webshop.categories.length > 0) {
        return null;
    }
    return webshop.products[0];
}
