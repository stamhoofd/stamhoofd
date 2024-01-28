<template>
    <LoadingView v-if="loading || !seatingPlan" />
    <div v-else class="st-view webshop-seating-view">
        <STNavigationBar title="Zaaloverzicht" :pop="canPop" :dismiss="canDismiss">
            <button v-if="hasFullPermissions" slot="right" class="icon navigation edit button" type="button" @click="editSeatingPlan" />
        </STNavigationBar>

        <main>
            <h1 class="style-navigation-title">
                Zaaloverzicht

                <button v-if="selectedProduct && availableProducts.length > 1" class="button text inline" type="button" @click="chooseProduct">
                    <span>{{ selectedProduct.name }}</span>
                    <span class="icon arrow-down-small" />
                </button>
            </h1>

            <div v-for="section of sections" :key="section.id" class="container">
                <hr>
                <h2>{{ section.name }}</h2>

                <div>
                    <SeatSelectionBox 
                        v-if="seatingPlan && section"
                        :seating-plan="seatingPlan"
                        :seating-plan-section="section"
                        :reserved-seats="reservedSeats"
                        :seats="highlightedSeats"
                        :highlight-seats="scannedSeats"
                        :on-click-seat="onClickSeat"
                        :admin="true"
                    />
                </div>
            </div>
        </main>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ContextMenu, ContextMenuItem, LoadingView, SeatSelectionBox,STNavigationBar, Toast } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from "@stamhoofd/networking";
import { PrivateOrder, PrivateOrderWithTickets, PrivateWebshop, Product, ReservedSeat, TicketPrivate } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../../classes/OrganizationManager';
import EditSeatingPlanView from "../edit/seating/EditSeatingPlanView.vue";
import { WebshopManager } from '../WebshopManager';
import OrderView from './OrderView.vue';

@Component({
    components: {
        STNavigationBar,
        LoadingView,
        SeatSelectionBox
    },
})
export default class WebshopSeatingView extends Mixins(NavigationMixin) {
    @Prop()
        webshopManager: WebshopManager

    get preview() {
        return this.webshopManager.preview
    }

    get webshop() {
        return this.webshopManager.webshop
    }

    get organization() {
        return OrganizationManager.organization
    }

    loading = false;
    orders: PrivateOrderWithTickets[] = []
    selectedProduct: Product | null = null

    created() {
        this.webshopManager.ordersEventBus.addListener(this, "fetched", this.onNewOrders.bind(this))
        this.webshopManager.ordersEventBus.addListener(this, "deleted", this.onDeleteOrders.bind(this))

        this.webshopManager.ticketsEventBus.addListener(this, "fetched", this.onNewTickets.bind(this))
        this.webshopManager.ticketPatchesEventBus.addListener(this, "patched", this.onNewTicketPatches.bind(this))

        this.reload();
        this.loadOrders().catch(console.error)
    }
    
    mounted() {
        // Set url
        UrlHelper.setUrl("/webshops/" + Formatter.slug(this.preview.meta.name)+"/seating")
        document.title = this.preview.meta.name+" - Zaalplan"
    }

    beforeDestroy() {
        this.webshopManager.ordersEventBus.removeListener(this)
        this.webshopManager.ticketsEventBus.removeListener(this)
        this.webshopManager.ticketPatchesEventBus.removeListener(this)
        Request.cancelAll(this)
    }

    get availableProducts() {
        return this.webshop?.products.filter(p => p.seatingPlanId) ?? []
    }

    get seatingPlan() {
        return this.webshop?.meta.seatingPlans.find(p => p.id === this.selectedProduct?.seatingPlanId) ?? null
    }

    get sections() {
        const plan = this.seatingPlan
        if (!plan) {
            return []
        }
        return plan.sections
    }

    get reservedSeats() {
        return this.selectedProduct?.reservedSeats ?? []
    }

    get scannedSeats() {
        return this.orders.flatMap(o => o.tickets.flatMap(t => {
            const ticket = t.getPublic(o);
            if (!ticket.isSingle || !ticket.items[0]) {
                return []
            }
            const item = ticket.items[0]
            if (item.product.id !== this.selectedProduct?.id) {
                return []
            }
            return t.scannedAt ? [t.seat] : []
        }))
    }

    highlightedSeats: ReservedSeat[] = []

    editSeatingPlan() {
        this.present({
            components: [
                new ComponentWithProperties(EditSeatingPlanView, {
                    webshop: this.webshop,
                    seatingPlan: this.seatingPlan,
                    isNew: false,
                    saveHandler: async (patch: AutoEncoderPatchType<PrivateWebshop>) => {
                        //this.patchWebshop = this.patchWebshop.patch(patchedWebshop)
                        await this.webshopManager.patchWebshop(patch)
                    }
                })
            ],
            modalDisplayStyle: "popup"
        })
    }

    chooseProduct(event) {
        const contextMenu = new ContextMenu([
            this.availableProducts.map(product => {
                return new ContextMenuItem({
                    name: product.name,
                    action: () => {
                        this.selectedProduct = product
                        this.highlightedSeats = []
                        return true;
                    }
                })
            })
        ]);
        contextMenu.show({ button: event.currentTarget, xPlacement: "right" }).catch(console.error);
    }

    onClickSeat(seat: ReservedSeat) {
        for (const order of this.orders) {
            for (const item of order.data.cart.items) {
                if (item.product.id !== this.selectedProduct?.id) {
                    continue
                }
                for (const s of item.reservedSeats) {
                    if (s.equals(seat)) {
                        this.openOrder(order)

                        this.highlightedSeats = order.data.cart.items.flatMap(i => i.reservedSeats)
                        return
                    }
                }
            }
        }
        this.highlightedSeats = []
        new Toast('Er is nog geen bestelling gekoppeld aan deze plaats.', 'info').show();
    }

    onDeleteOrders(orders: PrivateOrder[]): Promise<void> {
        // Delete these orders from the loaded orders instead of doing a full reload
        for (const order of orders) {
            const index = this.orders.findIndex(o => o.id === order.id)
            if (index != -1) {
                this.orders.splice(index, 1)
            }
        }

        return Promise.resolve()
    }
    
    /**
     * Insert or update an order
     */
    putOrder(order: PrivateOrder) {
        for (const _order of this.orders) {
            if (order.id === _order.id) {
                // replace data without affecting reference or tickets
                _order.set(order)
                return
            }
        }
        this.orders.push(PrivateOrderWithTickets.create(order))
    }

    async onNewOrders(orders: PrivateOrder[]) {
        // Search for the orders and replace / add them
        for (const order of orders) {
            this.putOrder(order)
        }

        return Promise.resolve()
    }

    async onNewTickets(tickets: TicketPrivate[]) {
        console.log("Received new tickets from network")
        
        for (const ticket of tickets) {
            const order = this.orders.find(o => o.id === ticket.orderId)
            if (order) {
                const existing = order.tickets.find(t => t.id === ticket.id);
                if (existing) {
                    existing.set(ticket)
                } else {
                    order.tickets.push(ticket)
                }
            } else {
                console.warn('Couldn\'t find order for ticket', ticket)
            }
        }

        return Promise.resolve()
    }

    onNewTicketPatches(patches: AutoEncoderPatchType<TicketPrivate>[]) {
        console.log("Received new tickets from network")
        
        mainLoop: for (const patch of patches) {
            for (const order of this.orders) {
                for (const ticket of order.tickets) {
                    if (ticket.id === patch.id) {
                        ticket.set(ticket.patch(patch))
                        continue mainLoop;
                    }
                }
            }
        }

        return Promise.resolve()
    }

    get hasWrite() {
        const p = SessionManager.currentSession?.user?.permissions
        if (!p) {
            return false
        }
        return this.preview.privateMeta.permissions.hasWriteAccess(p, OrganizationManager.organization.privateMeta?.roles ?? [])    
    }

    isLoadingOrders = true
    isRefreshingOrders = false

    async loadOrders() {
        console.log("Loading orders...")
        this.orders = []
        this.isLoadingOrders = true
        
        // Disabled for now: first fix needed for payment status + deleted orders
        try {
            // We use stream orders because that doesn't block the main thread on iOS
            // (we don't need to decode all orders at the same time on the main thread)

            // We use a buffer to prevent DOM updates or Vue slowdown during streaming
            let arrayBuffer: PrivateOrderWithTickets[] = []

            await this.webshopManager.streamOrders((order) => {
                // Same orders could be seen twice
                arrayBuffer.push(
                    PrivateOrderWithTickets.create(order)
                )
            }, false)

            let ticketBuffer: TicketPrivate[] = []

            await this.webshopManager.streamTickets((ticket) => {
                ticketBuffer.push(ticket)
            }, false)

            await this.webshopManager.streamTicketPatches((patch) => {
                const ticket = ticketBuffer.find(o => o.id === patch.id)
                if (ticket) {
                    ticket.set(ticket.patch(patch))
                }
            })

            for (const ticket of ticketBuffer) {
                const order = arrayBuffer.find(o => o.id === ticket.orderId)
                if (order) {
                    order.tickets.push(ticket)
                } else {
                    console.warn('Couldn\'t find order for ticket', ticket)
                }
            }

            if (arrayBuffer.length > 0) {
                this.orders = arrayBuffer
                this.isLoadingOrders = false
            }
        } catch (e) {
            // Database error. We can ignore this and simply move on.
            console.error(e)
        }
        await this.refresh(false) 
    }

    get hasTickets() {
        return this.preview.hasTickets
    }

    async refresh(reset = false) {
        try {
            // Initiate a refresh
            // don't wait
            this.isRefreshingOrders = true
            this.isLoadingOrders = this.orders.length == 0

            if (reset) {
                this.orders = []
            }
            await this.webshopManager.fetchNewOrders(false, reset)
        } catch (e) {
            // Fetching failed
            Toast.fromError(e).show()
        }


        // And preload the tickets if needed
        if (this.hasTickets) {
            try {
                await this.webshopManager.fetchNewTickets(false, false)
            } catch (e) {
                // Fetching failed
                Toast.fromError(e).show()
            }
            
            // Do we still have some missing patches that are not yet synced with the server?
            this.webshopManager.trySavePatches().catch((e) => {
                console.error(e)
                Toast.fromError(e).show()
            })
        }

        this.isLoadingOrders = false
        this.isRefreshingOrders = false
    }


    get hasFullPermissions() {
        return this.preview.privateMeta.permissions.hasFullAccess(OrganizationManager.user.permissions, this.organization.privateMeta?.roles ?? [])
    }

    reload() {
        this.loading = true;

        this.webshopManager.loadWebshopIfNeeded().catch((e) => {
            console.error(e)
            Toast.fromError(e).show()
        }).finally(() => {
            this.loading = false
            this.selectedProduct = this.selectedProduct ?? this.availableProducts[0] ?? null
        })
    }
    
    openOrder(order: PrivateOrderWithTickets) {
        const component = new ComponentWithProperties(NavigationController, { 
            root: new ComponentWithProperties(OrderView, { 
                initialOrder: order,
                webshopManager: this.webshopManager
            })
        })

        if ((this as any).$isMobile) {
            this.show(component)
        } else {
            component.modalDisplayStyle = "popup";
            this.present(component);
        }
    }
}
</script>