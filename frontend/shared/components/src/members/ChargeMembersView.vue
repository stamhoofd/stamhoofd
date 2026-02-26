<template>
    <ChargeView
        :filter="filter"
        count-endpoint-path="/members/count"
        charge-endpoint-path="/admin/charge-members"
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
        return $t('04606184-d9d9-4cb0-a98a-a4457f1d0293');
    }

    return $t('fce1ee6b-8dfc-43f6-b34a-5f9037326e76', { count: count.toString() });
}

function getConfirmationText({ total, count }: { total: string; count: number | null }) {
    if (count === 1) {
        return $t('173a325e-049d-4ce1-a220-e75c37e99b01', { total });
    }

    return $t('459ab829-65a9-4a55-8349-f8ec381fe9b3', { total, count: count === null ? '?' : count.toString() });
}
</script>
