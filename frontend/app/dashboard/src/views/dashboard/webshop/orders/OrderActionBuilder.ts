import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { AsyncTableAction, CenteredMessage, EmailView, GlobalEventBus, InMemoryTableAction, LoadComponent, MenuTableAction, RecipientChooseOneOption, TableAction, TableActionSelection, Toast } from '@stamhoofd/components';
import { OrganizationManager } from '@stamhoofd/networking';
import { EmailRecipientFilterType, EmailRecipientSubfilter, OrderStatus, OrderStatusHelper, Payment, PaymentGeneral, PaymentMethod, PaymentStatus, PrivateOrder, PrivateOrderWithTickets, TicketPrivate } from '@stamhoofd/structures';

import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { WebshopManager } from '../WebshopManager';
import { OrderRequiredFilterHelper } from './OrderRequiredFilterHelper';

export class OrderActionBuilder {
    webshopManager: WebshopManager;
    organizationManager: OrganizationManager;

    present: ReturnType<typeof usePresent>;

    constructor(settings: {
        present: ReturnType<typeof usePresent>;
        webshopManager: WebshopManager;
        organizationManager: OrganizationManager;
    }) {
        this.present = settings.present;
        this.webshopManager = settings.webshopManager;
        this.organizationManager = settings.organizationManager;
    }

    getStatusActions(): TableAction<PrivateOrder>[] {
        return Object.values(OrderStatus).filter(s => s !== OrderStatus.Deleted).map((status) => {
            return new InMemoryTableAction({
                name: OrderStatusHelper.getName(status),
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (orders: PrivateOrder[]) => {
                    await this.markAs(orders, status);
                },
            });
        });
    }

    getTicketStatusActions(): TableAction<PrivateOrderWithTickets>[] {
        return [
            new InMemoryTableAction({
                name: 'Gescand',
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (orders: PrivateOrderWithTickets[]) => {
                    const patches: AutoEncoderPatchType<TicketPrivate>[] = [];
                    for (const order of orders) {
                        for (const ticket of order.tickets) {
                            if (ticket.scannedAt) {
                                continue;
                            }
                            patches.push(TicketPrivate.patch({
                                id: ticket.id,
                                secret: ticket.secret, // needed for lookups
                                scannedAt: new Date(),
                                scannedBy: this.organizationManager.$context.user?.firstName ?? null,
                            }));
                        }
                    }
                    await this.webshopManager.addTicketPatches(patches);
                },
            }),
            new InMemoryTableAction({
                name: 'Niet gescand',
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (orders: PrivateOrderWithTickets[]) => {
                    const patches: AutoEncoderPatchType<TicketPrivate>[] = [];
                    for (const order of orders) {
                        for (const ticket of order.tickets) {
                            if (!ticket.scannedAt) {
                                continue;
                            }
                            patches.push(TicketPrivate.patch({
                                id: ticket.id,
                                secret: ticket.secret, // needed for lookups
                                scannedAt: null,
                                scannedBy: null,
                            }));
                        }
                    }
                    await this.webshopManager.addTicketPatches(patches);
                },
            }),
        ];
    }

    getPaymentActions(): TableAction<PrivateOrder>[] {
        return [
            new InMemoryTableAction({
                name: 'Betaald',
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (orders: PrivateOrder[]) => {
                    await this.markPaid(orders, true);
                },
            }),
            new InMemoryTableAction({
                name: 'Niet betaald',
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (orders: PrivateOrder[]) => {
                    await this.markPaid(orders, false);
                },
            }),
        ];
    }

    getActions(): TableAction<PrivateOrderWithTickets>[] {
        return [
            new InMemoryTableAction({
                name: 'Bestelling toevoegen',
                enabled: this.webshopManager.hasWrite,
                icon: 'add',
                priority: 1,
                groupIndex: 2,
                needsSelection: false,
                handler: async () => {
                    await this.createOrder();
                },
            }),

            new InMemoryTableAction({
                name: 'Wijzig...',
                enabled: this.webshopManager.hasWrite,
                icon: 'edit',
                priority: 1,
                groupIndex: 2,
                needsSelection: true,
                singleSelection: true,
                handler: async (orders: PrivateOrder[]) => {
                    await this.editOrder(orders[0]);
                },
            }),

            new MenuTableAction({
                name: 'Wijzig status',
                enabled: this.webshopManager.hasWrite,
                icon: 'flag',
                priority: 1,
                groupIndex: 2,
                needsSelection: true,
                allowAutoSelectAll: false,
                childActions: this.getStatusActions(),
            }),

            new MenuTableAction({
                name: 'Wijzig ticketstatus',
                enabled: this.webshopManager.hasWrite && this.webshopManager.preview.hasTickets,
                icon: 'flag',
                priority: 1,
                groupIndex: 2,
                needsSelection: true,
                allowAutoSelectAll: false,
                childActions: this.getTicketStatusActions(),
            }),

            new MenuTableAction({
                name: 'Wijzig betaalstatus',
                enabled: this.webshopManager.hasWrite,
                icon: 'flag',
                priority: 0,
                groupIndex: 2,
                needsSelection: true,
                allowAutoSelectAll: false,
                childActions: this.getPaymentActions(),
            }),

            new InMemoryTableAction({
                name: 'Kopieer link naar bestelling',
                icon: 'copy',
                priority: 0,
                groupIndex: 2,
                needsSelection: true,
                allowAutoSelectAll: false,
                singleSelection: true,
                handler: async (orders: PrivateOrder[]) => {
                    const order = orders[0];
                    // copy the link to clipboard
                    await navigator.clipboard.writeText('https://' + this.webshopManager.preview.getUrl(this.organizationManager.organization) + '/order/' + order!.id);
                    new Toast('Link gekopieerd naar klembord', 'success').show();
                },
            }),

            new AsyncTableAction({
                name: 'E-mailen',
                enabled: this.webshopManager.hasRead,
                icon: 'email',
                priority: 10,
                groupIndex: 3,
                handler: async (selection: TableActionSelection<PrivateOrder>) => {
                    await this.openMail(selection);
                },
            }),

            ...(this.webshopManager.preview.meta.phoneEnabled
                ? [new InMemoryTableAction({
                        name: "SMS'en",
                        enabled: this.webshopManager.hasRead,
                        icon: 'feedback-line',
                        priority: 9,
                        groupIndex: 3,

                        handler: async (orders: PrivateOrder[]) => {
                            await this.sms(orders);
                        },
                    })]
                : []),

            new InMemoryTableAction({
                name: 'Exporteer naar Excel',
                enabled: this.webshopManager.hasRead,
                icon: 'download',
                priority: 8,
                groupIndex: 3,
                handler: async (orders: PrivateOrder[]) => {
                    await this.exportToExcel(orders);
                },
            }),

            new InMemoryTableAction({
                name: 'Verwijderen',
                icon: 'trash',
                enabled: this.webshopManager.hasWrite,
                priority: 0,
                groupIndex: 5,
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (orders: PrivateOrder[]) => {
                    await this.deleteOrders(orders);
                },
            }),
        ];
    }

    async createOrder() {
        const displayedComponent = await LoadComponent(() => import(/* webpackChunkName: "EditOrderView" */ './EditOrderView.vue'), {
            webshopManager: this.webshopManager,
            isNew: true,
        });
        this.present(displayedComponent.setDisplayStyle('popup')).catch(console.error);
    }

    async editOrder(order: PrivateOrder, mode?: 'comments') {
        const displayedComponent = await LoadComponent(() => import(/* webpackChunkName: "EditOrderView" */ './EditOrderView.vue'), {
            initialOrder: order,
            webshopManager: this.webshopManager,
            mode,
        });
        this.present(displayedComponent.setDisplayStyle('popup')).catch(console.error);
    }

    async sms(orders: PrivateOrder[]) {
        const displayedComponent = await LoadComponent(() => import(/* webpackChunkName: "SMSView" */ '../../sms/SMSView.vue'), {
            customers: orders.map(o => o.data.customer),
        });
        this.present(displayedComponent.setDisplayStyle('popup')).catch(console.error);
    }

    async openMail(selection: TableActionSelection<PrivateOrder>) {
        const filter = selection.filter.filter;
        const search = selection.filter.search;

        const options: RecipientChooseOneOption[] = [];

        let name = 'Alle bestellingen';

        if (selection.markedRows.size > 0) {
            name = 'Geselecteerde bestellingen';
        }
        else if (!OrderRequiredFilterHelper.isDefault(this.webshopManager.preview.id, selection.filter.filter)) {
            name = 'Gefilterde bestellingen';
        }

        options.push({
            type: 'ChooseOne',
            options: [
                {
                    id: 'all',
                    name,
                    value: [
                        EmailRecipientSubfilter.create({
                            type: EmailRecipientFilterType.Orders,
                            filter,
                            search,
                        }),
                    ] },
            ],
        });

        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EmailView, {
                recipientFilterOptions: options,
            }),
        });
        await this.present({
            components: [
                displayedComponent,
            ],
            modalDisplayStyle: 'popup',
        });
    }

    async exportToExcel(orders: PrivateOrder[]) {
        const hasCanceledOrders = !!orders.find(o => o.status === OrderStatus.Canceled);
        const hasNotCanceled = !!orders.find(o => o.status !== OrderStatus.Canceled);
        if (hasCanceledOrders && hasNotCanceled) {
            const excludeCanceled = await CenteredMessage.confirm('Je exporteert ook geannuleerde bestellingen', 'Zonder exporteren', 'Momenteel heb je ook bestellingen geselecteerd die geannuleerd zijn. Als je die mee exporteert komen die bestellingen ook in de totalen van de Excel, dat wil je meestal niet.', 'Mee exporteren', true);
            if (excludeCanceled) {
                orders = orders.filter(o => o.status !== OrderStatus.Canceled);
            }
        }
        const d = await import(/* webpackChunkName: "OrdersExcelExport" */ '../../../../classes/OrdersExcelExport');
        const OrdersExcelExport = d.OrdersExcelExport;
        OrdersExcelExport.export(this.webshopManager.preview, orders);
    }

    async markAs(orders: PrivateOrder[], status: OrderStatus) {
        try {
            const wasCanceledOrDeleted = !!orders.find(o => o.status === OrderStatus.Canceled || o.status === OrderStatus.Deleted);
            const patches: PatchableArrayAutoEncoder<PrivateOrder> = new PatchableArray();
            for (const order of orders) {
                patches.addPatch(PrivateOrder.patch({ status, id: order.id }));
            }

            const updatedOrders = await this.webshopManager.patchOrders(patches);

            // Move all data to original orders
            for (const order of updatedOrders) {
                const original = orders.find(o => o.id === order.id);
                if (original) {
                    original.set(order);
                }
            }

            if (status === OrderStatus.Deleted) {
                new Toast(orders.length == 1 ? 'Bestelling verwijderd' : 'Bestellingen verwijderd', 'success').setHide(1500).show();

                // Do a slow reload of the webshop stocks
                if (!wasCanceledOrDeleted) {
                    this.webshopManager.backgroundReloadWebshop();
                }
            }
            else {
                new Toast('Status gewijzigd', 'success').setHide(1500).show();

                if (status == OrderStatus.Canceled) {
                    new Toast('Je moet zelf communiceren dat de bestelling werd geannuleerd', 'warning yellow').setHide(10 * 1000).show();

                    // Do a slow reload of the webshop stocks
                    if (!wasCanceledOrDeleted) {
                        this.webshopManager.backgroundReloadWebshop();
                    }
                }
                else {
                    if (wasCanceledOrDeleted) {
                        this.webshopManager.backgroundReloadWebshop();
                    }
                }
            }
        }
        catch (e) {
            Toast.fromError(e).show();
        }
    }

    async markPaid(orders: PrivateOrder[], paid = true) {
        const data: PatchableArrayAutoEncoder<Payment> = new PatchableArray();
        let willSendEmail = false;

        for (const order of orders) {
            for (const payment of order.payments) {
                if (!payment.canChangeStatus) {
                    continue;
                }
                if (paid) {
                    if (payment.status !== PaymentStatus.Succeeded) {
                        data.addPatch(Payment.patch({
                            id: payment.id,
                            status: PaymentStatus.Succeeded,
                        }));

                        if (payment.method === PaymentMethod.Transfer && order.data.shouldSendPaymentUpdates) {
                            willSendEmail = true;
                        }
                    }
                }
                else {
                    if (payment.status === PaymentStatus.Succeeded) {
                        data.addPatch(Payment.patch({
                            id: payment.id,
                            status: PaymentStatus.Created,
                        }));
                    }
                }
            }
        }

        if (data.changes.length) {
            if (willSendEmail && !await CenteredMessage.confirm('Ben je zeker?', paid ? 'Markeer als betaald' : 'Markeer als niet betaald', paid ? 'De besteller ontvangt een automatische e-mail.' : undefined)) {
                return;
            }
            const session = this.organizationManager.$context;

            try {
                const response = await session.authenticatedServer.request({
                    method: 'PATCH',
                    path: '/organization/payments',
                    body: data,
                    // TODO: need to confirm response type
                    decoder: new ArrayDecoder(PaymentGeneral as Decoder<PaymentGeneral>),
                    shouldRetry: false,
                });

                // Update data of existing objects
                for (const order of orders) {
                    for (const payment of order.payments) {
                        const p = response.data.find(pp => pp.id === payment.id);
                        if (p) {
                            payment.set(p);
                            order.updatePricePaid();
                        }
                    }
                }
                for (const payment of response.data) {
                    GlobalEventBus.sendEvent('paymentPatch', payment).catch(console.error);
                }
                new Toast('Betaalstatus gewijzigd', 'success').setHide(1000).show();
            }
            catch (e) {
                Toast.fromError(e).show();
            }
        }
        else {
            new Toast(paid ? 'Al gemarkeerd als betaald' : ('Deze ' + (orders.length == 1 ? 'bestelling werd' : 'bestellingen werden') + ' nog niet betaald'), 'error red').setHide(2000).show();
        }
    }

    async deleteOrders(orders: PrivateOrder[]) {
        if (!await CenteredMessage.confirm(orders.length == 1 ? 'Bestelling ' + orders[0].number + ' (' + orders[0].data.customer.name + ') verwijderen?' : 'Bestellingen verwijderen?', 'Verwijderen', 'Je kan dit niet ongedaan maken.')) {
            return;
        }

        try {
            await this.markAs(orders, OrderStatus.Deleted);
            for (const order of orders) {
                await this.webshopManager.deleteOrderFromDatabase(order.id);
            }
            await this.webshopManager.ordersEventBus.sendEvent('deleted', orders);
        }
        catch (e) {
            Toast.fromError(e).show();
            return;
        }
    }
}
