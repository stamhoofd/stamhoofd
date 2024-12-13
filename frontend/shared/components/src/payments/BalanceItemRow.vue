<template>
    <STListItem :selectable="canClick" @click="clickHandler">
        <template #left>
            <BalanceItemIcon :item="item" :is-payable="isPayable" />
        </template>

        <BalanceItemTitleBox :item="item" :is-payable="isPayable" />

        <template #right>
            <p v-if="!item.isDue" v-tooltip="item.dueAt ? ('Te betalen tegen ' + formatDate(item.dueAt)) : undefined" class="style-price-base disabled style-tooltip">
                ({{ formatPrice(item.priceOpen) }})
            </p>
            <p v-else class="style-price-base" :class="{negative: item.priceOpen < 0}">
                {{ formatPrice(item.priceOpen) }}
            </p>
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { EditBalanceItemView, GlobalEventBus, useContext } from '@stamhoofd/components';
import { BalanceItem, BalanceItemWithPayments, GroupedBalanceItems } from '@stamhoofd/structures';
import { computed } from 'vue';
import BalanceItemIcon from './BalanceItemIcon.vue';
import BalanceItemTitleBox from './BalanceItemTitleBox.vue';

const props = withDefaults(
    defineProps<{
        item: BalanceItem | GroupedBalanceItems;
        isPayable: boolean;
        hasWrite?: boolean;
    }>(),
    {
        hasWrite: true,
    },
);

const context = useContext();
const present = usePresent();

const canClick = computed(() => {
    return props.hasWrite && !props.isPayable && props.item instanceof BalanceItem;
});

async function clickHandler() {
    if (!canClick.value) {
        return;
    }

    if (props.item instanceof BalanceItem) {
        await editBalanceItem(props.item);
    }

    // todo: implement for GroupedBalanceItems
}

async function editBalanceItem(balanceItem: BalanceItem) {
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
        },
    });
    await present({
        components: [component],
        modalDisplayStyle: 'popup',
    });
}
</script>
