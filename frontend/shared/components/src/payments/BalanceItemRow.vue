<template>
    <STGridItem :selectable="canClick" class="price-grid" @click="clickHandler">
        <template #left>
            <BalanceItemIcon :item="item" :is-payable="isPayable" />
        </template>

        <BalanceItemTitleBox :item="item" :is-payable="isPayable" />

        <template v-if="item.status === BalanceItemStatus.Canceled || item.amount" #middleRight>
            <p v-if="item.status === BalanceItemStatus.Canceled" class="style-price-base negative">
                -
            </p>

            <p v-else class="style-price-base">
                {{ formatFloat(item.amount) }}
            </p>
        </template>

        <template #right>
            <p v-if="!item.isDue" v-tooltip="item.dueAt ? ('Te betalen tegen ' + formatDate(item.dueAt)) : undefined" class="style-price-base disabled style-tooltip">
                ({{ formatPrice(item.price) }})
            </p>
            <p v-else class="style-price-base" :class="{negative: item.price < 0}">
                {{ formatPrice(item.price) }}
            </p>

            <p v-if="item.pricePaid !== 0" class="style-price-base negative small">
                - {{ $t('72cf6e0c-87b5-47ae-af91-4112e24c13e1', {price: formatPrice(item.pricePaid )}) }}
            </p>

            <p v-if="item.pricePending !== 0" class="style-price-base disabled negative small">
                - {{ $t('b9a73b33-2a3d-44fa-a326-66cb8b8e1184', {price: formatPrice(item.pricePending)}) }}
            </p>
        </template>
    </STGridItem>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { EditBalanceItemView, GlobalEventBus, STGridItem, useContext } from '@stamhoofd/components';
import { BalanceItem, BalanceItemStatus, BalanceItemWithPayments, GroupedBalanceItems } from '@stamhoofd/structures';
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
            const result = await context.value.authenticatedServer.request({
                method: 'PATCH',
                path: '/organization/balance',
                body: arr,
                decoder: new ArrayDecoder(BalanceItemWithPayments as Decoder<BalanceItemWithPayments>),
                shouldRetry: false,
            });
            if (result.data && result.data.length === 1 && result.data[0].id === balanceItem.id) {
                balanceItem.deepSet(result.data[0])
            } else {
                GlobalEventBus.sendEvent('balanceItemPatch', balanceItem.patch(patch)).catch(console.error);
            }
        },
    });
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: component,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}
</script>
