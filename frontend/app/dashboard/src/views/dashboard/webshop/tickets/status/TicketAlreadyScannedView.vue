<template>
    <div ref="root" class="st-view ticket-already-scanned-view">
        <STNavigationBar :title="$t(`%Vv`)" />

        <main>
            <h1>
                <span class="icon warning yellow" />
                <span>{{ $t('%Vv') }}</span>
            </h1>
            <p class="ticket-secret">
                {{ ticket.secret }}
            </p>
            <p class="style-description">
                {{ $t('%Vw') }}
            </p>

            <STList class="info">
                <STListItem v-if="ticket.scannedAt">
                    <h3 class="style-definition-label">
                        {{ $t('%1GD') }}
                    </h3>
                    <p class="style-definition-text">
                        {{ formatDateTime(ticket.scannedAt) }}
                    </p>
                </STListItem>

                <STListItem v-if="ticket.scannedBy">
                    <h3 class="style-definition-label">
                        {{ $t('%Vx') }}
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
                    {{ $t('%Vy') }}
                </button>
                <button class="button primary" type="button" @click="() => pop()">
                    {{ $t('%Vz') }}
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, usePop, useShow } from '@simonbackx/vue-app-navigation';
import { ColorHelper } from '@stamhoofd/components/ColorHelper.ts';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import STToolbar from '@stamhoofd/components/navigation/STToolbar.vue';
import type { PrivateOrder, TicketPrivate, TicketPublicPrivate } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { ref, watch } from 'vue';
import type { WebshopManager } from '../../WebshopManager';
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
