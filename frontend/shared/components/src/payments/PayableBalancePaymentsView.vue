<template>
    <div class="st-view">
        <STNavigationBar :title="title" />

        <main>
            <h1>{{ title }}</h1>

            <p v-if="succeededPayments.length === 0" class="info-box">
                {{ $t('%h7') }}
            </p>

            <STList v-else>
                <PaymentRow v-for="payment of succeededPayments" :key="payment.id" :payment="payment" :payments="succeededPayments" />
            </STList>
        </main>
    </div>
</template>

<script setup lang="ts">
import type { DetailedPayableBalance } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { computed } from 'vue';
import PaymentRow from './components/PaymentRow.vue';

const props = defineProps<{
    item: DetailedPayableBalance;
}>();

const title = $t('%1JH')

const succeededPayments = computed(() => {
    return props.item.payments.filter(p => !p.isPending).sort((a, b) => Sorter.byDateValue(a.createdAt, b.createdAt));
});


</script>
