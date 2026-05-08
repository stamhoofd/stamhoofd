<template>
    <IconContainer :class="mandate.status === PaymentMandateStatus.Invalid ? 'error' : (mandate.isDefault ? '' : 'gray')">
        <figure>
            <template v-if="mandate.type === PaymentMandateType.CreditCard">
                <img v-if="mandate.details.brand === 'Mastercard'" src="@stamhoofd/assets/images/partners/icons/mastercard.svg">
                <img v-else-if="mandate.details.brand === 'Visa'" src="@stamhoofd/assets/images/partners/icons/visa.svg">
                <span v-else class="icon card" />
            </template>
            <span v-else class="icon bank" />
        </figure>

        <template #aside>
            <span v-if="mandate.status === PaymentMandateStatus.Invalid" v-tooltip="$t('Ongeldig')" class="icon error red small" />
            <span v-else-if="mandate.status === PaymentMandateStatus.Pending" v-tooltip="$t('In afwachting van verificatie')" class="icon clock small gray" />
            <span v-else-if="mandate.isDefault" v-tooltip="$t('Standaard betaalkaart')" class="icon success small primary" />
        </template>
    </IconContainer>
</template>

<script lang="ts" setup>
import IconContainer from '#icons/IconContainer.vue';
import type { PaymentMandate } from '@stamhoofd/structures/PaymentMandate.js';
import { PaymentMandateStatus, PaymentMandateType } from '@stamhoofd/structures/PaymentMandate.js';

defineProps<{
    mandate: PaymentMandate;
}>()
</script>
