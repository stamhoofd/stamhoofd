<template>
    <div class="st-view webshop-view background">
        <STNavigationBar :sticky="false">
            <BackButton v-if="canPop" slot="left" @click="pop" />
        </STNavigationBar>
    
        <main>
            <h1 class="data-table-prefix">
                <span class="icon-spacer">{{ title }}</span>
                <span v-if="!loading && !isLoadingOrders" class="style-tag">{{ orders.length }}</span>
            </h1>

            <div class="input-with-buttons data-table-prefix title-description">
                <div>
                    <input v-model="searchQuery" class="input search" placeholder="Zoeken" @input="searchQuery = $event.target.value">
                </div>
                <div>
                    <button class="button text" @click="editFilter">
                        <span class="icon filter" />
                        <span class="hide-small">Filter</span>
                        <span v-if="filteredCount > 0" class="bubble">{{ filteredCount }}</span>
                    </button>
                </div>
            </div>

            <Spinner v-if="loading && !isRefreshingOrders" class="center" />
            <p v-if="!isLoadingOrders && orders.length == 0" class="info-box">
                Je hebt nog geen bestellingen ontvangen
            </p>

            <table v-else-if="!isLoadingOrders" class="data-table">
                <thead>
                    <tr>
                        <th>
                            <Checkbox
                                v-model="selectAll"
                            />
                        </th>
                        <th class="hide-smartphone tiny" @click="toggleSort('number')">
                            Nummer
                            <span
                                class="sort-arrow"
                                :class="{
                                    up: sortBy == 'number' && sortDirection == 'ASC',
                                    down: sortBy == 'number' && sortDirection == 'DESC',
                                }"
                            />
                        </th>
                        <th @click="toggleSort('name')">
                            Bestelling
                            <span
                                class="sort-arrow"
                                :class="{
                                    up: sortBy == 'name' && sortDirection == 'ASC',
                                    down: sortBy == 'name' && sortDirection == 'DESC',
                                }"
                            />
                        </th>
                        <th class="hide-smartphone" @click="toggleSort('checkout')">
                            Info
                            <span
                                class="sort-arrow"
                                :class="{
                                    up: sortBy == 'checkout' && sortDirection == 'ASC',
                                    down: sortBy == 'checkout' && sortDirection == 'DESC',
                                }"
                            />
                        </th>
                        <th @click="toggleSort('status')">
                            Status
                            <span v-if="sortBy == 'status'"
                                  class="sort-arrow"
                                  :class="{
                                      up: sortBy == 'status' && sortDirection == 'ASC',
                                      down: sortBy == 'status' && sortDirection == 'DESC',
                                  }"
                            />
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="order in sortedOrders" :key="order.id" class="selectable" @click="openOrder(order)" @contextmenu.prevent="showOrderContextMenu($event, order.order)">
                        <td class="prefix" @click.stop="">
                            <Checkbox v-model="order.selected" />
                        </td>
                        <td class="hide-smartphone tiny">
                            #{{ order.order.number }}
                        </td>
                        <td>
                            <h2 class="style-title-list">
                                {{ order.order.data.customer.name }}
                            </h2>
                            <p class="only-smartphone style-description-small">
                                #{{ order.order.number }}
                            </p>
                        </td>
                        <td class="hide-smartphone member-description">
                            <h2 v-if="order.order.data.checkoutMethod" class="style-title-list">
                                {{ order.order.data.checkoutMethod.name }}
                            </h2>
                            <p v-if="order.order.data.timeSlot" class="style-description-small">
                                {{ order.order.data.timeSlot.date | date }} om {{ order.order.data.timeSlot.startTime | minutes }} - {{ order.order.data.timeSlot.endTime | minutes }}
                            </p>
                        </td>
                        <td>
                            <span v-if="order.order.payment && order.order.payment.status !== 'Succeeded'" class="style-tag warn">Niet betaald</span>
                            <span v-if="order.order.status == 'Prepared'" class="style-tag">Verwerkt</span>
                            <span v-if="order.order.status == 'Collect'" class="style-tag">Ligt klaar</span>
                            <span v-if="order.order.status == 'Completed'" v-tooltip="'Voltooid'" class="success icon green" />
                            <span v-if="order.order.status == 'Canceled'" v-tooltip="'Geannuleerd'" class="error icon canceled" />
                        </td>
                    </tr>
                </tbody>
            </table>

            <Spinner v-if="isRefreshingOrders" class="center" />

            <p v-if="totalFilteredCount == 1" class="info-box icon filter with-button">
                De filters verbergen één bestelling

                <button class="button text" @click="resetFilter">
                    Reset
                </button>
            </p>
            <p v-else-if="totalFilteredCount > 1" class="info-box icon filter with-button">
                De filters verbergen {{ totalFilteredCount }} bestellingen

                <button class="button text" @click="resetFilter">
                    Reset
                </button>
            </p>
        </main>

        <STToolbar :class="{'hide-smartphone': selectionCount == 0 }">
            <template #left>
                {{ selectionCount ? selectionCount : "Geen" }} {{ selectionCount == 1 ? "bestelling" : "bestellingen" }} geselecteerd
                <template v-if="selectionCountHidden">
                    (waarvan {{ selectionCountHidden }} verborgen)
                </template>
            </template>
            <template #right>
                <button v-if="hasWrite" class="button secundary" :disabled="selectionCount == 0 || isLoadingOrders" @click="markAs">
                    <span class="dropdown-text">Markeren als...</span>
                </button>
                <LoadingButton :loading="actionLoading">
                    <button class="button primary" :disabled="selectionCount == 0 || isLoadingOrders" @click="openMail()">
                        <span class="dropdown-text">E-mailen</span>
                        <div class="dropdown" @click.stop="openMailDropdown" />
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, HistoryManager } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { NavigationController } from "@simonbackx/vue-app-navigation";
import { FilterEditor, SegmentedControl,Toast,TooltipDirective as Tooltip } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { BackButton, LoadingButton,Spinner, STNavigationTitle } from "@stamhoofd/components";
import { Checkbox } from "@stamhoofd/components"
import { STToolbar } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { CheckoutMethodType, ChoicesFilterChoice, ChoicesFilterDefinition, ChoicesFilterMode, DateFilterDefinition, Filter, FilterDefinition, getPermissionLevelNumber, NumberFilterDefinition, OrderStatus, OrderStatusHelper, PaymentMethod, PaymentMethodHelper, PaymentStatus, PermissionLevel, PrivateOrder, WebshopOrdersQuery, WebshopTicketType } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "vue-property-decorator";

import { OrganizationManager } from '../../../../classes/OrganizationManager';
import { f } from "../../../../pdfkit.standalone";
import MailView from '../../mail/MailView.vue';
import { WebshopManager } from '../WebshopManager';
import OrderContextMenu from './OrderContextMenu.vue';
import OrderStatusContextMenu from './OrderStatusContextMenu.vue';
import OrderView from './OrderView.vue';
import { WebshopOrdersEventBus } from "./WebshopOrdersEventBus"

class SelectableOrder {
    order: PrivateOrder;
    selected = false;

    /**
     * Whether this order came from the database or from the server
     */
    isRefreshed = false;

    constructor(order: PrivateOrder, selected = false, isRefreshed = true) {
        this.order = order;
        this.selected = selected
        this.isRefreshed = isRefreshed
    }
}


@Component({
    components: {
        Checkbox,
        STNavigationBar,
        STNavigationTitle,
        STToolbar,
        BackButton,
        Spinner,
        LoadingButton,
        SegmentedControl
    },
    filters: {
        price: Formatter.price.bind(Formatter),
        date: Formatter.dateWithDay.bind(Formatter),
        minutes: Formatter.minutes.bind(Formatter),
    },
    directives: { Tooltip },
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
    actionLoading = false;

    orders: SelectableOrder[] = []
    nextQuery: WebshopOrdersQuery | null = WebshopOrdersQuery.create({})

    sortBy = "status";
    sortDirection = "ASC";
    selectionCountHidden = 0;
    searchQuery = "";

    selectedFilter: Filter<PrivateOrder> | null = null;


    /**
     * Insert or update an order
     */
    putOrder(order: PrivateOrder) {
        for (const [index, _order] of this.orders.entries()) {
            if (order.id === _order.order.id) {
                // replace
                this.orders.splice(index, 1, new SelectableOrder(order, _order.selected, true))
                return
            }
        }
        this.orders.push(new SelectableOrder(order, false, true))
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
        HistoryManager.setUrl("/webshops/" + Formatter.slug(this.preview.meta.name)+"/orders")
        document.title = this.preview.meta.name+" - Bestellingen"
    }

    pollInterval: number | null = null

    activated() {
        WebshopOrdersEventBus.addListener(this, "deleted", this.onDeleteOrder)

        /*if (this.hasTickets) {
            this.pollInterval = window.setInterval(() => {
                if (!this.isRefreshingOrders) {
                    this.refresh(false).catch(console.error)
                }
            }, 1000*30)
        }*/
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

        if (this.pollInterval) {
            clearInterval(this.pollInterval)
            this.pollInterval = null
        }
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
            const orders = await this.webshopManager.getOrdersFromDatabase()
            this.orders = orders.map(o => new SelectableOrder(o, false, false))
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
            await this.webshopManager.fetchNewOrders(false, reset)

            if (reset) {
                // Delete all orders that are not refreshed (those are deleted)
                this.orders = this.orders.filter(o => o.isRefreshed)
            }
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

    toggleSort(field: string) {
        if (this.sortBy == field) {
            if (this.sortDirection == "ASC") {
                this.sortDirection = "DESC";
            } else {
                this.sortDirection = "ASC";
            }
            return;
        }
        this.sortBy = field;
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

    get selectionCount(): number {
        let val = 0;
        this.orders.forEach((order) => {
            if (order.selected) {
                val++;
            }
        });
        return val;
    }

    get visibleSelectionCount(): number {
        let val = 0;
        this.filteredOrders.forEach((order) => {
            if (order.selected) {
                val++;
            }
        });
        return val;
    }

    getSelectedOrders(): PrivateOrder[] {
        return this.sortOrders(
                this.orders.filter((order: SelectableOrder) => {
                    return order.selected;
                })
            )
            .map((order: SelectableOrder) => {
                return order.order;
            });
    }

    filteredCount = 0

    get totalFilteredCount() {
        return this.orders.length - this.filteredOrders.length
    }

    get filteredOrders() {
        this.selectionCountHidden = 0
        this.filteredCount = 0

        const filtered = this.selectedFilter === null ? this.orders.slice() : this.orders.filter((order: SelectableOrder) => {
            if (this.selectedFilter?.doesMatch(order.order)) {
                return true;
            }
            this.selectionCountHidden += order.selected ? 1 : 0;
            this.filteredCount += 1
            return false;
        });

        if (this.searchQuery == "") {
            return filtered;
        }

        return filtered.filter((order: SelectableOrder) => {
            if (order.order.number+"" == this.searchQuery) {
                return true;
            }
            if (order.order.data.matchQuery(this.searchQuery)) {
                return true;
            }
            this.selectionCountHidden += order.selected ? 1 : 0;
            return false;
        });

    }

    sortOrders(orders: SelectableOrder[]) {
        const clone = orders.slice()

        if (this.sortBy == "number") {
            return clone.sort((a, b) => Sorter.byNumberValue(a.order.number ?? 0, b.order.number ?? 0) * (this.sortDirection == "ASC" ? -1 : 1));
        }

        if (this.sortBy == "name") {
            return clone.sort((a, b) => Sorter.byStringValue(a.order.data.customer.name, b.order.data.customer.name) * (this.sortDirection == "ASC" ? 1 : -1));
        }

        if (this.sortBy == "checkout") {
            return clone.sort((a, b) => Sorter.stack(
                    Sorter.byNumberValue(
                        (a.order.data.timeSlot?.date?.getTime() ?? 0) + ((a.order.data.timeSlot?.startTime ?? 0) + (a.order.data.timeSlot?.endTime ?? 0))/2 * 1000 * 60, 
                        (b.order.data.timeSlot?.date?.getTime() ?? 0) + ((b.order.data.timeSlot?.startTime ?? 0) + (b.order.data.timeSlot?.endTime ?? 0))/2 * 1000 * 60
                    ),
                    Sorter.byStringValue(a.order.data.checkoutMethod?.id ?? "", b.order.data.checkoutMethod?.id ?? "")
                )
                * (this.sortDirection == "ASC" ? -1 : 1));
        }
        

        if (this.sortBy == "status") {
            const statusMap: Map<OrderStatus, number> = new Map()
            for (const status of Object.values(OrderStatus)) {
                statusMap.set(status, statusMap.size)
            }

            return clone.sort((a, b) => Sorter.stack(
                Sorter.byNumberValue(statusMap.get(a.order.status) ?? 0, statusMap.get(b.order.status) ?? 0),
                Sorter.byBooleanValue((a.order.payment?.status ?? PaymentStatus.Succeeded) == PaymentStatus.Succeeded, (b.order.payment?.status ?? PaymentStatus.Succeeded) == PaymentStatus.Succeeded), 
                Sorter.byNumberValue(a.order.number ?? 0, b.order.number ?? 0)
            ) * (this.sortDirection == "ASC" ? -1 : 1));
        }

        return clone
    }

    resetFilter() {
        this.searchQuery = ""
        this.selectedFilter = null
    }

    get deliveryCities(): [string, string][] {
        const cities = new Map<string, string>()
        for (const order of this.orders) {
            if (order.order.data.checkoutMethod &&  order.order.data.checkoutMethod.type == CheckoutMethodType.Delivery && order.order.data.address) {
                cities.set(Formatter.slug(order.order.data.address.postalCode+" "+order.order.data.address.city), order.order.data.address.postalCode+" "+order.order.data.address.city)
            }
        }

        return [...cities.entries()].sort((a, b) => Sorter.byStringValue(a[0], b[0]))
    }

    get definitions(): FilterDefinition<PrivateOrder, Filter<PrivateOrder>, any>[] {
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
            choices: [PaymentMethod.Transfer, PaymentMethod.Payconiq, PaymentMethod.Bancontact, PaymentMethod.iDEAL, PaymentMethod.Unknown].map(method => {
                return new ChoicesFilterChoice(method, Formatter.capitalizeFirstLetter(PaymentMethodHelper.getName(method)))
            }),
            defaultMode: ChoicesFilterMode.Or,
            getValue: (order) => {
                return [order.data.paymentMethod]
            }
        })

        const paidStatus = new ChoicesFilterDefinition<PrivateOrder>({
            id: "order_paid",
            name: "Betaling",
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

        if (this.webshop?.meta.paymentMethods.includes(PaymentMethod.Bancontact) || this.webshop?.meta.paymentMethods.includes(PaymentMethod.iDEAL)) {
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

    editFilter() {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(FilterEditor, {
                definitions: this.definitions,
                selectedFilter: this.selectedFilter,
                organization: OrganizationManager.organization,
                setFilter: (filter: Filter<PrivateOrder>) => {
                    this.selectedFilter = filter
                }
            })
        }).setDisplayStyle("side-view"))
    }


    get sortedOrders() {
        return this.sortOrders(this.filteredOrders)
    }

    get title() {
        return this.preview.meta.name
    }

    get selectAll() {
        return this.visibleSelectionCount >= this.filteredOrders.length && this.filteredOrders.length > 0
    }

    set selectAll(selected: boolean) {
        this.filteredOrders.forEach((order) => {
            order.selected = selected;
        });
    }

    openOrder(order: SelectableOrder) {
        this.present(new ComponentWithProperties(NavigationController, { 
            root: new ComponentWithProperties(OrderView, { 
                initialOrder: order.order,
                webshopManager: this.webshopManager,
                getNextOrder: this.getNextOrder,
                getPreviousOrder: this.getPreviousOrder,
            })
        }).setDisplayStyle("popup"))
    }

    getPreviousOrder(order: PrivateOrder): PrivateOrder | null {
        for (let index = 0; index < this.sortedOrders.length; index++) {
            const _order = this.sortedOrders[index];
            if (_order.order.id == order.id) {
                if (index == 0) {
                    return null;
                }
                return this.sortedOrders[index - 1].order;
            }
        }
        return null;
    }

    getNextOrder(order: PrivateOrder): PrivateOrder | null {
        for (let index = 0; index < this.sortedOrders.length; index++) {
            const _order = this.sortedOrders[index];
            if (_order.order.id == order.id) {
                if (index == this.sortedOrders.length - 1) {
                    return null;
                }
                return this.sortedOrders[index + 1].order;
            }
        }
        return null;
    }

    openMail(subject = "") {
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MailView, {
                otherRecipients: this.getSelectedOrders().flatMap((o) => {
                    if ( o.data.customer.email.length > 0) {
                        return [o.data.customer]
                    }
                    return []
                }),
                defaultSubject: subject
            })
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
    }

    openMailDropdown(event) {
        if (this.selectionCount == 0) {
            return;
        }
        const displayedComponent = new ComponentWithProperties(OrderContextMenu, {
            x: event.clientX,
            y: event.clientY,
            orders: this.getSelectedOrders(),
            webshopManager: this.webshopManager
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }

    markAs(event) {
        if (this.selectionCount == 0) {
            return;
        }
        const displayedComponent = new ComponentWithProperties(OrderStatusContextMenu, {
            x: event.clientX,
            y: event.clientY,
            orders: this.getSelectedOrders(),
            webshopManager: this.webshopManager
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }

    showOrderContextMenu(event, order: PrivateOrder) {
        const displayedComponent = new ComponentWithProperties(OrderContextMenu, {
            x: event.clientX,
            y: event.clientY,
            orders: [order],
            webshopManager: this.webshopManager
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }

}
</script>