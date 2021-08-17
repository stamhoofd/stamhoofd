<template>
    <div class="st-view webshop-view background">
        <STNavigationBar :sticky="false">
            <template #left>
                <BackButton v-if="canPop" slot="left" @click="pop" />
                <STNavigationTitle v-else>
                    <span class="icon-spacer">{{ title }}</span>
                </STNavigationTitle>
            </template>
            <template #middle>
                <div />
            </template>
            <template #right>
                <select v-model="selectedFilter" class="input hide-small">
                    <option v-for="(filter, index) in filters" :key="index" :value="index">
                        {{ filter.getName() }}
                    </option>
                </select>
                <input v-model="searchQuery" class="input search" placeholder="Zoeken" @input="searchQuery = $event.target.value">
            </template>
        </STNavigationBar>
    
        <main>
            <h1 v-if="canPop" class="data-table-prefix">
                <span class="icon-spacer">{{ title }}</span>
            </h1>

            <BillingWarningBox filter-types="webshops" class="data-table-prefix" />

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
        </main>

        <STToolbar :class="{'hide-smartphone': selectionCount == 0 }">
            <template #left>
                {{ selectionCount ? selectionCount : "Geen" }} {{ selectionCount == 1 ? "bestelling" : "bestellingen" }} geselecteerd
                <template v-if="selectionCountHidden">
                    (waarvan {{ selectionCountHidden }} verborgen)
                </template>
            </template>
            <template #right>
                <button class="button secundary" :disabled="selectionCount == 0 || isLoadingOrders" @click="markAs">
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
import { Request } from "@simonbackx/simple-networking";
import { ComponentWithProperties, HistoryManager } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { NavigationController } from "@simonbackx/vue-app-navigation";
import { SegmentedControl,Toast,TooltipDirective as Tooltip } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { BackButton, LoadingButton,Spinner, STNavigationTitle } from "@stamhoofd/components";
import { Checkbox } from "@stamhoofd/components"
import { STToolbar } from "@stamhoofd/components";
import { Order, OrderStatus, PaymentStatus, PermissionLevel, WebshopOrdersQuery } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "vue-property-decorator";

import { NoFilter, NotPaidFilter,StatusFilter } from '../../../../classes/order-filters';
import { OrganizationManager } from '../../../../classes/OrganizationManager';
import MailView from '../../mail/MailView.vue';
import BillingWarningBox from '../../settings/packages/BillingWarningBox.vue';
import { WebshopManager } from '../WebshopManager';
import OrderContextMenu from './OrderContextMenu.vue';
import OrderStatusContextMenu from './OrderStatusContextMenu.vue';
import OrderView from './OrderView.vue';
import { WebshopOrdersEventBus } from "./WebshopOrdersEventBus"

class SelectableOrder {
    order: Order;
    selected = false;

    constructor(order: Order, selected = false) {
        this.order = order;
        this.selected = selected
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
        SegmentedControl,
        BillingWarningBox
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

    filters = [new NoFilter(), ...StatusFilter.generateAll(), new NotPaidFilter()];
    selectedFilter = 0;

    created() {
        this.webshopManager.ordersEventBus.addListener(this, "fetched", this.onNewOrders.bind(this))
        this.loadOrders().catch(console.error)
    }

    /**
     * Insert or update an order
     */
    putOrder(order: Order) {
        for (const [index, _order] of this.orders.entries()) {
            if (order.id === _order.order.id) {
                // replace
                this.orders.splice(index, 1, new SelectableOrder(order, _order.selected))
                return
            }
        }
        this.orders.push(new SelectableOrder(order, false))
    }

    onNewOrders(orders: Order[]) {
        console.log("Received new orders from network")
        // Search for the orders and replace / add them
        for (const order of orders) {
            this.putOrder(order)
        }
    }

    mounted() {
        this.reload();
        

        // Set url
        HistoryManager.setUrl("/webshops/" + Formatter.slug(this.preview.meta.name)+"/orders")
        document.title = this.preview.meta.name+" - Bestellingen"
    }

    activated() {
        WebshopOrdersEventBus.addListener(this, "deleted", this.onDeleteOrder)
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

    isLoadingOrders = true
    isRefreshingOrders = false

    async loadOrders() {
        this.orders = []
        this.isLoadingOrders = true
        try {
            const orders = await this.webshopManager.getOrdersFromDatabase()
            this.orders = orders.map(o => new SelectableOrder(o))

            
        } catch (e) {
            // Database error. We can ignore this and simply move on.
            Toast.fromError(e).show()
        }

        try {
            // Initiate a refresh
            // don't wait
            this.isRefreshingOrders = true
            this.isLoadingOrders = false
            await this.webshopManager.fetchNewOrders(true)
        } catch (e) {
            // Fetching failed
            if (!Request.isNetworkError(e)) {
                Toast.fromError(e).show()
            }
        }

        this.isRefreshingOrders = false
        this.isLoadingOrders = false
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

    getSelectedOrders(): Order[] {
        return this.orders
            .filter((order: SelectableOrder) => {
                return order.selected;
            })
            .map((order: SelectableOrder) => {
                return order.order;
            });
    }

    get filteredOrders() {
        this.selectionCountHidden = 0

        const filtered = this.orders.filter((order: SelectableOrder) => {
            if (this.filters[this.selectedFilter].doesMatch(order.order)) {
                return true;
            }
            this.selectionCountHidden += order.selected ? 1 : 0;
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

    get sortedOrders() {
        if (this.sortBy == "number") {
            return this.filteredOrders.sort((a, b) => Sorter.byNumberValue(a.order.number ?? 0, b.order.number ?? 0) * (this.sortDirection == "ASC" ? -1 : 1));
        }

        if (this.sortBy == "name") {
            return this.filteredOrders.sort((a, b) => Sorter.byStringValue(a.order.data.customer.name, b.order.data.customer.name) * (this.sortDirection == "ASC" ? 1 : -1));
        }

        if (this.sortBy == "checkout") {
            return this.filteredOrders.sort((a, b) => Sorter.stack(
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

            return this.filteredOrders.sort((a, b) => Sorter.stack(
                Sorter.byNumberValue(statusMap.get(a.order.status) ?? 0, statusMap.get(b.order.status) ?? 0),
                Sorter.byBooleanValue((a.order.payment?.status ?? PaymentStatus.Succeeded) == PaymentStatus.Succeeded, (b.order.payment?.status ?? PaymentStatus.Succeeded) == PaymentStatus.Succeeded), 
                Sorter.byNumberValue(a.order.number ?? 0, b.order.number ?? 0)
            ) * (this.sortDirection == "ASC" ? -1 : 1));
        }


        return this.filteredOrders
    }

    get title() {
        return this.preview.meta.name
    }

    get selectAll() {
        return this.selectionCount - this.selectionCountHidden >= this.filteredOrders.length && this.filteredOrders.length > 0
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

    getPreviousOrder(order: Order): Order | null {
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

    getNextOrder(order: Order): Order | null {
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

    showOrderContextMenu(event, order: Order) {
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

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

</style>
