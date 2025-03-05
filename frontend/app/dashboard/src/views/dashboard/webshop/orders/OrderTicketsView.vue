<template>
    <div class="st-view order-tickets-view">
        <STNavigationBar :title="$t(`Tickets`)"/>
        <main>
            <h1 v-if="tickets.length > 1">
                {{ $t('f3005a87-5877-435d-bc0e-5b4883e7ca11') }}
            </h1>
            <h1 v-else>
                {{ $t('57c98fd7-1432-4b03-99f7-452b6c95a7f1') }}
            </h1>

            <STList>
                <TicketRow v-for="ticket in tickets" :key="ticket.id" :ticket="ticket" :webshop-manager="webshopManager" :order="order"/>
            </STList>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" type="button" @click="downloadAllTickets">
                    <span class="icon download"/>
                    <span>{{ $t('e6b57793-7438-442c-9455-e75ac4a3fd0b') }}</span>
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { STList, STNavigationBar, STToolbar, useOrganization } from '@stamhoofd/components';
import { PrivateOrderWithTickets, TicketPublic } from '@stamhoofd/structures';

import { computed } from 'vue';
import { WebshopManager } from '../WebshopManager';
import TicketRow from './TicketRow.vue';

const props = defineProps<{
    initialOrder: PrivateOrderWithTickets;
    webshopManager: WebshopManager;
}>();

const organization = useOrganization();
const webshop = computed(() => props.webshopManager.preview);
const order = computed(() => props.initialOrder);
const tickets = computed(() => order.value.tickets.map(t => t.getPublic(order.value)).sort(TicketPublic.sort));

async function downloadAllTickets() {
    const TicketBuilder = (await import(
        /* webpackChunkName: "TicketBuilder" */
        /* webpackPrefetch: true */
        '@stamhoofd/ticket-builder'
    )).TicketBuilder;

    const builder = new TicketBuilder(tickets.value, webshop.value, organization.value!, order.value);
    await builder.download();
}
</script>
