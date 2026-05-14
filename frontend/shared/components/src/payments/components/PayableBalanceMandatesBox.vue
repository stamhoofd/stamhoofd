<template>
    <PaymentMandatesBox :paying-organization-id="organization.id" :selling-organization-id="props.item.organization.id" />
</template>

<script setup lang="ts">
import { useRequiredOrganization } from '#hooks/useOrganization';
import PaymentMandatesBox from '#mandates/PaymentMandatesBox.vue';
import type { DetailedPayableBalance } from '@stamhoofd/structures';

const props = defineProps<{
    item: DetailedPayableBalance;
}>();

const organization = useRequiredOrganization()
</script>
