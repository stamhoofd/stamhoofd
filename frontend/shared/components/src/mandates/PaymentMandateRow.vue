<template>
    <STGridItem class="right-stack left-center">
        <template #left>
            <PaymentMandateIcon :mandate="mandate" />
        </template>

        <p v-if="mandate.isDefault" class="style-title-prefix-list">
            {{ $t('Huidige standaard betaalmethode') }}
        </p>

        <h3 class="style-title-list">
            {{ mandate.name }}
        </h3>
        <p v-if="mandate.description" class="style-description-small">
            {{ mandate.description }}
        </p>

        <p v-if="mandate.bankName" class="style-description-small">
            {{ mandate.bankName }}
        </p>

        <template v-if="mandate.formattedExpiryDate" #middleRight>
            <p class="style-description-small">
                {{ mandate.formattedExpiryDate }}
            </p>
        </template>

        <template #right>
            <slot name="right" />
        </template>
    </STGridItem>
</template>


<script lang="ts" setup>
import type { PaymentMandate } from '@stamhoofd/structures/PaymentMandate.js';
import STGridItem from '../layout/STGridItem.vue';
import PaymentMandateIcon from './PaymentMandateIcon.vue';

defineProps<{
    mandate: PaymentMandate;
}>();

</script>
