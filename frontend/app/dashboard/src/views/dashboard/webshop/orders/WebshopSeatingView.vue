<template>
    <LoadingViewTransition>
        <div v-if="!loading && seatingPlan" class="st-view webshop-seating-view">
            <STNavigationBar :title="$t(`5b280bad-2167-42e6-8c4f-177ab1d76c67`)">
                <template v-if="hasFullPermissions" #right>
                    <button class="icon edit button" type="button" @click="editSeatingPlan" />
                </template>
            </STNavigationBar>

            <main>
                <h1 class="style-navigation-title">
                    {{ $t('6a49e896-3491-4f6e-a947-d180fce6c6e8') }}
                </h1>

                <button v-if="selectedProduct && availableProducts.length > 1" class="button text inline" type="button" @click="chooseProduct">
                    <span>{{ selectedProduct.name }}</span>
                    <span class="icon arrow-down-small" />
                </button>

                <p v-if="webshop !== null && selectedProduct && duplicateSeats.length" class="error-box">
                    {{ $t('d6972a60-97a1-4065-83f2-95638c866efd') }}: {{ duplicateSeats.map(s => s.getNameString(webshop!, selectedProduct!)).join(', ') }}
                </p>

                <div v-for="section of sections" :key="section.id" class="container">
                    <hr><h2>{{ section.name }}</h2>

                    <div>
                        <SeatSelectionBox v-if="seatingPlan && section" :seating-plan="seatingPlan" :seating-plan-section="section" :reserved-seats="reservedSeats" :seats="highlightedSeats" :highlight-seats="scannedSeats" :on-click-seat="onClickSeat" :on-hover-seat="onHoverSeat" :admin="true" />
                    </div>
                </div>
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { ContextMenu, ContextMenuItem, LoadingViewTransition, SeatSelectionBox, STNavigationBar, Toast, useAuth, useIsMobile } from '@stamhoofd/components';
import { PermissionLevel, PrivateOrder, PrivateOrderWithTickets, PrivateWebshop, Product, ReservedSeat, TicketPrivate } from '@stamhoofd/structures';

import { useRequestOwner } from '@stamhoofd/networking';
import { computed, onBeforeUnmount, Ref, ref } from 'vue';
import EditSeatingPlanView from '../edit/seating/EditSeatingPlanView.vue';
import { WebshopManager } from '../WebshopManager';
import OrderView from './OrderView.vue';

const props = defineProps<{
    webshopManager: WebshopManager;
}>();

const present = usePresent();
const show = useShow();
const isMobile = useIsMobile();
const preview = computed(() => props.webshopManager.preview);
const webshop = computed(() => props.webshopManager.webshop);
const loading = ref(false);
const orders = ref([]) as Ref<PrivateOrderWithTickets[]>;
const selectedProductId = ref<string | null>(null);
const requestOwner = useRequestOwner();
const isLoadingOrders = ref(true);
const isRefreshingOrders = ref(false);

const selectedProduct = computed({
    get: (): Product | null => webshop.value?.products?.find(p => p.id === selectedProductId.value) ?? null,
    set: (product: Product | null) => {
        selectedProductId.value = product?.id ?? null;
    },
});

const onNewOrders = async (orders: PrivateOrder[]) => {
    // Search for the orders and replace / add them
    for (const order of orders) {
        putOrder(order);
    }

    // If we received new orders, the webshop will also have changed reserved seats for the products
    await props.webshopManager.loadWebshopIfNeeded(false, true);

    // Remove highlight (order might have changed)
    highlightedSeats.value = [];

    return Promise.resolve();
};

const onDeleteOrders = async (orders: PrivateOrder[]): Promise<void> => {
    // Delete these orders from the loaded orders instead of doing a full reload
    for (const order of orders) {
        const index = orders.findIndex(o => o.id === order.id);
        if (index !== -1) {
            orders.splice(index, 1);
        }
    }

    // If we received new orders, the webshop will also have changed reserved seats for the products
    await props.webshopManager.loadWebshopIfNeeded(false, true);

    // Remove highlight (order might have changed)
    highlightedSeats.value = [];

    return Promise.resolve();
};

function created() {
    const ordersEventBus = props.webshopManager.orders.eventBus;
    ordersEventBus.addListener(requestOwner, 'fetched', onNewOrders);
    ordersEventBus.addListener(requestOwner, 'deleted', onDeleteOrders);

    reload();
    loadOrders().catch(console.error);
}

created();

onBeforeUnmount(() => {
    props.webshopManager.orders.eventBus.removeListener(requestOwner);
    props.webshopManager.tickets.eventBus.removeListener(requestOwner);
    props.webshopManager.tickets.patchesEventBus.removeListener(requestOwner);
});

const availableProducts = computed(() => {
    return webshop.value?.products.filter(p => p.seatingPlanId) ?? [];
});

const seatingPlan = computed(() => {
    return webshop.value?.meta.seatingPlans.find(p => p.id === selectedProduct.value?.seatingPlanId) ?? null;
});

const sections = computed(() => {
    const plan = seatingPlan.value;
    if (!plan) {
        return [];
    }
    return plan.sections;
});

const reservedSeats = computed(() => {
    return selectedProduct.value?.reservedSeats ?? [];
});

const duplicateSeats = computed(() => {
    // Try to find all seats that are reserved twice
    const duplicateSeats = new Map<string, ReservedSeat>();
    const foundSeats = new Set<string>();

    // We need to look at the reserved seats of orders, not of the product
    const correctedReservedSeats = orders.value.flatMap(o => o.data.cart.items.flatMap(item => item.product.id === selectedProduct.value?.id ? item.reservedSeats : []));

    for (const seat of correctedReservedSeats ?? []) {
        const id = seat.section + ':::' + seat.row + ':::' + seat.seat;
        if (foundSeats.has(id)) {
            duplicateSeats.set(id, seat);
        }
        foundSeats.add(id);
    }

    return [...duplicateSeats.values()];
});

const scannedSeats = computed(() => {
    return orders.value.flatMap(o => o.tickets.flatMap((t) => {
        const ticket = t.getPublic(o);
        if (!ticket.isSingle || !ticket.items[0]) {
            return [];
        }
        const item = ticket.items[0];
        if (item.product.id !== selectedProduct.value?.id) {
            return [];
        }
        return t.scannedAt ? [t.seat] : [];
    }));
});

const highlightedSeats = ref<ReservedSeat[]>([]);

function editSeatingPlan() {
    present({
        components: [
            new ComponentWithProperties(EditSeatingPlanView, {
                webshop: webshop.value,
                seatingPlan: seatingPlan.value,
                isNew: false,
                saveHandler: async (patch: AutoEncoderPatchType<PrivateWebshop>) => {
                    // this.patchWebshop = this.patchWebshop.patch(patchedWebshop)
                    await props.webshopManager.patchWebshop(patch);
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    }).catch(console.error);
}

function chooseProduct(event: MouseEvent) {
    const contextMenu = new ContextMenu([
        availableProducts.value.map((product) => {
            return new ContextMenuItem({
                name: product.name,
                action: () => {
                    selectedProduct.value = product;
                    highlightedSeats.value = [];
                    return true;
                },
            });
        }),
    ]);
    contextMenu.show({
        button: event.currentTarget as HTMLElement,
        xPlacement: 'right',
    }).catch(console.error);
}

function onClickSeat(seat: ReservedSeat) {
    for (const order of orders.value) {
        for (const item of order.data.cart.items) {
            if (item.product.id !== selectedProduct.value?.id) {
                continue;
            }
            for (const s of item.reservedSeats) {
                if (s.equals(seat)) {
                    openOrder(order);

                    highlightedSeats.value = order.data.cart.items.flatMap(i => i.product.id !== selectedProduct.value?.id ? [] : i.reservedSeats);
                    return;
                }
            }
        }
    }
    highlightedSeats.value = [];

    // Check if this seat is reserved in the product
    if (selectedProduct.value?.reservedSeats.find(r => r.equals(seat))) {
        new Toast('Deze plaats is gereserveerd, maar de bestelling is nog niet bevestigd. Dit kan voorkomen als de besteller nog aan het afrekenen is.', 'info').show();
    }
    else {
        new Toast('Er is nog geen bestelling gekoppeld aan deze plaats.', 'info').show();
    }
}

function onHoverSeat(seat: ReservedSeat) {
    for (const order of orders.value) {
        for (const item of order.data.cart.items) {
            if (item.product.id !== selectedProduct.value?.id) {
                continue;
            }
            for (const s of item.reservedSeats) {
                if (s.equals(seat)) {
                    highlightedSeats.value = order.data.cart.items.flatMap(i => i.product.id !== selectedProduct.value?.id ? [] : i.reservedSeats);
                    return;
                }
            }
        }
    }
    highlightedSeats.value = [];
}

/**
     * Insert or update an order
     */
function putOrder(order: PrivateOrder) {
    for (const _order of orders.value) {
        if (order.id === _order.id) {
            // replace data without affecting reference or tickets
            _order.set(order);
            return;
        }
    }
    orders.value.push(PrivateOrderWithTickets.create(order));
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

        await props.webshopManager.orders.stream({
            callback: (order) => {
            // Same orders could be seen twice
                arrayBuffer.push(
                    PrivateOrderWithTickets.create(order),
                );
            },
        });

        const ticketBuffer: TicketPrivate[] = [];

        await props.webshopManager.tickets.streamAll((ticket) => {
            ticketBuffer.push(ticket);
        }, false);

        await props.webshopManager.tickets.streamAllPatches((patch) => {
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

const hasTickets = computed(() => preview.value.hasTickets);

async function refresh(reset = false) {
    try {
        // Initiate a refresh
        // don't wait
        isRefreshingOrders.value = true;
        isLoadingOrders.value = orders.value.length === 0;

        if (reset) {
            orders.value = [];
        }
        await props.webshopManager.orders.fetchAllUpdated({ isFetchAll: reset });
    }
    catch (e) {
        // Fetching failed
        Toast.fromError(e).show();
    }

    // And preload the tickets if needed
    if (hasTickets.value) {
        try {
            await props.webshopManager.tickets.fetchAllUpdated();
        }
        catch (e) {
            // Fetching failed
            Toast.fromError(e).show();
        }

        // Do we still have some missing patches that are not yet synced with the server?
        props.webshopManager.tickets.trySavePatches().catch((e: Error) => {
            console.error(e);
            Toast.fromError(e).show();
        });
    }

    isLoadingOrders.value = false;
    isRefreshingOrders.value = false;
}

const auth = useAuth();
const hasFullPermissions = computed(() => auth.canAccessWebshop(props.webshopManager.preview, PermissionLevel.Full));

function reload() {
    loading.value = true;

    props.webshopManager.loadWebshopIfNeeded().catch((e) => {
        console.error(e);
        Toast.fromError(e).show();
    }).finally(() => {
        loading.value = false;
        selectedProduct.value = selectedProduct.value ?? availableProducts.value[0] ?? null;
        console.log(selectedProduct.value?.reservedSeats);
    });
}

function openOrder(order: PrivateOrderWithTickets) {
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
