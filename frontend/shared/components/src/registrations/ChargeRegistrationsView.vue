<template>
    <ChargeView :filter="filter" count-endpoint-path="/registrations/count" charge-endpoint-path="/admin/charge-registrations" :create-body="createBody" :get-description="getDescription" :get-confirmation-text="getConfirmationText" modal-display-style="popup" :show-due-at="$feature('member-trials')" :show-created-at="true" :organization="organization" :due-at-description="$t('15b6f0c8-6287-4b4d-bf34-4da2f4a0e575')" />
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

// todo
function getDescription({ count }: { count: number }) {
    if (count === 1) {
        return $t('04606184-d9d9-4cb0-a98a-a4457f1d0293');
    }

    return $t('0dd37ff6-b713-4ca3-a287-62cea3b6bcc6', { count: count.toString() });
}

// todo
function getConfirmationText({ total, count }: { total: string; count: number | null }) {
    if (count === 1) {
        return $t('173a325e-049d-4ce1-a220-e75c37e99b01', { total });
    }

    return $t('c380d4e3-10cf-4649-89fb-6fa86aa93f5a', { total, count: count === null ? '?' : count.toString() });
}
</script>
