<template>
    <STListItem class="right-stack left-center">
        <template #left>
            <slot name="left">
                <CompanyIcon :company="company" :is-default="isDefault" />
            </slot>
        </template>

        <h3 class="style-title-list">
            {{ company.name || 'Naamloos' }}
            <span v-if="isDefault" class="style-tag success">{{ $t('Standaard') }}</span>
        </h3>

        <p v-if="company.VATNumber" class="style-description-small">
            {{ company.VATNumber }} {{ $t('%Gn') }}
        </p>
        <p v-else-if="company.companyNumber" class="style-description-small">
            {{ company.companyNumber }}
        </p>
        <p v-else class="style-description-small">
            <span>{{ $t('Geen ondernemingsnummer (feitelijke vereniging)') }}</span>
            <span v-if="isDefault" v-tooltip="$t('Er zal geen ondernemingsnummer op facturen vermeld worden. Controleer goed of je geen ondernemingsnummer hebt en of je via die weg facturen wilt ontvangen.')" class="icon text-size warning" />
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
            <slot name="right">
                <CompanyIcon v-if="$slots.left" :company="company" :is-default="isDefault" />
            </slot>
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
