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
                name: $t(`044f91f3-91b5-4109-ad8d-3fea6c0c92e2`),
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
                name: $t(`c1bb5197-b80f-482e-aac8-db8f08e37108`),
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
                name: $t(`1c1933f1-fee4-4e7d-9c89-57593fd5bed3`),
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (orders: PrivateOrder[]) => {
                    await this.markPaid(orders, true);
                },
            }),
            new InMemoryTableAction({
                name: $t(`8e65de81-dc74-4bc0-8d73-6440d754b6a4`),
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (orders: PrivateOrder[]) => {
                    await this.markPaid(orders, false);
                },
            }),
        ];
    }

    getActions(options?: { includeAdd: boolean }): TableAction<PrivateOrderWithTickets>[] {
        return [
            new InMemoryTableAction({
                name: $t(`b6750fb9-8488-4849-81f9-1ce838cab847`),
                icon: 'add',
                priority: 1,
                groupIndex: 2,
                needsSelection: false,
                enabled: this.webshopManager.hasWrite && (options?.includeAdd ?? false),
                handler: async () => {
                    await this.createOrder();
                },
            }),

            new InMemoryTableAction({
                name: $t(`cca235f4-fc87-4ce7-9e48-24984f793a6c`),
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
                name: $t(`e0fff11f-5ddc-4edc-bab9-a1b293d2681f`),
                enabled: this.webshopManager.hasWrite,
                icon: 'flag',
                priority: 1,
                groupIndex: 2,
                needsSelection: true,
                allowAutoSelectAll: false,
                childActions: this.getStatusActions(),
            }),

            new MenuTableAction({
                name: $t(`945fff38-e294-4ad3-987a-fb070fc8e7cb`),
                enabled: this.webshopManager.hasWrite && this.webshopManager.preview.hasTickets,
                icon: 'flag',
                priority: 1,
                groupIndex: 2,
                needsSelection: true,
                allowAutoSelectAll: false,
                childActions: this.getTicketStatusActions(),
            }),

            new MenuTableAction({
                name: $t(`b77062d3-466e-47fa-ad77-5ad821478507`),
                enabled: this.webshopManager.hasWrite,
                icon: 'flag',
                priority: 0,
                groupIndex: 2,
                needsSelection: true,
                allowAutoSelectAll: false,
                childActions: this.getPaymentActions(),
            }),

            new InMemoryTableAction({
                name: $t(`f8477533-a14b-4867-af18-0c46efc770c5`),
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
                    new Toast($t(`6276c402-9d5a-4ed4-8e78-c43322899b55`), 'success').show();
                },
            }),

            new AsyncTableAction({
                name: $t(`f92ad3ab-8743-4d37-8b3f-c9d5ca756b16`),
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
                        name: $t(`73d85ece-245e-4e48-a833-1e78cf810b03`),
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
                name: $t(`60c06238-ad4d-4599-a3d3-ebe856476618`),
                enabled: this.webshopManager.hasRead,
                icon: 'download',
                priority: 8,
                groupIndex: 3,
                handler: async (orders: PrivateOrder[]) => {
                    await this.exportToExcel(orders);
                },
            }),

            new InMemoryTableAction({
                name: $t(`63af93aa-df6a-4937-bce8-9e799ff5aebd`),
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
        const displayedComponent = await LoadComponent(() => import(/* webpackChunkName: "SMSView" */ '@stamhoofd/components/views/SMSView.vue'), {
            customers: orders.map(o => o.data.customer),
        });
        this.present(displayedComponent.setDisplayStyle('popup')).catch(console.error);
    }

    async openMail(selection: TableActionSelection<PrivateOrder>) {
        const filter = selection.filter.filter;
        const search = selection.filter.search;

        const options: RecipientChooseOneOption[] = [];

        let name = $t(`8730dd7b-ee54-4267-9f32-ba7eca63ced9`);

        if (selection.markedRows.size > 0) {
            name = $t(`e2e87cbb-445c-4b39-85cf-c8488f95598d`);
        }
        else if (!OrderRequiredFilterHelper.isDefault(this.webshopManager.preview.id, selection.filter.filter)) {
            name = $t(`df092e1d-f238-4ddc-9d75-96498df32115`);
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
                defaultSenderId: this.webshopManager.preview?.privateMeta.defaultEmailId,
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
        if (!this.webshopManager.webshop) {
            new Toast($t(`f9b0679e-029b-4d34-a848-66674f33cdcf`), 'error red').show();
            return;
        }

        const hasCanceledOrders = !!orders.find(o => o.status === OrderStatus.Canceled);
        const hasNotCanceled = !!orders.find(o => o.status !== OrderStatus.Canceled);
        if (hasCanceledOrders && hasNotCanceled) {
            const excludeCanceled = await CenteredMessage.confirm($t(`fffc7c1f-b102-4588-85c4-cd2db9d47452`), $t(`47cc53b3-e42d-4fd6-999e-d184a5f349c0`), $t(`264e2590-ddb9-4724-8f4c-886eb9b2e5a5`), $t(`903d41c7-2468-4062-af28-7acf31a1712a`), true);
            if (excludeCanceled) {
                orders = orders.filter(o => o.status !== OrderStatus.Canceled);
            }
        }
        const d = await import(/* webpackChunkName: "OrdersExcelExport" */ '../../../../classes/OrdersExcelExport');
        const OrdersExcelExport = d.OrdersExcelExport;
        OrdersExcelExport.export(this.webshopManager.webshop, orders);
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
                new Toast(orders.length == 1 ? $t(`3857106f-4bfd-4530-88ca-9eaed64fca7a`) : $t(`76509866-f011-451f-ab1e-f03ad776be87`), 'success').setHide(1500).show();

                // Do a slow reload of the webshop stocks
                if (!wasCanceledOrDeleted) {
                    this.webshopManager.backgroundReloadWebshop();
                }
            }
            else {
                new Toast($t(`049498c3-10f3-4f4e-a80b-353cbbf14a8c`), 'success').setHide(1500).show();

                if (status == OrderStatus.Canceled) {
                    new Toast($t(`39bfbb22-cbab-4d4d-a741-802f01e97cd8`), 'warning yellow').setHide(10 * 1000).show();

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
            if (willSendEmail && !await CenteredMessage.confirm($t(`c8217f03-4005-47e7-b032-69f59dd05499`), paid ? $t(`aca879f0-55d3-4964-a8ad-0eedf18228fb`) : $t(`b3d75fdd-8231-4a1f-a1b3-5c6401d90a75`), paid ? $t(`616292aa-dda9-4a7c-8e02-d35582bf3519`) : undefined)) {
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
                new Toast($t(`8076e99d-cac2-4fb6-84e0-d893d9b3c205`), 'success').setHide(1000).show();
            }
            catch (e) {
                Toast.fromError(e).show();
            }
        }
        else {
            new Toast(paid ? $t(`37848bd6-919a-4f31-bfc7-e0e809e68847`) : orders.length === 1 ? $t(`7d1fc34a-2cbc-4114-8554-f1c0dc5e1b89`) : $t(`188bf8f2-69ca-4e29-8f1f-c67a39507a15`), 'error red').setHide(2000).show();
        }
    }

    async deleteOrders(orders: PrivateOrder[]) {
        if (!await CenteredMessage.confirm(orders.length === 1 ? $t(`059520a3-0798-46a6-8c41-e3e401aa1a59`, { number: orders[0].number?.toString() ?? '', customer: orders[0].data.customer.name }) : $t(`Bestellingen verwijderen?`), $t(`63af93aa-df6a-4937-bce8-9e799ff5aebd`), $t(`Je kan dit niet ongedaan maken.`))) {
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
