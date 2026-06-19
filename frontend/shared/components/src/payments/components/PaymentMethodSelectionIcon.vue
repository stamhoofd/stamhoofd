<template>
    <img v-if="method === PaymentMethod.Payconiq" height="48" width="108" src="@stamhoofd/assets/images/partners/icons/bancontact-pay-wero.png" class="bancontact-pay-icon">
    <img v-else-if="method === PaymentMethod.Bancontact" src="@stamhoofd/assets/images/partners/icons/bancontact.svg">
    <img v-else-if="method === PaymentMethod.iDEAL" src="@stamhoofd/assets/images/partners/icons/ideal.svg">
    <template v-else-if="method === PaymentMethod.CreditCard">
        <img src="@stamhoofd/assets/images/partners/icons/mastercard.svg">
        <img src="@stamhoofd/assets/images/partners/icons/visa.svg">
    </template>
    <span v-else-if="method === PaymentMethod.PointOfSale" class="icon location" />
    <span v-else class="icon bank" />
</template>

<script setup lang="ts">
import { PaymentMethod } from '@stamhoofd/structures';

defineProps<{
    method: PaymentMethod;
}>();
</script>

<style>
.bancontact-pay-icon {
    width: 108px;
    height: 48px;
}

@media (max-width: 400px) {
    .bancontact-pay-icon {
        width: 54px;
        height: 24px;
    }
}
</style>
