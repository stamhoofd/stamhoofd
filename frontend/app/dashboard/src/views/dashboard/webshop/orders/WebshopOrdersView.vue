<template>
    <ModernTableView
        ref="modernTableView"
        :table-object-fetcher="tableObjectFetcher"
        :filter-builders="filterBuilders"
        :title="title"
        :column-configuration-id="configurationId"
        :actions="actions"
        :all-columns="allColumns"
        :prefix-column="allColumns[0]"
        @click="$event => openOrder($event)"
    >
        <template #empty>
            {{ $t('Er zijn nog geen bestellingen.') }}
        </template>
    </ModernTableView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { Column, getWebshopOrderUIFilterBuilders, GlobalEventBus, InMemoryTableAction, ModernTableView, Toast, UIFilterBuilders, useIsMobile, useTableObjectFetcher, useVisibilityChange } from '@stamhoofd/components';
import { CheckoutMethod, CheckoutMethodType, OrderStatus, OrderStatusHelper, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PrivateOrder, PrivateOrderWithTickets, TicketPrivate, WebshopTimeSlot } from '@stamhoofd/structures';

import { ComponentWithProperties, NavigationController, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { useOrganizationManager, useRequestOwner } from '@stamhoofd/networking';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { computed, onBeforeUnmount, Ref, ref } from 'vue';
import { WebshopManager } from '../WebshopManager';
import { OrderActionBuilder } from './OrderActionBuilder';
import OrderView from './OrderView.vue';
import { useOrdersObjectFetcher } from './useOrdersObjectFetcher';

const props = defineProps<{ webshopManager: WebshopManager }>();

const title = 'Bestellingen';
// todo?
const configurationId = 'orders';

fetchOrders();
useVisibilityChange(() => fetchOrders());
const objectFetcher = useOrdersObjectFetcher(props.webshopManager);
const tableObjectFetcher = useTableObjectFetcher<PrivateOrderWithTickets>(objectFetcher);

function fetchOrders() {
    props.webshopManager.fetchOrders2().then((hadUpdatedOrders) => {
        if (hadUpdatedOrders) {
            tableObjectFetcher.reset();
        }
    }).catch(console.error);
}

// todo
const filterBuilders: UIFilterBuilders = getWebshopOrderUIFilterBuilders(props.webshopManager.preview);

// const organization = useOrganization();
const organizationManager = useOrganizationManager();
// const context = useContext();
const owner = useRequestOwner();
const show = useShow();
const present = usePresent();
const isMobile = useIsMobile();

const loading = ref(false);
const isLoadingOrders = ref(true);
const isRefreshingOrders = ref(false);
const orders: Ref<PrivateOrderWithTickets[]> = ref([]);

const preview = computed(() => props.webshopManager.preview);
// const webshop = computed(() => props.webshopManager.webshop);
const hasSingleTickets = computed(() => preview.value.hasSingleTickets);
const hasTickets = computed(() => preview.value.hasTickets);
// const estimatedRows = computed(() => {
//     if (isLoadingOrders.value) {
//         return orders.value.length === 0 ? 30 : orders.value.length;
//     }

//     return 0;
// });
const actions = computed(() => {
    const builder = new OrderActionBuilder({
        organizationManager: organizationManager.value,
        webshopManager: props.webshopManager,
        component: this,
    });
    return [
        new InMemoryTableAction({
            name: 'Openen',
            icon: 'eye',
            priority: 0,
            groupIndex: 1,
            needsSelection: true,
            singleSelection: true,
            handler: (orders: PrivateOrderWithTickets[]) => {
                openOrder(orders[0]);
            },
        }),

        ...builder.getActions(),
    ];
});

const allColumns = ((): Column<PrivateOrderWithTickets, any>[] => {
    const cols: Column<PrivateOrderWithTickets, any>[] = [
        new Column<PrivateOrder, number>({
            id: 'number',
            name: '#',
            getValue: order => order.number ?? 0,
            compare: (a, b) => Sorter.byNumberValue(b, a),
            minimumWidth: 50,
            recommendedWidth: 50,
            getStyleForObject: (order, isPrefix) => {
                if (!isPrefix) {
                    return '';
                }
                return OrderStatusHelper.getColor(order.status);
            },
            index: 0,
        }),

        new Column<PrivateOrder, OrderStatus>({
            id: 'status',
            name: 'Status',
            getValue: order => order.status,
            format: status => OrderStatusHelper.getName(status),
            compare: (a, b) => Sorter.byEnumValue(a, b, OrderStatus),
            getStyle: (status) => {
                return OrderStatusHelper.getColor(status);
            }, // todo: based on status
            minimumWidth: 100,
            recommendedWidth: 120,
            index: isMobile ? 1 : 0,
        }),

        new Column<PrivateOrder, string>({
            id: 'name',
            name: 'Naam',
            getValue: order => order.data.customer.name,
            compare: (a, b) => Sorter.byStringValue(a, b),
            minimumWidth: 100,
            recommendedWidth: 400,
            grow: true,
            index: isMobile ? 0 : 1,
        }),

        new Column<PrivateOrder, string>({
            id: 'email',
            name: 'E-mailadres',
            getValue: order => order.data.customer.email,
            compare: (a, b) => Sorter.byStringValue(a, b),
            minimumWidth: 100,
            recommendedWidth: 500,
            grow: false,
            enabled: false,
            index: isMobile ? 0 : 1,
        }),
    ];

    if (preview.value.meta.phoneEnabled) {
        cols.push(
            new Column<PrivateOrder, string>({
                id: 'phone',
                name: 'Telefoonnummer',
                getValue: order => order.data.customer.phone,
                compare: (a, b) => Sorter.byStringValue(a, b),
                minimumWidth: 100,
                recommendedWidth: 500,
                grow: false,
                enabled: false,
                index: isMobile ? 0 : 1,
            }),
        );
    }

    if (preview.value.meta.paymentMethods.length > 1) {
        cols.push(new Column<PrivateOrder, string[]>({
            id: 'paymentMethod',
            name: 'Betaalmethode',
            getValue: (order) => {
                return Formatter.uniqueArray(order.balanceItems.flatMap(b => b.payments.map(p => p.payment.method))).map(m => PaymentMethodHelper.getNameCapitalized(m, order.data.checkoutMethod?.type ?? null)).sort();
            },
            format: (methods) => {
                if (methods.length === 0) {
                    return 'Geen';
                }

                return methods.join(', ');
            },
            compare: (a, b) => Sorter.byStringValue(a.join(','), b.join(',')),
            getStyle: methods => methods.length === 0 ? 'gray' : '',
            minimumWidth: 100,
            recommendedWidth: 120,
            enabled: false,
        }));
    }

    if (preview.value.meta.checkoutMethods.length > 1) {
        cols.push(new Column<PrivateOrder, CheckoutMethod | null>({
            id: 'checkoutMethod',
            name: 'Methode',
            getValue: order => order.data.checkoutMethod,
            format: (method: CheckoutMethod | null) => {
                if (method === null) {
                    return 'Geen';
                }
                return method.typeName;
            },
            compare: (a, b) => Sorter.byStringValue(a?.id ?? '', b?.id ?? ''),
            getStyle: method => method === null ? 'gray' : '',
            minimumWidth: 100,
            recommendedWidth: 200,
            index: 1,
        }));
    }

    const hasDelivery = preview.value.meta.checkoutMethods.some(method => method.type === CheckoutMethodType.Delivery);

    // Count checkoutm ethods that are not delivery
    const nonDeliveryCount = preview.value.meta.checkoutMethods.filter(method => method.type !== CheckoutMethodType.Delivery).length;

    if (hasDelivery || nonDeliveryCount > 1) {
        cols.push(new Column<PrivateOrder, string | undefined>({
            id: 'location',
            name: hasDelivery && nonDeliveryCount === 0 ? 'Adres' : 'Locatie',
            enabled: true,
            getValue: order => order.data.locationName,
            compare: (a, b) => Sorter.byStringValue(a ?? '', b ?? ''),
            getStyle: loc => loc === undefined ? 'gray' : '',
            minimumWidth: 100,
            recommendedWidth: 250,
            index: 1,
        }));
    }

    const timeCount = Formatter.uniqueArray(preview.value.meta.checkoutMethods.flatMap(method => method.timeSlots.timeSlots).map(t => t.timeRangeString())).length;
    const dateCount = Formatter.uniqueArray(preview.value.meta.checkoutMethods.flatMap(method => method.timeSlots.timeSlots).map(t => t.dateString())).length;

    if (dateCount > 1) {
        cols.push(
            new Column<PrivateOrder, WebshopTimeSlot | undefined>({
                id: 'timeSlotDate',
                name: (hasDelivery && nonDeliveryCount > 0) ? 'Afhaal/leverdatum' : (hasDelivery ? 'Leverdatum' : 'Afhaaldatum'),
                getValue: order => order.data.timeSlot ? order.data.timeSlot : undefined,
                compare: (a, b) => !a && !b ? 0 : (a && b ? WebshopTimeSlot.sort(a, b) : (a ? 1 : -1)),
                format: (timeSlot, width: number) => {
                    if (!timeSlot) {
                        return 'Geen';
                    }
                    if (width < 120) {
                        return Formatter.dateNumber(timeSlot.date, false);
                    }

                    if (width < 200) {
                        return Formatter.capitalizeFirstLetter(timeSlot.dateStringShort());
                    }
                    return Formatter.capitalizeFirstLetter(timeSlot.dateString());
                },
                getStyle: loc => loc === undefined ? 'gray' : '',
                minimumWidth: 60,
                recommendedWidth: 70,
                index: 1,
            }),
        );
    }

    if (timeCount > 1) {
        cols.push(
            new Column<PrivateOrder, WebshopTimeSlot | undefined>({
                id: 'timeSlotTime',
                name: 'Tijdstip',
                getValue: order => order.data.timeSlot ? order.data.timeSlot : undefined,
                compare: (a, b) => !a && !b ? 0 : (a && b ? a.startTime - b.startTime : (a ? 1 : -1)),
                format: (timeSlot, width) => {
                    if (!timeSlot) {
                        return 'Geen';
                    }
                    const time = timeSlot.timeRangeString();

                    if (width < 120) {
                        return time.replaceAll(' - ', '-').replaceAll(/:00/g, 'u').replaceAll(/:(\n{2})/g, 'u$1');
                    }

                    return time;
                },
                getStyle: loc => loc === undefined ? 'gray' : '',
                minimumWidth: 80,
                recommendedWidth: 105,
                index: 1,
            }),
        );
    }

    cols.push(
        new Column<PrivateOrder, Date>({
            id: 'validAt',
            name: 'Besteldatum',
            getValue: order => order.validAt ?? new Date(1990, 0, 1),
            compare: (a, b) => Sorter.byDateValue(a, b),
            format: (date, width: number) => {
                if (width < 120) {
                    return Formatter.dateNumber(date, false);
                }

                if (width < 200) {
                    return Formatter.capitalizeFirstLetter(Formatter.date(date));
                }
                return Formatter.capitalizeFirstLetter(Formatter.dateWithDay(date));
            },
            getStyle: loc => loc === undefined ? 'gray' : '',
            minimumWidth: 60,
            recommendedWidth: 70,
            index: 1,
            enabled: false,
        }),
    );

    cols.push(
        new Column<PrivateOrder, number>({
            id: 'totalPrice',
            name: 'Bedrag',
            enabled: false,
            getValue: order => order.data.totalPrice,
            format: price => Formatter.price(price),
            compare: (a, b) => Sorter.byNumberValue(b ?? 0, a ?? 0),
            getStyle: price => price === undefined ? 'gray' : (price === 0 ? 'gray' : ''),
            minimumWidth: 70,
            recommendedWidth: 80,
            index: 1,
        }),
    );

    cols.push(
        new Column<PrivateOrder, number>({
            id: 'openBalance',
            name: 'Te betalen',
            enabled: preview.value.meta.paymentConfiguration.paymentMethods.includes(PaymentMethod.Transfer) || preview.value.meta.paymentConfiguration.paymentMethods.includes(PaymentMethod.PointOfSale), // keep it available because should be able to enable it when payment methods are changed
            getValue: order => order.openBalance,
            format: price => price !== 0 ? Formatter.price(price) : 'Betaald',
            compare: (a, b) => Sorter.byNumberValue(b ?? 0, a ?? 0),
            getStyle: price => (price === 0 ? 'gray' : ''),
            minimumWidth: 70,
            recommendedWidth: 80,
            index: 1,
        }),
    );

    if (hasTickets.value) {
        cols.push(
            new Column<PrivateOrderWithTickets, { scanned: number; total: number }>({
                name: hasSingleTickets.value ? 'Ticket' : 'Tickets',
                enabled: true,
                getValue: (order) => {
                    return {
                        scanned: order.tickets.filter(t => !!t.scannedAt).length,
                        total: order.tickets.length,
                    };
                },
                format: (stat) => {
                    if (stat.total === 0) {
                        return '-';
                    }

                    if (hasSingleTickets.value) {
                        return stat.scanned === stat.total ? 'Gescand' : 'Niet gescand';
                    }
                    return stat.scanned.toString() + ' / ' + stat.total;
                },
                compare: (a, b) => Sorter.stack(Sorter.byNumberValue(b.scanned, a.scanned), Sorter.byNumberValue(b.total, a.total)),
                getStyle: (stat) => {
                    if (stat.total === 0) {
                        return 'gray';
                    }

                    if (stat.scanned === stat.total) {
                        return 'info';
                    }
                    if (stat.scanned === 0) {
                        return 'tag-gray';
                    }
                    return 'warn';
                },
                minimumWidth: 100,
                recommendedWidth: hasSingleTickets.value ? 150 : 100,
                index: 1,
            }),
        );
    }

    if (!preview.value.meta.cartEnabled) {
        cols.push(
            new Column<PrivateOrderWithTickets, string>({
                name: 'Artikel',
                enabled: false,
                grow: true,
                getValue: (order) => {
                    if (order.data.cart.items.length > 1) {
                        return 'Meerdere artikels';
                    }

                    const item = order.data.cart.items[0];
                    if (!item) {
                        return '';
                    }
                    return item.product.name;
                },
                format: (stat) => {
                    if (!stat) {
                        return 'Geen';
                    }
                    return stat.toString();
                },
                compare: (a, b) => Sorter.byStringValue(b, a),
                getStyle: (stat) => {
                    if (!stat || stat === 'Meerdere artikels') {
                        return 'gray';
                    }

                    return '';
                },
                minimumWidth: 150,
                recommendedWidth: 200,
                index: 1,
            }),
        );

        cols.push(
            new Column<PrivateOrderWithTickets, string>({
                name: 'Beschrijving',
                enabled: false,
                grow: true,
                getValue: (order) => {
                    if (order.data.cart.items.length > 1) {
                        return 'Meerdere artikels';
                    }

                    const item = order.data.cart.items[0];
                    if (!item) {
                        return '';
                    }
                    return item.description.replaceAll('\n', ' - ');
                },
                format: (stat) => {
                    if (!stat) {
                        return 'Geen';
                    }
                    return stat.toString();
                },
                compare: (a, b) => Sorter.byStringValue(b, a),
                getStyle: (stat) => {
                    if (!stat || stat === 'Meerdere artikels') {
                        return 'gray';
                    }

                    return '';
                },
                minimumWidth: 150,
                recommendedWidth: 200,
                index: 1,
            }),
        );
    }

    // Show counts
    cols.push(
        new Column<PrivateOrderWithTickets, number>({
            id: 'amount',
            name: 'Aantal',
            enabled: false,
            getValue: order => order.data.amount,
            format: (stat) => {
                if (!stat) {
                    return 'Geen';
                }
                return stat.toString();
            },
            compare: (a, b) => Sorter.byNumberValue(b, a),
            getStyle: (stat) => {
                if (stat === 0) {
                    return 'gray';
                }

                return '';
            },
            minimumWidth: 100,
            recommendedWidth: hasSingleTickets.value ? 150 : 100,
            index: 1,
        }),
    );

    // Custom questions
    for (const category of preview.value.meta.recordCategories) {
        for (const record of category.getAllRecords()) {
            cols.push(new Column<PrivateOrder, string | undefined>({
                name: record.name,
                enabled: false,
                getValue: (order) => {
                    const answer = order.data.recordAnswers.get(record.id);
                    if (!answer) {
                        return undefined;
                    }
                    return answer.stringValue;
                },
                format: v => v ? v : 'Leeg',
                compare: (a, b) => Sorter.byStringValue(b ?? '', a ?? ''),
                getStyle: price => price === undefined ? 'gray' : '',
                minimumWidth: 70,
                recommendedWidth: 150,
            }));
        }
    }

    return cols;
})();

// const prefixColumn = computed(() => allColumns[0]);

/**
* Insert or update an order
*/
function putOrder(order: PrivateOrder) {
    for (const _order of orders.value) {
        if (order.id === _order.id) {
            // replace data without affecting reference or tickets
            _order.deepSet(order);
            return;
        }
    }
    orders.value.push(PrivateOrderWithTickets.create(order));
}

async function onNewOrders(orders: PrivateOrder[]) {
    console.log('Received new orders from network');
    // Search for the orders and replace / add them
    for (const order of orders) {
        putOrder(order);
    }

    return Promise.resolve();
}

async function onNewTickets(tickets: TicketPrivate[]) {
    console.log('Received new tickets from network');

    for (const order of orders.value) {
        order.addTickets(tickets);
    }

    return Promise.resolve();
}

function onNewTicketPatches(patches: AutoEncoderPatchType<TicketPrivate>[]) {
    console.log('Received new tickets from network');
    PrivateOrderWithTickets.addTicketPatches(orders.value, patches);
    return Promise.resolve();
}

function created() {
    props.webshopManager.ordersEventBus.addListener(owner, 'fetched', orders => onNewOrders(orders));
    props.webshopManager.ordersEventBus.addListener(owner, 'deleted', orders => onDeleteOrders(orders));

    props.webshopManager.ticketsEventBus.addListener(owner, 'fetched', tickets => onNewTickets(tickets));
    props.webshopManager.ticketPatchesEventBus.addListener(owner, 'patched', tickets => onNewTicketPatches(tickets));

    reload();
    loadOrders().catch(console.error);

    // Listen for patches in payments
    GlobalEventBus.addListener(owner, 'paymentPatch', async (payment: PaymentGeneral) => {
        if (payment && payment.id && payment.webshopIds.find(webshopId => webshopId === props.webshopManager.preview.id)) {
            await props.webshopManager.fetchNewTickets(false, false);
        }
        return Promise.resolve();
    });
}

// created();

// const hasWrite = computed(() => {
//     const p = context.value.organizationPermissions;
//     if (!p) {
//         return false;
//     }
//     return preview.value.privateMeta.permissions.hasWriteAccess(p);
// });

onBeforeUnmount(() => {
    props.webshopManager.ordersEventBus.removeListener(this);
    props.webshopManager.ticketsEventBus.removeListener(this);
    props.webshopManager.ticketPatchesEventBus.removeListener(this);
    Request.cancelAll(this);
});

function onDeleteOrders(orders: PrivateOrder[]): Promise<void> {
    // Delete these orders from the loaded orders instead of doing a full reload
    for (const order of orders) {
        const index = orders.findIndex(o => o.id === order.id);
        if (index !== -1) {
            orders.splice(index, 1);
        }
    }

    return Promise.resolve();
}

async function loadOrders() {
    console.log('Loading orders...');
    orders.value = [];
    isLoadingOrders.value = true;

    // Disabled for now: first fix needed for payment status + deleted orders
    try {
        // We use stream orders because that doesn't block the main thread on iOS
        // (we don't need to decode all orders at the same time on the main thread)

        // We use a buffer to prevent DOM updates or Vue slowdown during streaming
        const arrayBuffer: PrivateOrderWithTickets[] = [];

        await props.webshopManager.streamOrdersDeprecated((order) => {
            // Same orders could be seen twice
            arrayBuffer.push(
                PrivateOrderWithTickets.create(order),
            );
        }, false);

        const ticketBuffer: TicketPrivate[] = [];

        await props.webshopManager.streamTickets((ticket) => {
            ticketBuffer.push(ticket);
        }, false);

        await props.webshopManager.streamTicketPatches((patch) => {
            const ticket = ticketBuffer.find(o => o.id === patch.id);
            if (ticket) {
                ticket.deepSet(ticket.patch(patch));
            }
        });

        for (const ticket of ticketBuffer) {
            const order = arrayBuffer.find(o => o.id === ticket.orderId);
            if (order) {
                order.tickets.push(ticket);
            }
            else {
                console.warn('Couldn\'t find order for ticket', ticket);
            }
        }

        if (arrayBuffer.length > 0) {
            orders.value = arrayBuffer;
            isLoadingOrders.value = false;
        }
    }
    catch (e) {
        // Database error. We can ignore this and simply move on.
        console.error(e);
    }
    await refresh(false);
}

async function refresh(reset = false) {
    try {
        // Initiate a refresh
        // don't wait
        isRefreshingOrders.value = true;
        isLoadingOrders.value = orders.value.length === 0;

        if (reset) {
            orders.value = [];
        }
        await props.webshopManager.fetchNewOrdersDeprecated(false, reset);
    }
    catch (e) {
        // Fetching failed
        Toast.fromError(e).show();
    }

    // And preload the tickets if needed
    await refreshTickets();

    isLoadingOrders.value = false;
    isRefreshingOrders.value = false;
}

async function refreshTickets() {
    // And preload the tickets if needed
    if (hasTickets.value) {
        try {
            await props.webshopManager.fetchNewTickets(false, false);
        }
        catch (e) {
            // Fetching failed
            Toast.fromError(e).show();
        }

        // Do we still have some missing patches that are not yet synced with the server?
        props.webshopManager.trySavePatches().catch((e: any) => {
            console.error(e);
            Toast.fromError(e).show();
        });
    }
}

// const webshopUrl = computed(() => preview.value.getUrl(organization.value!));

// const hasFullPermissions = computed(() => preview.value.privateMeta.permissions.hasFullAccess(context.value.organizationPermissions));

function reload() {
    loading.value = true;

    props.webshopManager.loadWebshopIfNeeded().catch((e) => {
        console.error(e);
        Toast.fromError(e).show();
    }).finally(() => {
        loading.value = false;
    });
}

// const deliveryCities = computed(() => {
//     const cities = new Map<string, string>();
//     for (const order of orders.value) {
//         if (order.data.checkoutMethod && order.data.checkoutMethod.type === CheckoutMethodType.Delivery && order.data.address) {
//             cities.set(Formatter.slug(order.data.address.postalCode + ' ' + order.data.address.city), order.data.address.postalCode + ' ' + order.data.address.city);
//         }
//     }

//     return [...cities.entries()].sort((a, b) => Sorter.byStringValue(a[0], b[0]));
// });

// const filterDefinitions = [];

// todo: get private order with tickets??
// function openOrder(order: PrivateOrderWithTickets) {
function openOrder(order: PrivateOrder) {
    const component = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(OrderView, {
            initialOrder: order,
            webshopManager: props.webshopManager,
        }),
    });

    if (isMobile) {
        show(component).catch(console.error);
    }
    else {
        component.modalDisplayStyle = 'popup';
        present(component).catch(console.error);
    }
}
</script>
