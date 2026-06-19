<template>
    <IconContainer
        :class="{
            gray: method !== PaymentMethod.Unknown && method !== PaymentMethod.Transfer && method !== PaymentMethod.PointOfSale && method !== PaymentMethod.Payconiq,
            white: method === PaymentMethod.Payconiq,
        }"
    >
        <figure>
            <span v-if="method === PaymentMethod.Unknown && type === PaymentType.Reallocation" class="icon wand" />
            <img v-else-if="method === PaymentMethod.Bancontact" src="@stamhoofd/assets/images/partners/icons/bancontact.svg">
            <img v-else-if="method === PaymentMethod.Payconiq" src="@stamhoofd/assets/images/partners/icons/bancontact-pay.svg">
            <img v-else-if="method === PaymentMethod.iDEAL" src="@stamhoofd/assets/images/partners/icons/ideal.svg">
            <template v-else-if="method === PaymentMethod.CreditCard">
                <img src="@stamhoofd/assets/images/partners/icons/mastercard.svg">
            </template>
            <span v-else-if="method === PaymentMethod.PointOfSale" class="icon location" />
            <span v-else class="icon bank" />
        </figure>

        <template #aside>
            <slot name="aside" />
        </template>
    </IconContainer>
</template>

<script setup lang="ts">
import IconContainer from '#icons/IconContainer.vue';
import { PaymentMethod, PaymentType } from '@stamhoofd/structures';

defineProps<{
    method: PaymentMethod;
    type: PaymentType;
}>();
</script>
