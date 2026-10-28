import type { Product, Webshop } from '@stamhoofd/structures';
import { ProductType, WebshopType } from '@stamhoofd/structures';

/**
 * Wording that depends on what the webshop sells: tickets, registrations, donations or products.
 */
export function getOrderButtonText(webshop: Webshop, totalPrice?: number): string {
    switch (webshop.meta.type) {
        case WebshopType.Registrations: return $t('%XE');
        // totalPrice is undefined when the amount is only chosen in a later step
        case WebshopType.Donations: return totalPrice === 0 ? $t('%16p') : $t('%Zzp');
        default: return $t('%Xs');
    }
}

/**
 * Heading above products that are not in a category
 */
export function getProductListTitle(webshop: Webshop): string {
    if (webshop.meta.hasTickets) {
        return $t('%1AU');
    }
    switch (webshop.meta.type) {
        case WebshopType.Registrations: return $t('%1EI');
        case WebshopType.Donations: return $t('%ZyI');
        default: return $t('%Zzj');
    }
}

/**
 * What one unit of a product is called, e.g. in "Ticket 1" or "Kies eerst minstens één ticket"
 */
export function getUnitName(webshop: Webshop, product: Product): { singular: string; plural: string } {
    // A product that collects a participant per unit is counted in people, whatever its type
    if (product.enableCustomer) {
        return { singular: $t('%ZzI'), plural: $t('%a0C') };
    }
    if (product.type === ProductType.Ticket) {
        return { singular: $t('%o'), plural: $t('%m') };
    }
    if (product.type === ProductType.Voucher) {
        return { singular: $t('%Zyh'), plural: $t('%ZyO') };
    }
    if (product.type === ProductType.Person) {
        return { singular: $t('%12P'), plural: $t('%12R') };
    }
    if (webshop.meta.type === WebshopType.Registrations) {
        return { singular: $t('%82'), plural: $t('%14Y') };
    }
    return { singular: $t('%Zyr'), plural: $t('%a08') };
}
