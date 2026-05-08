<template>
    <STListItem class="right-stack left-center">
        <template #left>
            <slot name="left">
                <CompanyIcon :company="company" />
            </slot>
        </template>

        <h3 class="style-title-list">
            {{ company.name || 'Naamloos' }}
        </h3>

        <p v-if="company.VATNumber" class="style-description-small">
            {{ company.VATNumber }} {{ $t('%Gn') }}
        </p>
        <p v-else-if="company.companyNumber" class="style-description-small">
            {{ company.companyNumber }}
        </p>
        <p v-else class="style-description-small">
            {{ $t('%1CH') }}
        </p>

        <p v-if="company.address" class="style-description-small">
            {{ company.address.shortString() }}
        </p>
        <p v-else class="style-description-small">
            <span class="style-tag error">{{ $t('%gE') }}</span>
        </p>

        <p v-if="company.administrationEmail" class="style-description-small">
            {{ company.administrationEmail }}
        </p>

        <template #right>
            <slot name="right" />
        </template>
    </STListItem>
</template>


<script lang="ts" setup>
import type { Company } from '@stamhoofd/structures/Company.js';
import STListItem from '../layout/STListItem.vue';
import CompanyIcon from './CompanyIcon.vue';

withDefaults(
    defineProps<{
        company: Company;
        isDefault?: boolean
    }>(),
    {
        isDefault: false
    }
);

</script>
