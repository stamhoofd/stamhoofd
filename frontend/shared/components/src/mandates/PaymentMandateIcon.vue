<template>
    <IconContainer :class="mandate.status === PaymentMandateStatus.Invalid ? 'error' : (mandate.isDefault && mandate.status === PaymentMandateStatus.Valid ? 'gray' : 'gray')">
        <figure>
            <template v-if="mandate.type === PaymentMandateType.CreditCard">
                <img v-if="mandate.details.brand === 'Mastercard'" src="@stamhoofd/assets/images/partners/icons/mastercard.svg">
                <img v-else-if="mandate.details.brand === 'Visa'" src="@stamhoofd/assets/images/partners/icons/visa.svg">
                <span v-else class="icon card" />
            </template>
            <span v-else class="icon bank" />
        </figure>

        <template #aside>
            <span v-if="mandate.isDefault && mandate.status === PaymentMandateStatus.Valid" v-tooltip="$t('%1QF')" class="icon small success green" />
            <span v-if="mandate.status === PaymentMandateStatus.Invalid" v-tooltip="$t('%1S9')" class="icon error red small" />
            <span v-else-if="mandate.status === PaymentMandateStatus.Pending" v-tooltip="$t('%1SQ')" class="icon clock small gray" />
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
