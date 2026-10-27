import type { Category, Product, Webshop } from '@stamhoofd/structures';

/**
 * The products visitors can see on the webshop page
 */
export function getVisibleProducts(webshop: Webshop): Product[] {
    return webshop.products.filter(p => !p.hidden);
}

/**
 * The categories with at least one product visitors can see
 */
export function getVisibleCategories(webshop: Webshop): Category[] {
    return webshop.categories.filter((c) => {
        return c.productIds.some((id) => {
            const product = webshop.products.find(p => p.id === id);
            return product && !product.hidden;
        });
    });
}
