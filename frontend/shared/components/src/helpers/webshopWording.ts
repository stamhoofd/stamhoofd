import type { Webshop } from '@stamhoofd/structures';
import { WebshopType } from '@stamhoofd/structures';

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
