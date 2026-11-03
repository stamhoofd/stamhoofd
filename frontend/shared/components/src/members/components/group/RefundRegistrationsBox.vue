<template>
    <div v-if="categories.length > 0" class="container">
        <hr><h2>{{ $t('Terugbetalingen') }}</h2>

        <p v-if="hasPendingPayments" class="warning-box">
            {{ $t('Sommige betalingen staan nog \'in verwerking\'. Deze betalingen blijven in verwerking staan na deze actie. Verwerk deze betalingen daarom best eerst (markeer ze als betaald of annuleer ze) voor je verdergaat.') }}
        </p>

        <p v-if="hasPaidByOrganization" class="info-box">
            {{ $t('%8r') }}
        </p>

        <div class="st-list-box">
            <STList>
                <RefundCategoryRow v-for="category of categories" :key="category.type" :category="category" />
            </STList>
        </div>
    </div>
</template>

<script setup lang="ts">
import STList from '#layout/STList.vue';
import type { RegisterCheckout } from '@stamhoofd/structures';
import { computed } from 'vue';
import RefundCategoryRow from './RefundCategoryRow.vue';
import { getRefundCategories } from './refundCategories.ts';

const props = defineProps<{
    checkout: RegisterCheckout;
}>();

const categories = computed(() => getRefundCategories(props.checkout.cart.deleteRegistrations));

const hasPendingPayments = computed(() => props.checkout.cart.deleteRegistrations.some(item => item.registration.registration.balances.some(balance => balance.amountPending > 0)));
const hasPaidByOrganization = computed(() => props.checkout.cart.deleteRegistrations.some(item => item.registration.registration.payingOrganizationId && item.registration.registration.balances.some(balance => balance.amountOpen > 0 || balance.amountPaid > 0 || balance.amountPending > 0)));
</script>
