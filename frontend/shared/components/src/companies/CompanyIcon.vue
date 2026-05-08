<template>
    <IconContainer v-tooltip="$t('Geen ondernemingsnummer (feitelijke vereniging). Je kan kosten niet in de boekhouding van je VZW inbrengen als je ondernemingsnummer niet op facturen staat.')" class="gray" :icon="company.VATNumber || company.companyNumber ? 'company' : 'team'" :aside-icon="company.VATNumber || company.companyNumber ? '' : 'warning yellow stroke dark'" />
</template>

<script lang="ts" setup>
import IconContainer from '#icons/IconContainer.vue';
import type { Company } from '@stamhoofd/structures/Company.js';

defineProps<{
    company: Company;
}>()
</script>
