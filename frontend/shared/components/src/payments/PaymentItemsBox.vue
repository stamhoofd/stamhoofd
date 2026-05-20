<template>
    <STGrid>
        <STGridItem v-for="item in sortedItems" :key="item.id" :selectable="canWrite" class="price-grid" @click="editBalanceItem(item.balanceItem)">
            <template #left>
                <BalanceItemIcon :item="item.balanceItem" :is-payable="false" />
            </template>

            <BalanceItemTitleBox :item="item.balanceItem" :is-payable="false" :price="item.price" :payment-status="payment.status" />

            <p v-if="item.quantity !== 1" class="style-description-small">
                {{ $t('%1J3', {price: formatPrice(item.unitPrice)}) }}
            </p>

            <template #middleRight>
                <span class="style-price-base" :class="{negative: item.quantity < 0}">{{ formatFloat(item.quantity) }}</span>
            </template>

            <template #right>
                <span class="style-price-base" :class="{negative: item.price < 0}">{{ item.price === 0 ? $t('%1Mn') : formatPrice(item.price) }}</span>
            </template>
        </STGridItem>
    </STGrid>

    <PriceBreakdownBox :price-breakdown="[{name: $t('%2U'), price: payment.price}]" />
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import STGrid from '@stamhoofd/components/layout/STGrid.vue';
import STGridItem from '@stamhoofd/components/layout/STGridItem.vue';
import PriceBreakdownBox from '@stamhoofd/components/views/PriceBreakdownBox.vue';
import type { BalanceItem, PaymentGeneral } from '@stamhoofd/structures';
import { BalanceItemWithPayments } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { EditBalanceItemView } from '.';
import { GlobalEventBus } from '../EventBus';
import { useContext } from '../hooks/useContext.js';
import BalanceItemIcon from './BalanceItemIcon.vue';
import BalanceItemTitleBox from './BalanceItemTitleBox.vue';

const props = withDefaults(
    defineProps<{
        payment: PaymentGeneral;
        canWrite?: boolean
    }>(), {
        canWrite: false
    },
);

const context = useContext()
const present = usePresent()
const sortedItems = computed(() => {
    return props.payment.balanceItemPayments.slice().sort((a, b) => {
        return Sorter.stack(
            Sorter.byNumberValue(a.price, b.price),
            Sorter.byStringValue(a.itemDescription ?? a.balanceItem.description, b.itemDescription ?? b.balanceItem.description),
        );
    });
});

async function editBalanceItem(balanceItem: BalanceItem) {
    if (!props.canWrite) {
        return;
    }
    const component = new ComponentWithProperties(EditBalanceItemView, {
        balanceItem,
        isNew: false
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
