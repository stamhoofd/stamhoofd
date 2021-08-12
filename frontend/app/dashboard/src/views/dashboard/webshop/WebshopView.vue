<template>
    <div class="st-view webshop-view background">
        <STNavigationBar :sticky="false">
            <template #left>
                <BackButton v-if="canPop" slot="left" @click="pop" />
                <STNavigationTitle v-else>
                    <span class="icon-spacer">{{ title }}</span>

                    <button v-if="hasFullPermissions" v-tooltip="'Instellingen'" class="button gray icon settings" @click="editSettings" />
                    <a v-tooltip="'Webshop openen'" class="button gray icon external" :href="'https://'+webshopUrl" target="_blank" />
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

                <button v-tooltip="'Instellingen'" class="button gray icon settings" @click="editSettings" />
                <a v-tooltip="'Webshop openen'" class="button gray icon external" :href="'https://'+webshopUrl" target="_blank" />
            </h1>

            <BillingWarningBox filter-types="webshops" class="data-table-prefix"/>

            <Spinner v-if="loading" class="center" />
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
                            <span v-if="order.order.status == 'Pickup'" v-tooltip="'Ophalen'" class="success icon green" />
                            <span v-if="order.order.status == 'Completed'" v-tooltip="'Voltooid'" class="success icon green" />
                            <span v-if="order.order.status == 'Canceled'" v-tooltip="'Geannuleerd'" class="error icon canceled" />
                        </td>
                    </tr>
                </tbody>
            </table>
            

            <Spinner v-if="isLoadingOrders" class="center" />
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
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, HistoryManager } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { NavigationController } from "@simonbackx/vue-app-navigation";
import { SegmentedControl,Toast,TooltipDirective as Tooltip } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { BackButton, LoadingButton,Spinner, STNavigationTitle } from "@stamhoofd/components";
import { Checkbox } from "@stamhoofd/components"
import { STToolbar } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { getPermissionLevelNumber, Order, OrderStatus, PaginatedResponseDecoder, PaymentStatus, PermissionLevel, PrivateWebshop, WebshopOrdersQuery, WebshopPreview } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "vue-property-decorator";

import { NoFilter, NotPaidFilter,StatusFilter } from '../../../classes/order-filters';
import { OrganizationManager } from '../../../classes/OrganizationManager';
import MailView from '../mail/MailView.vue';
import BillingWarningBox from '../settings/packages/BillingWarningBox.vue';
import EditWebshopView from './EditWebshopView.vue';
import OrderContextMenu from './OrderContextMenu.vue';
import OrdersContextMenu from './OrdersContextMenu.vue';
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
export default class WebshopView extends Mixins(NavigationMixin) {
    @Prop()
    preview: WebshopPreview ;
    webshop: PrivateWebshop | null = null
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

    mounted() {
        this.reload();
        this.loadNextOrders()

        // Set url
        HistoryManager.setUrl("/webshops/" + Formatter.slug(this.preview.meta.name))
        document.title = "Stamhoofd - " + this.preview.meta.name
    }

    activated() {
        WebshopOrdersEventBus.addListener(this, "deleted", this.onDeleteOrder)
    }

    deactivated() {
        WebshopOrdersEventBus.removeListener(this)
    }

    onDeleteOrder(): Promise<void> {
        this.nextQuery = WebshopOrdersQuery.create({})
        this.orders = []
        this.loadNextOrders()
        return Promise.resolve()
    }

    get webshopUrl() {
        return this.webshop?.getUrl(OrganizationManager.organization) ?? ""
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

        SessionManager.currentSession!.authenticatedServer.request({
            method: "GET",
            path: "/webshop/"+this.preview.id,
            decoder: PrivateWebshop as Decoder<PrivateWebshop>
        }).then((response) => {
            this.webshop = response.data

            // Clone data and keep references
            OrganizationManager.organization.webshops.find(w => w.id == this.preview.id)?.set(response.data)
        }).catch((e) => {
            console.error(e)
            Toast.fromError(e).show()
        }).finally(() => {
            this.loading = false
        })
    }

    get isLoadingOrders() {
        return !!this.nextQuery
    }

    loadNextOrders() {
        if (!this.nextQuery) {
            return
        }

        SessionManager.currentSession!.authenticatedServer.request({
            method: "GET",
            path: "/webshop/"+this.preview.id+"/orders",
            query: this.nextQuery,
            decoder: new PaginatedResponseDecoder(Order as Decoder<Order>, WebshopOrdersQuery as Decoder<WebshopOrdersQuery>)
        }).then((response) => {
            this.orders.push(...response.data.results.map(o => new SelectableOrder(o)))
            this.nextQuery = response.data.next ?? null
            this.loadNextOrders()
        }).catch((e) => {
            console.error(e)
            Toast.fromError(e).show()
            this.nextQuery = null
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
        return this.webshop?.meta?.name ?? this.preview.meta.name
    }

    editSettings() {
        const displayedComponent = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EditWebshopView, {
                editWebshop: this.webshop
            })
        });
        this.present(displayedComponent.setDisplayStyle("popup"));
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
                webshop: this.webshop,
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
        const displayedComponent = new ComponentWithProperties(OrdersContextMenu, {
            x: event.clientX,
            y: event.clientY,
            orders: this.getSelectedOrders()
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
            webshop: this.preview
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }

    showOrderContextMenu(event, order: Order) {
        const displayedComponent = new ComponentWithProperties(OrderContextMenu, {
            x: event.clientX,
            y: event.clientY,
            orders: [order],
            webshop: this.preview
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }

}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

</style>
