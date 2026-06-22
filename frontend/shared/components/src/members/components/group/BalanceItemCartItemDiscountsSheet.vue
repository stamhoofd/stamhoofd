<template>
    <div class="st-view">
        <STNavigationBar v-if="!popup" :title="$t('%1Xl')" />

        <main>
            <STList>
                <BalanceItemCartItemDiscountRow v-for="item of items" :key="item.id" :item="item" />
            </STList>
        </main>
    </div>
</template>

<script lang="ts" setup>
import STList from '#layout/STList.vue';
import { usePopup } from '@simonbackx/vue-app-navigation';
import type { BalanceItemCartItem } from '@stamhoofd/structures';
import BalanceItemCartItemDiscountRow from './BalanceItemCartItemDiscountRow.vue';

withDefaults(
    defineProps<{
        items: BalanceItemCartItem[];
    }>(), {
    },
);

const popup = usePopup();

</script>
