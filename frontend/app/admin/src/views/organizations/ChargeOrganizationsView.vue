<template>
    <ChargeView :filter="filter" count-endpoint-path="/admin/organizations/count" charge-endpoint-path="/admin/charge-organizations" :get-description="getDescription" :get-confirmation-text="getConfirmationText" :create-body="createBody" :show-created-at="true" :show-due-at="true" />
</template>

<script lang="ts" setup>
import ChargeView from '@stamhoofd/components/src/views/ChargeView.vue';
import { ChargeOrganizationsRequest, StamhoofdFilter } from '@stamhoofd/structures';

defineProps<{ filter: StamhoofdFilter }>();

function createBody(args: { organizationId: string;
    price: number;
    description: string;
    amount: number | null;
    dueAt: Date | null;
    createdAt: Date | null; }): ChargeOrganizationsRequest {
    return ChargeOrganizationsRequest.create(args);
}

function getDescription({ count }: { count: number }) {
    if (count === 1) {
        return $t('51c27c5e-c2be-441b-a571-7bf573ee6848');
    }

    return $t('88119ffc-b692-4222-8217-75a9fa64f675', { count: count.toString() });
}

function getConfirmationText({ total, count }: { total: string; count: number | null }) {
    return $t('9305016a-babf-4606-af6c-e8ef9f2ba91e', { total, count: count === null ? '?' : count.toString() });
}
</script>
