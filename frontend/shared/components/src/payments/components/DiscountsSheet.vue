<template>
    <div class="st-view">
        <STNavigationBar v-if="!popup" :title="$t('%1Xl')" />

        <main>
            <STGrid>
                <BalanceItemRow v-for="item of items" :key="item.id" :item="item" :is-payable="true" />
            </STGrid>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { usePopup } from '@simonbackx/vue-app-navigation';
import STGrid from '@stamhoofd/components/layout/STGrid.vue';
import BalanceItemRow from '@stamhoofd/components/payments/BalanceItemRow.vue';
import type { BalanceItem } from '@stamhoofd/structures';

withDefaults(
    defineProps<{
        items: BalanceItem[];
    }>(), {
    },
);

const popup = usePopup();

</script>
