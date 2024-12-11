<template>
    <STList>
        <STListItem v-for="item in filteredItems" :key="item.id" :selectable="hasWrite" @click="editBalanceItem(item)">
            <template #left>
                <span class="style-amount min-width">
                    <figure class="style-image-with-icon gray">
                        <figure>
                            <span class="icon" :class="getBalanceItemTypeIcon(item.type)" />
                        </figure>
                        <aside>
                            <span v-if="item.amount <= 0" class="icon disabled small red" />
                            <span v-if="item.amount > 1" class="style-bubble primary">
                                {{ item.amount }}
                            </span>
                        </aside>
                    </figure>
                </span>
            </template>

            <p v-if="item.dueAt" class="style-title-prefix-list" :class="{error: item.dueAt && item.dueAt <= now}">
                <span>Te betalen tegen {{ formatDate(item.dueAt) }}</span>
                <span v-if="item.dueAt && item.dueAt <= now" class="icon error small" />
            </p>

            <h3 class="style-title-list">
                {{ item.itemTitle }}
            </h3>

            <p v-if="item.itemDescription" class="style-description-small pre-wrap" v-text="item.itemDescription" />

            <p v-if="item.amount === 0" class="style-description-small">
                Annulatie
            </p>

            <p v-else class="style-description-small">
                {{ formatFloat(item.amount) }} x {{ formatPrice(item.unitPrice) }}
            </p>

            <p v-if="item.pricePaid !== 0" class="style-description-small">
                {{ formatPrice(item.pricePaid) }} betaald
            </p>

            <p v-if="item.pricePending !== 0" class="style-description-small">
                {{ formatPrice(item.pricePending) }} in verwerking
            </p>

            <p class="style-description-small">
                {{ formatDate(item.createdAt) }}
            </p>

            <template #right>
                <p v-if="item.dueAt && item.dueAt > now" v-tooltip="'Te betalen tegen ' + formatDate(item.dueAt)" class="style-price-base disabled style-tooltip">
                    ({{ formatPrice(item.priceOpen) }})
                </p>
                <p v-else class="style-price-base">
                    {{ formatPrice(item.priceOpen) }}
                </p>
            </template>
        </STListItem>
    </STList>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { EditBalanceItemView, GlobalEventBus, useContext, useNow } from '@stamhoofd/components';
import { BalanceItemWithPayments, DetailedReceivableBalance, getBalanceItemTypeIcon } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = withDefaults(
    defineProps<{
        item: DetailedReceivableBalance;
        hasWrite?: boolean;
    }>(),
    {
        hasWrite: true,
    },
);
const items = computed(() => props.item.filteredBalanceItems);
const present = usePresent();
const context = useContext();
const now = useNow();

const filteredItems = items;

async function editBalanceItem(balanceItem: BalanceItemWithPayments) {
    if (!props.hasWrite) {
        return;
    }
    const component = new ComponentWithProperties(EditBalanceItemView, {
        balanceItem,
        isNew: false,
        saveHandler: async (patch: AutoEncoderPatchType<BalanceItemWithPayments>) => {
            const arr: PatchableArrayAutoEncoder<BalanceItemWithPayments> = new PatchableArray();
            patch.id = balanceItem.id;
            arr.addPatch(patch);
            await context.value.authenticatedServer.request({
                method: 'PATCH',
                path: '/organization/balance',
                body: arr,
                decoder: new ArrayDecoder(BalanceItemWithPayments),
                shouldRetry: false,
            });
            GlobalEventBus.sendEvent('balanceItemPatch', balanceItem.patch(patch)).catch(console.error);

            // await reload();

            // Also reload member outstanding amount of the whole family
            // await reloadFamily();
        },
    });
    await present({
        components: [component],
        modalDisplayStyle: 'popup',
    });
}

async function createBalanceItem() {
    const balanceItem = BalanceItemWithPayments.create({
        // memberId: props.member.id,
    });

    const component = new ComponentWithProperties(EditBalanceItemView, {
        balanceItem,
        isNew: true,
        saveHandler: async (patch: AutoEncoderPatchType<BalanceItemWithPayments>) => {
            const arr: PatchableArrayAutoEncoder<BalanceItemWithPayments> = new PatchableArray();
            arr.addPut(balanceItem.patch(patch));
            await context.value.authenticatedServer.request({
                method: 'PATCH',
                path: '/organization/balance',
                body: arr,
                decoder: new ArrayDecoder(BalanceItemWithPayments),
                shouldRetry: false,
            });
            GlobalEventBus.sendEvent('balanceItemPatch', balanceItem.patch(patch)).catch(console.error);
            // await reload();
            // Also reload member outstanding amount of the whole family
            // await reloadFamily();
        },
    });
    await present({
        components: [component],
        modalDisplayStyle: 'popup',
    });
}

</script>
