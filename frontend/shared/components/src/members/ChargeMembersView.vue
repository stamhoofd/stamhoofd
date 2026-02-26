<template>
    <ChargeView :filter="filter" count-endpoint-path="/members/count" charge-endpoint-path="/admin/charge-members" :create-body="createBody" :get-description="getDescription" :get-confirmation-text="getConfirmationText" :show-due-at="$feature('member-trials')" :show-created-at="true" :organization="organization" :due-at-description="$t('15b6f0c8-6287-4b4d-bf34-4da2f4a0e575')" />
</template>

<script lang="ts" setup>
import { ChargeMembersRequest, Organization, StamhoofdFilter } from '@stamhoofd/structures';
import ChargeView from '../views/ChargeView.vue';

defineProps<{ filter: StamhoofdFilter; organization: Organization }>();

function createBody(args: {
    price: number;
    description: string;
    amount: number | null;
    dueAt: Date | null;
    createdAt: Date | null; }): ChargeMembersRequest {
    return ChargeMembersRequest.create(args);
}

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
