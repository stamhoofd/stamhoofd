<template>
    <div class="st-view webshop-view background">
        <STNavigationBar :sticky="false">
            <template #left>
                <BackButton v-if="canPop" slot="left" @click="pop" />
                <STNavigationTitle v-else>
                    <span class="icon-spacer">{{ title }}</span>

                    <button class="button text" @click="editSettings">
                        <span class="icon settings" />
                        <span>Instellingen</span>
                    </button>
                </STNavigationTitle>
            </template>
            <template #middle>
                <div />
            </template>
            <template #right>
                <input v-model="searchQuery" class="input search" placeholder="Zoeken" @input="searchQuery = $event.target.value">
            </template>
        </STNavigationBar>
    
        <main>
            <h1 v-if="canPop">
                <span class="icon-spacer">{{ title }}</span>

                <button class="button text" @click="editSettings">
                    <span class="icon settings" />
                    <span>Instellingen</span>
                </button>
            </h1>

            <Spinner v-if="loading" class="center" />
            <p v-if="!isLoadingOrders && orders.length == 0" class="info-box">
                Je hebt nog geen bestellingen ontvangen
            </p>

            <table v-else class="data-table">
                <thead>
                    <tr>
                        <th>
                            <Checkbox
                                v-model="selectAll"
                            />
                        </th>
                        <th class="hide-smartphone tiny" @click="toggleSort('number')" >
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
                        <th @click="toggleSort('payment')">
                            Betaling
                            <span
                                class="sort-arrow"
                                :class="{
                                    up: sortBy == 'payment' && sortDirection == 'ASC',
                                    down: sortBy == 'payment' && sortDirection == 'DESC',
                                }"
                            />
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="order in sortedOrders" :key="order.id" @click="openOrder(order)">
                        <td @click.stop="">
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
                            <span class="style-description-small">{{ order.order.data.cart.price | price }}</span>
                            <span key="success" v-if="!order.order.payment || order.order.payment.status == 'Succeeded'" class="icon success green" v-tooltip="order.order.payment && order.order.payment.paidAt ? 'Betaald op '+formatDateTime(order.order.payment.paidAt) : 'Zonder betaling'"></span>
                            <span key="no-success" v-else class="icon clock gray" v-tooltip="'Nog niet betaald'"></span>
                        </td>
                    </tr>
                </tbody>
            </table>
            

            <Spinner v-if="isLoadingOrders" class="center" />
        </main>

        <STToolbar>
            <template #left>
                {{ selectionCount ? selectionCount : "Geen" }} {{ selectionCount == 1 ? "bestelling" : "bestellingen" }} geselecteerd
                <template v-if="selectionCountHidden">
                    (waarvan {{ selectionCountHidden }} verborgen)
                </template>
            </template>
            <template #right>
                <LoadingButton :loading="actionLoading">
                    <button class="button primary" :disabled="selectionCount == 0" @click="openMail()">
                        <span class="dropdown-text">Mailen</span>
                        <div class="dropdown" @click.stop="openMailDropdown" />
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { NavigationController } from "@simonbackx/vue-app-navigation";
import { SegmentedControl,TooltipDirective as Tooltip } from "@stamhoofd/components";
import { STNavigationBar } from "@stamhoofd/components";
import { BackButton, LoadingButton,Spinner, STNavigationTitle } from "@stamhoofd/components";
import { Checkbox } from "@stamhoofd/components"
import { STToolbar } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Order, PaginatedResponseDecoder, PaymentStatus, PrivateWebshop, WebshopOrdersQuery, WebshopPreview } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "vue-property-decorator";

import OrderView from './OrderView.vue';
import { OrganizationManager } from '../../../classes/OrganizationManager';
import EditWebshopView from './EditWebshopView.vue';
import MailView from '../mail/MailView.vue';
import OrdersContextMenu from './OrdersContextMenu.vue';

class SelectableOrder {
    order: Order;
    selected = true;

    constructor(order: Order, selected = true) {
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
        SegmentedControl
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

    sortBy = "number";
    sortDirection = "ASC";
    selectionCountHidden = 0;
    searchQuery = "";

    mounted() {
        this.reload();
        this.loadNextOrders()
    }

    formatDateTime(date: Date) {
        console.log(date)
        return Formatter.dateTime(date)
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

        return this.orders.filter((order: SelectableOrder) => {
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

        if (this.sortBy == "payment") {
            return this.filteredOrders.sort((a, b) => Sorter.stack(
                Sorter.byBooleanValue((a.order.payment?.status ?? PaymentStatus.Succeeded) == PaymentStatus.Succeeded, (b.order.payment?.status ?? PaymentStatus.Succeeded) == PaymentStatus.Succeeded), 
                Sorter.byNumberValue(a.order.data.cart.price, b.order.data.cart.price)
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
            y: event.clientY + 10,
            orders: this.getSelectedOrders()
        });
        this.present(displayedComponent.setDisplayStyle("overlay"));
    }

}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

</style>
