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
                name: $t(`%V1`),
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
                    await this.webshopManager.tickets.putPatches(patches);
                },
            }),
            new InMemoryTableAction({
                name: $t(`%1MZ`),
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
                    await this.webshopManager.tickets.putPatches(patches);
                },
            }),
        ];
    }

    getPaymentActions(): TableAction<PrivateOrder>[] {
        return [
            new InMemoryTableAction({
                name: $t(`%Kw`),
                needsSelection: true,
                allowAutoSelectAll: false,
                handler: async (orders: PrivateOrder[]) => {
                    await this.markPaid(orders, true);
                },
            }),
            new InMemoryTableAction({
                name: $t(`%18v`),
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
                name: $t(`%V2`),
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
                name: $t(`%V3`),
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
                name: $t(`%vW`),
                enabled: this.webshopManager.hasWrite,
                icon: 'flag',
                priority: 1,
                groupIndex: 2,
                needsSelection: true,
                allowAutoSelectAll: false,
                childActions: this.getStatusActions(),
            }),

            new MenuTableAction({
                name: $t(`%V4`),
                enabled: this.webshopManager.hasWrite && this.webshopManager.preview.hasTickets,
                icon: 'flag',
                priority: 1,
                groupIndex: 2,
                needsSelection: true,
                allowAutoSelectAll: false,
                childActions: this.getTicketStatusActions(),
            }),

            new MenuTableAction({
                name: $t(`%V5`),
                enabled: this.webshopManager.hasWrite,
                icon: 'flag',
                priority: 0,
                groupIndex: 2,
                needsSelection: true,
                allowAutoSelectAll: false,
                childActions: this.getPaymentActions(),
            }),

            new InMemoryTableAction({
                name: $t(`%V6`),
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
                    new Toast($t(`%V7`), 'success').show();
                },
            }),

            new AsyncTableAction({
                name: $t(`%Gb`),
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
                        name: $t(`%PI`),
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
                name: $t(`%V8`),
                enabled: this.webshopManager.hasRead,
                icon: 'download',
                priority: 8,
                groupIndex: 3,
                handler: async (orders: PrivateOrder[]) => {
                    await this.exportToExcel(orders);
                },
            }),

            new InMemoryTableAction({
                name: $t(`%CJ`),
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

        let name = $t(`%V9`);

        if (selection.markedRows.size > 0) {
            name = $t(`%VA`);
        }
        else if (!OrderRequiredFilterHelper.isDefault(this.webshopManager.preview.id, selection.filter.filter)) {
            name = $t(`%VB`);
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
            new Toast($t(`%17l`), 'error red').show();
            return;
        }

        const hasCanceledOrders = !!orders.find(o => o.status === OrderStatus.Canceled);
        const hasNotCanceled = !!orders.find(o => o.status !== OrderStatus.Canceled);
        if (hasCanceledOrders && hasNotCanceled) {
            const excludeCanceled = await CenteredMessage.confirm($t(`%VC`), $t(`%VD`), $t(`%VE`), $t(`%VF`), true);
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

            const updatedOrders = await this.webshopManager.orders.putPatches(patches);

            // Move all data to original orders
            for (const order of updatedOrders) {
                const original = orders.find(o => o.id === order.id);
                if (original) {
                    original.set(order);
                }
            }

            if (status === OrderStatus.Deleted) {
                new Toast(orders.length == 1 ? $t(`%VG`) : $t(`%VH`), 'success').setHide(1500).show();

                // Do a slow reload of the webshop stocks
                if (!wasCanceledOrDeleted) {
                    this.webshopManager.backgroundReloadWebshop();
                }
            }
            else {
                new Toast($t(`%VI`), 'success').setHide(1500).show();

                if (status == OrderStatus.Canceled) {
                    new Toast($t(`%VJ`), 'warning yellow').setHide(10 * 1000).show();

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
            if (willSendEmail && !await CenteredMessage.confirm($t(`%MY`), paid ? $t(`%1JQ`) : $t(`%MZ`), paid ? $t(`%VK`) : undefined)) {
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
                new Toast($t(`%Mb`), 'success').setHide(1000).show();
            }
            catch (e) {
                Toast.fromError(e).show();
            }
        }
        else {
            new Toast(paid ? $t(`%Mc`) : orders.length === 1 ? $t(`%VL`) : $t(`%VM`), 'error red').setHide(2000).show();
        }
    }

    async deleteOrders(orders: PrivateOrder[]) {
        const isSomePaid = orders.some(order => order.payments.some(payment => payment.status === PaymentStatus.Succeeded));
        if (isSomePaid) {
            const text = orders.length > 1 ? $t('%1Ne') : $t('%1Na');
            const description = orders.length > 1 ? $t(`%1Nf`) : $t('%1Nd');
            const isConfirm = await CenteredMessage.confirm(text, $t(`%1Nc`), description, undefined, false);
            if (!isConfirm) {
                return;
            }
        }

        if (!await CenteredMessage.confirm(orders.length === 1
            ? $t(`%VN`,
                    { number: orders[0].number?.toString() ?? '', customer: orders[0].data.customer.name })
            : $t(`%1Ng`),
        $t(`%CJ`),
        $t(`%1Fc`), undefined, true, $t('%1NZ'))
        ) {
            return;
        }

        try {
            await this.markAs(orders, OrderStatus.Deleted);
            await this.webshopManager.orders.deleteFromDatabase(orders);
        }
        catch (e) {
            Toast.fromError(e).show();
            return;
        }
    }
}
