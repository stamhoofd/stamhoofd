<template>
    <ChargeView
        :filter="filter"
        count-endpoint-path="/admin/organizations/count"
        charge-endpoint-path="/admin/charge-organizations"
        :get-description="getDescription"
        :get-confirmation-text="getConfirmationText"
    />
</template>

<script lang="ts" setup>
import ChargeView from '@stamhoofd/components/views/ChargeView.vue';
import type { StamhoofdFilter } from '@stamhoofd/structures';

defineProps<{
    filter: StamhoofdFilter;
}>();

function getDescription({ count }: { count: number }) {
    if (count === 1) {
        return $t('%6l');
    }

    return $t('%6k', { count: count.toString() });
}

function getConfirmationText({ total, count }: { total: string; count: number | null }) {
    return $t('%2h', { total, count: count === null ? '?' : count.toString() });
}
</script>
