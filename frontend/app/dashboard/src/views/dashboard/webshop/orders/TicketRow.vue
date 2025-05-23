<template>
    <STListItem v-long-press="(e: MouseEvent) => openMenu(e)" class="right-stack" :selectable="true" @contextmenu.prevent="openMenu" @click="openTicket">
        <h3 class="style-title-list">
            {{ name }}
            <span v-if="ticket.getIndexText()" class="ticket-index">{{ ticket.getIndexText() }}</span>
        </h3>
        <p v-if="isSingle && order" class="style-description-small" v-text="$t('1a2a842e-4f98-4818-911b-c9634aca4214')+order.number" />
        <p v-if="isSingle && order" class="style-description-small" v-text="order.data.customer.name" />
        <p v-if="!isSingle && !cartItem" class="style-description-small">
            <span class="style-tag error">{{ $t('d942f8fe-5c83-4b7f-badf-b6be91762be7') }}</span>
        </p>
        <p v-if="cartItem && cartItem.description" class="style-description-small pre-wrap" v-text="cartItem.description" />
        <p v-if="cartItem && cartItem.product.location" class="style-description-small" v-text="cartItem.product.location.name" />
        <p v-if="cartItem && cartItem.product.location && cartItem.product.location.address" class="style-description-small" v-text="cartItem.product.location.address" />
        <p v-if="ticket.getIndexDescriptionString(webshop)" class="style-description-small pre-wrap" v-text="ticket.getIndexDescriptionString(webshop)" />

        <p v-if="scannedAtDescription" class="style-description-small" v-text="scannedAtDescription" />

        <template #right>
            <button class="button text" type="button" @click.stop="markAs">
                <span :class="'style-tag '+statusColor">{{ statusName }}</span>
                <span v-if="hasWrite" class="icon arrow-down-small" />
            </button>
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { ContextMenu, ContextMenuItem, STListItem, useAuth, useContext, useOrganization } from '@stamhoofd/components';
import { Order, PermissionLevel, TicketPrivate, TicketPublicPrivate, WebshopTicketType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { computed } from 'vue';
import TicketAlreadyScannedView from '../tickets/status/TicketAlreadyScannedView.vue';
import ValidTicketView from '../tickets/status/ValidTicketView.vue';
import { WebshopManager } from '../WebshopManager';

const props = defineProps<{
    ticket: TicketPublicPrivate;
    order: Order;
    webshopManager: WebshopManager;
}>();

const present = usePresent();
const context = useContext();
const organization = useOrganization();
const webshop = computed(() => props.webshopManager.preview);
// todo: multiple item support needed!
const cartItem = computed(() => props.ticket.items[0]);
const name = computed(() => props.ticket.getTitle());
const auth = useAuth();

const scannedAtDescription = computed(() => {
    if (!props.ticket.scannedAt) {
        return 'Niet gescand';
    }
    if (!props.ticket.scannedBy) {
        return 'Gescand op ' + Formatter.dateTime(props.ticket.scannedAt);
    }
    return 'Gescand op ' + Formatter.dateTime(props.ticket.scannedAt) + ' door ' + props.ticket.scannedBy;
});

const isSingle = computed(() => webshop.value.meta.ticketType === WebshopTicketType.SingleTicket);
const hasWrite = computed(() => {
    return auth.canAccessWebshopTickets(webshop.value, PermissionLevel.Write);
});

async function openTicket() {
    if (!hasWrite.value) {
        await download();
        return;
    }
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(props.ticket.scannedAt !== null ? TicketAlreadyScannedView : ValidTicketView, {
                    order: props.order,
                    ticket: props.ticket,
                    webshopManager: props.webshopManager,
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

function openMenu(clickEvent: MouseEvent) {
    const contextMenu = new ContextMenu([
        [
            new ContextMenuItem({
                name: 'Openen',
                disabled: !hasWrite.value,
                action: () => {
                    openTicket();
                    return true;
                },
            }),
            new ContextMenuItem({
                name: 'Markeer als',
                disabled: !hasWrite.value,
                childMenu: getMarkAsMenu(),
            }),
            new ContextMenuItem({
                name: 'Download',
                action: () => {
                    download().catch(console.error);
                    return true;
                },
                icon: 'download',
            }),
        ],
    ]);
    contextMenu.show({ clickEvent }).catch(console.error);
}

function markAs(event: MouseEvent) {
    if (!hasWrite.value) {
        return;
    }
    const el: HTMLElement = (event.currentTarget as HTMLElement).querySelector('.right') ?? event.currentTarget as HTMLElement;
    const contextMenu = getMarkAsMenu();
    contextMenu.show({ button: el, xPlacement: 'left' }).catch(console.error);
}

function getMarkAsMenu() {
    return new ContextMenu([
        [
            new ContextMenuItem({
                name: 'Gescand',
                selected: !!props.ticket.scannedAt,
                action: () => {
                    props.webshopManager.addTicketPatch(TicketPrivate.patch({
                        id: props.ticket.id,
                        secret: props.ticket.secret, // needed for lookups
                        scannedAt: new Date(),
                        scannedBy: context.value.user?.firstName ?? null,
                    })).catch(console.error);
                    return true;
                },
            }),
            new ContextMenuItem({
                name: 'Niet gescand',
                selected: !props.ticket.scannedAt,
                action: () => {
                    props.webshopManager.addTicketPatch(TicketPrivate.patch({
                        id: props.ticket.id,
                        secret: props.ticket.secret, // needed for lookups
                        scannedAt: null,
                        scannedBy: null,
                    })).catch(console.error);
                    return true;
                },
            }),
        ],
    ]);
}

const statusName = computed(() => props.ticket.scannedAt ? 'Gescand' : 'Niet gescand');
const statusColor = computed(() => props.ticket.scannedAt ? '' : 'gray');

async function download() {
    const TicketBuilder = (await import(
        /* webpackChunkName: "TicketBuilder" */
        /* webpackPrefetch: true */
        '@stamhoofd/ticket-builder'
    )).TicketBuilder;

    const builder = new TicketBuilder([props.ticket], webshop.value, organization.value!, props.order ?? undefined);
    await builder.download();
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.ticket-index {
    @extend .style-definition-label;
    display: inline-block;
}
</style>
