<template>
    <div class="st-view order-tickets-view">
        <STNavigationBar :title="'Tickets'" />
        <main>
            <h1 v-if="tickets.length > 1">
                Tickets
            </h1>
            <h1 v-else>
                Ticket
            </h1>

            <STList>
                <TicketRow v-for="ticket in tickets" :key="ticket.id" :ticket="ticket" :webshop-manager="webshopManager" :order="order" />
            </STList>
        </main>

        <STToolbar>
            <template #right><button class="button primary" type="button" @click="downloadAllTickets">
                <span class="icon download" />
                <span>Download</span>
            </button></template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { PrivateOrderWithTickets, TicketPublic } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "@simonbackx/vue-app-navigation/classes";


import { WebshopManager } from "../WebshopManager";
import TicketRow from "./TicketRow.vue";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        TicketRow
    }
})
export default class OrderTicketsView extends Mixins(NavigationMixin){
    loading = false
    errorBox: ErrorBox | null = null

    @Prop({ required: true })
        initialOrder!: PrivateOrderWithTickets

    @Prop({ required: true })
        webshopManager!: WebshopManager

    get webshop() {
        return this.webshopManager.preview
    }

    order: PrivateOrderWithTickets = this.initialOrder

    get tickets() {
        return this.order.tickets.map(t => t.getPublic(this.order)).sort(TicketPublic.sort)
    }

    get hasWrite() {
        return this.webshop.privateMeta.permissions.hasWriteAccess(this.$context.organizationPermissions)
    }

    async downloadAllTickets() {
        const TicketBuilder = (await import(
            /* webpackChunkName: "TicketBuilder" */
            /* webpackPrefetch: true */
            '@stamhoofd/ticket-builder'
        )).TicketBuilder

        const builder = new TicketBuilder(this.tickets, this.webshop, this.$organization, this.order)
        await builder.download()
    }

  
}
</script>