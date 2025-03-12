<template>
    <ChargeView :filter="filter" count-endpoint-path="/members/count" charge-endpoint-path="/admin/charge-members" :create-body="createBody" :get-description="getDescription" :get-confirmation-text="getConfirmationText" modal-display-style="popup" :show-due-at="true" :show-created-at="true" />
</template>

<script lang="ts" setup>
import ChargeView from '@stamhoofd/components/src/views/ChargeView.vue';
import { ChargeMembersRequest, StamhoofdFilter } from '@stamhoofd/structures';

defineProps<{ filter: StamhoofdFilter }>();

function createBody(args: { organizationId: string;
    price: number;
    description: string;
    amount: number | null;
    dueAt: Date | null;
    createdAt: Date | null; }): ChargeMembersRequest {
    return ChargeMembersRequest.create(args);
}

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
