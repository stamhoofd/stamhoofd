<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`Openstaand bedrag`)" />

        <main>
            <h1>{{ $t('%vX', {organization: item.organization.name}) }}</h1>

            <PayableBalanceTable :item="item" />
        </main>
    </div>
</template>

<script setup lang="ts">
import type { DetailedPayableBalance } from '@stamhoofd/structures';
import PayableBalanceTable from './PayableBalanceTable.vue';

defineProps<{
    item: DetailedPayableBalance;
}>();

</script>
