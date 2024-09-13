<template>
    <figure class="style-image-with-icon gray">
        <figure>
            <img v-if="method === PaymentMethod.Bancontact" src="@stamhoofd/assets/images/partners/icons/bancontact.svg">
            <img v-else-if="method === PaymentMethod.iDEAL" src="@stamhoofd/assets/images/partners/icons/ideal.svg">
            <span v-else-if="method === PaymentMethod.CreditCard" class="icon card" />
            <span v-else-if="method === PaymentMethod.PointOfSale" class="icon location" />
            <span v-else class="icon bank" />
        </figure>
        <aside>
            <slot />
        </aside>
    </figure>
</template>

<script setup lang="ts">
import { PaymentMethod } from '@stamhoofd/structures';

defineProps<{
    method: PaymentMethod;
}>();
</script>
