<template>
    <ChargeView :filter="filter" count-endpoint-path="/members/count" charge-endpoint-path="/admin/charge-members" :get-description="getDescription" :get-confirmation-text="getConfirmationText" />
</template>

<script lang="ts" setup>
import ChargeView from '@stamhoofd/components/src/views/ChargeView.vue';
import { StamhoofdFilter } from '@stamhoofd/structures';

defineProps<{ filter: StamhoofdFilter }>();

function getDescription({ count }: { count: number }) {
    if (count === 1) {
        return $t('Reken een bedrag aan aan het geselecteerde lid.');
    }

    return $t('Reken een bedrag aan aan de {count} geselecteerde leden.', { count: count.toString() });
}

function getConfirmationText({ total, count }: { total: string; count: number | null }) {
    if (count === 1) {
        return $t('Weet je zeker dat je {total} wilt aanrekenen aan 1 lid?', { total });
    }

    return $t('Weet je zeker dat je {total} wilt aanrekenen aan {count} leden?', { total, count: count === null ? '?' : count.toString() });
}
</script>
