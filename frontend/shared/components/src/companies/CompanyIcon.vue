<template>
    <IconContainer :class="isDefault ? 'gray' : 'gray'" :icon="company.VATNumber || company.companyNumber ? 'company' : 'team'" :aside-icon="(isDefault ? 'success green' : '')" />
</template>

<script lang="ts" setup>
import IconContainer from '#icons/IconContainer.vue';
import type { Company } from '@stamhoofd/structures/Company.js';

withDefaults(
    defineProps<{
        company: Company;
        isDefault?: boolean
    }>(), {
        isDefault: false
    }
)
</script>
