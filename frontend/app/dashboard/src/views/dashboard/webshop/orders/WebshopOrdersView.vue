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
import { Column, TableAction, TableView, Toast } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from "@stamhoofd/networking";
import { CheckoutMethod, CheckoutMethodType, ChoicesFilterChoice, ChoicesFilterDefinition, ChoicesFilterMode, DateFilterDefinition, Filter, FilterDefinition, getPermissionLevelNumber, NumberFilterDefinition, OrderStatus, OrderStatusHelper, PaymentMethod, PaymentMethodHelper, PaymentStatus, PermissionLevel, PrivateOrder, PrivateOrderWithTickets, TicketPrivate, WebshopOrdersQuery, WebshopTicketType } from '@stamhoofd/structures';
import { WebshopTimeSlot } from "@stamhoofd/structures/esm/dist";
import { Formatter, Sorter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../../classes/OrganizationManager';
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
        return OrganizationManager.organization
    }

    loading = false;
    orders: PrivateOrderWithTickets[] = []
    nextQuery: WebshopOrdersQuery | null = WebshopOrdersQuery.create({})

    get estimatedRows() {
        if (this.isLoadingOrders) {
            return this.orders.length == 0 ? 30 : this.orders.length
        }
       
        return 0
    }

    get actions(): TableAction<PrivateOrderWithTickets>[] {
        const builder = new OrderActionBuilder({
            webshopManager: this.webshopManager,
            component: this
        })
        return [
            new TableAction({
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
        ]

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
            new Column<PrivateOrder, number | undefined>({
                name: "Bedrag", 
                enabled: false,
                getValue: (order) => order.payment?.price,
                format: (price) => price ? Formatter.price(price) : "Onbekend",
                compare: (a, b) => Sorter.byNumberValue(b ?? 0, a ?? 0),
                getStyle: (price) => price === undefined ? "gray" : (price === 0 ? "gray" : ""),
                minimumWidth: 70,
                recommendedWidth: 80,
                align: "right",
                index: 1
            }),
        )

        cols.push(
            new Column<PrivateOrder, number | undefined>({
                name: "Te betalen", 
                enabled: this.preview.meta.paymentMethods.includes(PaymentMethod.Transfer), // keep it available because should be able to enable it when payment methods are changed
                getValue: (order) => order.payment && order.payment.status !== PaymentStatus.Succeeded ? order.payment.price : (order.payment && order.payment.price < order.data.totalPrice ? order.data.totalPrice - order.payment.price : undefined),
                format: (price) => price ? Formatter.price(price) : "Betaald",
                compare: (a, b) => Sorter.byNumberValue(b ?? 0, a ?? 0),
                getStyle: (price) => price === undefined ? "gray" : (price === 0 ? "gray" : ""),
                minimumWidth: 70,
                recommendedWidth: 80,
                align: "right",
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
                        if (this.hasSingleTickets) {
                            if (stat.total === 0) {
                                return '—'
                            }
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
                _order.set(order)
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

        console.log(this.orders)
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
        UrlHelper.setUrl("/webshops/" + Formatter.slug(this.preview.meta.name)+"/orders")
        document.title = this.preview.meta.name+" - Bestellingen"
    }

    get hasWrite() {
        const p = SessionManager.currentSession?.user?.permissions
        if (!p) {
            return false
        }
        return getPermissionLevelNumber(this.preview.privateMeta.permissions.getPermissionLevel(p)) >= getPermissionLevelNumber(PermissionLevel.Write)
    }

    beforeDestroy() {
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
            this.webshopManager.trySavePatches().catch(console.error)
        }

        this.isLoadingOrders = false
        this.isRefreshingOrders = false
    }

    get webshopUrl() {
        return this.preview.getUrl(OrganizationManager.organization)
    }

    formatDateTime(date: Date) {
        console.log(date)
        return Formatter.dateTime(date)
    }

    get hasFullPermissions() {
        if (!OrganizationManager.user.permissions) {
            return false
        }
        return this.preview.privateMeta.permissions.getPermissionLevel(OrganizationManager.user.permissions) === PermissionLevel.Full
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
        const checkoutMethod = new ChoicesFilterDefinition<PrivateOrder>({
            id: "order_checkoutMethod",
            name: "Afhaal/leveringsmethode",
            choices: (this.webshop?.meta.checkoutMethods ?? []).flatMap(method => {
                // TODO: also add checkout methods that are not valid anymore from existing orders
                const choices: ChoicesFilterChoice[] = []

                if (method.timeSlots.timeSlots.length == 0) {
                    choices.push(
                        new ChoicesFilterChoice(method.id, method.type+": "+method.name)
                    )
                }
                
                for (const time of method.timeSlots.timeSlots) {
                    choices.push(
                        new ChoicesFilterChoice(method.id+"-"+time.id, method.type+": "+method.name, time.toString())
                    )
                }
                return choices
            }),
            defaultMode: ChoicesFilterMode.Or,
            getValue: (order) => {
                const ids: string[] = []
                if (order.data.checkoutMethod) {
                    ids.push(order.data.checkoutMethod.id)
                    
                    if (order.data.timeSlot) {
                        ids.push(order.data.checkoutMethod.id+"-"+order.data.timeSlot.id)
                    }
                }
                return ids
            }
        })

        const paymentMethod = new ChoicesFilterDefinition<PrivateOrder>({
            id: "order_paymentMethod",
            name: "Betaalmethode",
            choices: [PaymentMethod.Transfer, PaymentMethod.Payconiq, PaymentMethod.Bancontact, PaymentMethod.iDEAL, PaymentMethod.CreditCard, PaymentMethod.Unknown].map(method => {
                return new ChoicesFilterChoice(method, Formatter.capitalizeFirstLetter(PaymentMethodHelper.getName(method)))
            }),
            defaultMode: ChoicesFilterMode.Or,
            getValue: (order) => {
                return [order.data.paymentMethod]
            }
        })

        const paidStatus = new ChoicesFilterDefinition<PrivateOrder>({
            id: "order_paid",
            name: "Betaalstatus",
            choices: [
                new ChoicesFilterChoice("paid", "Betaald"),
                new ChoicesFilterChoice("not_paid", "Niet betaald")
            ],
            defaultMode: ChoicesFilterMode.Or,
            getValue: (order) => {
                return [order.payment?.status == PaymentStatus.Succeeded ? "paid" : "not_paid"]
            }
        })

        const orderStatus = new ChoicesFilterDefinition<PrivateOrder>({
            id: "order_status",
            name: "Bestelstatus",
            choices: Object.values(OrderStatus).filter(s => s !== OrderStatus.Deleted).map(status => {
                return new ChoicesFilterChoice(status, OrderStatusHelper.getName(status))
            }),
            defaultMode: ChoicesFilterMode.Or,
            getValue: (order) => {
                return [order.status]
            }
        })

        const orderNumber = new NumberFilterDefinition<PrivateOrder>({
            id: "order_number",
            name: "Bestelnummer",
            getValue: (order) => {
                return order.number ?? 0
            }
        })

        const definitions: FilterDefinition<PrivateOrder, Filter<PrivateOrder>, any>[] = [orderStatus, checkoutMethod, paymentMethod, paidStatus, orderNumber]

        if (this.webshop?.meta.checkoutMethods.find(c => c.type === CheckoutMethodType.Delivery)) {
            definitions.push(new ChoicesFilterDefinition<PrivateOrder>({
                id: "order_deliveryCity",
                name: "Leveringsgemeente",
                choices: this.deliveryCities.map(([id, city]) => {
                    return new ChoicesFilterChoice(id, city)
                }),
                defaultMode: ChoicesFilterMode.Or,
                getValue: (order) => {
                    const ids: string[] = []
                    if (order.data.checkoutMethod && order.data.checkoutMethod.type === CheckoutMethodType.Delivery && order.data.address) {
                        ids.push(Formatter.slug(order.data.address.postalCode+" "+order.data.address.city))
                    }
                    return ids
                }
            }))
        }

        definitions.push(new NumberFilterDefinition<PrivateOrder>({
            id: "order_price",
            name: "Bestelbedrag",
            currency: true,
            floatingPoint: true,
            getValue: (order) => {
                return order.data.totalPrice
            }
        }))

        definitions.push(
            new DateFilterDefinition<PrivateOrder>({
                id: "order_createdAt",
                name: "Besteldatum",
                time: false,
                getValue: (order) => {
                    return order.validAt ?? new Date(1900, 0, 1)
                }
            })
        )

        if (this.webshop?.meta.paymentMethods.includes(PaymentMethod.Transfer)) {
            definitions.push(new DateFilterDefinition<PrivateOrder>({
                id: "order_paidAt",
                name: "Betaaldatum",
                time: false,
                getValue: (order) => {
                    return order.payment?.paidAt ?? new Date(1900, 0, 1)
                }
            }))
        }

        if (this.organization.privateMeta?.mollieOnboarding?.canReceivePayments && (this.webshop?.meta.paymentMethods.includes(PaymentMethod.Bancontact) || this.webshop?.meta.paymentMethods.includes(PaymentMethod.iDEAL) || this.webshop?.meta.paymentMethods.includes(PaymentMethod.CreditCard))) {
            definitions.push(
                new DateFilterDefinition<PrivateOrder>({
                    id: "order_settledAt",
                    name: "Uitbetalingsdatum Mollie",
                    description: "Voor betaalmethodes Bancontact en iDEAL",
                    time: false,
                    getValue: (order) => {
                        return order.payment?.settlement?.settledAt ?? new Date(1900, 0, 1)
                    }
                })
            )
        }

        definitions.push(
            new ChoicesFilterDefinition<PrivateOrder>({
                id: "order_products",
                name: "Bestelde artikels",
                choices: (this.webshop?.products ?? []).map(product => {
                    return new ChoicesFilterChoice(product.id, product.name+(product.dateRange ? " ("+product.dateRange.toString()+")" : ""))
                }),
                defaultMode: ChoicesFilterMode.Or,
                getValue: (order) => {
                    return order.data.cart.items.flatMap(i => i.product.id)
                }
            })
        )

        if (this.hasTickets) {
            definitions.push(
                new ChoicesFilterDefinition<PrivateOrderWithTickets>({
                    id: "order_ticket_scanned",
                    name: "Ticket scanstatus",
                    choices: this.hasSingleTickets ? [
                        new ChoicesFilterChoice('none', 'Niet gescand'),
                        new ChoicesFilterChoice('all', 'Gescand'),
                    ] : [
                        new ChoicesFilterChoice('none', 'Geen enkel ticket gescand'),
                        new ChoicesFilterChoice('partial', 'Gedeeltelijk gescand'),
                        new ChoicesFilterChoice('all', 'Alle tickets gescand'),
                    ],
                    defaultMode: ChoicesFilterMode.Or,
                    getValue: (order) => {
                        const scanned = order.tickets.filter(t => t.scannedAt).length
                        const total = order.tickets.length

                        if (scanned === 0) {
                            return ['none']
                        }

                        if (scanned === total) {
                            return ['all']
                        }

                        return ['partial']
                    }
                })
            )

            definitions.push(
                new DateFilterDefinition<PrivateOrderWithTickets>({
                    id: "order_ticket_scanned_at",
                    name: "Ticket scan tijdstip",
                    getValue: (order) => {
                        return order.tickets.reduce((acc, ticket) => {
                            if (ticket.scannedAt && ticket.scannedAt < acc) {
                                return ticket.scannedAt
                            }

                            return acc
                        }, new Date(2222, 0, 1))
                    }
                })
            )

            if (!this.hasSingleTickets) {
                definitions.push(
                    new NumberFilterDefinition<PrivateOrderWithTickets>({
                        id: "order_ticket_count",
                        name: "Aantal aangemaakte tickets",
                        description: "Tickets worden pas aangemaakt als de bestelling werd betaald.",
                        currency: false,
                        floatingPoint: false,
                        getValue: (order) => {
                            return order.tickets.length
                        }
                    })
                )
            }
        }


        return definitions
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