<template>
    <STList>
        <STListItem v-for="item in filteredItems" :key="item.id" :selectable="hasWrite" @click="editBalanceItem(item)">
            <template #left>
                <span v-if="item.amount === 0" class="style-amount min-width">
                    <span class="icon disabled gray" />
                </span>
                <span v-else class="style-amount min-width">{{ formatFloat(item.amount) }}</span>
            </template>

            <p v-if="item.itemPrefix" class="style-title-prefix-list">
                {{ item.itemPrefix }}
            </p>

            <h3 class="style-title-list">
                {{ item.itemTitle }}
            </h3>

            <p v-if="item.itemDescription" class="style-description-small">
                {{ item.itemDescription }}
            </p>

            <p class="style-description-small">
                {{ formatDate(item.createdAt) }}
            </p>

            <p v-if="item.amount === 0" class="style-description-small">
                Deze schuld werd verwijderd maar werd al (deels) betaald
            </p>

            <p v-else class="style-description-small">
                {{ formatFloat(item.amount) }} x {{ formatPrice(item.unitPrice) }} te betalen
            </p>

            <p v-if="item.pricePaid !== 0" class="style-description-small">
                {{ formatPrice(item.pricePaid) }} betaald
            </p>

            <p v-if="item.pricePending !== 0" class="style-description-small">
                {{ formatPrice(item.pricePending) }} in verwerking
            </p>

            <template #right>
                <p class="style-price-base">
                    {{ formatPrice(item.priceOpen) }}
                </p>
            </template>
        </STListItem>
    </STList>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, PatchableArrayAutoEncoder, PatchableArray, ArrayDecoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { EditBalanceItemView, GlobalEventBus, useContext } from '@stamhoofd/components';
import { BalanceItemWithPayments, DetailedReceivableBalance } from '@stamhoofd/structures';
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
const items = computed(() => props.item.balanceItems);
const present = usePresent();
const context = useContext();

const filteredItems = computed(() => {
    return items.value.filter(i => BalanceItemWithPayments.getOutstandingBalance([i]).priceOpen !== 0);
});

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
