<template>
    <TableView ref="table" :prefix-column="prefixColumn" default-sort-direction="DESC" :organization="organization" :title="title" :column-configuration-id="'orders-'+preview.id" :actions="actions" :all-values="isLoadingOrders ? [] : orders" :estimated-rows="estimatedRows" :all-columns="allColumns" :filter-definitions="filterDefinitions" @refresh="refresh(false)" @click="openOrder">
        <template #empty>
            Er zijn nog geen bestellingen.
        </template>
    </TableView>
</template>

<script lang="ts">
import { AutoEncoderPatchType } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-networking";
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";
import { Column, GlobalEventBus, InMemoryTableAction, TableAction, TableView, Toast } from "@stamhoofd/components";
import { UrlHelper } from "@stamhoofd/networking";
import { CheckoutMethod, CheckoutMethodType, Filter, FilterDefinition, OrderStatus, OrderStatusHelper, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PrivateOrder, PrivateOrderWithTickets, TicketPrivate, WebshopTimeSlot } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';


import { WebshopManager } from '../WebshopManager';
import { OrderActionBuilder } from "./OrderActionBuilder";
import OrderView from './OrderView.vue';

@Component({
    components: {
        TableView,
    },
})
export default class WebshopOrdersView extends Mixins(NavigationMixin) {
    @Prop()
        webshopManager: WebshopManager

    get preview() {
        return this.webshopManager.preview
    }

    get webshop() {
        return this.webshopManager.webshop
    }

    get organization() {
        return this.$organization
    }

    loading = false;
    orders: PrivateOrderWithTickets[] = []

    get estimatedRows() {
        if (this.isLoadingOrders) {
            return this.orders.length == 0 ? 30 : this.orders.length
        }
       
        return 0
    }

    get actions(): TableAction<PrivateOrderWithTickets>[] {
        const builder = new OrderActionBuilder({
            organizationManager: this.$organizationManager,
            webshopManager: this.webshopManager,
            component: this
        })
        return [
            new InMemoryTableAction({
                name: "Openen",
                icon: "eye",
                priority: 0,
                groupIndex: 1,
                needsSelection: true,
                singleSelection: true,
                handler: (orders: PrivateOrderWithTickets[]) => {
                    this.openOrder(orders[0])
                }
            }),

            ...builder.getActions()
        ]
    }

    allColumns = ((): Column<PrivateOrderWithTickets, any>[] => {
        const cols: Column<PrivateOrderWithTickets, any>[] = [
            new Column<PrivateOrder, number>({
                name: "#", 
                getValue: (order) => order.number ?? 0, 
                compare: (a, b) => Sorter.byNumberValue(b, a),
                minimumWidth: 50,
                recommendedWidth: 50,
                getStyleForObject: (order, isPrefix) => {
                    if (!isPrefix) {
                        return ""
                    }
                    return OrderStatusHelper.getColor(order.status)
                },
                index: 0
            }),

            new Column<PrivateOrder, OrderStatus>({
                name: "Status", 
                getValue: (order) => order.status,
                format: (status) => OrderStatusHelper.getName(status),
                compare: (a, b) => Sorter.byEnumValue(a, b, OrderStatus), 
                getStyle: (status) => {
                    return OrderStatusHelper.getColor(status)
                }, // todo: based on status
                minimumWidth: 100,
                recommendedWidth: 120,
                index: (this as any).$isMobile ? 1 : 0
            }),

            new Column<PrivateOrder, string>({
                name: "Naam", 
                getValue: (order) => order.data.customer.name, 
                compare: (a, b) => Sorter.byStringValue(a, b),
                minimumWidth: 100,
                recommendedWidth: 400,
                grow: true,
                index: (this as any).$isMobile ? 0 : 1
            }),

            new Column<PrivateOrder, string>({
                name: "E-mailadres", 
                getValue: (order) => order.data.customer.email, 
                compare: (a, b) => Sorter.byStringValue(a, b),
                minimumWidth: 100,
                recommendedWidth: 500,
                grow: false,
                enabled: false,
                index: (this as any).$isMobile ? 0 : 1
            }),
        ]

        if (this.preview.meta.phoneEnabled) {
            cols.push(
                new Column<PrivateOrder, string>({
                    name: "Telefoonnummer", 
                    getValue: (order) => order.data.customer.phone, 
                    compare: (a, b) => Sorter.byStringValue(a, b),
                    minimumWidth: 100,
                    recommendedWidth: 500,
                    grow: false,
                    enabled: false,
                    index: (this as any).$isMobile ? 0 : 1
                })
            )
        }

        if (this.preview.meta.paymentMethods.length > 1){
            cols.push(new Column<PrivateOrder, string[]>({
                name: "Betaalmethode", 
                getValue: (order) => {
                    return Formatter.uniqueArray(order.balanceItems.flatMap(b => b.payments.map(p => p.payment.method))).map(m => PaymentMethodHelper.getNameCapitalized(m, order.data.checkoutMethod?.type ?? null)).sort()
                }, 
                format: (methods) => {
                    if (methods.length === 0) {
                        return "Geen"
                    }

                    return methods.join(', ')
                },
                compare: (a, b) => Sorter.byStringValue(a.join(','), b.join(',')),
                getStyle: (methods) => methods.length === 0 ? "gray" : "",
                minimumWidth: 100,
                recommendedWidth: 120,
                enabled: false
            }))
        }

        if (this.preview.meta.checkoutMethods.length > 1){
            cols.push(new Column<PrivateOrder, CheckoutMethod | null>({
                name: "Methode", 
                getValue: (order) => order.data.checkoutMethod, 
                format: (method: CheckoutMethod | null) => {
                    if (method === null) {
                        return "Geen"
                    }
                    return method.typeName
                },
                compare: (a, b) => Sorter.byStringValue(a?.id ?? "", b?.id ?? ""),
                getStyle: (method) => method === null ? "gray" : "",
                minimumWidth: 100,
                recommendedWidth: 200,
                index: 1
            }))
        }

        const hasDelivery = this.preview.meta.checkoutMethods.some(method => method.type === CheckoutMethodType.Delivery)
        
        // Count checkoutm ethods that are not delivery
        const nonDeliveryCount = this.preview.meta.checkoutMethods.filter(method => method.type !== CheckoutMethodType.Delivery).length

        if (hasDelivery || nonDeliveryCount > 1) {
            cols.push(new Column<PrivateOrder, string | undefined>({
                name: hasDelivery && nonDeliveryCount == 0 ? "Adres" : "Locatie", 
                enabled: true,
                getValue: (order) => {
                    if (order.data.checkoutMethod?.type === CheckoutMethodType.Takeout) {
                        return order.data.checkoutMethod.name
                    }

                    if (order.data.checkoutMethod?.type === CheckoutMethodType.OnSite) {
                        return order.data.checkoutMethod.name
                    }

                    return order.data.address?.shortString() ?? "Onbekend"
                }, 
                compare: (a, b) => Sorter.byStringValue(a ?? "", b ?? ""),
                getStyle: (loc) => loc === undefined ? "gray" : "",
                minimumWidth: 100,
                recommendedWidth: 250,
                index: 1
            }))
        }

        const timeCount = Formatter.uniqueArray(this.preview.meta.checkoutMethods.flatMap(method => method.timeSlots.timeSlots).map(t => t.timeRangeString())).length
        const dateCount = Formatter.uniqueArray(this.preview.meta.checkoutMethods.flatMap(method => method.timeSlots.timeSlots).map(t => t.dateString())).length

        if (dateCount > 1) {
            cols.push(
                new Column<PrivateOrder, WebshopTimeSlot | undefined>({
                    name: (hasDelivery && nonDeliveryCount > 0) ? "Afhaal/leverdatum" : (hasDelivery ? "Leverdatum" : "Afhaaldatum"), 
                    getValue: (order) => order.data.timeSlot ? order.data.timeSlot : undefined,
                    compare: (a, b) => !a && !b ? 0 : (a && b ? WebshopTimeSlot.sort(a, b) : (a ? 1 : -1)),
                    format: (timeSlot, width: number) => {
                        if (!timeSlot) {
                            return "Geen"
                        }
                        if (width < 120) {
                            return Formatter.dateNumber(timeSlot.date, false)
                        }

                        if (width < 200) {
                            return Formatter.capitalizeFirstLetter(timeSlot.dateStringShort())
                        }
                        return Formatter.capitalizeFirstLetter(timeSlot.dateString())
                    },
                    getStyle: (loc) => loc === undefined ? "gray" : "",
                    minimumWidth: 60,
                    recommendedWidth: 70,
                    index: 1
                }),
            )
        }
        
        if (timeCount > 1) {
            cols.push(
                new Column<PrivateOrder, WebshopTimeSlot | undefined>({
                    name: "Tijdstip", 
                    getValue: (order) => order.data.timeSlot ? order.data.timeSlot : undefined,
                    compare: (a, b) => !a && !b ? 0 : (a && b ? a.startTime - b.startTime : (a ? 1 : -1)),
                    format: (timeSlot, width) => {
                        if (!timeSlot) {
                            return "Geen"
                        }
                        const time = timeSlot.timeRangeString()

                        if (width < 120) {
                            return time.replaceAll(" - ", "-").replaceAll(/:00/g, "u").replaceAll(/:(\n{2})/g, "u$1")
                        }

                        return time
                    },
                    getStyle: (loc) => loc === undefined ? "gray" : "",
                    minimumWidth: 80,
                    recommendedWidth: 105,
                    index: 1
                })
            )
        }

        cols.push(
            new Column<PrivateOrder, Date>({
                name: "Besteldatum", 
                getValue: (order) => order.validAt ?? new Date(1990, 0, 1),
                compare: (a, b) => Sorter.byDateValue(a, b),
                format: (date, width: number) => {
                    if (width < 120) {
                        return Formatter.dateNumber(date, false)
                    }

                    if (width < 200) {
                        return Formatter.capitalizeFirstLetter(Formatter.date(date))
                    }
                    return Formatter.capitalizeFirstLetter(Formatter.dateWithDay(date))
                },
                getStyle: (loc) => loc === undefined ? "gray" : "",
                minimumWidth: 60,
                recommendedWidth: 70,
                index: 1,
                enabled: false
            }),
        )

        cols.push(
            new Column<PrivateOrder, number>({
                name: "Bedrag", 
                enabled: false,
                getValue: (order) => order.data.totalPrice,
                format: (price) => Formatter.price(price),
                compare: (a, b) => Sorter.byNumberValue(b ?? 0, a ?? 0),
                getStyle: (price) => price === undefined ? "gray" : (price === 0 ? "gray" : ""),
                minimumWidth: 70,
                recommendedWidth: 80,
                index: 1
            }),
        )

        cols.push(
            new Column<PrivateOrder, number>({
                name: "Te betalen", 
                enabled: this.preview.meta.paymentConfiguration.paymentMethods.includes(PaymentMethod.Transfer) || this.preview.meta.paymentConfiguration.paymentMethods.includes(PaymentMethod.PointOfSale), // keep it available because should be able to enable it when payment methods are changed
                getValue: (order) => order.totalToPay - order.pricePaid,
                format: (price) => price !== 0 ? Formatter.price(price) : "Betaald",
                compare: (a, b) => Sorter.byNumberValue(b ?? 0, a ?? 0),
                getStyle: (price) => (price === 0 ? "gray" : ""),
                minimumWidth: 70,
                recommendedWidth: 80,
                index: 1
            }),
        )

        if (this.hasTickets) {
            cols.push(
                new Column<PrivateOrderWithTickets, {scanned: number, total: number}>({
                    name: this.hasSingleTickets ? 'Ticket' : "Tickets", 
                    enabled: true,
                    getValue: (order) => {
                        return {
                            scanned: order.tickets.filter(t => !!t.scannedAt).length,
                            total: order.tickets.length
                        }
                    },
                    format: (stat) => {
                        if (stat.total === 0) {
                            return '-'
                        }

                        if (this.hasSingleTickets) {
                            return stat.scanned === stat.total ? "Gescand" : "Niet gescand"
                        }
                        return stat.scanned.toString() + " / " + stat.total
                    },
                    compare: (a, b) => Sorter.stack(Sorter.byNumberValue(b.scanned, a.scanned), Sorter.byNumberValue(b.total, a.total)),
                    getStyle: (stat) => {
                        if (stat.total === 0) {
                            return "gray"
                        }

                        if (stat.scanned === stat.total) {
                            return "info"
                        }
                        if (stat.scanned === 0) {
                            return "tag-gray"
                        }
                        return "warn"
                    },
                    minimumWidth: 100,
                    recommendedWidth: this.hasSingleTickets ? 150 : 100,
                    index: 1
                })
            )
        }

        if (!this.preview.meta.cartEnabled) {
            cols.push(
                new Column<PrivateOrderWithTickets, string>({
                    name: "Artikel", 
                    enabled: false,
                    grow: true,
                    getValue: (order) => {
                        if (order.data.cart.items.length > 1) {
                            return "Meerdere artikels"
                        }

                        const item = order.data.cart.items[0]
                        if (!item) {
                            return "";
                        }
                        return item.product.name
                    },
                    format: (stat) => {
                        if (!stat) {
                            return 'Geen'
                        }
                        return stat.toString()
                    },
                    compare: (a, b) => Sorter.byStringValue(b, a),
                    getStyle: (stat) => {
                        if (!stat || stat === "Meerdere artikels") {
                            return "gray"
                        }

                        return ""
                    },
                    minimumWidth: 150,
                    recommendedWidth: 200,
                    index: 1
                })
            )

            cols.push(
                new Column<PrivateOrderWithTickets, string>({
                    name: "Beschrijving", 
                    enabled: false,
                    grow: true,
                    getValue: (order) => {
                        if (order.data.cart.items.length > 1) {
                            return "Meerdere artikels"
                        }

                        const item = order.data.cart.items[0]
                        if (!item) {
                            return "";
                        }
                        return item.description.replaceAll("\n", " - ")
                    },
                    format: (stat) => {
                        if (!stat) {
                            return 'Geen'
                        }
                        return stat.toString()
                    },
                    compare: (a, b) => Sorter.byStringValue(b, a),
                    getStyle: (stat) => {
                        if (!stat || stat === "Meerdere artikels") {
                            return "gray"
                        }

                        return ""
                    },
                    minimumWidth: 150,
                    recommendedWidth: 200,
                    index: 1
                })
            )
        }

        // Show counts
        cols.push(
            new Column<PrivateOrderWithTickets, number>({
                name: "Aantal", 
                enabled: false,
                getValue: (order) => {
                    return order.data.cart.items.reduce((acc, item) => {
                        return acc + item.amount
                    }, 0)
                },
                format: (stat) => {
                    if (!stat) {
                        return 'Geen'
                    }
                    return stat.toString()
                },
                compare: (a, b) => Sorter.byNumberValue(b, a),
                getStyle: (stat) => {
                    if (stat === 0) {
                        return "gray"
                    }

                    return ""
                },
                minimumWidth: 100,
                recommendedWidth: this.hasSingleTickets ? 150 : 100,
                index: 1
            })
        )
      
        // Custom questions
        for (const category of this.preview.meta.recordCategories) {
            for (const record of category.getAllRecords()) {
                cols.push(new Column<PrivateOrder, string | undefined>({
                    name: record.name, 
                    enabled: false,
                    getValue: (order) => {
                        const answer = order.data.recordAnswers.find(a => a.settings.id === record.id)
                        if (!answer) {
                            return undefined
                        }
                        return answer.stringValue
                    },
                    format: (v) => v ? v : "Leeg",
                    compare: (a, b) => Sorter.byStringValue(b ?? '', a ?? ''),
                    getStyle: (price) => price === undefined ? "gray" : '',
                    minimumWidth: 70,
                    recommendedWidth: 150,
                }));
            }
        }
        return cols
    })()

    get prefixColumn() {
        // Needs to stay the same reference to enable disable/enable functionality
        return this.allColumns[0]
    }

    /**
     * Insert or update an order
     */
    putOrder(order: PrivateOrder) {
        for (const _order of this.orders) {
            if (order.id === _order.id) {
                // replace data without affecting reference or tickets
                _order.deepSet(order)
                return
            }
        }
        this.orders.push(PrivateOrderWithTickets.create(order))
    }

    async onNewOrders(orders: PrivateOrder[]) {
        console.log("Received new orders from network")
        // Search for the orders and replace / add them
        for (const order of orders) {
            this.putOrder(order)
        }

        return Promise.resolve()
    }

    async onNewTickets(tickets: TicketPrivate[]) {
        console.log("Received new tickets from network")
        
        for (const order of this.orders) {
            order.addTickets(tickets)
        }

        return Promise.resolve()
    }

    onNewTicketPatches(patches: AutoEncoderPatchType<TicketPrivate>[]) {
        console.log("Received new tickets from network")
        PrivateOrderWithTickets.addTicketPatches(this.orders, patches);
        return Promise.resolve()
    }

    created() {
        this.webshopManager.ordersEventBus.addListener(this, "fetched", this.onNewOrders.bind(this))
        this.webshopManager.ordersEventBus.addListener(this, "deleted", this.onDeleteOrders.bind(this))

        this.webshopManager.ticketsEventBus.addListener(this, "fetched", this.onNewTickets.bind(this))
        this.webshopManager.ticketPatchesEventBus.addListener(this, "patched", this.onNewTicketPatches.bind(this))

        this.reload();
        this.loadOrders().catch(console.error);

        // Listen for patches in payments
        GlobalEventBus.addListener(this, "paymentPatch", async (payment: PaymentGeneral) => {
            if (payment && payment.id && payment.orders.find(o => o.webshopId === this.webshopManager.preview.id)) {
                await this.webshopManager.fetchNewTickets(false, false);
            }
            return Promise.resolve()
        })
    }

    mounted() {
        // Set url
        UrlHelper.setUrl("/webshops/" + Formatter.slug(this.preview.meta.name)+"/orders")
        document.title = this.preview.meta.name+" - Bestellingen"
    }

    get hasWrite() {
        const p = this.$context.organizationPermissions
        if (!p) {
            return false
        }
        return this.preview.privateMeta.permissions.hasWriteAccess(p)    
    }

    beforeUnmount() {
        this.webshopManager.ordersEventBus.removeListener(this)
        this.webshopManager.ticketsEventBus.removeListener(this)
        this.webshopManager.ticketPatchesEventBus.removeListener(this)
        Request.cancelAll(this)
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

    get hasSingleTickets() {
        return this.preview.hasSingleTickets
    }

    get hasTickets() {
        return this.preview.hasTickets
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
                    ticket.deepSet(ticket.patch(patch))
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
        await this.refreshTickets();

        this.isLoadingOrders = false
        this.isRefreshingOrders = false
    }

    async refreshTickets() {
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
    }

    get webshopUrl() {
        return this.preview.getUrl(this.$organization)
    }

    get hasFullPermissions() {
        return this.preview.privateMeta.permissions.hasFullAccess(this.$context.organizationPermissions)
    }

    reload() {
        this.loading = true;

        this.webshopManager.loadWebshopIfNeeded().catch((e) => {
            console.error(e)
            Toast.fromError(e).show()
        }).finally(() => {
            this.loading = false
        })
    }

    get deliveryCities(): [string, string][] {
        const cities = new Map<string, string>()
        for (const order of this.orders) {
            if (order.data.checkoutMethod &&  order.data.checkoutMethod.type == CheckoutMethodType.Delivery && order.data.address) {
                cities.set(Formatter.slug(order.data.address.postalCode+" "+order.data.address.city), order.data.address.postalCode+" "+order.data.address.city)
            }
        }

        return [...cities.entries()].sort((a, b) => Sorter.byStringValue(a[0], b[0]))
    }

    get filterDefinitions(): FilterDefinition<PrivateOrder, Filter<PrivateOrder>, any>[] {
        return []
    }

    get title() {
        return "Bestellingen"
    }

    openOrder(order: PrivateOrderWithTickets) {
        const table = this.$refs.table as TableView<PrivateOrderWithTickets> | undefined
        const component = new ComponentWithProperties(NavigationController, { 
            root: new ComponentWithProperties(OrderView, { 
                initialOrder: order,
                webshopManager: this.webshopManager,
                getNextOrder: table?.getNext,
                getPreviousOrder: table?.getPrevious,
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
