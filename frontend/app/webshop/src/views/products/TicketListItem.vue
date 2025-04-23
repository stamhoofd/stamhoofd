<template>
    <STListItem class="ticket-list-item right-stack" :selectable="true" @click="openTicket">
        <h3>
            {{ name }}
            <span v-if="ticket.getIndexText()" class="ticket-index">{{ ticket.getIndexText() }}</span>
        </h3>
        <p v-if="isSingle && order" class="description" v-text="$t('1a2a842e-4f98-4818-911b-c9634aca4214')+order.number" />
        <p v-if="isSingle && order" class="description" v-text="order.data.customer.name" />
        <p v-if="cartItem.description" class="description" v-text="cartItem.description" />

        <p v-if="cartItem.product.location" class="description" v-text="cartItem.product.location.name" />
        <p v-if="cartItem.product.location && cartItem.product.location.address" class="description" v-text="cartItem.product.location.address" />
        <p v-if="ticket.getIndexDescriptionString(webshop)" class="description" v-text="ticket.getIndexDescriptionString(webshop)" />

        <template #right>
            <span class="icon qr-code" />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { DetailedTicketView, STListItem } from '@stamhoofd/components';
import { Order, Organization, TicketPublic, Webshop, WebshopTicketType } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = withDefaults(defineProps<{
    webshop: Webshop;
    organization: Organization;
    ticket: TicketPublic;
    order?: Order | null;
}>(), {
    order: null,
});

const present = usePresent();

// TODO: multiple item support needed!
const cartItem = computed(() => props.ticket.items[0]);
const name = computed(() => props.ticket.getTitle());
const isSingle = computed(() => props.webshop.meta.ticketType === WebshopTicketType.SingleTicket);

function openTicket() {
    present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(DetailedTicketView, {
                    ticket: props.ticket,
                    order: props.order,
                    webshop: props.webshop,
                    organization: props.organization,
                }),
            }),
        ],
        modalDisplayStyle: 'sheet',
    }).catch(console.error);
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.ticket-list-item {

    .middle {
        > .event-name {
            @extend .style-definition-label;
        }

        .ticket-index {
            @extend .style-definition-label;
            display: inline-block;
        }

        > h3 {
            padding-top: 5px;
            @extend .style-title-2;
        }

        > .description {
            @extend .style-description-small;
            padding-top: 10px;
            text-overflow: ellipsis;
            overflow: hidden;
            display: -webkit-box;
            white-space: pre-wrap;
            line-clamp: 3; /* number of lines to show */
            -webkit-line-clamp: 3; /* number of lines to show */
            -webkit-box-orient: vertical;

            + .description {
                padding-top: 0;
            }
        }

        > .price {
            font-size: 14px;
            line-height: 1.4;
            font-weight: 600;
            padding-top: 10px;
            color: $color-primary;
            display: flex;
            flex-direction: row;

            .style-tag {
                margin-left: auto;
            }
        }
    }
}
</style>
