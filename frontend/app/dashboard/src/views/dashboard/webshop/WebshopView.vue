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
                        <th @click="toggleSort('name')">
                            Totaalprijs
                            <span
                                class="sort-arrow"
                                :class="{
                                    up: sortBy == 'name' && sortDirection == 'ASC',
                                    down: sortBy == 'name' && sortDirection == 'DESC',
                                }"
                            />
                        </th>
                        <th class="hide-smartphone" @click="toggleSort('status')">
                            Info
                            <span
                                class="sort-arrow"
                                :class="{
                                    up: sortBy == 'status' && sortDirection == 'ASC',
                                    down: sortBy == 'status' && sortDirection == 'DESC',
                                }"
                            />
                        </th>
                        <th>Acties</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="order in sortedOrders" :key="order.id" @click="openOrder(order)">
                        <td @click.stop="">
                            <Checkbox v-model="order.selected" />
                        </td>
                        <td>
                            <h2 class="style-title-list">
                                {{ order.order.data.customer.name }}
                            </h2>
                            <p class="style-description-small">
                                #{{ order.order.number }}
                            </p>
                        </td>
                        <td class="minor">
                            {{ order.order.data.cart.price | price }}
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
                            <span v-if="!order.order.payment || order.order.payment.status == 'Succeeded'" class="icon success green" v-tooltip="order.order.payment ? 'Betaald op '+order.order.payment.paidAt : 'Zonder betaling'"></span>
                            <span v-else class="icon clock gray" v-tooltip="'Nog niet betaald'"></span>
                        </td>
                    </tr>
                </tbody>
            </table>
            

            <Spinner v-if="isLoadingOrders" class="center" />
        </main>
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
import { Order, PaginatedResponseDecoder, PrivateWebshop, WebshopOrdersQuery, WebshopPreview } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "vue-property-decorator";

import OrderView from './OrderView.vue';
import { OrganizationManager } from '../../../classes/OrganizationManager';
import EditWebshopView from './EditWebshopView.vue';

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

    orders: SelectableOrder[] = []
    nextQuery: WebshopOrdersQuery | null = WebshopOrdersQuery.create({})

    sortBy = "info";
    sortDirection = "ASC";
    selectionCountHidden = 0;

    mounted() {
        this.reload();
        this.loadNextOrders()
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

    get filteredOrders() {
        return this.orders
    }

    get sortedOrders() {
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
        this.present(new ComponentWithProperties(OrderView, { initialOrder: order.order }).setDisplayStyle("popup"))
    }

}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

</style>
