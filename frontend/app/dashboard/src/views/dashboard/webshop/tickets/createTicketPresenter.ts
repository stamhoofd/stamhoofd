import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import type { WebshopManager } from '../WebshopManager';
import TicketAlreadyScannedView from './status/TicketAlreadyScannedView.vue';
import ValidTicketView from './status/ValidTicketView.vue';
import type { OpenTicketHandler } from './TicketNavigation';

export function createTicketPresenter(webshopManager: WebshopManager): OpenTicketHandler {
    const openTicket: OpenTicketHandler = async (ticket, order, navigation) => {
        await navigation.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(ticket.scannedAt !== null ? TicketAlreadyScannedView : ValidTicketView, {
                        order,
                        ticket,
                        webshopManager,
                        openTicketHandler: openTicket,
                    }),
                }),
            ],
            modalDisplayStyle: 'popup',
        });
    };
    return openTicket;
}
