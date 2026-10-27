import type { Webshop } from '@stamhoofd/structures';
import { WebshopType } from '@stamhoofd/structures';

/**
 * Tickets and registrations are mostly ordered in amounts, without a cart: new webshops of these types start with
 * the bulk order mode, and the cart is listed last
 */
export function prefersBulkOrderMode(type: WebshopType) {
    return type === WebshopType.Performance || type === WebshopType.Event || type === WebshopType.Registrations;
}

/**
 * Visitors choose their seats on a seating plan, which makes no sense for one ticket per order
 */
export function usesSeatingPlan(webshop: Webshop) {
    return webshop.meta.type === WebshopType.Performance || webshop.products.some(p => p.seatingPlanId !== null);
}
