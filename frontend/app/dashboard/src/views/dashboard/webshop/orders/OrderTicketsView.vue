<template>
    <div class="st-view order-tickets-view">
        <STNavigationBar :title="$t(`32e049b4-acd6-4d77-a5b8-0632111f2445`)" />
        <main>
            <h1 v-if="tickets.length > 1">
                {{ $t('b40d200c-4265-4d58-a7f4-7c2498b062b9') }}
            </h1>
            <h1 v-else>
                {{ $t('de971042-551d-43d2-ab47-e76132156887') }}
            </h1>

            <STList>
                <TicketRow v-for="ticket in tickets" :key="ticket.id" :ticket="ticket" :webshop-manager="webshopManager" :order="order" />
            </STList>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" type="button" @click="downloadAllTickets">
                    <span class="icon download" />
                    <span>{{ $t('d3e021e4-a9eb-4f7e-a538-8d2dbc27341c') }}</span>
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
