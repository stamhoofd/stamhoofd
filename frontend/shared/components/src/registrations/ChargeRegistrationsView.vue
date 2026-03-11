<template>
    <ChargeView
        :filter="filter"
        count-endpoint-path="/registrations/count"
        charge-endpoint-path="/admin/charge-registrations"
        :get-description="getDescription"
        :get-confirmation-text="getConfirmationText"
    />
</template>

<script lang="ts" setup>
import { StamhoofdFilter } from '@stamhoofd/structures';
import ChargeView from '../views/ChargeView.vue';

defineProps<{
    filter: StamhoofdFilter;
}>();

function getDescription({ count }: { count: number }) {
    if (count === 1) {
        return $t('%Cf');
    }

    return $t('%1IN', { count: count.toString() });
}

function getConfirmationText({ total, count }: { total: string; count: number | null }) {
    if (count === 1) {
        return $t('%Ch', { total });
    }

    return $t('%1IO', { total, count: count === null ? '?' : count.toString() });
}
</script>
