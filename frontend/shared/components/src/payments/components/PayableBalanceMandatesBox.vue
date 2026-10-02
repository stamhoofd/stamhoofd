<template>
    <PaymentMandatesBox :paying-organization-id="organization.id" :selling-organization-id="props.item.organization.id" :can-manage="auth.hasAccessRight(AccessRight.OrganizationFinanceDirector)" />
</template>

<script setup lang="ts">
import { useAuth } from '#hooks/useAuth.ts';
import { useRequiredOrganization } from '#hooks/useOrganization';
import PaymentMandatesBox from '#mandates/PaymentMandatesBox.vue';
import type { DetailedPayableBalance } from '@stamhoofd/structures';
import { AccessRight } from '@stamhoofd/structures';

const props = defineProps<{
    item: DetailedPayableBalance;
}>();

const organization = useRequiredOrganization()
const auth = useAuth();
</script>
