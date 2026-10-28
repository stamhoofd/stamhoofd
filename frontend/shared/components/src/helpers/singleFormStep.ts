import type { Product, Webshop } from '@stamhoofd/structures';

export type SingleFormStepReason = 'photo' | 'description';

/**
 * A description that was cleared in the editor still has html like <p></p>, so this checks the text
 */
export function hasWebshopDescription(webshop: Webshop): boolean {
    return webshop.meta.description.text.trim().length > 0;
}

/**
 * A webshop that orders one at a time with only one product shows the form of that product on the page itself, unless
 * the product clashes with the content of the webshop: the page then shows an order button that opens the product as
 * a separate step. A product photo always clashes with the cover photo; a product description only when it would come
 * right below the description of the webshop.
 *
 * In the split layout the form is shown next to the content while it fits, so the step is only used on narrow screens.
 */
export function getSingleFormStepReason(webshop: Webshop, product: Product): SingleFormStepReason | null {
    if (product.images.length > 0) {
        return 'photo';
    }
    if (hasWebshopDescription(webshop) && product.description.trim().length > 0) {
        return 'description';
    }
    return null;
}
