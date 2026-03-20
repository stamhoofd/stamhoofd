<template>
    <div class="st-view order-tickets-view">
        <STNavigationBar :title="$t(`%j`)" />
        <main>
            <h1 v-if="tickets.length > 1">
                {{ $t('%1t') }}
            </h1>
            <h1 v-else>
                {{ $t('%2K') }}
            </h1>

            <STList>
                <TicketRow v-for="ticket in tickets" :key="ticket.id" :ticket="ticket" :webshop-manager="webshopManager" :order="order" />
            </STList>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" type="button" @click="downloadAllTickets">
                    <span class="icon download" />
                    <span>{{ $t('%2E') }}</span>
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import STList from '@stamhoofd/components/layout/STList.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import STToolbar from '@stamhoofd/components/navigation/STToolbar.vue';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import type { PrivateOrderWithTickets} from '@stamhoofd/structures';
import { TicketPublic } from '@stamhoofd/structures';

import { computed } from 'vue';
import type { WebshopManager } from '../WebshopManager';
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
