import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import { getProductListTitle } from '@stamhoofd/components/helpers/webshopWording.ts';
import type { Product, Webshop } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { getVisibleProducts } from './visibleProducts';

/**
 * Shared by the lists that show all products on the webshop page itself (bulk mode and one at a time)
 */

export type ProductListGroup = { id: string; name: string; description: string; products: Product[] };

/**
 * The visible products per category, followed by the products without a category
 *
 * @param options.hideTitle Leave out the general title (e.g. 'Tickets') when no product has a category
 */
export function getProductListGroups(webshop: Webshop, options: { hideTitle?: boolean } = {}): ProductListGroup[] {
    const visibleProducts = getVisibleProducts(webshop);
    const categorised = new Set<string>();
    const groups = webshop.categories.flatMap((category) => {
        const products = category.productIds.flatMap((id) => {
            const product = visibleProducts.find(p => p.id === id);
            if (!product) {
                return [];
            }
            categorised.add(product.id);
            return [product];
        });
        if (products.length === 0) {
            return [];
        }
        return [{ id: category.id, name: category.name, description: category.description, products }];
    });

    const rest = visibleProducts.filter(p => !categorised.has(p.id));
    if (rest.length > 0) {
        groups.push({ id: 'uncategorised', name: groups.length > 0 ? $t('Andere') : (options.hideTitle ? '' : getProductListTitle(webshop)), description: '', products: rest });
    }
    return groups;
}

/**
 * Date, location and price of a product in one line, or its description when it has none of those
 *
 * @param priceText The price as the list shows it, e.g. empty when the prices are listed below the product
 */
export function getProductListDescription(product: Product, priceText: string) {
    const parts: string[] = [];
    if (product.dateRange) {
        parts.push(Formatter.capitalizeFirstLetter(product.dateRange.toString()));
    }
    if (product.location) {
        parts.push(product.location.name);
    }
    if (priceText) {
        parts.push(priceText);
    }
    if (parts.length === 0 && product.description) {
        return product.description;
    }
    return parts.join(' • ');
}

export function canOrderProduct(product: Product) {
    return product.isEnabled && !product.isSoldOut;
}

/**
 * Whether the order form of a product (CartItemView) asks anything of the visitor: a price, options, fields, a
 * participant, seats, UiTPAS numbers or an amount
 */
export function productHasChoices(product: Product, webshop: Webshop) {
    return product.filteredPrices({ admin: false }).length > 1
        || product.prices.some(p => p.allowCustomPrice || p.uitpasBaseProductPriceId !== null)
        || product.optionMenus.length > 0
        || product.customFields.length > 0
        || product.enableCustomer
        || product.seatingPlanId !== null
        || (product.maxPerOrder !== 1 && webshop.allowsMultiple(product));
}

/**
 * Description, photos, location and date of a product in a sheet
 */
export function useShowProductInfo() {
    const present = usePresent();

    return (product: Product) => {
        present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: AsyncComponent(() => import('./ProductInfoView.vue'), { product }),
                }),
            ],
            modalDisplayStyle: 'sheet',
        }).catch(console.error);
    };
}
