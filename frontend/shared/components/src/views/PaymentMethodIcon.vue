<template>
    <img v-if="method === PaymentMethod.Payconiq && isWero" height="48" width="108" src="@stamhoofd/assets/images/partners/icons/bancontact-pay.png" class="bancontact-pay-icon">
    <figure v-else class="style-image-with-icon" :class="{white: method !== PaymentMethod.Unknown && method !== PaymentMethod.Transfer && method !== PaymentMethod.PointOfSale, dual: method === PaymentMethod.CreditCard || method === PaymentMethod.Payconiq && isWero}">
        <figure>
            <img v-if="method === PaymentMethod.Bancontact" src="@stamhoofd/assets/images/partners/icons/bancontact.svg">
            <img v-else-if="method === PaymentMethod.Payconiq" src="@stamhoofd/assets/images/partners/icons/payconiq.svg">
            <img v-else-if="method === PaymentMethod.iDEAL" src="@stamhoofd/assets/images/partners/icons/ideal.svg">
            <template v-else-if="method === PaymentMethod.CreditCard">
                <img src="@stamhoofd/assets/images/partners/icons/mastercard.svg">
                <img src="@stamhoofd/assets/images/partners/icons/visa.svg">
            </template>
            <span v-else-if="method === PaymentMethod.PointOfSale" class="icon location" />
            <span v-else class="icon bank" />
        </figure>
        <aside>
            <slot />
        </aside>
    </figure>
</template>

<script setup lang="ts">
import { isBancontactPay,PaymentMethod } from '@stamhoofd/structures';

defineProps<{
    method: PaymentMethod;
}>();

const isWero = isBancontactPay();

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
