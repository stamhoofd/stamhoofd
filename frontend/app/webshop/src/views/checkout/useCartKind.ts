import { ProductType, WebshopTicketType, WebshopType } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useCheckoutManager } from '../../composables/useCheckoutManager';
import { useWebshopManager } from '../../composables/useWebshopManager';

export type CartKind = 'donation' | 'ticket' | 'tickets' | 'registration' | 'registrations' | 'order';

/**
 * What the customer is buying, based on the webshop type and the cart contents.
 * Used to name the cart and the order in the checkout steps.
 */
export function useCartKind() {
    const checkoutManager = useCheckoutManager();
    const webshopManager = useWebshopManager();

    return computed<CartKind>(() => {
        const meta = webshopManager.webshop.meta;
        if (meta.type === WebshopType.Donations) {
            return 'donation';
        }

        const items = checkoutManager.checkout.cart.items;
        const ticketCount = meta.ticketType === WebshopTicketType.SingleTicket
            ? 1
            : items
                    .filter(i => i.product.type === ProductType.Ticket || i.product.type === ProductType.Voucher)
                    .reduce((count, i) => count + i.amount, 0);

        if (ticketCount > 0) {
            return ticketCount === 1 ? 'ticket' : 'tickets';
        }

        if (meta.type === WebshopType.Registrations) {
            const registrationCount = items.reduce((count, i) => count + i.amount, 0);
            return registrationCount > 1 ? 'registrations' : 'registration';
        }

        return 'order';
    });
}
