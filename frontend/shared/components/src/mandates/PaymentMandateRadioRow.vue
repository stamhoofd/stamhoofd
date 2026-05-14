<template>
    <STGridItem :selectable="true" element-name="label" class="right-stack left-center">
        <template #left>
            <Radio v-model="model" name="choose-mandate" :value="mandate.id" />
        </template>

        <h3 class="style-title-list">
            <span>{{ mandate.name }}</span>
            <span v-if="mandate.isDefault && model === mandate.id" class="style-tag success">{{ $t('Standaard') }}</span>
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

        <slot />

        <template #right>
            <PaymentMandateIcon :mandate="mandate" />
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

const model = defineModel<string | null>({
    required: true,
});

</script>
