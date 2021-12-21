<template>
    <TableView ref="table" :title="title" :column-configuration-id="'orders-'+preview.id" :actions="actions" :all-values="orders" :estimated-rows="estimatedRows" :all-columns="allColumns" :filter-definitions="filterDefinitions" @click="openOrder">
        <template #empty>
            Er zijn nog geen bestellingen.
        </template>
    </TableView>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Column, TableAction, TableView, Toast } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from "@stamhoofd/networking";
import { CheckoutMethodType, ChoicesFilterChoice, ChoicesFilterDefinition, ChoicesFilterMode, DateFilterDefinition, Filter, FilterDefinition, getPermissionLevelNumber, NumberFilterDefinition, OrderStatus, OrderStatusHelper, PaymentMethod, PaymentMethodHelper, PaymentStatus, PermissionLevel, PrivateOrder, WebshopOrdersQuery, WebshopTicketType } from '@stamhoofd/structures';
import { WebshopTimeSlot } from "@stamhoofd/structures/esm/dist";
import { Formatter, Sorter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../../classes/OrganizationManager';
import { WebshopManager } from '../WebshopManager';
import OrderView from './OrderView.vue';
import { WebshopOrdersEventBus } from "./WebshopOrdersEventBus";

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

    loading = false;
    orders: PrivateOrder[] = []
    nextQuery: WebshopOrdersQuery | null = WebshopOrdersQuery.create({})


    get estimatedRows() {
        if (!this.loading) {
            return 0
        }

        if (this.orders.length > 0) {
            return this.orders.length
        }
       
        // todo
        return 30
    }

    get actions(): TableAction<PrivateOrder>[] {
        return [
            new TableAction({
                name: "Openen",
                icon: "eye",
                priority: 0,
                groupIndex: 1,
                needsSelection: true,
                singleSelection: true,
                handler: (orders: PrivateOrder[]) => {
                    this.openOrder(orders[0])
                }
            })
        ]
    }

    allColumns = ((): Column<PrivateOrder, any>[] => {
        const cols: Column<PrivateOrder, any>[] = [
            new Column<PrivateOrder, number>({
                name: "#", 
                getValue: (order) => order.number ?? 0, 
                compare: (a, b) => Sorter.byNumberValue(b, a),
                minimumWidth: 50,
                recommendedWidth: 50
            }),

            new Column<PrivateOrder, string>({
                name: "Naam", 
                getValue: (order) => order.data.customer.name, 
                compare: (a, b) => Sorter.byStringValue(a, b),
                minimumWidth: 100,
                recommendedWidth: 400
            }),

            new Column<PrivateOrder, string | undefined>({
                name: "Locatie", 
                getValue: (order) => order.data.checkoutMethod?.name, 
                compare: (a, b) => Sorter.byStringValue(a ?? "", b ?? ""),
                getStyle: (loc) => loc === undefined ? "gray" : "",
                minimumWidth: 100,
                recommendedWidth: 200
            }),

            new Column<PrivateOrder, string | undefined>({
                name: "Adres", 
                enabled: false,
                getValue: (order) => order.data.address?.toString(), 
                compare: (a, b) => Sorter.byStringValue(a ?? "", b ?? ""),
                getStyle: (loc) => loc === undefined ? "gray" : "",
                minimumWidth: 100,
                recommendedWidth: 250
            }),

            new Column<PrivateOrder, WebshopTimeSlot | undefined>({
                name: "Datum", 
                enabled: false,
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
                minimumWidth: 50,
                recommendedWidth: 65
            }),

            new Column<PrivateOrder, WebshopTimeSlot | undefined>({
                name: "Tijdstip", 
                enabled: false,
                getValue: (order) => order.data.timeSlot ? order.data.timeSlot : undefined,
                compare: (a, b) => !a && !b ? 0 : (a && b ? WebshopTimeSlot.sort(a, b) : (a ? 1 : -1)),
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
                recommendedWidth: 105
            }),

            new Column<PrivateOrder, string>({
                name: "Status", 
                getValue: (order) => OrderStatusHelper.getName(order.status),
                compare: (a, b) => Sorter.byStringValue(a ?? "", b ?? ""), // todo: based on index
                getStyleForObject: (order) => "", // todo: based on status
                minimumWidth: 100,
                recommendedWidth: 200
            }),

            new Column<PrivateOrder, number | undefined>({
                name: "Te betalen", 
                enabled: false,
                getValue: (order) => order.payment && order.payment.status !== PaymentStatus.Succeeded ? order.payment.price : undefined,
                format: (price) => price ? Formatter.price(price) : "Betaald",
                compare: (a, b) => Sorter.byNumberValue(a ?? 0, b ?? 0),
                getStyle: (price) => price === undefined ? "gray" : "",
                minimumWidth: 100,
                recommendedWidth: 150
            }),
        ]
        return cols
    })()

    /**
     * Insert or update an order
     */
    putOrder(order: PrivateOrder) {
        for (const [index, _order] of this.orders.entries()) {
            if (order.id === _order.id) {
                // replace
                this.orders.splice(index, 1, order)
                return
            }
        }
        this.orders.push(order)
    }

    onNewOrders(orders: PrivateOrder[]) {
        console.log("Received new orders from network")
        // Search for the orders and replace / add them
        for (const order of orders) {
            this.putOrder(order)
        }
    }

    created() {
        this.webshopManager.ordersEventBus.addListener(this, "fetched", this.onNewOrders.bind(this))
        this.reload();
        this.loadOrders().catch(console.error)
    }

    mounted() {
        // Set url
        UrlHelper.setUrl("/webshops/" + Formatter.slug(this.preview.meta.name)+"/orders")
        document.title = this.preview.meta.name+" - Bestellingen"
    }

    activated() {
        WebshopOrdersEventBus.addListener(this, "deleted", this.onDeleteOrder)
    }

    get hasWrite() {
        const p = SessionManager.currentSession?.user?.permissions
        if (!p) {
            return false
        }
        return getPermissionLevelNumber(this.preview.privateMeta.permissions.getPermissionLevel(p)) >= getPermissionLevelNumber(PermissionLevel.Write)
    }

    deactivated() {
        WebshopOrdersEventBus.removeListener(this)
    }

    onDeleteOrder(): Promise<void> {
        // todo: needs an update
        this.nextQuery = WebshopOrdersQuery.create({})
        this.orders = []
        this.loadOrders().catch(console.error)
        return Promise.resolve()
    }

    get hasTickets() {
        return this.preview.meta.ticketType === WebshopTicketType.SingleTicket || this.preview.meta.ticketType === WebshopTicketType.Tickets
    }

    isLoadingOrders = true
    isRefreshingOrders = false

    async loadOrders() {
        console.log("Loading orders...")
        this.orders = []
        this.isLoadingOrders = true
        
        // Disabled for now: first fix needed for payment status + deleted orders
        try {
            this.orders = await this.webshopManager.getOrdersFromDatabase()
        } catch (e) {
            // Database error. We can ignore this and simply move on.
            console.error(e)
        }

        await this.refresh(true) 
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

        this.isLoadingOrders = false

        // And preload the tickets if needed
        if (this.hasTickets) {
            try {
                await this.webshopManager.fetchNewTickets(false, false).catch(console.error)
            } catch (e) {
                // Fetching failed
                Toast.fromError(e).show()
            }
        }

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
                // todo: also add checkout methods that are not valid anymore from existing orders
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
            choices: Object.values(OrderStatus).map(status => {
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

        if (this.webshop?.meta.paymentMethods.includes(PaymentMethod.Bancontact) || this.webshop?.meta.paymentMethods.includes(PaymentMethod.iDEAL) || this.webshop?.meta.paymentMethods.includes(PaymentMethod.CreditCard)) {
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

        // todo: products
        definitions.push(
            new ChoicesFilterDefinition<PrivateOrder>({
                id: "order_products",
                name: "Bestelde artikels",
                choices: (this.webshop?.products ?? []).map(product => {
                    return new ChoicesFilterChoice(product.id, product.name)
                }),
                defaultMode: ChoicesFilterMode.Or,
                getValue: (order) => {
                    return order.data.cart.items.flatMap(i => i.product.id)
                }
            })
        )


        return definitions
    }

    get title() {
        return this.preview.meta.name
    }

    openOrder(order: PrivateOrder) {
        const table = this.$refs.table as TableView<PrivateOrder> | undefined
        this.present(new ComponentWithProperties(NavigationController, { 
            root: new ComponentWithProperties(OrderView, { 
                initialOrder: order,
                webshopManager: this.webshopManager,
                getNextOrder: table?.getNext,
                getPreviousOrder: table?.getPrevious,
            })
        }).setDisplayStyle("popup"))
    }

    /*openMail(subject = "Bestelling {{nr}}") {
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MailView, {
                orders: this.getSelectedOrders(),
                webshop: this.webshop,
                defaultSubject: subject
            })
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }*/

    /*markAs(event) {
        if (this.selectionCount == 0) {
            return;
        }

        const el = event.currentTarget;
        const displayedComponent = new ComponentWithProperties(OrderStatusContextMenu, {
            x: el.getBoundingClientRect().left + el.offsetWidth,
            y: el.getBoundingClientRect().top,
            xPlacement: "left",
            yPlacement: "top",
            orders: this.getSelectedOrders(),
            webshopManager: this.webshopManager
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }*/
}
</script>