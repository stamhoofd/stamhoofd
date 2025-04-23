<template>
    <div ref="root" class="st-view ticket-already-scanned-view">
        <STNavigationBar :title="$t(`Ticket al gescand`)" />

        <main>
            <h1>
                <span class="icon warning yellow" />
                <span>{{ $t('4ac91a6b-7e0d-4ebc-9698-2543ef654b63') }}</span>
            </h1>
            <p class="ticket-secret">
                {{ ticket.secret }}
            </p>
            <p class="style-description">
                {{ $t('21c8577c-7124-41e3-8bda-3692b917fdba') }}
            </p>

            <STList class="info">
                <STListItem v-if="ticket.scannedAt">
                    <h3 class="style-definition-label">
                        {{ $t('7853cca1-c41a-4687-9502-190849405f76') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDateTime(ticket.scannedAt) }}
                    </p>
                </STListItem>

                <STListItem v-if="ticket.scannedBy">
                    <h3 class="style-definition-label">
                        {{ $t('dcb6acd6-9b5a-4a2e-af6e-441a8264dee0') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ ticket.scannedBy }}
                    </p>
                </STListItem>
            </STList>
        </main>

        <STToolbar>
            <template #right>
                <button class="button secundary" type="button" @click="viewTicket">
                    {{ $t('90a3142d-c6a4-4e52-a4d7-db2e78fabacc') }}
                </button>
                <button class="button primary" type="button" @click="() => pop()">
                    {{ $t('1b311bbf-8cc3-4b91-a019-f80a062d8d4d') }}
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, usePop, useShow } from '@simonbackx/vue-app-navigation';
import { ColorHelper, STList, STListItem, STNavigationBar, STToolbar } from '@stamhoofd/components';
import { PrivateOrder, TicketPrivate, TicketPublicPrivate } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { ref, watch } from 'vue';
import { WebshopManager } from '../../WebshopManager';
import ValidTicketView from './ValidTicketView.vue';

const props = defineProps<{
    webshopManager: WebshopManager;
    ticket: TicketPrivate | TicketPublicPrivate;
    order: PrivateOrder;
}>();

const root = ref<HTMLElement | null>(null);

watch(root, (root) => {
    if (root !== null) {
        ColorHelper.setColor('#ffc900', root);
    }
});

const show = useShow();
const pop = usePop();

function formatDateTime(date: Date) {
    return Formatter.capitalizeFirstLetter(Formatter.dateTimeWithDay(date));
}

function viewTicket() {
    show({
        components: [
            new ComponentWithProperties(ValidTicketView, {
                webshopManager: props.webshopManager,
                ticket: props.ticket,
                order: props.order,
            }),
        ],
        replace: 1,
        force: true,
    }).catch(console.error);
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.ticket-already-scanned-view {
    //--color-current-background-shade: #{$color-success-background-shade};
    > main {
        > h1 {
            color: $color-warning-dark;
            text-align: center;
            padding-bottom: 0 !important;

            span {
                display: block;

                &.icon {
                    display: inline-block;
                    font-size: 64px;
                    width: 64px;
                }
            }

            + p {
                text-align: center;
            }
        }
    }

    .ticket-secret {
        text-align: center;
        color: $color-gray-text;
        font-size: 10px;
        font-weight: bold;
        padding-bottom: 20px;
        padding-top: 5px;
    }
}
</style>
