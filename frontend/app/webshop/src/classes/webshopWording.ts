import type { Product, Webshop } from '@stamhoofd/structures';
import { ProductType, WebshopType } from '@stamhoofd/structures';

/**
 * Wording that depends on what the webshop sells: tickets, registrations, donations or products.
 */
export function getOrderButtonText(webshop: Webshop): string {
    switch (webshop.meta.type) {
        case WebshopType.Registrations: return $t('Inschrijven');
        case WebshopType.Donations: return $t('Doneren');
        default: return $t('Bestellen');
    }
}

/**
 * Heading above products that are not in a category
 */
export function getProductListTitle(webshop: Webshop): string {
    if (webshop.meta.hasTickets) {
        return $t('Tickets');
    }
    switch (webshop.meta.type) {
        case WebshopType.Registrations: return $t('Inschrijvingen');
        case WebshopType.Donations: return $t('Steun ons');
        default: return $t('Artikelen');
    }
}

/**
 * What one unit of a product is called, e.g. in "Ticket 1" or "Kies eerst minstens één ticket"
 */
export function getUnitName(webshop: Webshop, product: Product): { singular: string; plural: string } {
    // A product that collects a participant per unit is counted in people, whatever its type
    if (product?.enableCustomer) {
        return { singular: $t('deelnemer'), plural: $t('deelnemers') };
    }
    if (product?.type === ProductType.Ticket) {
        return { singular: $t(`%o`), plural: $t(`%m`) };
    }
    if (product?.type === ProductType.Voucher) {
        return { singular: $t(`voucher`), plural: $t(`vouchers`) };
    }
    if (product?.type === ProductType.Person) {
        return { singular: $t(`%12P`), plural: $t(`%12R`) };
    }
    if (webshop.meta.type === WebshopType.Registrations) {
        return { singular: $t('inschrijving'), plural: $t('inschrijvingen') };
    }
    return { singular: $t('artikel'), plural: $t('artikelen') };
}
